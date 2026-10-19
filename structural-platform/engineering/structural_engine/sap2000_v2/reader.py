"""Source-traceable member snapshots, never strength calculations or model writes."""
from __future__ import annotations
from contextlib import contextmanager
from datetime import datetime, timezone
from math import dist
import json
from pathlib import Path
import re
from ..member_forces.sap2000 import SapError, checked, outputs, ExtractionRequest
from .contract import API_NAME, BUILD_ID, SAP_VERSION, UNITS, REFERENCE_URL, REFERENCE_COMMIT
from .models import SnapshotRequest, TableRequest
from .reflection import RuntimeReader, block, field
from .registry import GETTERS, SHAPES
from .section_types import classify_section

REFERENCE = json.loads(Path(__file__).with_name('reference.json').read_text())
OK = ('ok', 'empty')


def material_name(value):
    # CSI uses the literal 'None' for an unassigned frame material overwrite.
    return value if isinstance(value,str) and value.strip() and value.strip().casefold()!='none' else None



@contextmanager
def units_session(sap):
    previous = sap.model.GetPresentUnits()
    if not isinstance(previous, int) or isinstance(previous, bool) or previous <= 0:
        raise SapError('SAP2000_V2_UNITS: Cannot establish original units')
    try:
        checked(sap.model.SetPresentUnits(6))
        yield previous
    finally:
        try:
            checked(sap.model.SetPresentUnits(previous))
        except Exception as error:
            raise SapError('SAP2000_V2_RESTORE_FAILED: Original units could not be restored. Check SAP before continuing.') from error


@contextmanager
def output_session(sap):
    available = sap.cases()
    setup = sap.model.Results.Setup
    saved = []
    for case in available:
        getter = setup.GetCaseSelectedForOutput if case['kind'] == 'case' else setup.GetComboSelectedForOutput
        saved.append((case, outputs(getter(case['name']), 1)[0]))
    try:
        yield available
    finally:
        try:
            checked(setup.DeselectAllCasesAndCombosForOutput())
            for case, selected in saved:
                setter = setup.SetCaseSelectedForOutput if case['kind'] == 'case' else setup.SetComboSelectedForOutput
                checked(setter(case['name'], bool(selected)))
        except Exception as error:
            raise SapError('SAP2000_V2_RESTORE_FAILED: Original output selections could not be restored.') from error


def canonical_properties(raw):
    """Exact dimensional scaling; SAP data is kept separately and not recomputed."""
    factors = {'Area':('A_mm2',1e6), 'As2':('As2_mm2',1e6), 'As3':('As3_mm2',1e6),
               'Torsion':('J_mm4',1e12), 'I22':('I22_mm4',1e12), 'I33':('I33_mm4',1e12),
               'S22':('S22_mm3',1e9), 'S33':('S33_mm3',1e9),
               'Z22':('Z22_mm3',1e9), 'Z33':('Z33_mm3',1e9), 'R22':('r22_mm',1000.), 'R33':('r33_mm',1000.)}
    return {name:field(raw,key)*factor for key,(name,factor) in factors.items()
            if isinstance(field(raw,key),(float,int)) and not isinstance(field(raw,key),bool)} if raw['status'] in OK else {}


def coverage(value):
    counts = {}
    def visit(node):
        if isinstance(node, dict):
            if isinstance(node.get('status'), str) and 'source' in node:
                status = node['status']; counts[status] = counts.get(status,0)+1
            for k,v in node.items():
                if k not in ('data','signature'): visit(v)
        elif isinstance(node,list):
            for item in node:visit(item)
    visit(value)
    return counts


class SteelReader:
    def __init__(self, sap, runtime=None):
        self.sap = sap
        self.runtime = runtime or RuntimeReader(sap.model)
        self.sections = {}
        self.materials = {}

    def read(self, key, **values):
        result = self.runtime.read(key, **values)
        reference = REFERENCE['methods'].get(key)
        if reference: result['reference'] = reference
        units={
            'local_axes':{'Ang':'degree'},'point_axes':{'Ang':'degree'},
            'nonprismatic':{'MyLength':'relative for MyType=1; m for MyType=2','EI22':'variation code','EI33':'variation code'},
            'releases':{'StartValue':['kN/m']*3+['kN·m/rad']*3,'EndValue':['kN/m']*3+['kN·m/rad']*3},
            'load_point':{'Val':'kN for MyType=1; kN·m for MyType=2','RD':'relative position','Dist':'m'},
            'load_distributed':{'Val1':'kN/m for MyType=1; kN·m/m for MyType=2','Val2':'same as Val1','RD1':'relative','RD2':'relative','Dist1':'m','Dist2':'m'},
            'matrix':{'Value':'direction cosines; dimensionless; original SAP array order'},
            'point_matrix':{'Value':'direction cosines; dimensionless; original SAP array order'},
            'section_properties':{'Area':'m²','As2':'m²','As3':'m²','Torsion':'m⁴','I22':'m⁴','I33':'m⁴','S22':'m³','S33':'m³','Z22':'m³','Z33':'m³','R22':'m','R33':'m'},
            'material_isotropic':{'e':'kN/m²','g':'kN/m²','u':'dimensionless','a':'1/°C'},
            'material_density':{'w':'kN/m³','m':'kN·s²/m⁴'},
            'steel_strength':{'Fy':'kN/m²','Fu':'kN/m²','eFy':'kN/m²','eFu':'kN/m²'},
            'joint_displacements':{**dict.fromkeys(('U1','U2','U3'),'m'),**dict.fromkeys(('R1','R2','R3'),'rad')},
            'joint_reactions':{**dict.fromkeys(('F1','F2','F3'),'kN'),**dict.fromkeys(('M1','M2','M3'),'kN·m')},
            'design_summary':{'Ratio':'dimensionless, SAP result only','Location':'m from frame I end'},
        }
        if key in units:result['field_units']=units[key]
        if key=='releases' and result['status'] in OK:
            result['dof_order']=['U1','U2','U3','R1','R2','R3']
            result['release_flag_meaning']='true = released; false = not released. Partial-fixity values retained separately.'
        if key=='end_offsets':result['field_units']={'Length1':'m','Length2':'m','RZ':'dimensionless rigid-zone factor'}
        return result

    def modifiers(self, key, name):
        result = self.read(key, Name=name)
        values = field(result,'Value')
        if result['status'] in OK:
            if not isinstance(values,list) or len(values)!=8:
                return block('invalid_data',GETTERS[key].path,reason='Expected eight CSI frame modifiers')
            result['components'] = dict(zip(('A','As2','As3','J','I22','I33','Mass','Weight'),values))
            result['units'] = 'dimensionless; separate property/object modifiers, not applied here'
        return result

    def section(self, name, *, trail=()):
        if name in trail or len(trail)>=8:
            return block('invalid_data','PropFrame.GetNonPrismatic',reason='Cyclic or excessively nested section references')
        if name in self.sections:return self.sections[name]
        kind = self.read('section_type',Name=name)
        code = field(kind,'PropType',field(kind,'MyType'))
        kind_name = self.sap.section_type_names.get(code,'Unknown')
        enum_name=kind_name
        normalized = re.sub('[^A-Z0-9]','',kind_name.upper()).removeprefix('SECTION')
        shape_key = SHAPES.get(normalized)
        geometry = self.read(shape_key,Name=name) if shape_key else block('unsupported','PropFrame geometry',reason='No verified shape getter for enum '+kind_name)
        # Older/different API signatures can leave the enum unresolved. A successful
        # typed GetISection read verifies geometry; never infer shape from its name.
        if not shape_key and normalized not in ('VARIABLE','NONPRISMATIC'):
            probe=self.read('shape_i',Name=name)
            if probe['status']=='ok':
                geometry=probe;shape_key='shape_i'
                if kind_name=='Unknown':kind_name='I (verified GetISection)'
            else:geometry={**geometry,'i_section_probe':probe}
        props = self.read('section_properties',Name=name)
        item = {'name':name,'type':kind,'type_name':kind_name,'geometry':geometry,
                'section_type':classify_section(enum_name,code,verified_i=shape_key=='shape_i' and geometry['status']=='ok'),
                'properties':props,'properties_mm':canonical_properties(props),
                'material_file':self.read('section_material_file',Name=name),
                'modifiers':self.modifiers('section_modifiers',name), 'components':[]}
        self.sections[name]=item
        if normalized=='VARIABLE' or 'NONPRISMATIC' in normalized:
            item['geometry']=self.read('nonprismatic',Name=name)
            starts,ends = field(item['geometry'],'StartSec'),field(item['geometry'],'EndSec')
            if item['geometry']['status'] in OK and isinstance(starts,list) and isinstance(ends,list) and len(starts)==len(ends):
                for child in dict.fromkeys(starts+ends):
                    if child in (*trail,name):
                        item['components'].append({'name':child,**block('invalid_data','PropFrame.GetNonPrismatic',reason='Cyclic section definition')})
                    else:
                        child_data=self.section(child,trail=(*trail,name));item['components'].append({'name':child,'section_type':child_data.get('section_type'),**(child_data if 'status' in child_data else {})})
        item['dimensions_mm']={key.casefold()+'_mm':value*1000. for key,value in (geometry.get('data') or {}).items()
                               if key.casefold() in ('t3','t2','tf','tw','t2b','tfb','dis') and isinstance(value,(int,float)) and not isinstance(value,bool)}
        if shape_key=='shape_i' and geometry['status'] in OK:
            item['i_dimensions_mm']={label:item['dimensions_mm'].get(key+'_mm') for key,label in
                [('t3','h'),('t2','bf_top'),('tf','tf_top'),('tw','tw'),('t2b','bf_bottom'),('tfb','tf_bottom')]}
        item['segments']=[]
        if normalized=='VARIABLE' or 'NONPRISMATIC' in normalized:
            raw=item['geometry']; arrays=[field(raw,k) for k in ('StartSec','EndSec','MyLength','MyType','EI33','EI22')]
            if raw['status'] in OK and all(isinstance(a,list) for a in arrays) and len({len(a) for a in arrays})==1:
                for i,(start,end,length,kind,ei33,ei22) in enumerate(zip(*arrays),1):
                    item['segments'].append({'segment':i,'start_section':start,'end_section':end,
                        'length':length,'length_type':kind,'length_unit':{1:'relative',2:'m'}.get(kind,'unknown'),
                        'EI33_variation':ei33,'EI22_variation':ei22})
        return item

    def material(self,name):
        if name in self.materials:return self.materials[name]
        kind=self.read('material_type',Name=name)
        iso=self.read('material_isotropic',Name=name,Temp=0.)
        density=self.read('material_density',Name=name)
        # Steel type is defined by CSI material enumeration: 1=Steel (reference GetMaterial).
        strength=self.read('steel_strength',Name=name,Temp=0.) if field(kind,'MatType')==1 else block('not_applicable','PropMaterial.GetOSteel_1',reason='Material is not confirmed as CSI Steel')
        normalized={}
        for source,target in [('e','E_MPa'),('g','G_MPa')]:
            value=field(iso,source)
            if isinstance(value,(int,float)):normalized[target]=value/1000.
        poisson=field(iso,'u')
        if isinstance(poisson,(int,float)):normalized['poisson_ratio']=poisson
        for source,target in [('Fy','Fy_MPa'),('Fu','Fu_MPa'),('eFy','expected_Fy_MPa'),('eFu','expected_Fu_MPa')]:
            value=field(strength,source)
            if isinstance(value,(int,float)):normalized[target]=value/1000.
        mass=field(density,'m')
        if isinstance(mass,(int,float)):normalized['mass_density_kg_m3']=mass*1000.
        self.materials[name]={'name':name,'type':kind,'isotropic':iso,'density':density,'steel_strength':strength,
                              'normalized':normalized,'temperature_C':0.,'basis':'SAP library values; no member strength/default inference'}
        return self.materials[name]

    def _materials_for(self,section,overwrite):
        names=[]
        for name in [section,*[c['name'] for c in self.sections.get(section,{}).get('components',[]) if c.get('status')!='invalid_data']]:
            data=self.sections.get(name,{})
            for source in (data.get('geometry',{}),data.get('material_file',{})):
                for key,value in (source.get('data') or {}).items():
                    if 'matprop' in key.casefold() and material_name(value):names.append(material_name(value))
        assigned=material_name(field(overwrite,'PropName'))
        if assigned:names.append(assigned)
        for name in dict.fromkeys(names):self.material(name)
        return {'library_materials':list(dict.fromkeys(names)), 'member_overwrite':overwrite,
                'effective_material':(assigned or (names[0] if len(set(names))==1 else None)) if overwrite['status'] in OK else None,
                'effective_material_basis':'explicit member overwrite' if overwrite['status'] in OK and assigned else
                  ('section material(s); no overwrite' if overwrite['status'] in OK else 'unconfirmed: material overwrite getter unavailable')}

    def design_setup(self,include_preferences=False):
        code=self.read('design_code')
        name=field(code,'CodeName') or ''
        active=re.sub('[^A-Z0-9]','',name.upper())=='AISC36010'
        result={'scope':'model_design_code','basis':'Model-wide preferences for the active design code; member overwrites remain separate',
                'code':code,'available':self.read('design_available'),
                'strength_combos':self.read('strength_combos'),'deflection_combos':self.read('deflection_combos'),
                'aisc360_10_active':active}
        if include_preferences:
            if active:
                result['preferences']=[{**entry,**self.read('preference',Item=entry['item'])}
                                      for entry in REFERENCE['aisc360_10']['preferences']['items']]
                provision=next((r for r in result['preferences'] if r['item']==3),{})
                result['design_method']={1.:'LRFD',2.:'ASD'}.get(field(provision,'Value'))
            else:result['preferences']=block('unsupported','DesignSteel.AISC360_10.GetPreference',reason='Active SAP design code is not confirmed AISC 360-10; item numbers are not guessed')
        return result

    def overwrites(self,frame,setup):
        if not setup['aisc360_10_active']:
            return block('unsupported','DesignSteel.AISC360_10.GetOverwrite',reason='Only source-indexed AISC 360-10 overwrites are enabled; actual code differs or cannot be read')
        result=[]
        for entry in REFERENCE['aisc360_10']['overwrites']['items']:
            index=entry['item']
            unit='m' if 10<=index<=15 else ('kN/m²' if index==35 else ('kN' if index in (37,38,41,42) else ('kN·m' if index in (39,40) else 'dimensionless_or_code')))
            result.append({**entry,**self.read('overwrite',Name=frame,Item=index),'units':unit,
                           'basis':'Keep ProgDet and Value separately; no effective program default is inferred'})
        return result

    def design_results(self,frame,setup):
        available=field(setup['available'],'return_value')
        source='DesignSteel.GetSummaryResults'
        if available is False:
            summary=block('not_designed',source,reason='Members have not been designed')
        elif available is True:
            summary=self.read('design_summary',Name=frame,ItemType=0)
            if summary['status'] in OK and (summary['status']=='empty' or field(summary,'NumberItems')==0):
                summary={**summary,'status':'not_designed','reason':'Members have not been designed'}
        else:
            summary=block('unavailable',source,reason='Cannot confirm SAP steel design availability; check getter status')
        status=summary['status']
        return {'status':status,'message':('Members have not been designed' if status=='not_designed' else
                    ('SAP Steel Design results available' if status in OK else 'SAP Steel Design results could not be read')),
                'design_section':self.read('design_section',Name=frame),'summary':summary,
                'basis':'Read existing results only; design availability is model-wide, summary is queried for this frame. No StartDesign.'}

    def load_catalog(self,requested):
        cases=requested or [type('Case',(),{'name':c['name'],'kind':c['kind']})() for c in self.sap.cases()]
        catalog={}
        def visit(case,trail=()):
            key=case.kind+':'+case.name
            if key in trail:
                catalog[key]={'status':'invalid_data','reason':'Cyclic combo reference'};return
            if key in catalog:return
            if case.kind=='combination':
                kind=self.read('combo_type',Name=case.name)
                components=self.read('combo_components',Name=case.name)
                catalog[key]={'kind':kind,'components':components}
                names,kinds=field(components,'CName',[]),field(components,'CNameType',[])
                if len(names)!=len(kinds):return
                for name,kind in zip(names,kinds):
                    if kind in (0,1):visit(type('Case',(),{'name':name,'kind':'case' if kind==0 else 'combination'})(),(*trail,key))
            else:
                kind=self.read('case_type',Name=case.name)
                entry={'type':kind};catalog[key]=entry
                code=field(kind,'CaseType')
                if code==1:entry['loads']=self.read('linear_loads',Name=case.name)
                if code==2:
                    entry['loads']=self.read('nonlinear_loads',Name=case.name)
                    entry['geometric_nonlinearity']=self.read('nonlinear_geometry',Name=case.name)
        for case in cases:visit(case)
        return {'cases_and_combinations':catalog,'patterns':self.read('load_patterns'),
                'basis':'Original combo types/factors; not expanded algebraically or assumed concurrent'}

    def snapshot(self,request:SnapshotRequest):
        sap=self.sap
        before=sap.model_info()
        if request.expected_model!=before['model']:raise SapError('SAP2000_MODEL_CHANGED: Reconnect before reading V2 data')
        groups=set(request.groups)
        model_only=groups=={'design_setup'}
        frames=[] if model_only else list(dict.fromkeys(sap.selection() if request.frames is None else request.frames))
        if not model_only and (not frames or len(frames)>200 or set(frames)-set(sap.names(sap.model.FrameObj))):
            raise SapError('SAP2000_V2_SELECTION: Select 1–200 existing frame objects')
        members=[];model_data={};force_data=None
        with units_session(sap) as original_units:
            setup=self.design_setup('design_setup' in groups) if groups & {'design_setup','design_overwrites','design_results'} else None
            if setup:model_data['steel_design']=setup
            for frame in frames:
                assignment=self.read('section_assignment',Name=frame)
                section=field(assignment,'PropName')
                auto=field(assignment,'SAuto')
                member={'frame':frame,'analysis_section':section,'auto_select_list':auto,'data':{}}
                members.append(member)
                if 'identity' in groups:
                    member['data']['identity']={key:self.read(key,Name=frame) for key in ('guid','groups','section_assignment','design_procedure')}
                if groups & {'sections','materials','modifiers'} and section:self.section(section)
                if 'sections' in groups:
                    member['data']['sections']={'assignment':assignment,'nonprismatic_assignment':self.read('nonprismatic_assignment',Name=frame),
                                               'auto_select':self.read('auto_select',Name=auto) if auto else block('not_applicable','PropFrame.GetAutoSelectSteel',reason='No auto-select list assigned')}
                if 'materials' in groups:
                    member['data']['materials']=self._materials_for(section,self.read('material_overwrite',Name=frame))
                if 'geometry' in groups or 'displacements' in groups:
                    points=self.read('points',Name=frame);pi,pj=field(points,'Point1'),field(points,'Point2')
                    geometry={'points':points,'ends':{}}
                    for end,name in [('I',pi),('J',pj)]:
                        if name:geometry['ends'][end]={'point':name,'coordinates':self.read('coordinates',Name=name,CSys='Global'),
                                                      'local_axes':self.read('point_axes',Name=name),'matrix':self.read('point_matrix',Name=name,IsGlobal=True)}
                    if all(end in geometry['ends'] for end in ('I','J')):
                        coords=[[field(geometry['ends'][end]['coordinates'],c) for c in ('X','Y','Z')] for end in ('I','J')]
                        if all(isinstance(v,(int,float)) for row in coords for v in row):geometry['length_m']=dist(*coords)
                    for key in ('local_axes','advanced_local_axes','matrix'):geometry[key]=self.read(key,Name=frame,IsGlobal=True)
                    member['data']['geometry']=geometry
                if 'assignments' in groups:member['data']['assignments']={key:self.read(key,Name=frame) for key in ('releases','insertion','end_offsets','springs','hinges','material_temperature')}
                if 'modifiers' in groups:member['data']['modifiers']={'member':self.modifiers('member_modifiers',frame),'section':self.sections.get(section,{}).get('modifiers')}
                if 'loads' in groups:member['data']['loads']={key:self.read(key,Name=frame,ItemType=0) for key in ('load_point','load_distributed','load_gravity','load_temperature')}
                if 'design_overwrites' in groups:member['data']['design_overwrites']=self.overwrites(frame,setup)
                if 'design_results' in groups:member['data']['design_results']=self.design_results(frame,setup)
            if 'loads' in groups:model_data['loads']=self.load_catalog(request.output_cases)
            if 'forces' in groups:
                if request.output_cases and before['locked']:
                    force_data=sap.extract(ExtractionRequest(frames=frames,output_cases=request.output_cases,expected_model=request.expected_model)).model_dump(mode='json')
                else:model_data['forces']=block('input_required','Results.FrameForce',reason='Select output cases and run analysis in SAP first')
            if 'displacements' in groups:
                if not request.output_cases or not before['locked']:
                    model_data['displacements']=block('input_required','Results.JointDispl/JointReact',reason='Select output cases and analyze/lock the model first')
                else:self.responses(request,members)
            if sap.model.GetModelFilename()!=before['model']:raise SapError('SAP2000_MODEL_CHANGED: Model changed during snapshot; no mixed-model data accepted')
        result={'api_name':API_NAME,'schema_version':'2.0','build_id':BUILD_ID,'sap2000_version':SAP_VERSION,
                'model':before['model'],'pid':before['pid'],'locked':before['locked'],'extracted_at':datetime.now(timezone.utc).isoformat(),
                'units':UNITS,'original_units_code':original_units,'requested_groups':request.groups,
                'reference':{'url':REFERENCE_URL,'commit':REFERENCE_COMMIT,'basis':'Reference docs; installed DLL signatures control actual calls'},
                'members':members,'sections':self.sections,'materials':self.materials,'model_data':model_data,
                'force_dataset':force_data,'restored_state':{'units':True,'output_selection':True},
                'warnings':['SAP library/analysis/design values are separate; no GeekCalculus capacity or Cb calculation.',
                            'Section22/33 and frame local123 are not canonical XY; point responses retain point-local axes.',
                            'Nonprismatic/General/SD and overwrites require engineering review before automatic design import.']}
        result['coverage']=coverage(result)
        result['status']='partial' if any(k not in ('ok','empty','not_applicable') and v for k,v in result['coverage'].items()) else 'ok'
        return result

    def responses(self,request,members):
        sap=self.sap;setup=sap.model.Results.Setup
        with output_session(sap) as available:
            lookup={(c['kind'],c['name']) for c in available}
            if any((c.kind,c.name) not in lookup for c in request.output_cases):raise SapError('Unknown V2 output case')
            statuses={c['name']:c['results_available'] for c in available if c['kind']=='case'}
            for case in request.output_cases:
                missing=sap.missing_dependencies(case,statuses)
                if missing:
                    for member in members:member['data'].setdefault('displacements',[]).append({'output_case':case.model_dump(),'result':block('unavailable','Results',reason='Unfinished underlying cases: '+', '.join(missing))})
                    continue
                checked(setup.DeselectAllCasesAndCombosForOutput())
                setter=setup.SetCaseSelectedForOutput if case.kind=='case' else setup.SetComboSelectedForOutput
                checked(setter(case.name,True))
                cached={}
                for member in members:
                    ends={}
                    for end,point in member['data']['geometry']['ends'].items():
                        name=point['point']
                        if name not in cached:cached[name]={key:self.read(key,Name=name,ItemTypeElm=0) for key in ('joint_displacements','joint_reactions')}
                        ends[end]=cached[name]
                    member['data'].setdefault('displacements',[]).append({'output_case':case.model_dump(),
                        'concurrency':sap.concurrency(case,statuses=statuses),'ends':ends,
                        'frame_end_forces':self.read('frame_joint_forces',Name=member['frame'],ItemTypeElm=0),
                        'basis':'Point-element local axes; endpoint response only, not full-span deflection'})

    def table(self,request:TableRequest):
        if self.sap.model.GetModelFilename()!=request.expected_model:raise SapError('SAP2000_MODEL_CHANGED: Reconnect before table read')
        with units_session(self.sap):
            inventory=self.read('tables');keys=field(inventory,'TableKey',[])
            if request.table_key not in keys:raise SapError('SAP2000_V2_TABLE: Choose an actual runtime table key')
            fields=self.read('table_fields',TableKey=request.table_key)
            raw=self.read('table_array',TableKey=request.table_key,FieldKeyList=['All'],GroupName='All')
            result={'api_name':API_NAME,'model':request.expected_model,'table_key':request.table_key,'units':UNITS,
                    'fields':fields,'raw':raw,'rows':None,'columns':None,'truncated':False,
                    'basis':'SAP database display state; no case/group display selection changed'}
            if raw['status'] in OK:
                columns=field(raw,'FieldsKeysIncluded') or field(raw,'FieldKeysIncluded')
                values=field(raw,'TableData');count=field(raw,'NumberRecords')
                if not isinstance(columns,list) or not columns or not isinstance(values,list) or not isinstance(count,int) or len(values)!=count*len(columns):
                    result['raw']=block('invalid_data','DatabaseTables.GetTableForDisplayArray',reason='Table dimensions do not match');return result
                limit=min(count,request.max_records)
                result.update(columns=columns,rows=[values[i*len(columns):(i+1)*len(columns)] for i in range(limit)],
                              total_records=count,truncated=limit<count)
                # Do not defeat the requested serialization bound by also embedding all raw cells.
                raw['data']={k:v for k,v in raw['data'].items() if k.casefold()!='tabledata'}
            if self.sap.model.GetModelFilename()!=request.expected_model:raise SapError('SAP2000_MODEL_CHANGED: Table read discarded')
            return result
