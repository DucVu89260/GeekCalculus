"""CFS read-only normalization for v0.3; preserve unknown native codes and units."""
from pathlib import Path
from cfsa_reader import read_cfsa

INCH_M = 0.0254  # provisional; verified against nominal geometry in CFS before engineering use

def normalize(path):
    p = Path(path).resolve()
    raw = read_cfsa(p)
    sections_dir = p.parent / 'SECTIONS'
    catalog = sorted(f.name for f in sections_dir.glob('*.cfss')) if sections_dir.is_dir() else []
    members=[]
    for m in raw['members']:
        filename=Path(m['section_file'].replace('\\','/')).name
        candidates = [sections_dir / filename]
        members.append({'id':m['id'],'section':m['section'],'section_file':filename,
          'section_found':candidates[0].is_file(),
          'start_m':round(m['start_native']*INCH_M,6),'end_m':round(m['end_native']*INCH_M,6),
          'start_native':m['start_native'],'end_native':m['end_native']})
    supports=[{'id':s['id'],'type_code':s['type_code'],'x_m':round(s['location_native']*INCH_M,6),
      'location_native':s['location_native'],'bearing_native':s['bearing_native'],
      'flags_hex':s['flags_hex'],'k':s['k']} for s in raw['supports']]
    loads={}
    for name,rows in raw['loadings'].items():
        loads[name]=[{'type_code':r['type_code'], 'angle_radians':r['angle_radians'],
            'start_m':round(r['start_native']*INCH_M,6), 'end_m':round(r['end_native']*INCH_M,6),
            'w_start_native':r['w_start_native'],'w_end_native':r['w_end_native'],
            'factor':r['factor']} for r in rows]
    # Native positions of support type 7 appear to be main bearing locations in this file;
    # preserve originals and label this inference rather than asserting it as fact.
    bearings=[s['x_m'] for s in supports if s['type_code']==7]
    lengths=[round(bearings[i+1]-bearings[i],6) for i in range(len(bearings)-1)]
    overlaps=[{'left_member':i+1,'right_member':i+2,
        'length_m':round(max(0,members[i]['end_m']-members[i+1]['start_m']),6)} for i in range(len(members)-1)]
    return {'schema_version':3,'name':raw['title'].strip() or p.stem,'source':{
        'filename':p.name,'sha256':raw['source_sha256'],'read_only':True,
        'native_length_assumption':'inch (provisional)',
        'native_load_units':'unknown; do not treat as kN/m',
        'support_type_mapping':'type_code 7 assumed main support; 5 assumed intermediate restraint (unverified)',
        'combinations':{'status':'never imported into draft','opaque_block_sha256':raw['combinations']['sha256']}},
      'sections_directory':str(sections_dir),'section_catalog':catalog,'members':members,
      'supports':supports,'loadings':loads,'span_lengths_m':lengths,'bearing_positions_m':bearings,
      'overlaps':overlaps,'total_length_m':round(max(m['end_m'] for m in members)-min(m['start_m'] for m in members),6),'geometry_min_m':round(min(m['start_m'] for m in members),6),'geometry_max_m':round(max(m['end_m'] for m in members),6),
      'warnings':(['Missing SECTIONS directory'] if not sections_dir.is_dir() else [])+
           ([f"Section not found: {m['section_file']}" for m in members if not m['section_found']])}
