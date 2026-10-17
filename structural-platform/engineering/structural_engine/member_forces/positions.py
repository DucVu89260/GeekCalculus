"""Signed samples at frame quarter points; original SAP rows remain untouched."""
from bisect import bisect_left
from collections import defaultdict
from .models import COMPONENTS, ForceRow, PositionRequest

MARKS = (0., .25, .5, .75, 1.)


def position_samples(request: PositionRequest):
    dataset = request.dataset
    members = {m.frame:m for m in dataset.members}
    groups = defaultdict(list)
    for row in dataset.rows:
        groups[(row.frame,row.case_kind,row.output_case,row.step_type,row.step_num)].append(row)
    if len(groups)*5 > 100000:
        raise ValueError('Quarter-point sampling exceeds 100000 samples; reduce frames or output cases')
    used_ids = {row.record_id for row in dataset.rows}
    data = []
    for key, rows in groups.items():
        frame, kind, output, step, step_num = key
        member = members.get(frame)
        length = member.length if member and member.units_code == 6 else None
        by_station = defaultdict(list)
        for row in rows:
            by_station[row.station].append(row)
        stations = sorted(by_station)
        for fraction in MARKS:
            sample = dict(frame=frame,case_kind=kind,output_case=output,step_type=step,step_num=step_num,
                          fraction=fraction,station=length*fraction if length else None,
                          method='unavailable',rows=[],source_record_ids=[],weight=None,reason=None)
            data.append(sample)
            if not length:
                sample['reason'] = 'thiếu chiều dài I–J; hãy xuất lại bằng bản API mới'
                continue
            target = length*fraction
            tolerance = max(1e-6,length*1e-8)
            # Retain all sides of a discontinuity when SAP supplied the target station.
            index = bisect_left(stations,target-tolerance)
            exact = []
            while index < len(stations) and stations[index] <= target+tolerance:
                exact.extend(by_station[stations[index]])
                index += 1
            if exact:
                sample.update(method='original',rows=[r.model_dump(mode='json') for r in exact],
                              source_record_ids=[r.record_id for r in exact])
                continue
            if fraction in (0.,1.):
                sample['reason'] = 'thiếu station đầu I/J; không ngoại suy'
                continue
            right_index = bisect_left(stations,target)
            if right_index == 0 or right_index == len(stations):
                sample['reason'] = 'không có hai station kẹp mốc; không ngoại suy'
                continue
            x0,x1 = stations[right_index-1:right_index+1]
            left,right = defaultdict(list),defaultdict(list)
            for row in by_station[x0]:left[row.element].append(row)
            for row in by_station[x1]:right[row.element].append(row)
            common = left.keys() & right.keys()
            if len(common) != 1:
                sample['reason'] = 'station lân cận khác element hoặc có nhiều nhánh; không nội suy qua gián đoạn'
                continue
            element = next(iter(common))
            if len(left[element]) != 1 or len(right[element]) != 1:
                sample['reason'] = 'station nguồn trùng trên cùng element; không chọn tùy ý hoặc lấy trung bình'
                continue
            a,b = left[element][0],right[element][0]
            if a.concurrency != b.concurrency or b.element_station <= a.element_station:
                sample['reason'] = 'thông tin hai station nguồn không nhất quán'
                continue
            weight = (target-x0)/(x1-x0)
            # Interpolate signed values. Never use abs() for force components.
            values = {c:(1-weight)*getattr(a,c)+weight*getattr(b,c) for c in COMPONENTS}
            record_id = f'position-{len(data)}'
            while record_id in used_ids:record_id += '-derived'
            used_ids.add(record_id)
            row = ForceRow(**{**a.model_dump(),**values,
                'record_id':record_id, 'station':target,
                'element_station':(1-weight)*a.element_station+weight*b.element_station})
            sample.update(method='linear',rows=[row.model_dump(mode='json')],
                          source_record_ids=[a.record_id,b.record_id],weight=weight)
    source_ids = {record_id for sample in data for record_id in sample['source_record_ids']}
    return {**dataset.model_dump(mode='json',exclude={'rows'}),
            'source_rows':[r.model_dump(mode='json') for r in dataset.rows if r.record_id in source_ids],
            'basis':'whole_frame_I_J','data':data,
            'note':'Signed linear samples at whole-frame quarter points; not a Cb calculation. Original rows are unchanged. Envelope/modal samples remain nonconcurrent.'}
