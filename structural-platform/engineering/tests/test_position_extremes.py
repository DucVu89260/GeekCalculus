import pytest
from structural_engine.member_forces.models import ExtremeRequest
from structural_engine.member_forces.processing import extremes
from test_force_positions import dataset
from test_member_forces import post


def two_frames():
    data=dataset()
    data.members.append(data.members[0].model_copy(update={'frame':'F2','length':8.}))
    for i,r in enumerate(list(data.rows)):
        data.rows.append(r.model_copy(update={'record_id':'F2-'+str(i),'frame':'F2',
            'element':'E2','output_case':'WIND','station':float(i*8),'element_station':float(i*8),
            'M3':-300. if i==0 else 500.,'P':123. if i==0 else -456.}))
    return data


def test_all_station_extreme_reports_governing_case_and_local_ij_position():
    result=extremes(ExtremeRequest(dataset=two_frames(),scope='global',components=['M3']))
    high=result['data'][0]['max']
    assert high['value']==500. and high['rows'][0]['output_case']=='WIND'
    assert high['locations'][0]['frame']=='F2'
    assert high['locations'][0]['station']==8. and high['locations'][0]['relative_station']==1.
    assert high['locations'][0]['local_axis']=='local_1_from_I'
    assert high['locations'][0]['position']=='End J'
    assert high['rows'][0]['P']==-456.


@pytest.mark.parametrize(('position','fraction'), [('end_i',0.),('quarter',.25),('mid',.5),('three_quarter',.75),('end_j',1.)])
def test_per_frame_position_extremes_respect_each_frame_length_and_signed_forces(position,fraction):
    result=extremes(ExtremeRequest(dataset=two_frames(),position=position,components=['M3']))
    expected={'F1':-120.+fraction*240.,'F2':-300.+fraction*800.}
    assert len(result['data'])==2
    for item in result['data']:
        row=item['absolute']['rows'][0];loc=item['absolute']['locations'][0]
        assert row['M3']==pytest.approx(expected[item['group']])
        assert loc['relative_station']==fraction
        assert loc['method']==('original' if fraction in (0.,1.) else 'linear')
        assert loc['station']==(4. if item['group']=='F1' else 8.)*fraction


def test_global_quarter_extreme_has_signed_governing_row_and_interpolation_provenance():
    result=extremes(ExtremeRequest(dataset=two_frames(),position='quarter',scope='global',components=['M3']))
    absolute=result['data'][0]['absolute']
    assert absolute['value']==100. and absolute['rows'][0]['M3']==-100.
    assert absolute['rows'][0]['frame']=='F2' and absolute['rows'][0]['output_case']=='WIND'
    loc=absolute['locations'][0]
    assert loc['weight']==.25 and loc['source_record_ids']==['F2-0','F2-1']
    assert {r['record_id'] for r in result['source_rows']}=={'1','2','F2-0','F2-1'}


def test_end_forces_are_whole_governing_vectors_not_mixed_component_extremes():
    data=dataset()
    a=data.rows[0]
    data.rows.append(a.model_copy(update={'record_id':'other-case','output_case':'WIND','M3':900.,'P':-777.}))
    result=extremes(ExtremeRequest(dataset=data,position='end_i'))
    m3=next(x for x in result['data'] if x['component']=='M3')
    assert m3['max']['rows'][0]['output_case']=='WIND' and m3['max']['rows'][0]['P']==-777.
    assert m3['min']['rows'][0]['output_case']=='ULS' and m3['min']['rows'][0]['P']==-20.
    assert all(x['min']['locations'][0]['station']==0. for x in result['data'])


def test_position_missing_returns_explicit_none_report_and_no_fabricated_extreme():
    data=dataset();data.members=[]
    result=extremes(ExtremeRequest(dataset=data,position='mid'))
    assert result['data']==[]
    assert result['unavailable_positions'][0]['method']=='unavailable'
    assert 'chiều dài' in result['unavailable_positions'][0]['reason']


def test_five_positions_preserves_ties_and_both_sides_of_an_element_boundary():
    data=dataset();a,b=data.rows
    data.rows=[a,a.model_copy(update={'record_id':'left','station':2.,'element_station':2.,'M3':-999.}),
               b.model_copy(update={'record_id':'right','station':2.,'element_station':0.,'element':'E2','M3':999.}),
               b.model_copy(update={'element':'E2','element_station':2.})]
    result=extremes(ExtremeRequest(dataset=data,position='five',components=['M3']))
    absolute=result['data'][0]['absolute']
    assert absolute['tie_count']==2
    assert [l['position'] for l in absolute['locations']]==['1/2 L','1/2 L']
    assert {r['record_id'] for r in absolute['rows']}=={'left','right'}


def test_position_api_validation_and_existing_frame_case_filters():
    data=two_frames()
    response=post('extremes',dict(dataset=data.model_dump(),position='end_j',frames=['F2'],components=['M3']))
    assert response.status_code==200
    assert response.json()['data'][0]['max']['locations'][0]['station']==8.
    assert post('extremes',dict(dataset=data.model_dump(),position='end_k')).status_code==422
