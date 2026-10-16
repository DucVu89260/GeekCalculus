"""Run SAP_TEST_CLR=1 with a configured pythonnet runtime for real CLR tests."""
import os
import pytest
pytestmark=pytest.mark.skipif(os.environ.get('SAP_TEST_CLR')!='1',reason='Optional real CLR fixture requires .NET runtime')


def fixture_proxy():
    import clr
    import System as S
    from System.Reflection import AssemblyName, MethodAttributes as M, TypeAttributes as T, PropertyAttributes as P, ParameterAttributes as A
    from System.Reflection.Emit import AssemblyBuilder, AssemblyBuilderAccess, OpCodes as O
    from structural_engine.member_forces.dotnet import DotNetProxy
    from uuid import uuid4
    module=AssemblyBuilder.DefineDynamicAssembly(AssemblyName('Fixture'+uuid4().hex),AssemblyBuilderAccess.Run).DefineDynamicModule('main')
    integer=clr.GetClrType(S.Int32);double=clr.GetClrType(S.Double);string=clr.GetClrType(S.String);boolean=clr.GetClrType(S.Boolean)
    enum=module.DefineEnum('Units',T.Public,integer)
    enum.DefineLiteral('Object',S.Int32(0));enum.DefineLiteral('kN_m_C',S.Int32(6))
    enum_type=enum.CreateTypeInfo().AsType()
    cls=module.DefineType('SapFixture',T.Public);cls.DefineDefaultConstructor(M.Public)
    def literal(il,kind,value):
        if kind.IsArray:
            element=kind.GetElementType();il.Emit(O.Ldc_I4,S.Int32(len(value)));il.Emit(O.Newarr,element)
            for i,item in enumerate(value):
                il.Emit(O.Dup);il.Emit(O.Ldc_I4,S.Int32(i));literal(il,element,item);il.Emit(O.Stelem,element)
        elif kind==string: il.Emit(O.Ldstr,str(value))
        elif kind==double: il.Emit(O.Ldc_R8,S.Double(value))
        else: il.Emit(O.Ldc_I4,S.Int32(value))
    def output_method(name,inputs,outputs):
        params=[*inputs,*[kind.MakeByRefType() for kind,value in outputs]]
        method=cls.DefineMethod(name,M.Public,integer,S.Array[S.Type](params))
        if name=='GetNameList':
            method.DefineParameter(1,A.Optional|A.HasDefault,'CaseType').SetConstant(S.Int32(0))
        il=method.GetILGenerator()
        for i,(kind,value) in enumerate(outputs):
            il.Emit(O.Ldarg,S.Int16(i+len(inputs)+1));literal(il,kind,value);il.Emit(O.Stobj,kind)
        il.Emit(O.Ldc_I4_0);il.Emit(O.Ret)
    method=cls.DefineMethod('GetModelFilename',M.Public,string,S.Array[S.Type]([boolean]))
    method.DefineParameter(1,A.Optional|A.HasDefault,'IncludePath').SetConstant(True)
    il=method.GetILGenerator();short=il.DefineLabel();il.Emit(O.Ldarg_1);il.Emit(O.Brfalse,short)
    il.Emit(O.Ldstr,r'C:\Models\Frame.sdb');il.Emit(O.Ret);il.MarkLabel(short);il.Emit(O.Ldstr,'Frame.sdb');il.Emit(O.Ret)
    output_method('GetVersion',[],[(string,'26.2.0'),(double,26.2)])
    output_method('GetNameList',[enum_type],[(integer,2),(string.MakeArrayType(),['DEAD','WIND'])])
    output_method('GetSelected',[],[(integer,2),(integer.MakeArrayType(),[2,2]),(string.MakeArrayType(),['F1','F2'])])
    output_method('GetCaseSelectedForOutput',[string],[(boolean,True)])
    output_method('GetCaseStatus',[],[(integer,2),(string.MakeArrayType(),['DEAD','WIND']),(enum_type.MakeArrayType(),[0,6])])
    method=cls.DefineMethod('SetPresentUnits',M.Public,enum_type,S.Array[S.Type]([enum_type]))
    il=method.GetILGenerator();il.Emit(O.Ldarg_1);il.Emit(O.Ret)
    cols=[(integer,2),(string.MakeArrayType(),['F1','F1']),(double.MakeArrayType(),[0.,4.]),
        (string.MakeArrayType(),['E1','E1']),(double.MakeArrayType(),[0.,4.]),
        (string.MakeArrayType(),['DEAD','DEAD']),(string.MakeArrayType(),['','']),
        (double.MakeArrayType(),[0.,0.]),*[(double.MakeArrayType(),[float(i),float(i+1)]) for i in range(6)]]
    output_method('FrameForce',[string,enum_type],cols)
    for name in ['Results','SelectObj']:
        prop=cls.DefineProperty(name,getattr(P,'None'),cls,S.Array[S.Type]([]))
        getter=cls.DefineMethod('get_'+name,M.Public|M.SpecialName|M.HideBySig,cls,S.Array[S.Type]([]))
        il=getter.GetILGenerator();il.Emit(O.Ldarg_0);il.Emit(O.Ret);prop.SetGetMethod(getter)
    typed=cls.CreateTypeInfo().AsType()
    return DotNetProxy(S.Activator.CreateInstance(typed),typed,S)


def test_real_clr_version_refs_and_name_arrays():
    from structural_engine.member_forces.sap2000 import Sap2000
    proxy=fixture_proxy()
    assert proxy.GetModelFilename()==r'C:\Models\Frame.sdb'
    assert proxy.GetModelFilename(False)=='Frame.sdb'
    assert proxy.GetVersion()==('26.2.0',26.2,0)
    assert Sap2000(proxy).verify_version()=='26.2.0'
    assert Sap2000(proxy).names(proxy)==['DEAD','WIND']
    assert proxy.GetCaseSelectedForOutput('DEAD')==(True,0)


def test_real_clr_enums_arrays_properties_and_frame_forces():
    from structural_engine.member_forces.sap2000 import Sap2000, outputs
    proxy=fixture_proxy()
    assert proxy.SetPresentUnits(6)==6
    assert proxy.GetCaseStatus()==(2,['DEAD','WIND'],[0,6],0)
    assert Sap2000(proxy).selection()==['F1','F2']
    data=outputs(proxy.Results.FrameForce('F1',0),14)
    assert data[0]==2 and data[1]==['F1','F1']
    assert data[2]==[0.,4.] and data[-1]==[5.,6.]
