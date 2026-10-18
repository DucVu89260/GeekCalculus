API_NAME = 'API_IF_SAP26.2.0_V2'
API_PREFIX = '/' + API_NAME
BUILD_ID = '2026.10.18-v2-local.9'
SAP_VERSION = '26.2.0'
PORT = 8010
REFERENCE_URL = 'https://github.com/Ephraim-Bryski/SAP-Tooltips'
REFERENCE_COMMIT = '608415951abf7c601c3939ed0296cd1daa45eda5'
UNITS = {'sap_code': 6, 'system': 'kN_m_C', 'length': 'm', 'force': 'kN',
         'moment': 'kN·m', 'stress': 'kN/m²', 'area': 'm²', 'inertia': 'm⁴',
         'section_modulus': 'm³', 'angle': 'rad (local-axis assignment Ang is degrees)',
         'weight_density': 'kN/m³', 'mass_density': 'kN·s²/m⁴'}
GROUPS = ('identity', 'sections', 'materials', 'geometry', 'assignments', 'modifiers',
          'loads', 'forces', 'displacements', 'design_setup', 'design_overwrites', 'design_results')
DEFAULT_GROUPS = ('identity', 'sections', 'materials', 'geometry', 'modifiers')
