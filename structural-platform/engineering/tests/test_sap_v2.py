from contextlib import contextmanager
import json
import pytest
from fastapi.testclient import TestClient
from structural_engine.member_forces.sap2000 import SapError
from structural_engine.member_forces.dotnet import ConnectionSettings
from structural_engine.sap2000_v2.contract import API_PREFIX, GROUPS
from structural_engine.sap2000_v2.connector import create_app
from structural_engine.sap2000_v2.models import SnapshotRequest, TableRequest
from structural_engine.sap2000_v2.reader import SteelReader
from structural_engine.sap2000_v2.reflection import field
from structural_engine.sap2000_v2.worker import execute
from sap_v2_fixtures import SteelModel, FixtureRuntime, gateway
TOKEN='v2-local-fixture-token-00000000000000000000'
AUTH={'Authorization':'Bearer '+TOKEN}

def read(model=None,**payload):
    model=model or SteelModel()
    with gateway(model) as sap:result=SteelReader(sap,FixtureRuntime(model)).snapshot(SnapshotRequest(expected_model='model.sdb',**payload))
    return model,result

def test_identity_geometry_material_override_units_scaling_and_modifiers():
    model,data=read()
    assert data['api_name'].endswith('_V2') and data['pid']==20948
    assert data['original_units_code']==9 and model.units==9
    assert data['members'][0]['data']['geometry']['length_m']==5 and data['members'][1]['data']['geometry']['length_m']==12
    assert data['members'][0]['analysis_section']=='I300' and data['members'][0]['auto_select_list']=='AUTO1'
    assert data['members'][1]['data']['materials']['effective_material']=='SteelB'
    assert data['members'][0]['data']['materials']['effective_material']=='SteelA'
    assert data['sections']['I300']['dimensions_mm']['t3_mm']==300
    props=data['sections']['I300']['properties_mm']
    assert props['A_mm2']==10000 and props['I33_mm4']==150000000 and props['J_mm4']==800000
    material=data['materials']['SteelA']['normalized']
    assert material['Fy_MPa']==345 and material['E_MPa']==200000 and material['mass_density_kg_m3']==7850
    assert data['sections']['I300']['properties']['data']['Area']==.01
    assert data['sections']['I300']['modifiers']['components']['I33']==.6
    assert all(units==6 for _,_,units in model.v2_calls)
    json.dumps(data,allow_nan=False)

def test_nonprismatic_components_and_unavailable_properties_remain_explicit():
    _,data=read(groups=['sections']);np=data['sections']['NP1']
    assert np['type_name']=='Variable' and np['geometry']['data']['StartSec']==['I300','I500']
    assert np['geometry']['field_units']['MyLength'].startswith('relative')
    assert np['properties']['status']=='unavailable' and np['properties_mm']=={}
    assert {r['name'] for r in np['components']}=={'I300','I500'} and 'I500' in data['sections']
    assert data['status']=='partial'

def test_all_groups_restore_state_and_keep_design_overwrites_and_point_axes_separate():
    model=SteelModel();old=(model.units,model.case_selected.copy(),model.combo_selected.copy())
    _,data=read(model,groups=list(GROUPS),output_cases=[{'name':'DEAD','kind':'case'}])
    assert (model.units,model.case_selected,model.combo_selected)==old
    setup=data['model_data']['steel_design'];assert setup['scope']=='model_design_code';assert len(setup['preferences'])==35 and setup['design_method']=='ASD'
    overwrite=data['members'][0]['data']['design_overwrites'];assert len(overwrite)==43
    cb=next(r for r in overwrite if r['item']==28)
    assert cb['label']=='Bending coefficient, Cb' and field(cb,'Value')==0 and field(cb,'ProgDet') is True
    fy=next(r for r in overwrite if r['item']==35);assert field(fy,'Value')==400000 and fy['units']=='kN/m²'
    assert data['materials']['SteelA']['normalized']['Fy_MPa']==345
    end=data['members'][0]['data']['displacements'][0]['ends']['I']['joint_displacements']
    assert end['data']['U2']==[-.002] and end['field_units']['U2']=='m'
    assert data['force_dataset']['api_name'].endswith('_V1')
    assert data['members'][0]['data']['assignments']['releases']['data']['StartValue'][1]==500
    assert data['members'][0]['data']['design_results']['summary']['data']['WarningSummary']==['Review lateral restraint']

def test_code_mismatch_does_not_query_aisc_indices_or_fake_design_results():
    model=SteelModel();model.design_code='AISC 360-16';model.design_available=False
    _,data=read(model,groups=['design_setup','design_overwrites','design_results'])
    assert data['model_data']['steel_design']['preferences']['status']=='unsupported'
    assert data['members'][0]['data']['design_overwrites']['status']=='unsupported'
    assert data['members'][0]['data']['design_results']['summary']['status']=='not_designed'
    assert not any(key in ('preference','overwrite','design_summary') for key,_,_ in model.v2_calls)

def test_unlocked_definition_reads_work_but_outputs_need_explicit_cases_and_analysis():
    model=SteelModel();model.locked=False
    _,data=read(model,groups=['identity','sections','forces','displacements'])
    assert data['force_dataset'] is None and data['model_data']['forces']['status']=='input_required'
    assert data['model_data']['displacements']['status']=='input_required' and model.units==9

def test_getter_and_restore_failure_never_accept_dirty_snapshot():
    model=SteelModel();model.fail_key='releases'
    with pytest.raises(RuntimeError,match='Synthetic getter failure'):read(model,groups=['assignments'])
    assert model.units==9
    model=SteelModel();model.restore_fail=True
    with pytest.raises(SapError,match='RESTORE_FAILED'):read(model)

def test_pin_limits_unknown_members_and_categories():
    model=SteelModel()
    with gateway(model) as sap:
        with pytest.raises(SapError,match='MODEL_CHANGED'):SteelReader(sap,FixtureRuntime(model)).snapshot(SnapshotRequest(expected_model='other.sdb'))
    assert model.units==9 and not model.v2_calls
    for values in ({'groups':['made_up']},{'frames':['F1','F1']},{'frames':[str(i) for i in range(201)]}):
        with pytest.raises(ValueError):SnapshotRequest(expected_model='model.sdb',**values)
    with pytest.raises(SapError,match='SELECTION'):read(model,frames=['missing'])

def test_table_bounds_strings_units_and_key_validation():
    model=SteelModel()
    with gateway(model) as sap:
        reader=SteelReader(sap,FixtureRuntime(model));data=reader.table(TableRequest(table_key='Frame Assignments - Section Properties',expected_model='model.sdb',max_records=1))
        assert data['rows']==[['F1','I300','0.01']] and data['total_records']==2 and data['truncated']
        assert 'TableData' not in data['raw']['data'] and data['fields']['data']['UnitsString']==['','','m2']
        with pytest.raises(SapError,match='runtime table key'):reader.table(TableRequest(table_key='missing',expected_model='model.sdb'))
    assert model.units==9

def test_http_auth_validation_and_approved_web_cors():
    calls=[]
    def runner(op,settings,payload):calls.append(op);return {'op':op}
    client=TestClient(create_app(TOKEN,operation_runner=runner,instance_scanner=lambda s:[]))
    for path in ('connection','model','instances','selection','members','output-cases','schema','capabilities','tables'):
        assert client.get(API_PREFIX+'/'+path).status_code==401
    assert client.post(API_PREFIX+'/snapshot',json={'expected_model':'model.sdb'}).status_code==401
    assert client.get(API_PREFIX+'/model',headers=AUTH).json()=={'op':'model'}
    assert client.post(API_PREFIX+'/snapshot',headers=AUTH,json={'expected_model':'model.sdb','groups':['identity']}).status_code==200
    assert client.post(API_PREFIX+'/snapshot',headers=AUTH,json={'expected_model':'model.sdb','groups':['bad']}).status_code==422
    assert client.put(API_PREFIX+'/connection',headers=AUTH,json={'pid':20948,'expected_model':'model.sdb'}).status_code==200
    assert client.get(API_PREFIX+'/schema',headers=AUTH).json()['api_name'].endswith('_V2')
    assert client.get('/',headers={'Host':'attacker.example'}).status_code==400
    preflight=client.options(API_PREFIX+'/snapshot',headers={'Origin':'https://ducvu89260.github.io','Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization'})
    assert preflight.status_code==200 and preflight.headers['access-control-allow-origin']=='https://ducvu89260.github.io'
    private=client.options(API_PREFIX+'/snapshot',headers={'Origin':'https://ducvu89260.github.io','Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization,content-type','Access-Control-Request-Private-Network':'true'})
    assert private.headers['access-control-allow-private-network']=='true'
    assert 'access-control-allow-credentials' not in private.headers
    denied=client.options(API_PREFIX+'/snapshot',headers={'Origin':'https://attacker.example','Access-Control-Request-Method':'POST'})
    assert denied.status_code==400 and 'access-control-allow-origin' not in denied.headers
    assert client.get(API_PREFIX+'/connection',headers={'Origin':'https://ducvu89260.github.io'}).status_code==401
    assert client.get(API_PREFIX+'/connection',headers=AUTH).json()['web_panel_supported'] is True
    assert client.get('/').status_code==200
    assert calls==['model','snapshot']

def test_worker_dispatch_and_model_pin():
    model=SteelModel()
    @contextmanager
    def opener(settings):
        with gateway(model) as sap:yield sap
    data=execute('snapshot',ConnectionSettings(pid=20948,expected_model='model.sdb'),{'expected_model':'model.sdb','groups':['identity']},opener=opener,runtime_factory=FixtureRuntime)
    assert data['pid']==20948 and model.units==9
    with pytest.raises(SapError,match='MODEL_CHANGED'):
        execute('snapshot',ConnectionSettings(pid=20948,expected_model='different.sdb'),{'expected_model':'different.sdb'},opener=opener,runtime_factory=FixtureRuntime)


def test_sc1_tapered_end_geometry_and_material_strengths_are_api_values_not_name_parsing():
    from structural_engine.sap2000_v2.reflection import block
    from structural_engine.sap2000_v2.registry import GETTERS
    model=SteelModel()
    class TaperedRuntime(FixtureRuntime):
        def read(self,key,**inputs):
            name=inputs.get('Name')
            if key=='section_assignment':
                return block('ok',GETTERS[key].path,data={'PropName':'SC1','SAuto':''})
            if key=='section_type' and name=='SC1':
                return block('ok',GETTERS[key].path,data={'PropType':99})
            if key=='nonprismatic' and name=='SC1':
                return block('ok',GETTERS[key].path,data={'NumberItems':1,'StartSec':['H300x200x6x8'],'EndSec':['H700x200x6x8'],'MyLength':[1.],'MyType':[1],'EI33':[2],'EI22':[1]})
            if key=='shape_i':
                # Actual SAP geometry intentionally differs from the name: never parse names.
                return block('ok',GETTERS[key].path,data={'MatProp':'SteelA','t3':.310 if name.startswith('H300') else .700,'t2':.200,'tf':.008,'tw':.006,'t2b':.200,'tfb':.008})
            return super().read(key,**inputs)
    with gateway(model) as sap:
        data=SteelReader(sap,TaperedRuntime(model)).snapshot(SnapshotRequest(expected_model='model.sdb',groups=['sections','materials'],frames=['F1']))
    seg=data['sections']['SC1']['segments'][0]
    assert seg=={'segment':1,'start_section':'H300x200x6x8','end_section':'H700x200x6x8','length':1.,'length_type':1,'length_unit':'relative','EI33_variation':2,'EI22_variation':1}
    assert data['sections'][seg['start_section']]['i_dimensions_mm']=={'h':310.,'bf_top':200.,'tf_top':8.,'tw':6.,'bf_bottom':200.,'tf_bottom':8.}
    assert data['sections'][seg['end_section']]['i_dimensions_mm']['h']==700.
    assert data['members'][0]['data']['materials']['effective_material']=='SteelA'
    assert data['materials']['SteelA']['normalized']['Fy_MPa']==345.
    assert data['materials']['SteelA']['normalized']['Fu_MPa']==510.
    assert model.units==9


def test_mytype_signature_and_literal_none_overwrite_resolve_component_material():
    from structural_engine.sap2000_v2.reflection import block
    from structural_engine.sap2000_v2.registry import GETTERS
    model=SteelModel()
    class ActualNamesRuntime(FixtureRuntime):
        def read(self,key,**inputs):
            if key=='section_type':
                return block('ok',GETTERS[key].path,data={'MyType':99 if inputs['Name']=='NP1' else 1})
            if key=='material_overwrite':
                return block('ok',GETTERS[key].path,data={'PropName':'None'})
            return super().read(key,**inputs)
    with gateway(model) as sap:
        result=SteelReader(sap,ActualNamesRuntime(model)).snapshot(SnapshotRequest(expected_model='model.sdb'))
    assert result['sections']['NP1']['segments'][0]['start_section']=='I300'
    assert result['sections']['I300']['i_dimensions_mm']['h']==300.
    assert result['members'][1]['data']['materials']['effective_material']=='SteelA'
    assert 'None' not in result['materials']
    assert result['materials']['SteelA']['normalized']['Fy_MPa']==345.
    assert result['materials']['SteelA']['normalized']['Fu_MPa']==510.


def test_unresolved_enum_requires_successful_i_getter_not_section_name_guess():
    from structural_engine.sap2000_v2.reflection import block
    from structural_engine.sap2000_v2.registry import GETTERS
    model=SteelModel()
    class UnknownEnumRuntime(FixtureRuntime):
        def read(self,key,**inputs):
            if key=='section_type':return block('ok',GETTERS[key].path,data={'UnexpectedType':123})
            if key=='shape_i' and inputs['Name']=='bad':return block('unavailable',GETTERS[key].path,code=1)
            return super().read(key,**inputs)
    with gateway(model) as sap:
        reader=SteelReader(sap,UnknownEnumRuntime(model))
        good=reader.section('600212610');bad=reader.section('bad')
    assert good['i_dimensions_mm']['h']==500.
    assert good['geometry']['source']=='PropFrame.GetISection'
    assert 'i_dimensions_mm' not in bad and bad['geometry']['status']=='unsupported'


def test_installed_dll_uppercase_i_dimensions_match_normalized_lowercase_contract():
    _,result=read(groups=['sections','materials'])
    section=result['sections']['I300']
    assert section['geometry']['data']['T3']==.3
    assert 't3' not in section['geometry']['data']  # untouched installed-DLL field spelling
    assert section['dimensions_mm']=={'t3_mm':300.,'t2_mm':150.,'tf_mm':12.,'tw_mm':8.,'t2b_mm':150.,'tfb_mm':12.}
    assert section['i_dimensions_mm']=={'h':300.,'bf_top':150.,'tf_top':12.,'tw':8.,'bf_bottom':150.,'tf_bottom':12.}
    assert result['members'][0]['data']['materials']['effective_material']=='SteelA'
    assert 'None' not in result['materials']


def test_design_status_is_per_member_and_failed_getter_is_not_mislabeled_undesigned():
    from structural_engine.sap2000_v2.reflection import block
    from structural_engine.sap2000_v2.registry import GETTERS
    model=SteelModel()
    class MixedDesignRuntime(FixtureRuntime):
        def read(self,key,**inputs):
            if key=='design_summary' and inputs['Name']=='F2':
                self.model.v2_calls.append((key,inputs,self.model.units))
                return block('empty',GETTERS[key].path,data={'NumberItems':0,'FrameName':[]})
            return super().read(key,**inputs)
    with gateway(model) as sap:
        result=SteelReader(sap,MixedDesignRuntime(model)).snapshot(SnapshotRequest(expected_model='model.sdb',groups=['design_results']))
    assert result['members'][0]['data']['design_results']['status']=='ok'
    empty=result['members'][1]['data']['design_results']
    assert empty['status']=='not_designed' and empty['message']=='Members have not been designed'
    assert any(key=='design_summary' and args['Name']=='F2' for key,args,_ in model.v2_calls)
    class FailedDesignRuntime(FixtureRuntime):
        def read(self,key,**inputs):
            if key in ('design_available','design_summary'):return block('unavailable',GETTERS[key].path,code=1)
            return super().read(key,**inputs)
    with gateway(model) as sap:
        result=SteelReader(sap,FailedDesignRuntime(model)).snapshot(SnapshotRequest(expected_model='model.sdb',groups=['design_results']))
    assert result['members'][0]['data']['design_results']['status']=='unavailable'
    assert result['members'][0]['data']['design_results']['message']!='Members have not been designed'


def test_no_model_design_gives_exact_message_without_attempting_summary():
    model=SteelModel();model.design_available=False
    _,result=read(model,groups=['assignments','design_setup','design_overwrites','design_results'])
    for member in result['members']:
        assert member['data']['design_results']['message']=='Members have not been designed'
        assert member['data']['assignments']['releases']['dof_order']==['U1','U2','U3','R1','R2','R3']
        assert member['data']['assignments']['springs']['status']=='empty'
        assert member['data']['assignments']['hinges']['status']=='empty'
        assert member['data']['assignments']['end_offsets']['field_units']['Length1']=='m'
        assert len(member['data']['design_overwrites'])==43
    assert len(result['model_data']['steel_design']['preferences'])==35
    assert not any(key=='design_summary' for key,_,_ in model.v2_calls)


def test_preferences_only_reads_model_once_without_any_frame_selection():
    model=SteelModel()
    with gateway(model) as sap:
        def unexpected_selection():raise AssertionError('Model preferences must not query selected members')
        sap.selection=unexpected_selection
        result=SteelReader(sap,FixtureRuntime(model)).snapshot(SnapshotRequest(expected_model='model.sdb',groups=['design_setup']))
    assert result['members']==[] and result['sections']=={} and result['materials']=={}
    assert result['model_data']['steel_design']['scope']=='model_design_code'
    assert len([key for key,_,_ in model.v2_calls if key=='preference'])==35
    assert not any(key in ('section_assignment','overwrite') for key,_,_ in model.v2_calls)
    assert model.units==9
