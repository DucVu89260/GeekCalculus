from contextlib import contextmanager
from structural_engine.member_forces.sap2000 import Sap2000
from structural_engine.sap2000_v2.reflection import block
from structural_engine.sap2000_v2.registry import GETTERS
from test_sap2000_connector import FakeModel

class SteelModel(FakeModel):
    def __init__(self):
        super().__init__();self.design_code='AISC 360-10';self.design_available=True;self.fail_key=None;self.v2_calls=[]
        self.coords={'F1I':(0.,0.,0.),'F1J':(3.,4.,0.),'F2I':(3.,4.,0.),'F2J':(3.,4.,12.)}
        self.PointObj.GetCoordCartesian=lambda point,csys:(*self.coords[point],0)

class FixtureRuntime:
    def __init__(self,model):self.model=model
    def describe(self,key):return {'key':key,'source':GETTERS[key].path,'available':True,'parameters':[],'group':GETTERS[key].group}
    def read(self,key,**inputs):
        m=self.model;m.v2_calls.append((key,inputs,m.units))
        if key==m.fail_key:raise RuntimeError('Synthetic getter failure')
        name=inputs.get('Name','');data={};status='ok'
        if key=='section_assignment':data={'PropName':'I300' if name=='F1' else 'NP1','SAuto':'AUTO1' if name=='F1' else ''}
        elif key=='guid':data={'GUID':'synthetic-guid-'+name}
        elif key=='groups':data={'NumberGroups':2,'Groups':['ROOF','STEEL']}
        elif key=='design_procedure':data={'MyType':1}
        elif key=='section_type':data={'MyType':99 if name=='NP1' else 1}
        elif key=='section_properties':
            if name=='NP1':return block('unavailable',GETTERS[key].path,code=1,reason='No single nonprismatic property')
            data={'Area':.01,'As2':.004,'As3':.006,'Torsion':8e-7,'I22':1.2e-5,'I33':.00015,'S22':.00024,'S33':.001,'Z22':.0003,'Z33':.00115,'R22':.0346,'R33':.1225}
        elif key=='shape_i':data={'FileName':'','MatProp':'SteelA','t3':.3 if name=='I300' else .5,'t2':.15,'tf':.012,'tw':.008,'t2b':.15,'tfb':.012,'Color':0,'Notes':'fixture','GUID':'section-'+name}
        elif key=='section_material_file':data={'NameInFile':name,'FileName':'','MatProp':'' if name=='NP1' else 'SteelA','PropType':99 if name=='NP1' else 1}
        elif key=='nonprismatic':data={'NumberItems':2,'StartSec':['I300','I500'],'EndSec':['I500','I300'],'MyLength':[1.,1.],'MyType':[1,1],'EI33':[2,2],'EI22':[1,1],'Color':0,'Notes':'','GUID':'np'}
        elif key=='nonprismatic_assignment':data={'PropName':'NP1' if name=='F2' else '','sVarTotalLength':0.,'sVarRelStartLoc':0.}
        elif key=='auto_select':data={'NumberItems':2,'SectName':['I300','I500'],'AutoStartSection':'I300','Notes':'','GUID':'auto'}
        elif key in ('section_modifiers','member_modifiers'):data={'Value':[1.,.8,.9,1.,.7,.6,1.,1.]}
        elif key=='material_overwrite':data={'PropName':'SteelB' if name=='F2' else 'None'}
        elif key=='material_type':data={'MatType':1,'Color':0,'Notes':'','GUID':'material-'+name}
        elif key=='material_isotropic':data={'e':200000000.,'u':.3,'a':1.2e-5,'g':76923076.92307693}
        elif key=='material_density':data={'w':77.,'m':7.85}
        elif key=='steel_strength':data={'Fy':355000. if name=='SteelB' else 345000.,'Fu':510000.,'eFy':380000.,'eFu':560000.,'FinalSlope':0.}
        elif key=='points':data={'Point1':name+'I','Point2':name+'J'}
        elif key=='coordinates':data=dict(zip(('X','Y','Z'),m.coords[name]))
        elif key in ('local_axes','point_axes'):data={'Ang':30.,'Advanced':False}
        elif key=='advanced_local_axes':data={'Active':False,'Plane2':12}
        elif key in ('matrix','point_matrix'):data={'Value':[1.,0.,0.,0.,1.,0.,0.,0.,1.]}
        elif key=='releases':data={'ii':[False,True,False,False,False,True],'jj':[False]*6,'StartValue':[0.,500.,0.,0.,0.,10.],'EndValue':[0.]*6}
        elif key=='insertion':data={'CardinalPoint':8,'Mirror2':False,'Mirror3':False,'StiffTransform':True,'Offset1':[0.,0.,0.],'Offset2':[0.,0.,0.],'CSys':'Local'}
        elif key=='end_offsets':data={'AutoOffset':False,'Length1':.1,'Length2':.2,'RZ':.5}
        elif key in ('springs','hinges'):data={'NumberSprings' if key=='springs' else 'NumberHinges':0};status='empty'
        elif key=='material_temperature':data={'Temp':20.}
        elif key in ('load_point','load_distributed','load_gravity','load_temperature'):data={'NumberItems':0};status='empty'
        elif key=='combo_type':data={'ComboType':1 if name=='ENV' else 0}
        elif key=='combo_components':data={'NumberItems':1,'CNameType':[0],'CName':['DEAD'],'SF':[1.4]}
        elif key=='case_type':data={'CaseType':1,'SubType':0}
        elif key=='linear_loads':data={'NumberLoads':1,'LoadType':['Load'],'LoadName':['D'],'SF':[1.]}
        elif key=='load_patterns':data={'NumberNames':1,'MyName':['D']}
        elif key=='design_code':data={'CodeName':m.design_code}
        elif key=='design_available':data={'return_value':m.design_available}
        elif key in ('strength_combos','deflection_combos'):data={'NumberItems':1,'MyName':['ULS']}
        elif key=='preference':data={'Value':2. if inputs['Item']==3 else 1.}
        elif key=='overwrite':data={'Value':0. if inputs['Item']==28 else (400000. if inputs['Item']==35 else 1.),'ProgDet':inputs['Item']==28}
        elif key=='design_section':data={'PropName':'I500'}
        elif key=='design_summary':data={'NumberItems':1,'FrameName':[name],'Ratio':[.87],'RatioType':[1],'Location':[2.5],'ComboName':['ULS'],'ErrorSummary':[''],'WarningSummary':['Review lateral restraint']}
        elif key=='joint_displacements':data={'NumberResults':1,'Obj':[name],'Elm':[name+'e'],'LoadCase':['DEAD'],'StepType':[''],'StepNum':[0.],**{c:[v] for c,v in zip(('U1','U2','U3','R1','R2','R3'),(.001,-.002,.0004,1e-5,0.,-1e-5))}}
        elif key=='joint_reactions':data={'NumberResults':0,'Obj':[]};status='empty'
        elif key=='frame_joint_forces':data={'NumberResults':1,'Obj':[name],'F1':[-10.],'F2':[4.],'F3':[1.],'M1':[.5],'M2':[2.],'M3':[20.]}
        elif key=='tables':data={'NumberTables':1,'TableKey':['Frame Assignments - Section Properties'],'TableName':['Sections'],'ImportType':[1],'IsEmpty':[False]}
        elif key=='table_fields':data={'NumberFields':3,'FieldKey':['Frame','Section','Area'],'FieldName':['Frame','Section','Area'],'UnitsString':['','','m2']}
        elif key=='table_array':data={'TableVersion':1,'FieldsKeysIncluded':['Frame','Section','Area'],'NumberRecords':2,'TableData':['F1','I300','0.01','F2','NP1','']}
        else:return block('unsupported',GETTERS[key].path,reason='Not in fixture')
        return block(status,GETTERS[key].path,data=data,code=0,signature=[])

@contextmanager
def gateway(model=None):
    yield Sap2000(model or SteelModel(),connection_pid=20948,section_type_names={1:'I',99:'Variable'})
