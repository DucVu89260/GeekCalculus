"""Constrained experimental CFSA binary patcher. NEVER overwrites the source.
Only member coordinates, existing load coordinates/magnitudes, or XT support positions can change.
Unknown bytes, section references, support records, and opaque combinations are preserved.
Requires independent verification with CFS before engineering use.
"""
import hashlib, math, struct
from pathlib import Path
from cfsa_reader import read_cfsa, Reader
from adapter import normalize, INCH_M

def f32(data, offset, value):
    if not math.isfinite(float(value)): raise ValueError('Nonfinite field value')
    if abs(value)>1e8:raise ValueError('Value out of bound')
    struct.pack_into('<f',data,offset,float(value))

def layout(data):
    r=Reader(data);r.take(10+120+2)
    count=r.u8();member=[]
    if not 1<=count<=100:raise ValueError('Member count invalid')
    for _ in range(count):
        n=r.u16();r.take(n);r.take(8)
        member.append({'start_m':r.p,'end_m':r.p+4});r.take(8+21)
    ns=r.u8()
    if not 2<=ns<=200:raise ValueError("Support count invalid")
    supports=[]
    for _ in range(ns):
        code=r.u8();position=r.p;r.take(4);r.take(4+4+2)
        supports.append({"type_code":code,"location_native":position})
    nl=r.u8();loads={}
    for _ in range(nl):
        name=r.take(20).decode('latin1').strip();n=r.u8();loads[name]=[]
        for _ in range(n):
            r.take(1+4);start=r.p;end=start+4;ws=end+4;we=ws+4
            r.take(4*5)
            loads[name].append({'start_m':start,'end_m':end,'w_start_native':ws,'w_end_native':we})
    return member,supports,loads,r.p

def patch_copy(source_path,draft):
    src=Path(source_path).resolve()
    if not src.is_file() or src.suffix.lower()!='.cfsa': raise ValueError('Expected existing .cfsa source')
    original=src.read_bytes()
    if hashlib.sha256(original).hexdigest()!=draft.get('source',{}).get('sha256'):
        raise ValueError('SOURCE HASH MISMATCH: re-import original CFSA and save a new draft')
    if not (src.parent/'SECTIONS').is_dir():raise ValueError('SECTIONS subdirectory missing')
    baseline=normalize(src)
    if baseline['warnings']:raise ValueError('Missing referenced .cfss; repair SECTIONS first')
    if len(draft.get('members',[]))!=len(baseline['members']):raise ValueError('Member count changed')
    existing=baseline['supports']; proposed=draft.get('supports')
    if not isinstance(proposed,list) or len(proposed)!=len(existing):
        raise ValueError('Support count changed; v0.5A only moves existing XT nodes')
    # Compare all fields except x_m, and allow movement for XT (native code 5) only.
    for i,(old,new) in enumerate(zip(existing,proposed)):
        if not isinstance(new,dict):raise ValueError(f'Support {i+1}: invalid object')
        if new.keys()!=old.keys():raise ValueError(f'Support {i+1}: field schema changed')
        for key in old:
            if key!='x_m' and new[key]!=old[key]:raise ValueError(f'Support {i+1}: {key} modified; disallowed')
        x=float(new['x_m'])
        if not math.isfinite(x) or x<0:raise ValueError(f'Support {i+1}: invalid coordinate')
        if old['type_code']!=5 and abs(x-old['x_m'])>0.000002:
            raise ValueError(f'Support {i+1}: only XT (type 5) nodes may move')
        if i>0 and x<=float(proposed[i-1]['x_m'])+0.000001:
            raise ValueError(f'Support {i+1}: coordinates must strictly increase')
    # Each XT must remain between its original pair of main bearings.
    main=[s['x_m'] for s in existing if s['type_code']==7]
    if len(main)<2:raise ValueError('Main support geometry invalid')
    for i,(old,new) in enumerate(zip(existing,proposed)):
        if old['type_code']!=5:continue
        x0=old['x_m']; x=float(new['x_m'])
        bounds=[(a,b) for a,b in zip(main,main[1:]) if a<x0<b]
        if len(bounds)!=1 or not(bounds[0][0]+0.0001<x<bounds[0][1]-0.0001):
            raise ValueError(f'Support {i+1}: moved outside original span')
    if draft.get('bearing_positions_m')!=baseline['bearing_positions_m']:raise ValueError('Bearing list changed')
    if set(draft.get('loadings',{}))!=set(baseline['loadings']):raise ValueError('Loading case set changed')
    if 'combinations' in draft:raise ValueError('Top-level combinations must not be present')
    member_offsets,support_offsets,load_offsets,comb_start=layout(original)
    if len(member_offsets)!=len(baseline['members']):raise ValueError('Parser mismatch')
    result=bytearray(original);changed=[]
    for i,(old,new,ofs) in enumerate(zip(baseline['members'],draft['members'],member_offsets)):
        if (new.get('section_file')!=old['section_file'] or new.get('section')!=old['section']):
            raise ValueError(f'Member {i+1}: section changes not permitted in experimental export')
        if new.get('id')!=old['id']:raise ValueError('Member identities changed')
        start=float(new['start_m']);end=float(new['end_m'])
        if not (-10000<=start<end<=10000):raise ValueError('Invalid member geometry')
        for key,v in [('start_m',start),('end_m',end)]:
            if abs(v-old[key])>0.000002:
                f32(result,ofs[key],v/INCH_M);changed.append(f'member[{i+1}].{key}')
    for i,(old,new,ofs) in enumerate(zip(baseline['supports'],draft['supports'],support_offsets)):
        x=float(new['x_m'])
        if old['type_code']==5 and abs(x-old['x_m'])>0.000002:
            f32(result,ofs['location_native'],x/INCH_M)
            changed.append(f'support[{i+1}].x_m')
    for name,old_rows in baseline['loadings'].items():
        new_rows=draft['loadings'][name];offset_rows=load_offsets[name]
        if len(new_rows)!=len(old_rows):raise ValueError(f'{name}: load row count changed')
        for j,(old,new,ofs) in enumerate(zip(old_rows,new_rows,offset_rows)):
            for field in ('type_code','angle_radians','factor'):
                if new.get(field)!=old.get(field):raise ValueError(f'{name}[{j}]: {field} changed')
            for key in ('start_m','end_m','w_start_native','w_end_native'):
                v=float(new[key]);ov=float(old[key]);tol=0.000002 if key.endswith('_m') else 1e-10
                if abs(v-ov)>tol:
                    native=v/INCH_M if key.endswith('_m') else v
                    f32(result,ofs[key],native);changed.append(f'{name}[{j}].{key}')
            if not -10000<=float(new['start_m'])<float(new['end_m'])<=10000:raise ValueError('Invalid load region')
    # Full local roundtrip check in addition to the allowlisted-byte check.
    if not changed:raise ValueError('Nothing changed compared with source')
    if result[comb_start:]!=original[comb_start:]:raise ValueError('Combination bytes changed — aborted')
    allow={o+delta for ofs in member_offsets for o in ofs.values() for delta in range(4)}
    allow.update({ofs['location_native']+delta for ofs in support_offsets for delta in range(4) if ofs['type_code']==5})
    allow.update({o+delta for rows in load_offsets.values() for ofs in rows for o in ofs.values() for delta in range(4)})
    differences=[i for i,(a,b) in enumerate(zip(original,result)) if a!=b]
    if any(i not in allow for i in differences):raise ValueError('Unexpected byte difference — aborted')
    # Validate patched model with the same parser before write.
    output=src.with_name(src.stem+'_WEBTEST.cfsa')
    if output.exists():raise ValueError('Output already exists: rename/move it before another export')
    # Reparse from a temporary file with original-layout read rules before final replacement.
    temp=src.with_name(src.stem+'_WEBTEST.cfsa.tmp')
    try:
        with temp.open('xb') as h:h.write(result)
        read_cfsa(temp)
        temp.rename(output)
    finally:
        if temp.exists():temp.unlink()
    return {'ok':True,'output':str(output),'source_sha256':hashlib.sha256(original).hexdigest(),
            'output_sha256':hashlib.sha256(result).hexdigest(),'changed_fields':changed,
            'changed_byte_count':len(differences),'combinations_unchanged':True,
            'note':'EXPERIMENTAL COPY ONLY. Close/reopen in CFS and visually check all inputs. Do not use for design before validation.'}
