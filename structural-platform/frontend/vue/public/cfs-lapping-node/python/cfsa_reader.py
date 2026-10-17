"""Experimental READ-ONLY CFS 11.0.2 .cfsa parser for observed 8-span file.
Only accepts observed binary layout. NEVER writes .cfsa.
"""
import struct, json, hashlib, sys
from pathlib import Path

class Reader:
    def __init__(self, data): self.b=data; self.p=0
    def take(self,n):
        if self.p+n>len(self.b): raise ValueError('Truncated CFSA file')
        x=self.b[self.p:self.p+n]; self.p+=n; return x
    def u8(self):return self.take(1)[0]
    def u16(self):return struct.unpack('<H',self.take(2))[0]
    def f32(self):return struct.unpack('<f',self.take(4))[0]
    def f64(self):return struct.unpack('<d',self.take(8))[0]

def read_cfsa(path):
    path=Path(path); data=path.read_bytes();r=Reader(data)
    if len(data)<150 or data[0]!=11:raise ValueError('Unknown/unsupported CFSA header; read-only parser aborted')
    header=r.take(10)
    title=r.take(120).decode('latin1').strip()
    unknown=r.take(2)
    n_members=r.u8()
    if not 1<=n_members<=100:raise ValueError('Unexpected member count')
    members=[]
    for i in range(n_members):
        slen=r.u16()
        if not 1<=slen<=240:raise ValueError('Invalid section path length')
        section_path=r.take(slen).decode('latin1')
        opaque_double=r.f64()
        start=r.f32();end=r.f32()
        tail=r.take(21)
        if start>end: raise ValueError('Member coordinate ordering invalid')
        members.append(dict(id=i+1,section=Path(section_path.replace('\\','/')).stem,section_file=section_path,start_native=start,end_native=end,unknown_material_value=opaque_double))
    ns=r.u8()
    if not 2<=ns<=200:raise ValueError('Unexpected support count')
    supports=[]
    for i in range(ns):
        kind=r.u8();x=r.f32();bearing=r.f32();k=r.f32();flags=r.take(2)
        supports.append(dict(id=i+1,type_code=kind,location_native=x,bearing_native=bearing,k=k,flags_hex=flags.hex()))
    nl=r.u8()
    if not 1<=nl<=60:raise ValueError('Unexpected loading count')
    loads={}
    for i in range(nl):
        name=r.take(20).decode('latin1').strip();n=r.u8()
        if n>100:raise ValueError('Unexpected load row count')
        rows=[]
        for j in range(n):
            kind=r.u8();angle=r.f32();start=r.f32();end=r.f32();w1=r.f32();w2=r.f32();factor=r.f32()
            rows.append(dict(type_code=kind,angle_radians=angle,start_native=start,end_native=end,w_start_native=w1,w_end_native=w2,factor=factor))
        loads[name]=rows
    combo_start=r.p
    # Leave all combinations completely opaque and untouched.
    combo_blob=data[combo_start:]
    # Native length values appear consistent with inches, but do not assert conversion as proven.
    return dict(schema_version=2,source_file=path.name,source_sha256=hashlib.sha256(data).hexdigest(),title=title,
                source_format='CFS 11 binary; experimental read-only decoder',
                native_units='unverified (coordinates appear to be inches)',
                members=members,supports=supports,loadings=loads,
                combinations=dict(status='preserved_in_original_only',opaque_bytes=len(combo_blob),sha256=hashlib.sha256(combo_blob).hexdigest()),
                metadata=dict(member_count=n_members,support_count=ns,loading_case_count=nl,combination_block_offset=combo_start,
                              warning='DO NOT write converted JSON into .cfsa; units and enum codes are unverified.'))

if __name__=='__main__':
    if len(sys.argv)<2:raise SystemExit('Usage: py -3 cfsa_reader.py model.cfsa [output.json]')
    model=read_cfsa(sys.argv[1]);out=Path(sys.argv[2]) if len(sys.argv)>2 else Path(sys.argv[1]).with_suffix('.import.json')
    out.write_text(json.dumps(model,indent=2,ensure_ascii=False),encoding='utf-8')
    print('Read-only JSON written:',out,'members:',len(model['members']),'supports:',len(model['supports']),'loadings:',len(model['loadings']))
