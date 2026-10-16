"""Internal Cb module (AISC 360-10 F1-1); not exposed by the SAP API."""
from __future__ import annotations
import math
from typing import Annotated, Literal
from pydantic import Field, model_validator
from ...member_forces.models import Filter, Name, Number
from ...member_forces.processing import select


class CbRequest(Filter):
    frame: Name
    output_case: Name
    case_kind: Literal['case', 'combination']
    step_type: Annotated[str, Field(strict=True, max_length=100)] = ''
    step_num: Number = 0
    moment_component: Literal['M2', 'M3']
    start: Annotated[Number, Field(ge=0)]
    end: Annotated[Number, Field(gt=0)]
    section: Literal['symmetric_i']
    standard: Literal['AISC_360_10'] = 'AISC_360_10'
    # An explicit engineering declaration; samples alone cannot prove this.
    moment_diagram: Literal['piecewise_linear', 'quarter_points_and_all_extrema']
    braced_segment_confirmed: Literal[True]
    loading_through_shear_center: Literal[True]
    both_ends_braced: Literal[True]
    major_axis_confirmed: Literal[True]

    @model_validator(mode='after')
    def ordered_segment(self):
        if self.end <= self.start:
            raise ValueError('end must be greater than start')
        return self


def calculate_cb(request: CbRequest):
    if request.step_type.lower() not in ('', 'step', 'time'):
        raise ValueError('Cb requires one concurrent moment diagram, not envelope output')
    rows = [r for r in select(request) if r.frame == request.frame and r.output_case == request.output_case
            and r.case_kind == request.case_kind and r.step_type == request.step_type and r.step_num == request.step_num]
    if not rows:
        raise ValueError('No rows match the requested frame, case and analysis step')
    if any(r.concurrency != 'concurrent' for r in rows):
        raise ValueError('Cb requires verified concurrent results, not modal/statistical combinations')
    by_station = {}
    for row in rows:
        moment = getattr(row, request.moment_component)
        if row.station in by_station and by_station[row.station] != moment:
            raise ValueError('Multiple different moments at one station; split the segment at the discontinuity')
        by_station[row.station] = moment
    stations = sorted(by_station)
    if stations[0] > request.start or stations[-1] < request.end:
        raise ValueError('Moment data must cover both segment boundaries')

    def at(x):
        if x in by_station:
            return by_station[x]
        # Do not silently interpolate a sampled curved moment diagram.
        if request.moment_diagram != 'piecewise_linear':
            raise ValueError('Exact stations are required at segment ends and quarter points')
        for a, b in zip(stations, stations[1:]):
            if a < x < b:
                ratio = (x-a)/(b-a)
                return (1-ratio)*by_station[a] + ratio*by_station[b]
        raise ValueError('Station is outside the moment diagram')

    points = [request.start + (request.end-request.start)*f for f in (0, .25, .5, .75, 1)]
    moments = [abs(at(x)) for x in points]
    maximum = max([moments[0], moments[-1], *[abs(m) for x, m in by_station.items() if request.start <= x <= request.end]])
    if maximum == 0:
        return {'status': 'not_applicable', 'Cb': None, 'reason': 'Zero moment throughout the segment'}
    # Normalize first to avoid overflow; do not apply an unsupported universal cap.
    ma, mb, mc = [m/maximum for m in moments[1:4]]
    cb = 12.5/(2.5 + 3*ma + 4*mb + 3*mc)
    if not math.isfinite(cb):
        raise ValueError('Cb is outside the supported numerical range')
    return {'status': 'success', 'Cb': cb, 'standard': 'AISC_360_10', 'equation': 'F1-1',
            'formula': '12.5*Mmax/(2.5*Mmax+3*MA+4*MB+3*MC)',
            'frame': request.frame, 'output_case': request.output_case, 'case_kind': request.case_kind,
            'step_type': request.step_type, 'step_num': request.step_num,
            'moment_component': request.moment_component, 'segment_m': [request.start, request.end],
            'quarter_stations_m': points[1:4], 'Mmax': maximum, 'MA': moments[1], 'MB': moments[2], 'MC': moments[3],
            'moment_units': 'kN.m', 'basis': request.moment_diagram,
            'assumptions': 'User-confirmed major-axis bending of a symmetric I/H section, loading through shear center, both segment ends braced. Not a capacity or LTB resistance check.'}
