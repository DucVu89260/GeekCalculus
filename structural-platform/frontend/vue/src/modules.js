export const moduleGroups = [
  { code: 'loads', title: 'structureLoading', description: 'structureLoadingDescription' },
  { code: 'steel', title: 'structureSteel', description: 'structureSteelDescription' },
  { code: 'concrete', title: 'structureRC', description: 'structureRCDescription' },
]
export const groupTools = {
  steel: [
    { code: 'design', title: 'toolSteelDesign', description: 'steelDescription', route: 'steel' },
    { code: 'section-properties', title: 'toolSectionProperties', description: 'analysisDescription', route: 'steel/section-properties' },
    { code: 'library', title: 'toolSteelLibrary', description: 'libraryDescription', route: 'steel/library' },
    { code: 'future', title: 'toolFutureLab', description: 'futureDescription', route: 'steel/future' },
  ],
  concrete: [
    { code: 'design', title: 'toolRCDesign', description: 'concreteDescription', route: 'concrete' },
    { code: 'section-properties', title: 'toolSectionProperties', description: 'analysisDescription', route: 'concrete/section-properties' },
    { code: 'library', title: 'toolRCLibrary', description: 'libraryDescription', route: 'concrete/library' },
    { code: 'future', title: 'toolFutureLab', description: 'futureDescription', route: 'concrete/future' },
  ],
  loads: [
    { code: 'combo', title: 'toolCombo', description: 'comboDescription', route: 'loads/combo' },
    { code: 'wind', title: 'toolWind', description: 'windDescription', route: 'loads/wind' },
    { code: 'dead', title: 'toolDead', description: 'deadDescription', route: 'loads/dead' },
    { code: 'seismic', title: 'toolSeismic', description: 'seismicDescription', route: 'loads/seismic' },
    { code: 'snow', title: 'toolSnow', description: 'snowDescription', route: 'loads/snow' },
    { code: 'temperature', title: 'toolTemperature', description: 'temperatureDescription', route: 'loads/temperature' },
  ],
}

// Existing bookmarks continue to reach the same calculators and library.
const legacyRoutes = {
  analysis: 'steel/section-properties',
  library: 'steel/library',
  future: 'steel/future',
}
export function resolveModuleRoute(code) {
  const normalized = legacyRoutes[code] ?? code
  const [groupCode, toolCode, extra] = String(normalized).split('/')
  if (extra !== undefined) return null
  const group = moduleGroups.find(item => item.code === groupCode)
  const tool = groupTools[groupCode]?.find(item => item.code === (toolCode || groupTools[groupCode][0].code))
  return group && tool ? { group, tool } : null
}
export const moduleHref = code => `${import.meta.env.BASE_URL}#/modules/${code}`
export function moduleFromHash() {
  const match = window.location.hash.match(/^#\/modules\/([a-z]+(?:\/[a-z-]+)?)$/)
  return match && resolveModuleRoute(match[1]) ? match[1] : null
}
