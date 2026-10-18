import pytest
from structural_engine.sap2000_v2.section_types import classify_section
from test_sap_v2 import read


@pytest.mark.parametrize('enum,key,label',[
    ('I','i_wide_flange','I / Wide Flange Section'),
    ('Channel','channel','Channel Section'),('T','tee','Tee Section'),
    ('Angle','angle','Angle Section'),('DblAngle','double_angle','Double Angle Section'),
    ('DblChannel','double_channel','Double Channel Section'),('Pipe','pipe','Pipe Section'),
    ('Box','tube','Tube Section'),('Rectangular','rectangular','Rectangular Section'),
    ('Circle','circular','Circular Section'),('Auto','auto_select_list','Auto Select List'),
    ('SteelJoist','steel_joist','Steel Joist'),('Variable','nonprismatic','Nonprismatic Section'),
    ('SECTION_I','i_wide_flange','I / Wide Flange Section'),
])
def test_runtime_enum_names_define_stable_routing_keywords(enum,key,label):
    result=classify_section(enum,9182)
    assert result['key']==key and result['sap_label']==label
    assert result['sap_enum_code']==9182  # no numeric enum mapping guessed
    assert result['sap_enum_name']==enum
    assert result['design_check_status']=='not_evaluated'


@pytest.mark.parametrize('name',['SD','General','ColdC','BuiltUpIHybrid','Unknown','FutureType'])
def test_special_sections_remain_manual_even_if_i_probe_succeeds(name):
    result=classify_section(name,77,verified_i=name!='Unknown')
    assert result['key']=='manual_review' and result['routing_status']=='manual_review'


def test_unknown_enum_only_routes_i_when_typed_getter_verifies_it():
    assert classify_section('Unknown',None,verified_i=True)['key']=='i_wide_flange'
    assert classify_section('Unknown',None)['key']=='manual_review'


def test_nonprismatic_component_references_include_child_shape_keywords():
    _,result=read(groups=['sections'])
    parent=result['sections']['NP1']
    assert parent['section_type']['key']=='nonprismatic'
    assert parent['section_type']['routing_status']=='component_dependent'
    assert all(child['section_type']['key']=='i_wide_flange' for child in parent['components'])
    assert result['sections']['I300']['section_type']['sap_label']=='I / Wide Flange Section'
