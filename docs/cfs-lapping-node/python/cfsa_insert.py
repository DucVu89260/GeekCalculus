"""v0.5C experimental multi-insert/delete XT records, preserving all opaque bytes."""
import hashlib, math
from pathlib import Path
from adapter import normalize, INCH_M
from cfsa_patch import layout, patch_copy, f32
from cfsa_reader import read_cfsa

RECORD=15

def export_copy(source_path, draft):
    src=Path(source_path).resolve()
    if src.suffix.lower()!='.cfsa' or not src.is_file(): raise ValueError('Invalid CFSA source')
    original=src.read_bytes(); baseline=normalize(src)
    old=baseline['supports']; new=draft.get('supports',[])
    if len(new)==len(old) and all(not s.get('is_new') for s in new):
        # Existing v0.5A logic only if identities unchanged; otherwise rebuild.
        if all(a.get('id')==b.get('id') for a,b in zip(old,new)):return patch_copy(src,draft)
    if draft.get('source',{}).get('sha256')!=hashlib.sha256(original).hexdigest():raise ValueError('Source changed: re-import')
    if baseline['warnings']:raise ValueError('Missing sections in SECTIONS')
    if not 2<=len(new)<=200:raise ValueError('Invalid support count')
    if draft.get('bearing_positions_m')!=baseline['bearing_positions_m']:raise ValueError('Main bearings changed')
    if 'combinations' in draft:raise ValueError('Combinations cannot be edited')
    mains=[s['x_m'] for s in old if s['type_code']==7]
    ids=[s['id'] for s in old]
    old_by_id={s['id']:s for s in old}
    used=set(); last=-math.inf; inserted=0; deleted=0
    for j,s in enumerate(new):
        x=float(s['x_m']);
        if not math.isfinite(x) or not(last+0.0001<x<=baseline['total_length_m']+0.0001):raise ValueError('Support coordinates must increase strictly')
        last=x
        if s.get('is_new') is True:
            inserted+=1
            if s.get('type_code')!=5:raise ValueError('Only new XT supported')
            if not any(a+0.0001<x<b-0.0001 for a,b in zip(mains,mains[1:])):raise ValueError('New XT outside spans')
            if s.get('id',0)>0:raise ValueError('New XT id must be temporary/nonpositive')
        else:
            sid=s.get('id')
            if sid in used or sid not in old_by_id:raise ValueError('Unknown or duplicate old support identity')
            used.add(sid);a=old_by_id[sid]
            if set(s)!=set(a):raise ValueError('Existing support schema changed')
            for k in a:
                if k!='x_m' and a[k]!=s[k]:raise ValueError(f'Support {sid} modified immutable {k}')
            if a['type_code']==7 and abs(x-a['x_m'])>0.000002:raise ValueError('XYT main bearing moved')
            if a['type_code']==5:
                if not any(l+0.0001<a['x_m']<r-0.0001 and l+0.0001<x<r-0.0001 for l,r in zip(mains,mains[1:])):raise ValueError('Old XT moved outside original span')
    deleted=len(old)-len(used)
    if any(a['id'] not in used and a['type_code']!=5 for a in old):raise ValueError('Cannot delete XYT/main support')
    if [s['id'] for s in new if s.get('type_code')==7]!=[s['id'] for s in old if s['type_code']==7]:raise ValueError('Main bearing identities changed')
    if inserted>60 or deleted>60:raise ValueError('Too many changes per export')
    if len(draft.get('members',[]))!=len(baseline['members']):raise ValueError('Member count changed')
    for a,b in zip(baseline['members'],draft['members']):
        for k in a:
            if k not in ('start_m','end_m') and a[k]!=b.get(k):raise ValueError('Member attribute changed: '+k)
        if not -10000<=float(b['start_m'])<float(b['end_m'])<=10000:raise ValueError('Bad member extents')
    if set(draft.get('loadings',{}))!=set(baseline['loadings']):raise ValueError('Load case names changed')
    for name,rows in baseline['loadings'].items():
        other=draft['loadings'][name]
        if len(rows)!=len(other):raise ValueError('Load row count changed')
        for a,b in zip(rows,other):
            if set(a)!=set(b):raise ValueError('Load schema changed')
            for k in ('type_code','angle_radians','factor'):
                if a[k]!=b[k]:raise ValueError('Immutable load attribute changed')
            if not -10000<=float(b['start_m'])<float(b['end_m'])<=10000:raise ValueError('Bad load extent')
    mem_off,sup_off,load_off,comb_off=layout(original)
    record_start=sup_off[0]['location_native']-1
    count_offset=record_start-1
    if original[count_offset]!=len(old):raise ValueError('Support record count layout mismatch')
    record_end=record_start+RECORD*len(old)
    if record_end>len(original):raise ValueError('Support table truncated')
    table=bytearray()
    for s in new:
        if s.get('is_new'):
            x=float(s['x_m'])
            l,r=next((l,r) for l,r in zip(mains,mains[1:]) if l<x<r)
            candidates=[v for v in old if v['type_code']==5 and l<v['x_m']<r]
            if not candidates:raise ValueError('Span without XT template unsupported')
            template=candidates[0]
            for k in ('type_code','bearing_native','k','flags_hex'):
                if s.get(k)!=template[k] or any(c[k]!=template[k] for c in candidates):raise ValueError('Inconsistent new XT template')
            template_bytes=original[record_start+(template['id']-1)*RECORD:record_start+template['id']*RECORD]
            rec=bytearray(template_bytes)
        else:
            sid=s['id'];rec=bytearray(original[record_start+(sid-1)*RECORD:record_start+sid*RECORD])
        if len(rec)!=RECORD or rec[0]!=5 and s['type_code']==5:raise ValueError('Broken support record')
        f32(rec,1,float(s['x_m'])/INCH_M)
        table.extend(rec)
    result=bytearray(original[:count_offset])+bytes([len(new)])+table+original[record_end:]
    new_mem,new_sup,new_load,new_comb=layout(result)
    shift=RECORD*(len(new)-len(old))
    if new_comb!=comb_off+shift or result[new_comb:]!=original[comb_off:]:raise ValueError('Combination block mutated')
    for a,b,offs in zip(baseline['members'],draft['members'],new_mem):
        for key in ('start_m','end_m'):
            if abs(float(a[key])-float(b[key]))>0.000002:f32(result,offs[key],float(b[key])/INCH_M)
    for name,rows in baseline['loadings'].items():
        for a,b,offs in zip(rows,draft['loadings'][name],new_load[name]):
            for key in ('start_m','end_m','w_start_native','w_end_native'):
                tol=0.000002 if key.endswith('_m') else 1e-10
                if abs(float(a[key])-float(b[key]))>tol:f32(result,offs[key],float(b[key])/INCH_M if key.endswith('_m') else float(b[key]))
    if result[new_comb:]!=original[comb_off:]:raise ValueError('Combination block changed')
    allow=set(range(count_offset,record_end))
    allow.update(o+delta for offs in mem_off for o in offs.values() for delta in range(4))
    allow.update(o+delta for rows in load_off.values() for offs in rows for o in offs.values() for delta in range(4))
    # Compare bytes outside rewritten table at old-to-new mapped offsets.
    for i in range(len(original)):
        if i in allow:continue
        j=i if i<count_offset else i+shift
        if original[i]!=result[j]:raise ValueError(f'Unexpected byte mutation at source offset {i}')
    output=src.with_name(src.stem+'_WEBTEST.cfsa')
    if output.exists():raise ValueError('Output exists; move/rename previous _WEBTEST.cfsa first')
    tmp=src.with_name(src.stem+'_WEBTEST.cfsa.tmp')
    try:
        with tmp.open('xb') as h:h.write(result)
        parsed=read_cfsa(tmp)
        if len(parsed['supports'])!=len(new) or len(parsed['members'])!=len(baseline['members']) or len(parsed['loadings'])!=len(baseline['loadings']):raise ValueError('Readback record count mismatch')
        for got,want in zip(parsed['supports'],new):
            if got['type_code']!=want['type_code'] or abs(got['location_native']*INCH_M-float(want['x_m']))>0.00002:raise ValueError('Readback support mismatch')
        tmp.rename(output)
    finally:
        if tmp.exists():tmp.unlink()
    return {'ok':True,'output':str(output),'support_count_before':len(old),'support_count_after':len(new),'added_xt':inserted,'deleted_xt':deleted,'combinations_unchanged':True,'experimental':True}
