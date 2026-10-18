"""Actual CLR calls against synthetic typed CSI-like interfaces, not SAP."""
import os
import pytest
pytestmark=pytest.mark.skipif(os.environ.get('SAP_TEST_CLR')!='1',reason='Requires pythonnet CLR runtime')

def fixture(bad_count=False,nan=False):
    import clr
    import System as S
    from System.Reflection import AssemblyName,MethodAttributes as M,TypeAttributes as T,PropertyAttributes as P,ParameterAttributes as A
    from System.Reflection.Emit import AssemblyBuilder,AssemblyBuilderAccess,OpCodes as O
    from uuid import uuid4
    from structural_engine.member_forces.dotnet import DotNetProxy
    from structural_engine.sap2000_v2.reflection import RuntimeReader
    mod=AssemblyBuilder.DefineDynamicAssembly(AssemblyName('V2Fixture'+uuid4().hex),AssemblyBuilderAccess.Run).DefineDynamicModule('main')
    integer=clr.GetClrType(S.Int32);double=clr.GetClrType(S.Double);string=clr.GetClrType(S.String);boolean=clr.GetClrType(S.Boolean)
    enum=mod.DefineEnum('ItemKind',T.Public,integer);enum.DefineLiteral('Object',S.Int32(0));enum_type=enum.CreateTypeInfo().AsType()
    cls=mod.DefineType('V2Model',T.Public);cls.DefineDefaultConstructor(M.Public)
    def literal(il,kind,value):
        if kind.IsArray:
            elem=kind.GetElementType();il.Emit(O.Ldc_I4,S.Int32(len(value)));il.Emit(O.Newarr,elem)
            for i,v in enumerate(value):il.Emit(O.Dup);il.Emit(O.Ldc_I4,S.Int32(i));literal(il,elem,v);il.Emit(O.Stelem,elem)
        elif kind==string:il.Emit(O.Ldstr,str(value))
        elif kind==double:il.Emit(O.Ldc_R8,S.Double(value))
        else:il.Emit(O.Ldc_I4,S.Int32(value))
    def method(name,params,outs,returned=0,ret_type=integer):
        method=cls.DefineMethod(name,M.Public,ret_type,S.Array[S.Type]([k.MakeByRefType() if ref else k for _,k,ref,_ in params]))
        for i,(pname,k,ref,default) in enumerate(params):
            p=method.DefineParameter(i+1,A.Optional|A.HasDefault if default is not None else getattr(A,'None'),pname)
            if default is not None:p.SetConstant(default)
        il=method.GetILGenerator()
        for i,value in outs.items():il.Emit(O.Ldarg,S.Int16(i+1));literal(il,params[i][1],value);il.Emit(O.Stobj,params[i][1])
        literal(il,ret_type,returned);il.Emit(O.Ret)
    method('GetGUID',[('Name',string,False,None),('GUID',string,True,None)],{1:'fixture-guid'})
    method('GetSectProps',[('Name',string,False,None),('Area',double,True,None),('I33',double,True,None)],{1:float('nan') if nan else .01,2:.00015})
    method('GetMPIsotropic',[('Name',string,False,None),('e',double,True,None),('u',double,True,None),('a',double,True,None),('g',double,True,None),('Temp',double,False,S.Double(0.))],{1:2e8,2:.3,3:1.2e-5,4:7.692307692307693e7})
    method('JointDispl',[('Name',string,False,None),('ItemTypeElm',enum_type,False,None),('NumberResults',integer,True,None),('Obj',string.MakeArrayType(),True,None),('U2',double.MakeArrayType(),True,None)],{2:1,3:['F1I'],4:[] if bad_count else [-.002]})
    method('GetResultsAvailable',[],{},True,boolean)
    method('GetWeightAndMass',[('Name',string,False,None),('w',double,True,None),('m',double,True,None)],{1:0.,2:0.},17)
    method('GetHingeAssigns_1',[('Name',string,False,None),('NewInput',integer,False,None),('NumberHinges',integer,True,None)],{2:0})
    method('GetTableForDisplayArray',[('TableKey',string,False,None),('FieldKeyList',string.MakeArrayType(),True,None),('GroupName',string,False,None),('TableVersion',integer,True,None),('FieldsKeysIncluded',string.MakeArrayType(),True,None),('NumberRecords',integer,True,None),('TableData',string.MakeArrayType(),True,None)],{3:1,4:['Frame','Section'],5:1,6:['F1','I300']})
    for name in ['FrameObj','PropFrame','PropMaterial','Results','DesignSteel','DatabaseTables']:
        p=cls.DefineProperty(name,getattr(P,'None'),cls,S.Array[S.Type]([]));g=cls.DefineMethod('get_'+name,M.Public|M.SpecialName|M.HideBySig,cls,S.Array[S.Type]([]));il=g.GetILGenerator();il.Emit(O.Ldarg_0);il.Emit(O.Ret);p.SetGetMethod(g)
    kind=cls.CreateTypeInfo().AsType()
    return RuntimeReader(DotNetProxy(S.Activator.CreateInstance(kind),kind,S))

def test_named_refs_optional_defaults_and_enum_arrays():
    r=fixture()
    assert r.read('guid',Name='F1')['data']=={'GUID':'fixture-guid'}
    assert r.read('section_properties',Name='I300')['data']=={'Area':.01,'I33':.00015}
    assert r.read('material_isotropic',Name='Steel')['data']['e']==2e8
    assert r.read('material_isotropic',Name='Steel',Temp=25.)['status']=='ok'
    assert r.read('joint_displacements',Name='F1I',ItemTypeElm=0)['data']=={'NumberResults':1,'Obj':['F1I'],'U2':[-.002]}
    assert r.describe('joint_displacements')['parameters'][1]['type'].endswith('ItemKind')

def test_boolean_return_and_nonzero_return_code_not_fabricated_zero():
    r=fixture();assert r.read('design_available')['data']=={'return_value':True}
    value=r.read('material_density',Name='Steel');assert value['status']=='unavailable' and value['data'] is None and value['return_code']==17

def test_byref_array_input_preserved():
    data=fixture().read('table_array',TableKey='Example',FieldKeyList=['All'],GroupName='All')
    assert data['status']=='ok' and data['data']['FieldKeyList']==['All'] and data['data']['TableData']==['F1','I300']

def test_count_nan_missing_and_changed_signature_are_explicit():
    assert fixture(bad_count=True).read('joint_displacements',Name='F1I',ItemTypeElm=0)['status']=='invalid_data'
    assert fixture(nan=True).read('section_properties',Name='I300')['status']=='invalid_data'
    r=fixture();assert r.read('hinges',Name='F1')['status']=='unsupported_signature'
    assert r.read('releases',Name='F1')['status']=='unsupported'
    with pytest.raises(ValueError):r.read('SetSection',Name='F1')
