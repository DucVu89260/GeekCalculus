"""Internal Cb calculation tests: no SAP HTTP endpoint participates."""
import pytest
from pydantic import ValidationError
from structural_engine.design.aisc360_10.cb import CbRequest, calculate_cb
from test_member_forces import dataset, row


def payload(rows=None, **overrides):
    data = dict(dataset=dataset(rows), frame='F1', output_case='ULS', case_kind='combination',
                moment_component='M3', start=0, end=4, section='symmetric_i',
                moment_diagram='quarter_points_and_all_extrema', braced_segment_confirmed=True,
                loading_through_shear_center=True, both_ends_braced=True, major_axis_confirmed=True)
    return {**data, **overrides}


def cb(data):
    return calculate_cb(CbRequest.model_validate(data))


def test_uniform_triangle_reverse_curvature_and_zero():
    assert cb(payload())['Cb'] == pytest.approx(1)
    assert cb(payload([row(x,m) for x,m in enumerate([0,5,10,5,0])]))['Cb'] == pytest.approx(125/95)
    assert cb(payload([row(x,m) for x,m in enumerate([-10,-5,0,5,10])]))['Cb'] == pytest.approx(125/55)
    result=cb(payload([row(x,0) for x in (0,1,2,3,4)]))
    assert result['status']=='not_applicable' and result['Cb'] is None


def test_segment_and_case_are_not_mixed():
    rows=[row(x,m) for x,m in enumerate([100,10,10,10,100])]
    rows.append({**row(1.5,999), 'record_id':'other', 'output_case':'OTHER'})
    result=cb(payload(rows,start=1,end=3,moment_diagram='piecewise_linear'))
    assert result['Mmax']==10 and result['Cb']==pytest.approx(1)


def test_missing_quarters_require_explicit_linear_diagram_and_coverage():
    data=payload([row(0,0),row(4,10)])
    with pytest.raises(ValueError,match='Exact stations'):
        cb(data)
    data['moment_diagram']='piecewise_linear'
    assert cb(data)['MA']==2.5
    data['end']=5
    with pytest.raises(ValueError,match='cover'):
        cb(data)


@pytest.mark.parametrize('concurrency,step', [('concurrent','Max'),('nonconcurrent',''),('unknown',''),('concurrent','Mode')])
def test_nonconcurrent_data_is_rejected(concurrency,step):
    rows=[{**row(x),'concurrency':concurrency,'step_type':step} for x in (0,1,2,3,4)]
    with pytest.raises(ValueError):
        cb(payload(rows,step_type=step))


def test_conflicting_stations_and_invalid_assumptions_are_rejected():
    rows=[row(0),{**row(0,20),'record_id':'duplicate-station'},*[row(x) for x in (1,2,3,4)]]
    with pytest.raises(ValueError,match='station'):
        cb(payload(rows))
    with pytest.raises(ValidationError):
        cb(payload(both_ends_braced=False))
    data=payload()
    data['dataset']['units']='N_mm_C'
    with pytest.raises(ValidationError):
        cb(data)
