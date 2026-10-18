"""SAP shape keywords for routing, not a claim of design-rule support."""
import re

# Numeric enum values are supplied by the installed DLL, never hardcoded here.
TYPES = {
    'i_wide_flange': ('I / Wide Flange Section', ('I', 'ISECTION')),
    'channel': ('Channel Section', ('CHANNEL',)),
    'tee': ('Tee Section', ('T', 'TEE')),
    'angle': ('Angle Section', ('ANGLE',)),
    'double_angle': ('Double Angle Section', ('DBLANGLE', 'DOUBLEANGLE')),
    'double_channel': ('Double Channel Section', ('DBLCHANNEL', 'DBCHANNEL', 'DOUBLECHANNEL')),
    'pipe': ('Pipe Section', ('PIPE',)),
    'tube': ('Tube Section', ('BOX', 'TUBE')),
    'rectangular': ('Rectangular Section', ('RECTANGULAR', 'RECTANGLE')),
    'circular': ('Circular Section', ('CIRCLE', 'CIRCULAR')),
    'auto_select_list': ('Auto Select List', ('AUTO', 'AUTOSELECT', 'AUTOSELECTLIST', 'AUTOSELECTSTEEL')),
    'steel_joist': ('Steel Joist', ('JOIST', 'STEELJOIST')),
    'nonprismatic': ('Nonprismatic Section', ('VARIABLE', 'NONPRISMATIC')),
}


def classify_section(enum_name, enum_code, *, verified_i=False):
    token = re.sub('[^A-Z0-9]', '', enum_name.upper()).removeprefix('SECTION')
    match = next(((key, label) for key, (label, names) in TYPES.items() if token in names), None)
    basis = 'installed SAP enum name'
    if match is None and enum_name == 'Unknown' and verified_i:
        match = ('i_wide_flange', TYPES['i_wide_flange'][0])
        basis = 'successful PropFrame.GetISection; enum unresolved'
    key, label = match or ('manual_review', enum_name if enum_name != 'Unknown' else 'Unknown / Special Section')
    routing = {'nonprismatic': 'component_dependent', 'auto_select_list': 'selection_list',
               'steel_joist': 'specialized_workflow', 'manual_review': 'manual_review'}.get(key, 'family_identified')
    return {'key': key, 'sap_label': label, 'sap_enum_name': enum_name, 'sap_enum_code': enum_code,
            'basis': basis if match else 'unmapped SAP section type', 'routing_status': routing,
            'design_check_status': 'not_evaluated',
            'note': 'Shape family only; verify material, geometry and rule applicability before selecting a design check.'}
