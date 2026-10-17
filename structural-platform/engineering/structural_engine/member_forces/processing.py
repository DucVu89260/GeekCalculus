"""No force components from different rows are combined into a design action."""
from __future__ import annotations

import csv
import io
from collections import defaultdict
from .models import COMPONENTS, ExportRequest, ExtremeRequest, Filter


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
    groups = defaultdict(list)
    for row in select(request):
        groups[row.frame if request.scope == 'per_frame' else 'all'].append(row)
    def governing(value, tied):
        # Preserve every tie by ID without expanding full force vectors millions of times.
        return {'value': value, 'record_ids': [r.record_id for r in tied],
                'tie_count': len(tied), 'rows': [r.model_dump() for r in tied[:20]],
                'rows_truncated': len(tied) > 20}

    output = []
    for group, rows in groups.items():
        for component in dict.fromkeys(request.components):
            low = min(getattr(r, component) for r in rows)
            high = max(getattr(r, component) for r in rows)
            absolute = max(abs(low), abs(high))
            output.append({
                'group': group, 'component': component,
                'min': governing(low, [r for r in rows if getattr(r, component) == low]),
                'max': governing(high, [r for r in rows if getattr(r, component) == high]),
                'absolute': governing(absolute, [r for r in rows if abs(getattr(r, component)) == absolute]),
            })
    return {**request.dataset.model_dump(exclude={'rows'}), 'scope': request.scope, 'data': output,
            'basis': 'exported_stations_only',
            'warning': 'Extremes are limited to exported stations and steps; envelope rows are not concurrent actions.'}


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
