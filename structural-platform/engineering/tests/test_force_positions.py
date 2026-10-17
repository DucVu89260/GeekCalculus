import pytest
from fastapi.testclient import TestClient
from structural_engine.member_forces.connector import create_app
from structural_engine.member_forces.models import ForceRow, PositionRequest
from structural_engine.member_forces.positions import position_samples
from structural_engine.member_forces.sap2000 import Sap2000
from test_sap2000_connector import FakeModel, request


def dataset():
    data=Sap2000(FakeModel()).extract(request(frames=['F1']))
    data.rows=[r.model_copy(update={c:(-20. if i==0 else 20.)*(j+1)
                                  for j,c in enumerate(('P','V2','V3','T','M2','M3'))})
               for i,r in enumerate(data.rows)]
    return data


def samples(data):return position_samples(PositionRequest(dataset=data))['data']


@pytest.mark.parametrize(('fraction','expected'),[(.25,-10.),(.5,0.),(.75,10.)])
def test_linear_interpolation_preserves_signed_all_six_components(fraction,expected):
    data=dataset(); original=data.model_dump()
    sample=next(s for s in samples(data) if s['fraction']==fraction)
    assert sample['method']=='linear' and sample['weight']==fraction
    assert sample['source_record_ids']==['1','2']
    for j,component in enumerate(('P','V2','V3','T','M2','M3')):
        assert sample['rows'][0][component]==expected*(j+1)
    assert sample['rows'][0]['station']==fraction*4
    assert sample['rows'][0]['element_station']==fraction*4
    assert data.model_dump()==original


def test_exact_station_keeps_both_sides_and_interpolation_uses_correct_element():
    data=dataset();a,b=data.rows
    data.rows=[a, a.model_copy(update={'record_id':'left','station':2.,'element_station':2.,'M3':-5.}),
        b.model_copy(update={'record_id':'right','station':2.,'element_station':0.,'element':'second','M3':5.}),
        b.model_copy(update={'element':'second','element_station':2.})]
    result=samples(data)
    middle=result[2]
    assert middle['method']=='original'
    assert [r['M3'] for r in middle['rows']]==[-5.,5.]
    assert result[1]['source_record_ids']==['1','left']
    assert result[3]['source_record_ids']==['right','2']


def test_no_interpolation_between_unrelated_elements_or_duplicate_source_rows():
    data=dataset()
    data.rows[1]=data.rows[1].model_copy(update={'element':'another'})
    assert samples(data)[2]['method']=='unavailable'
    data=dataset()
    data.rows.append(data.rows[0].model_copy(update={'record_id':'duplicate','M3':999.}))
    assert samples(data)[2]['method']=='unavailable'


def test_no_extrapolation_and_missing_length_has_explicit_reason():
    data=dataset()
    data.rows[0]=data.rows[0].model_copy(update={'station':1.,'element_station':1.})
    data.rows[1]=data.rows[1].model_copy(update={'station':3.,'element_station':3.})
    result=samples(data)
    assert result[0]['method']==result[4]['method']=='unavailable'
    assert result[2]['method']=='linear'
    data.members=[]
    assert all(s['method']=='unavailable' and 'chiều dài' in s['reason'] for s in samples(data))


@pytest.mark.parametrize('field,value', [('frame','F2'),('case_kind','case'),('output_case','DEAD'),('step_type','Max'),('step_num',2.)])
def test_never_mix_frames_cases_kinds_or_steps(field,value):
    data=dataset()
    data.rows[1]=data.rows[1].model_copy(update={field:value})
    assert not any(s['method']=='linear' for s in samples(data))


def test_envelope_stays_nonconcurrent_and_generated_ids_never_collide():
    data=dataset()
    data.rows=[r.model_copy(update={'concurrency':'nonconcurrent','step_type':'Max'}) for r in data.rows]
    data.rows[0]=data.rows[0].model_copy(update={'record_id':'position-2'})
    result=samples(data)
    assert result[1]['rows'][0]['record_id']!='position-2'
    assert result[1]['rows'][0]['concurrency']=='nonconcurrent'
    assert result[1]['rows'][0]['step_type']=='Max'


def test_position_endpoint_needs_token_and_does_not_require_live_sap():
    client=TestClient(create_app('x'*32))
    path='/API_IF_SAP26.2.0_V1/position-samples'
    assert client.post(path,json={'dataset':dataset().model_dump()}).status_code==401
    result=client.post(path,json={'dataset':dataset().model_dump()},headers={'Authorization':'Bearer '+'x'*32})
    assert result.status_code==200
    assert result.json()['data'][2]['rows'][0]['M3']==0.
    assert {r['record_id'] for r in result.json()['source_rows']} == {'1','2'}
    assert 'missing_results' in result.json()


def test_interpolation_handles_nonuniform_source_spacing_with_signed_values():
    data=dataset()
    data.rows[0]=data.rows[0].model_copy(update={'station':.5,'element_station':.5,'M3':-12.})
    data.rows[1]=data.rows[1].model_copy(update={'station':3.5,'element_station':3.5,'M3':6.})
    sample=samples(data)[1]  # L/4 = 1, t = (1-.5)/(3.5-.5)
    assert sample['weight']==pytest.approx(1/6)
    assert sample['rows'][0]['M3']==pytest.approx(-9.)
