import { FORMULAS, REFERENCE } from '../../../standards/aisc360-10-verified-hi.mjs'

// Implementation references are not transcriptions or source-review approvals.
export function aisc36010Equations(rows) {
  return rows.map(row => {
    const formula = Object.hasOwn(FORMULAS, row.label) ? FORMULAS[row.label] : null
    return formula && !row.latex && !row.expression
      ? { ...row, reference_expression: formula.expression, reference_conditions: formula.applies, reference_citation: REFERENCE }
      : { ...row }
  })
}

export function equationDocument(documents, documentId) {
  if (documentId != null) return documents.find(doc => String(doc.id) === String(documentId)) || null
  const specifications = documents.filter(doc => doc.kind === 'specification')
  return specifications.length === 1 ? specifications[0] : null
}
