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
    def GetTypeOAPI(self, name):
        return 1, 0, 0
    def GetTypeCombo(self, name):
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
        self.LoadCases = Names(['DEAD'])
        self.RespCombo = Names(['ULS', 'ENV'])
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
    with pytest.raises(SapError, match='underlying'):
        Sap2000(model).extract(request())
    assert model.units == 9
    model = FakeModel()
    model.LoadCases.GetTypeOAPI = lambda name: (4, 0, 0)
    assert Sap2000(model).extract(request()).rows[0].concurrency == 'nonconcurrent'


def test_missing_results_and_malformed_arrays_restore_state():
    model = FakeModel()
    model.Results.FrameForce = lambda *args: (0, *([[]]*13), 0)
    with pytest.raises(SapError, match='No frame forces'):
        Sap2000(model).extract(request())
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
