from contextlib import contextmanager
from types import SimpleNamespace
import pytest
from fastapi.testclient import TestClient
from structural_engine.member_forces.connector import create_app
from structural_engine.member_forces.sap2000 import ExtractionRequest, Sap2000, SapError


class Names:
    def __init__(self, names):
        self.names = names
    def GetNameList(self):
        return len(self.names), self.names, 0


class CaseNames(Names):
    def GetTypeOAPI(self, name):
        return 1, 0, 0


class ComboNames(Names):
    # cCombo exposes GetTypeOAPI(Name, ref int ComboType), not GetTypeCombo.
    # cLoadCases.GetTypeOAPI has a different output signature.
    def GetTypeOAPI(self, name):
        return (1 if name == 'ENV' else 0), 0
    def GetCaseList(self, name):
        return 1, [0], ['DEAD'], [1.0], 0


class FakeModel:
    def __init__(self):
        self.units = 9
        self.case_selected = {'DEAD': True}
        self.combo_selected = {'ULS': False, 'ENV': True}
        self.fail = False
        self.restore_fail = False
        self.locked = True
        self.FrameObj = Names(['F1', 'F2'])
        self.FrameObj.GetSection = lambda name: ('I300' if name == 'F1' else 'NP1', '', 0)
        self.PropFrame = SimpleNamespace(GetTypeOAPI=lambda name: (99 if name == 'NP1' else 1, 0),
            GetNonPrismatic=lambda name: (2,['I300','I500'],['I500','I300'],[.5,.5],[1,1],[1,1],[1,1],0,'','',0))
        self.LoadCases = CaseNames(['DEAD'])
        self.RespCombo = ComboNames(['ULS', 'ENV'])
        self.Analyze = SimpleNamespace(GetCaseStatus=lambda: (1, ['DEAD'], [4], 0))
        self.SelectObj = SimpleNamespace(GetSelected=lambda: (3, [2, 1, 2], ['F1', 'joint1', 'F2'], 0))
        self.Results = SimpleNamespace(Setup=self, FrameForce=self.force)
    def GetVersion(self):
        return '26.2.0', 26.2, 0
    def GetPresentUnits(self):
        return self.units
    def SetPresentUnits(self, value):
        if self.restore_fail and value == 9:
            return 1
        self.units = value
        return 0
    def GetModelIsLocked(self):
        return self.locked
    def GetModelFilename(self):
        return 'model.sdb'
    def GetCaseSelectedForOutput(self, name):
        return self.case_selected[name], 0
    def GetComboSelectedForOutput(self, name):
        return self.combo_selected[name], 0
    def SetCaseSelectedForOutput(self, name, value):
        self.case_selected[name] = value
        return 0
    def SetComboSelectedForOutput(self, name, value):
        self.combo_selected[name] = value
        return 0
    def DeselectAllCasesAndCombosForOutput(self):
        self.case_selected = dict.fromkeys(self.case_selected, False)
        self.combo_selected = dict.fromkeys(self.combo_selected, False)
        return 0
    def force(self, frame, item_type):
        assert self.units == 6 and item_type == 0
        if self.fail:
            return (*([None]*14), 1)
        name = next(n for n, v in {**self.case_selected, **self.combo_selected}.items() if v)
        return (2, [frame]*2, [0.,4.], [frame+'-1']*2, [0.,4.], [name]*2, ['', ''], [0.,0.],
                [-10.,-20.], [1.,2.], [3.,4.], [5.,6.], [7.,8.], [9.,10.], 0)


def request(**kwargs):
    return ExtractionRequest(output_cases=[{'name':'ULS','kind':'combination'}], **kwargs)


def test_extracts_selected_frames_full_vector_and_restores_state():
    model = FakeModel()
    result = Sap2000(model).extract(request())
    assert len(result.rows) == 4 and {r.frame for r in result.rows} == {'F1','F2'}
    assert result.units == 'kN_m_C'
    assert result.rows[1].station == 4 and result.rows[1].M3 == 10
    assert result.rows[0].concurrency == 'concurrent'
    assert model.units == 9 and model.case_selected == {'DEAD':True}
    assert model.combo_selected == {'ULS':False,'ENV':True}


def test_explicit_frames_and_separate_outputs():
    model = FakeModel()
    result = Sap2000(model).extract(ExtractionRequest(frames=['F2'], output_cases=[
        {'name':'DEAD','kind':'case'}, {'name':'ENV','kind':'combination'}]))
    assert [r.output_case for r in result.rows] == ['DEAD','DEAD','ENV','ENV']
    assert result.rows[-1].concurrency == 'nonconcurrent'
    assert all(r.frame == 'F2' for r in result.rows)


def test_restoration_after_com_failure_and_report_restore_failure():
    model = FakeModel(); model.fail = True
    with pytest.raises(SapError):
        Sap2000(model).extract(request())
    assert model.units == 9 and model.case_selected['DEAD'] and model.combo_selected['ENV']
    model = FakeModel(); model.restore_fail = True
    with pytest.raises(SapError, match='restore'):
        Sap2000(model).extract(request())


def test_invalid_model_frame_and_selection_do_not_modify_state():
    model = FakeModel(); model.locked = False
    with pytest.raises(SapError, match='analyzed'):
        Sap2000(model).extract(request())
    model.locked = True
    with pytest.raises(SapError, match='unknown'):
        Sap2000(model).extract(request(frames=['MISSING']))
    model.SelectObj.GetSelected = lambda: (0, [], [], 0)
    with pytest.raises(SapError, match='Select'):
        Sap2000(model).extract(request())
    assert model.units == 9 and model.combo_selected['ENV']


def test_combo_constituent_status_and_spectrum_classification():
    model = FakeModel()
    model.Analyze.GetCaseStatus = lambda: (1, ['DEAD'], [1], 0)
    missing = Sap2000(model).extract(request())
    assert missing.rows == [] and missing.missing_results[0].result is None
    assert model.units == 9
    model = FakeModel()
    model.LoadCases.GetTypeOAPI = lambda name: (4, 0, 0)
    assert Sap2000(model).extract(request()).rows[0].concurrency == 'nonconcurrent'


def test_missing_results_and_malformed_arrays_restore_state():
    model = FakeModel()
    model.Results.FrameForce = lambda *args: (0, *([[]]*13), 0)
    empty = Sap2000(model).extract(request())
    assert not empty.rows and len(empty.missing_results) == 2
    model.Results.FrameForce = lambda *args: (2, *([[]]*13), 0)
    with pytest.raises(SapError, match='array lengths'):
        Sap2000(model).extract(request())
    assert model.units == 9


def test_local_bearer_auth_and_routes():
    model = FakeModel()
    @contextmanager
    def gateway():
        yield Sap2000(model)
    client = TestClient(create_app('x'*32, gateway))
    assert client.get('/API_IF_SAP26.2.0_V1/output-cases').status_code == 401
    headers = {'Authorization':'Bearer '+'x'*32}
    cases = client.get('/API_IF_SAP26.2.0_V1/output-cases', headers=headers)
    assert cases.status_code == 200 and len(cases.json()['data']) == 3
    assert client.get('/API_IF_SAP26.2.0_V1/selection', headers=headers).json()['frames'] == ['F1','F2']
    result = client.post('/API_IF_SAP26.2.0_V1/frame-forces', headers=headers, json=request().model_dump())
    assert result.status_code == 200 and len(result.json()['rows']) == 4
    assert client.get('/API_IF_SAP26.2.0_V1/selection', headers={**headers,'Host':'evil.example'}).status_code == 400
    assert client.post('/API_IF_SAP26.2.0_V1/extremes', json={}).status_code == 401
    with pytest.raises(RuntimeError):
        create_app('short')


def test_connector_rejects_other_sap_versions_and_has_no_cb_endpoint():
    model = FakeModel()
    @contextmanager
    def gateway():
        yield Sap2000(model)
    client = TestClient(create_app('x'*32, gateway))
    headers = {'Authorization': 'Bearer '+'x'*32}
    assert client.app.title == 'API_IF_SAP26.2.0_V1'
    assert client.post('/API_IF_SAP26.2.0_V1/cb', headers=headers, json={}).status_code == 404
    model.GetVersion = lambda: ('26.1.0', 26.1, 0)
    assert client.get('/API_IF_SAP26.2.0_V1/output-cases', headers=headers).status_code == 503
    assert model.units == 9


def test_model_identity_panel_and_authentication_boundaries():
    model = FakeModel()
    @contextmanager
    def gateway():
        yield Sap2000(model)
    client = TestClient(create_app('x'*32, gateway))
    panel = client.get('/')
    assert panel.status_code == 200 and 'Xuất nội lực cấu kiện' in panel.text
    assert "frame-ancestors 'none'" in panel.headers['content-security-policy']
    assert 'x'*32 not in panel.text
    assert client.get('/API_IF_SAP26.2.0_V1/model').status_code == 401
    headers = {'Authorization': 'Bearer '+'x'*32}
    data = client.get('/API_IF_SAP26.2.0_V1/model', headers=headers).json()
    assert data['model'] == data['filename'] == 'model.sdb'
    assert data['sap2000_version'] == '26.2.0' and data['locked'] is True
    model.GetModelFilename = lambda: r'C:\Work\Tower.sdb'
    assert Sap2000(model).model_info()['filename'] == 'Tower.sdb'
    result = client.post('/API_IF_SAP26.2.0_V1/frame-forces', headers=headers,
        json={**request().model_dump(), 'expected_model':'previous.sdb'})
    assert result.status_code == 503 and 'changed' in result.json()['detail']
    assert model.units == 9


def test_model_change_during_extraction_discards_results_and_restores_state():
    model = FakeModel()
    force = model.Results.FrameForce
    def switched(*args):
        result = force(*args)
        model.GetModelFilename = lambda: 'different.sdb'
        return result
    model.Results.FrameForce = switched
    with pytest.raises(SapError, match='changed during'):
        Sap2000(model).extract(request(expected_model='model.sdb'))
    assert model.units == 9 and model.case_selected['DEAD']


def test_com_diagnostics_report_stage_and_hresult_without_exception_details():
    from structural_engine.member_forces.sap2000 import com_operation
    class FakeComError(Exception):
        hresult = -2147221021
    def fail():
        raise FakeComError('private exception details')
    with pytest.raises(SapError) as error:
        com_operation('SAP2000_ATTACH', fail)
    assert 'SAP2000_ATTACH' in str(error.value)
    assert '0x800401E3' in str(error.value)
    assert 'private exception details' not in str(error.value)


def test_multiple_cases_and_combos_across_multiple_frames_restore_all_state():
    model = FakeModel()
    result = Sap2000(model).extract(ExtractionRequest(output_cases=[
        {'name':'DEAD','kind':'case'}, {'name':'ULS','kind':'combination'}, {'name':'ENV','kind':'combination'}]))
    assert len(result.rows) == 12
    assert {r.frame for r in result.rows} == {'F1','F2'}
    assert {r.case_kind for r in result.rows} == {'case','combination'}
    assert {r.concurrency for r in result.rows if r.output_case == 'ULS'} == {'concurrent'}
    assert {r.concurrency for r in result.rows if r.output_case == 'ENV'} == {'nonconcurrent'}
    assert model.units == 9 and model.case_selected == {'DEAD':True}
    assert model.combo_selected == {'ULS':False,'ENV':True}


@pytest.mark.parametrize('combo_type',[1,2,3,4])
def test_envelope_absolute_srss_and_range_combos_are_extractable_but_nonconcurrent(combo_type):
    model = FakeModel()
    model.RespCombo.GetTypeOAPI = lambda name: (combo_type,0)
    result = Sap2000(model).extract(request())
    assert all(r.concurrency == 'nonconcurrent' for r in result.rows)


def test_nested_linear_combo_and_nested_envelope_are_classified():
    model = FakeModel()
    model.RespCombo.names.append('NESTED')
    model.combo_selected['NESTED'] = False
    model.RespCombo.GetCaseList = lambda name: (1, [1], ['ULS'], [1.0], 0) if name == 'NESTED' else (1,[0],['DEAD'],[1.0],0)
    req = ExtractionRequest(output_cases=[{'name':'NESTED','kind':'combination'}])
    assert all(r.concurrency == 'concurrent' for r in Sap2000(model).extract(req).rows)
    model.RespCombo.GetCaseList = lambda name: (1,[1],['ENV'],[1.0],0) if name == 'NESTED' else (1,[0],['DEAD'],[1.0],0)
    assert all(r.concurrency == 'nonconcurrent' for r in Sap2000(model).extract(req).rows)
    assert model.units == 9 and model.combo_selected['ENV'] is True


def test_combo_type_api_failure_and_cyclic_combo_restore_settings():
    model = FakeModel()
    model.RespCombo.GetTypeOAPI = lambda name: (0,7)
    with pytest.raises(SapError):
        Sap2000(model).extract(request())
    assert model.units == 9 and model.case_selected['DEAD']
    model = FakeModel()
    model.RespCombo.GetCaseList = lambda name: (1,[1],['ULS'],[1.0],0)
    with pytest.raises(SapError, match='Cyclic'):
        Sap2000(model).extract(request())
    assert model.units == 9 and model.combo_selected['ENV']


@pytest.mark.parametrize(('column', 'bad_value', 'field'), [(2, -0.01, 'station'), (6, 123, 'step_type'), (13, float('nan'), 'M3')])
def test_invalid_force_reports_case_frame_field_and_restores_state(column, bad_value, field):
    model = FakeModel()
    original = model.force
    def invalid(frame, item_type):
        values = list(original(frame, item_type))
        if model.combo_selected['ENV']:
            values[column] = [bad_value, values[column][1]]
        return tuple(values)
    model.Results.FrameForce = invalid
    outputs = [{'name':'DEAD','kind':'case'}, {'name':'ULS','kind':'combination'}, {'name':'ENV','kind':'combination'}]
    with pytest.raises(SapError) as raised:
        Sap2000(model).extract(ExtractionRequest(output_cases=outputs))
    message = str(raised.value)
    assert 'SAP2000_RESULT_INVALID' in message
    assert "combination 'ENV'" in message and "frame 'F1'" in message
    assert field in message and 'dòng 1/2' in message
    assert model.units == 9 and model.case_selected == {'DEAD':True}
    assert model.combo_selected == {'ULS':False,'ENV':True}


def test_extract_all_183_outputs_without_count_validation_failure():
    model = FakeModel()
    names = ['ULS'+str(i) for i in range(182)]
    model.combo_selected = dict.fromkeys(names, False)
    model.RespCombo = ComboNames(names)
    result = Sap2000(model).extract(ExtractionRequest(output_cases=[
        {'name':'DEAD','kind':'case'}, *[{'name':n,'kind':'combination'} for n in names]]))
    assert len(result.rows) == 183*2*2
    assert len({(r.output_case,r.case_kind) for r in result.rows}) == 183
    assert model.units == 9 and not any(model.combo_selected.values())


@pytest.mark.parametrize('label', [None, '', 'Max', 'Min', 'Mode', 'Step'])
def test_nullable_sap_step_label_preserves_force_vector_and_concurrency(label):
    model = FakeModel()
    original = model.force
    def force(frame, item_type):
        result = list(original(frame, item_type))
        result[6] = [label, label]
        return tuple(result)
    model.Results.FrameForce = force
    result = Sap2000(model).extract(ExtractionRequest(output_cases=[
        {'name':'DEAD','kind':'case'}, {'name':'ULS','kind':'combination'},
        {'name':'ENV','kind':'combination'}]))
    assert len(result.rows) == 12
    assert all(row.step_type == ('' if label is None else label) for row in result.rows)
    for row in result.rows:
        first = row.station == 0
        assert [row.P,row.V2,row.V3,row.T,row.M2,row.M3] == ([-10.,1.,3.,5.,7.,9.] if first else [-20.,2.,4.,6.,8.,10.])
        assert row.step_num == 0
        assert row.concurrency == ('nonconcurrent' if row.output_case == 'ENV' else 'concurrent')
    assert model.units == 9 and model.case_selected == {'DEAD':True}
    assert model.combo_selected == {'ULS':False,'ENV':True}
    assert all(row['step_type'] == ('' if label is None else label) for row in result.model_dump(mode='json')['rows'])


def test_missing_case_does_not_abort_other_outputs_or_extremes():
    from structural_engine.member_forces.models import ExtremeRequest
    from structural_engine.member_forces.processing import extremes
    model = FakeModel()
    model.LoadCases = CaseNames(['DEAD', 'EMPTY'])
    model.case_selected['EMPTY'] = False
    model.Analyze.GetCaseStatus = lambda: (2, ['DEAD','EMPTY'], [4,1], 0)
    original = model.RespCombo.GetCaseList
    model.RespCombo.GetCaseList = lambda name: (1,[0],['EMPTY'],[1.],0) if name == 'ENV' else original(name)
    result = Sap2000(model).extract(ExtractionRequest(output_cases=[
        {'name':'EMPTY','kind':'case'}, {'name':'ENV','kind':'combination'}, {'name':'ULS','kind':'combination'}]))
    assert len(result.rows) == 4
    assert {r.output_case for r in result.rows} == {'ULS'}
    assert {r.output_case for r in result.missing_results} == {'EMPTY','ENV'}
    assert all(r['result'] is None for r in result.model_dump(mode='json')['missing_results'])
    assert all(r['absolute']['rows'][0]['output_case'] == 'ULS' for r in extremes(ExtremeRequest(dataset=result))['data'])
    assert model.units == 9 and model.combo_selected['ENV']


def test_nested_envelope_missing_dependency_is_none_even_after_valid_child():
    model = FakeModel()
    model.RespCombo.GetCaseList = lambda name: (2,[0,0],['DEAD','EMPTY'],[1.,1.],0)
    result = Sap2000(model).extract(ExtractionRequest(output_cases=[{'name':'ENV','kind':'combination'}]))
    assert not result.rows and 'EMPTY' in result.missing_results[0].reason


def test_missing_zero_factor_dependency_does_not_suppress_valid_combo():
    model = FakeModel()
    model.RespCombo.GetCaseList = lambda name: (2,[0,0],['DEAD','EMPTY'],[1.,0.],0)
    result = Sap2000(model).extract(request())
    assert len(result.rows) == 4 and result.missing_results == []


def test_all_missing_outputs_http_response_is_success_with_json_null():
    model = FakeModel()
    model.Analyze.GetCaseStatus = lambda: (1,['DEAD'],[1],0)
    @contextmanager
    def gateway():
        yield Sap2000(model)
    client = TestClient(create_app('x'*32, gateway))
    response = client.post('/API_IF_SAP26.2.0_V1/frame-forces',
        headers={'Authorization':'Bearer '+'x'*32}, json=request().model_dump())
    assert response.status_code == 200
    assert response.json()['rows'] == []
    assert response.json()['missing_results'][0]['result'] is None


def test_member_sections_and_nonprismatic_segments_use_sap_enum_names():
    model = FakeModel()
    sap = Sap2000(model, section_type_names={1:'I',99:'NONPRISMATIC'})
    data = sap.extract(request())
    first, second = data.members
    assert first.frame == 'F1' and first.section == 'I300' and first.section_type == 'I'
    assert first.components == [] and first.units_code == 6
    assert second.frame == 'F2' and second.section == 'NP1'
    assert second.section_type_code == 99 and second.section_type == 'NONPRISMATIC'
    assert [(p.start_section,p.end_section) for p in second.components] == [('I300','I500'),('I500','I300')]
    assert all(p.start_type == 'I' and p.end_type == 'I' for p in second.components)
    assert [p.length for p in second.components] == [.5,.5]
    assert [p.length_type for p in second.components] == [1,1]
    assert model.units == 9
    from structural_engine.member_forces.models import ExportRequest
    from structural_engine.member_forces.processing import connection_export
    import csv, io
    records=list(csv.DictReader(io.StringIO(connection_export(ExportRequest(dataset=data,format='csv')))))
    assert records[-1]['section'] == 'NP1' and records[-1]['section_type'] == 'NONPRISMATIC'
    assert 'members' not in records[-1]
    assert connection_export(ExportRequest(dataset=data))['members'][1]['components'][1]['index'] == 2


def test_member_endpoint_reads_selection_without_changing_units_or_output_state():
    model = FakeModel()
    @contextmanager
    def gateway():
        yield Sap2000(model, connection_pid=123,section_type_names={1:'I',99:'NONPRISMATIC'})
    client = TestClient(create_app('x'*32, gateway))
    response=client.get('/API_IF_SAP26.2.0_V1/members',headers={'Authorization':'Bearer '+'x'*32})
    assert response.status_code == 200
    assert response.json()['pid'] == 123 and len(response.json()['data']) == 2
    assert response.json()['data'][1]['units_code'] == 9
    assert model.units == 9 and model.case_selected['DEAD'] and model.combo_selected['ENV']


def test_malformed_nonprismatic_definition_fails_and_restores_units():
    model=FakeModel()
    model.PropFrame.GetNonPrismatic=lambda name:(2,['I300'],['I500'],[.5],[1],[1],[1],0,'','',0)
    with pytest.raises(SapError,match='Invalid nonprismatic'):
        Sap2000(model,section_type_names={99:'NONPRISMATIC',1:'I'}).extract(request())
    assert model.units == 9 and model.case_selected['DEAD'] and model.combo_selected['ENV']
