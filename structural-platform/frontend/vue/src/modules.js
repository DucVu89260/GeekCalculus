export const moduleGroups = [
  { code: 'steel', title: 'groupSteel', description: 'steelDescription' },
  { code: 'concrete', title: 'groupConcrete', description: 'concreteDescription' },
  { code: 'analysis', title: 'groupAnalysis', description: 'analysisDescription' },
  { code: 'loads', title: 'groupLoads', description: 'loadDescription' },
  { code: 'library', title: 'groupLibrary', description: 'libraryDescription' },
  { code: 'future', title: 'groupFuture', description: 'futureDescription' },
]
export const moduleHref = code => `${import.meta.env.BASE_URL}#/modules/${code}`
export function moduleFromHash() {
  const match = window.location.hash.match(/^#\/modules\/([a-z]+)$/)
  return match && moduleGroups.some(group => group.code === match[1]) ? match[1] : null
}
