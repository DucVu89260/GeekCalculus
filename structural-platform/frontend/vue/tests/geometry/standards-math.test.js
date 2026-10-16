import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { renderStandardMath } from '../../src/standards-math.js'

test('E3-2 draft renders subscripts and exponent using the inherited transcription', () => {
  // Rendering regression only. The private authoritative PDF still requires review.
  const registry = JSON.parse(readFileSync(new URL('../../../../standards/aisc360-10-review-drafts.json', import.meta.url)))
  const draft = registry.equations.find(e => e.label === 'E3-2')
  assert.equal(draft.verification_status, 'needs_review')
  const math = renderStandardMath(draft.latex)
  assert.equal(math.usable, true)
  assert.match(math.html, /<msub>/)
  assert.match(math.html, /<msup>/)
  assert.match(math.html, /<msup><mn>0\.658<\/mn>/)
  assert.match(renderStandardMath(registry.equations.find(e => e.label === 'E3-4').latex).html, /<mfrac>/)
})

test('empty and malformed math cannot replace a missing-expression placeholder', () => {
  for (const expression of [null, '', '   ', '\\frac{a}{', '\\unknowncommand{a}', '\\def\\a{\\a}\\a']) {
    const rendered = renderStandardMath(expression)
    assert.equal(rendered.usable, false)
    assert.equal(rendered.html, '')
  }
})

test('source math cannot insert links, HTML or executable content', () => {
  for (const expression of ['\\href{javascript:alert(1)}{x}', '\\htmlClass{owned}{x}', '\\includegraphics{https://example.com/a.png}']) {
    assert.equal(renderStandardMath(expression).usable, false)
  }
})
