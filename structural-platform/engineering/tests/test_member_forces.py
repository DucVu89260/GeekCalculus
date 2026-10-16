import csv
import io
import pytest
from fastapi.testclient import TestClient
from structural_engine.sectional_properties.api.main import app

client = TestClient(app)


def row(station=0, moment=10, **kwargs):
    return dict(record_id=str(station), frame='F1', element='E1', station=station,
                element_station=station, output_case='ULS', case_kind='combination',
                step_type='', step_num=0, concurrency='concurrent', P=-20, V2=3, V3=4, T=5, M2=0, M3=moment, **kwargs)


def dataset(rows=None):
    return dict(model='test.sdb', extracted_at='2026-10-16T00:00:00Z',
                rows=rows if rows is not None else [row(x) for x in (0, 1, 2, 3, 4)])


def post(endpoint, payload):
    return client.post('/API_IF_SAP26.2.0_V1/'+endpoint, json=payload)


def test_extremes_keep_concurrent_values_and_all_ties():
    rows = [row(0, -40), row(1, 40), row(2, 4)]
    rows[1].update(P=99, output_case='WIND')
    response = post('extremes', dict(dataset=dataset(rows), components=['M3']))
    assert response.status_code == 200
    result = response.json()['data'][0]
    assert result['min']['value'] == -40
    assert result['max']['rows'][0]['P'] == 99
    assert len(result['absolute']['rows']) == 2
    assert result['absolute']['rows'][0]['P'] == -20


def test_global_and_per_frame_extremes_and_missing_filters():
    rows = [row(0, 10), {**row(1, 90), 'frame': 'F2'}]
    assert len(post('extremes', dict(dataset=dataset(rows), components=['M3'])).json()['data']) == 2
    response = post('extremes', dict(dataset=dataset(rows), scope='global', components=['M3']))
    assert response.json()['data'][0]['max']['rows'][0]['frame'] == 'F2'
    assert post('extremes', dict(dataset=dataset(), frames=['missing'])).status_code == 422


def test_export_preserves_case_step_and_local_force_vector_and_protects_csv():
    rows = [{**row(), 'output_case': '=HYPERLINK("x")', 'step_num': 4, 'step_type': 'Time'}]
    response = post('connection-export', dict(dataset=dataset(rows)))
    assert response.json()['rows'][0]['step_num'] == 4
    csv_response = post('connection-export', dict(dataset=dataset(rows), format='csv'))
    assert csv_response.headers['content-type'].startswith('text/csv')
    data = list(csv.DictReader(io.StringIO(csv_response.text)))
    assert data[0]['output_case'].startswith("'=")
    assert data[0]['P'] == '-20.0'
    assert data[0]['units'] == 'kN_m_C'


def test_large_tie_sets_preserve_all_record_ids_without_unbounded_vector_expansion():
    result = post('extremes', dict(dataset=dataset([row(x) for x in range(25)]), components=['M3'])).json()
    tied = result['data'][0]['max']
    assert tied['tie_count'] == len(tied['record_ids']) == 25
    assert len(tied['rows']) == 20 and tied['rows_truncated'] is True
    assert result['model'] == 'test.sdb'


@pytest.mark.parametrize('concurrency,step', [('concurrent','Max'), ('nonconcurrent',''), ('unknown',''), ('concurrent','Mode')])
def test_export_rejects_nonconcurrent_results(concurrency, step):
    rows = [{**row(x), 'concurrency': concurrency, 'step_type': step} for x in (0,1,2,3,4)]
    assert post('connection-export', dict(dataset=dataset(rows))).status_code == 422


def test_validation_version_identity_and_removed_cb_route():
    assert post('extremes',dict(dataset=dataset([row(),row()]))).status_code == 422
    assert post('connection-export',dict(dataset=dataset(),record_ids=['unknown'])).status_code == 422
    data=dataset()
    data['rows'][0]['M3']='NaN'
    assert post('extremes',dict(dataset=data)).status_code == 422
    data=dataset()
    data['sap2000_version']='26.1.0'
    assert post('extremes',dict(dataset=data)).status_code == 422
    assert post('cb',{}).status_code == 404
    result=post('extremes',dict(dataset=dataset())).json()
    assert result['api_name']=='API_IF_SAP26.2.0_V1'
    assert result['sap2000_version']=='26.2.0'
