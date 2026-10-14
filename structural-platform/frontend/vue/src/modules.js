export const moduleGroups = [
  { code: 'steel', title: 'groupSteel', description: 'steelDescription' },
  { code: 'concrete', title: 'groupConcrete', description: 'concreteDescription' },
  { code: 'loads', title: 'groupLoads', description: 'loadDescription' },
  { code: 'library', title: 'groupLibrary', description: 'libraryDescription' },
  { code: 'future', title: 'groupFuture', description: 'futureDescription' },
]
// Preserve bookmarked calculator URLs without listing another navigation item.
export const legacySectionPropertiesGroup = { code: 'analysis', title: 'groupAnalysis', description: 'analysisDescription' }
export const moduleHref = code => `${import.meta.env.BASE_URL}#/modules/${code}`
// A separate addressable calculation page inside Steel Design.
export const symmetricIStandardHref = standard =>
  `${import.meta.env.BASE_URL}#/modules/steel/components/symmetric-i/${standard}`

export function parseModuleRoute(hash) {
  const match = /^#\/modules\/([a-z]+)(?:\/components\/symmetric-i\/([a-z0-9-]+))?$/.exec(hash)
  if (!match) return { module: null, detail: null }
  const [, moduleCode, standard] = match
  if (!moduleGroups.some(group => group.code === moduleCode) && moduleCode !== legacySectionPropertiesGroup.code) {
    return { module: null, detail: null }
  }
  if (standard && (moduleCode !== 'steel' || standard !== 'aisc-360-10')) {
    return { module: null, detail: null }
  }
  return { module: moduleCode, detail: standard ? 'symmetric-i/aisc-360-10' : null }
}

export const moduleFromHash = () => parseModuleRoute(window.location.hash).module
export const moduleDetailFromHash = () => parseModuleRoute(window.location.hash).detail
