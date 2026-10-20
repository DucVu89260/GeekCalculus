"""Read-only allowlist. Names/signatures are verified against the installed DLL.

No arbitrary method path, setter, analysis or design execution is exposed to HTTP.
The external reference is documentation only, never imported or executed.
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class Getter:
    path: str
    group: str
    axes: str = 'not_applicable'
    notes: str = ''


GETTERS = {}

def add(key, path, group, axes='not_applicable', notes=''):
    GETTERS[key] = Getter(path, group, axes, notes)

for key, method in {
    'guid':'GetGUID', 'groups':'GetGroupAssign', 'section_assignment':'GetSection',
    'design_procedure':'GetDesignProcedure', 'material_overwrite':'GetMaterialOverwrite',
    'nonprismatic_assignment':'GetSectionNonPrismatic',
}.items(): add(key, 'FrameObj.'+method, 'identity')
for key, method in {
    'points':'GetPoints', 'local_axes':'GetLocalAxes', 'advanced_local_axes':'GetLocalAxesAdvanced',
    'matrix':'GetTransformationMatrix',
}.items(): add(key, 'FrameObj.'+method, 'geometry', 'SAP_frame_local_123 / Global',
               'Matrix is read from SAP; do not infer axis order from canonical XY.')
add('coordinates', 'PointObj.GetCoordCartesian', 'geometry', 'Global')
add('point_axes', 'PointObj.GetLocalAxes', 'geometry', 'SAP_point_local_123')
add('point_matrix', 'PointObj.GetTransformationMatrix', 'geometry', 'SAP_point_local_123 / Global')
for key, method in {
    'releases':'GetReleases','insertion':'GetInsertionPoint','end_offsets':'GetEndLengthOffset',
    'springs':'GetSpring','hinges':'GetHingeAssigns_1','material_temperature':'GetMatTemp',
}.items(): add(key, 'FrameObj.'+method, 'assignments', 'SAP_defined; preserve returned CSys/Dir')
add('member_modifiers','FrameObj.GetModifiers','modifiers', notes='Dimensionless; not applied to section data.')
add('section_modifiers','PropFrame.GetModifiers','modifiers', notes='Dimensionless; not applied to section data.')
for key, method in {'load_point':'GetLoadPoint','load_distributed':'GetLoadDistributed',
                    'load_gravity':'GetLoadGravity','load_temperature':'GetLoadTemperature'}.items():
    add(key,'FrameObj.'+method,'loads','SAP_defined; preserve CSys/Dir/relative and absolute positions')
for key, path in {
    'output_nl_static':'Results.Setup.GetOptionNLStatic','output_multistep_static':'Results.Setup.GetOptionMultiStepStatic',
    'output_multivalued_combo':'Results.Setup.GetOptionMultiValuedCombo',
    'combo_type':'RespCombo.GetTypeOAPI','combo_components':'RespCombo.GetCaseList',
    'case_type':'LoadCases.GetTypeOAPI','nonlinear_geometry':'LoadCases.StaticNonlinear.GetGeometricNonlinearity',
    'linear_loads':'LoadCases.StaticLinear.GetLoads','nonlinear_loads':'LoadCases.StaticNonlinear.GetLoads',
    'load_patterns':'LoadPatterns.GetNameList','pattern_type':'LoadPatterns.GetLoadType',
    'pattern_self_weight':'LoadPatterns.GetSelfWTMultiplier',
}.items(): add(key,path,'loads')
for key, path in {
    'section_type':'PropFrame.GetTypeOAPI','section_properties':'PropFrame.GetSectProps',
    'section_material_file':'PropFrame.GetNameInPropFile',
    'nonprismatic':'PropFrame.GetNonPrismatic','auto_select':'PropFrame.GetAutoSelectSteel',
    'shape_i':'PropFrame.GetISection','shape_tube':'PropFrame.GetTube','shape_pipe':'PropFrame.GetPipe',
    'shape_angle':'PropFrame.GetAngle','shape_double_angle':'PropFrame.GetDblAngle',
    'shape_channel':'PropFrame.GetChannel','shape_double_channel':'PropFrame.GetDblChannel',
    'shape_tee':'PropFrame.GetTee','shape_rectangle':'PropFrame.GetRectangle',
    'shape_circle':'PropFrame.GetCircle','shape_general':'PropFrame.GetGeneral',
    'shape_sd':'PropFrame.GetSDSection','shape_cold_c':'PropFrame.GetColdC',
    'shape_cold_z':'PropFrame.GetColdZ','shape_cold_hat':'PropFrame.GetColdHat',
    'shape_hybrid_i':'PropFrame.GetHybridISection',
}.items(): add(key,path,'sections','SAP_section_local_23', 'Unmodified SAP property; not GeekCalculus-computed geometry.')
for key, path in {
    'material_type':'PropMaterial.GetMaterial','material_isotropic':'PropMaterial.GetMPIsotropic',
    'material_density':'PropMaterial.GetWeightAndMass','steel_strength':'PropMaterial.GetOSteel_1',
}.items(): add(key,path,'materials', notes='Library data at Temp=0 C; not inferred temperature-dependent member strength.')
for key, path in {
    'design_code':'DesignSteel.GetCode','design_available':'DesignSteel.GetResultsAvailable',
    'design_section':'DesignSteel.GetDesignSection','design_summary':'DesignSteel.GetSummaryResults',
    'strength_combos':'DesignSteel.GetComboStrength','deflection_combos':'DesignSteel.GetComboDeflection',
    'preference':'DesignSteel.AISC360_10.GetPreference','overwrite':'DesignSteel.AISC360_10.GetOverwrite',
}.items(): add(key,path,'design_setup' if key not in ('design_summary','design_section','overwrite') else
             ('design_overwrites' if key=='overwrite' else 'design_results'),
             notes='Read existing SAP design data only. No StartDesign or effective-default inference.')
add('joint_displacements','Results.JointDispl','displacements','SAP_point_element_local_123', 'U: m; R: rad. Not frame axes or midspan deflection.')
add('joint_reactions','Results.JointReact','displacements','SAP_point_element_local_123','F: kN; M: kN·m. Non-support joints may have no reactions.')
add('frame_joint_forces','Results.FrameJointForce','displacements','SAP_point_element_local_123')
add('tables','DatabaseTables.GetAllTables','tables')
add('table_fields','DatabaseTables.GetAllFieldsInTable','tables')
add('table_array','DatabaseTables.GetTableForDisplayArray','tables',notes='Raw SAP display table; active display/output selection is recorded, not silently changed.')

# Enum NAMES only: numeric mappings come from the actual installed DLL.
SHAPES = {
    'I':'shape_i','ISECTION':'shape_i','BOX':'shape_tube','TUBE':'shape_tube','PIPE':'shape_pipe',
    'ANGLE':'shape_angle','DBLANGLE':'shape_double_angle','CHANNEL':'shape_channel',
    'DBLCHANNEL':'shape_double_channel','DBCHANNEL':'shape_double_channel','T':'shape_tee','TEE':'shape_tee',
    'RECTANGULAR':'shape_rectangle','RECTANGLE':'shape_rectangle','CIRCLE':'shape_circle',
    'GENERAL':'shape_general','SD':'shape_sd','COLDC':'shape_cold_c','COLDZ':'shape_cold_z',
    'COLDHAT':'shape_cold_hat','BUILTUPIHYBRID':'shape_hybrid_i',
}
