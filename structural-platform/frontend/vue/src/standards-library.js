import asce710 from '../../../standards/asce7-10-library.json'
import { FORMULAS } from '../../../standards/asce7-10-wind.mjs'

export const asce710Library = asce710
export const asce710SourceReference = {
  id: 'ASCE7-10-local-source', kind: 'specification', original_name: 'ASCE 7-10.pdf',
  page_count: asce710.page_count, sha256: asce710.source_sha256,
  processing_status: 'source_indexed', source_mode: 'static_pdf',
  file_url: `${import.meta.env.BASE_URL}standards/asce7-10.pdf`,
}
export function asce710Equations(rows = asce710.equations) {
  const implemented = { '27.3-1': ['q', 'velocityPressure'], '27.4-1': ['p', 'calculateWind710'] }
  return rows.map(row => {
    const branch = implemented[row.label]
    return branch ? { ...row, expression: FORMULAS[branch[0]].expression,
      implementation_key: row.implementation_key || branch[1], implementation_status: 'IMPLEMENTED_BRANCH_REVIEW_REQUIRED' } : row
  })
}
export const asce710WindFormulas = Object.entries(FORMULAS).map(([key, formula]) => ({ key, ...formula }))
