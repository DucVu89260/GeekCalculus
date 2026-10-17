"""No force components from different rows are combined into a design action."""
from __future__ import annotations

import csv
import io
from collections import defaultdict
from .models import COMPONENTS, ExportRequest, ExtremeRequest, Filter, ForceRow, PositionRequest


def select(request: Filter):
    rows = request.dataset.rows
    if request.frames:
        missing = set(request.frames) - {r.frame for r in rows}
        if missing:
            raise ValueError('Requested frames are absent from dataset')
        rows = [r for r in rows if r.frame in request.frames]
    if request.output_cases:
        missing = set(request.output_cases) - {r.output_case for r in rows}
        if missing:
            raise ValueError('Requested output cases are absent from selected frames')
        rows = [r for r in rows if r.output_case in request.output_cases]
    if not rows:
        raise ValueError('No matching force rows')
    return rows


def extremes(request: ExtremeRequest):
    from .positions import position_samples
    rows = select(request)
    members = {m.frame:m for m in request.dataset.members}
    provenance, unavailable, source_rows = {}, [], []
    fractions = {'end_i':0.,'quarter':.25,'mid':.5,'three_quarter':.75,'end_j':1.}
    if request.position != 'all':
        sampled = position_samples(PositionRequest(dataset=request.dataset.model_copy(update={'rows':rows})))
        samples = [s for s in sampled['data'] if request.position == 'five' or s['fraction'] == fractions[request.position]]
        unavailable = [{k:v for k,v in s.items() if k != 'rows'} for s in samples if s['method'] == 'unavailable']
        rows = []
        for sample in samples:
            for data in sample['rows']:
                row = ForceRow.model_validate(data)
                rows.append(row)
                provenance[row.record_id] = {key:sample[key] for key in ('method','source_record_ids','weight')}
        source_ids = {identifier for data in provenance.values() for identifier in data['source_record_ids']}
        source_rows = [r for r in sampled['source_rows'] if r['record_id'] in source_ids]
    groups = defaultdict(list)
    for row in rows:
        groups[row.frame if request.scope == 'per_frame' else 'all'].append(row)

    def location(row):
        member = members.get(row.frame)
        length = member.length if member and member.units_code == 6 else None
        marks = ((0.,'End I'),(.25,'1/4 L'),(.5,'1/2 L'),(.75,'3/4 L'),(1.,'End J'))
        labels = [label for fraction,label in marks if length and abs(row.station-length*fraction) <= max(1e-6,length*1e-8)]
        return {'frame':row.frame,'element':row.element,'local_axis':'local_1_from_I',
                'station':row.station,'element_station':row.element_station,
                'relative_station':row.station/length if length else None,
                'position':', '.join(labels) if labels else 'Station khác',
                **provenance.get(row.record_id,{'method':'original','source_record_ids':[row.record_id],'weight':None})}

    def governing(value, tied):
        # Full tie IDs, with bounded row/location previews for readable responses.
        return {'value': value, 'record_ids': [r.record_id for r in tied],
                'tie_count': len(tied), 'rows': [r.model_dump() for r in tied[:20]],
                'locations':[location(r) for r in tied[:20]], 'rows_truncated': len(tied) > 20}

    output = []
    for group, group_rows in groups.items():
        for component in dict.fromkeys(request.components):
            low = min(getattr(r, component) for r in group_rows)
            high = max(getattr(r, component) for r in group_rows)
            absolute = max(abs(low), abs(high))
            output.append({
                'group': group, 'component': component,
                'min': governing(low, [r for r in group_rows if getattr(r, component) == low]),
                'max': governing(high, [r for r in group_rows if getattr(r, component) == high]),
                'absolute': governing(absolute, [r for r in group_rows if abs(getattr(r, component)) == absolute]),
            })
    return {**request.dataset.model_dump(exclude={'rows'}), 'scope': request.scope, 'position':request.position,
            'components':list(dict.fromkeys(request.components)), 'data': output,
            'unavailable_positions':unavailable,'source_rows':source_rows,
            'basis': 'exported_stations_only' if request.position == 'all' else 'whole_frame_position_samples',
            'warning': 'Independent component extremes are not one design action. Preserve each governing row vector; envelope/modal rows remain nonconcurrent. Position samples may use signed linear interpolation.'}


def connection_export(request: ExportRequest):
    rows = select(request)
    if request.record_ids:
        if set(request.record_ids) - {r.record_id for r in rows}:
            raise ValueError('Requested record_ids are absent from selected data')
        rows = [r for r in rows if r.record_id in request.record_ids]
    if any(r.concurrency != 'concurrent' or r.step_type.lower() in ('max', 'min', 'envelope', 'mode') for r in rows):
        raise ValueError('Envelope rows cannot represent concurrent connection actions; select constituent cases/steps')
    metadata = request.dataset.model_dump(exclude={'rows'})
    warning = 'Local section-cut forces, not joint actions. Map local axes, end-face signs, units and offsets for the target software. No vendor-specific import format is implied.'
    if request.format == 'json':
        return {**metadata, 'purpose': 'connection_interchange', 'warning': warning, 'rows': [r.model_dump() for r in rows]}
    stream = io.StringIO(newline='')
    metadata.pop('members', None)
    metadata.pop('missing_results', None)  # Missing outputs are documented in JSON, never force rows.
    member_lookup = {m.frame:m for m in request.dataset.members}
    fields = [*metadata.keys(), 'warning', 'section', 'section_type', *rows[0].model_dump().keys()]
    writer = csv.DictWriter(stream, fieldnames=fields)
    writer.writeheader()
    for row in rows:
        member = member_lookup.get(row.frame)
        record = {**metadata, 'warning': warning, 'section':member.section if member else '',
                  'section_type':member.section_type if member else '', **row.model_dump()}
        # Avoid spreadsheet formula execution from model/object/case names.
        record = {k: ("'" + v if isinstance(v, str) and v.lstrip().startswith(('=', '+', '-', '@')) else v) for k, v in record.items()}
        writer.writerow(record)
    return stream.getvalue()
