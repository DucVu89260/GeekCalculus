import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const catalog = JSON.parse(readFileSync(new URL('../../../../standards/asce7-10-library.json', import.meta.url)));
test('ASCE 7-10 static library includes the complete source index and matching PDF', () => {
  assert.equal(catalog.edition_code, 'ASCE7-10');
  assert.equal(catalog.page_count, 658);
  assert.equal(catalog.clauses.length, 875);
  assert.equal(catalog.equations.length, 310);
  const pdf = readFileSync(new URL('../../public/standards/asce7-10.pdf', import.meta.url));
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  assert.equal(createHash('sha256').update(pdf).digest('hex'), catalog.source_sha256);
});
test('clause/equation source anchors and normative/commentary separation survive static integration', () => {
  const ids = new Set(catalog.clauses.map(c => c.id));
  assert.equal(ids.size, catalog.clauses.length);
  for (const c of catalog.clauses) {
    assert.ok(c.pdf_page >= 1 && c.pdf_page <= 658);
    if (c.parent_id) assert.ok(ids.has(c.parent_id));
  }
  assert.equal(catalog.clauses.find(c => c.code === '26').pdf_page, 284);
  assert.equal(catalog.clauses.find(c => c.code === '27').pdf_page, 306);
  assert.equal(catalog.clauses.find(c => c.code === 'C27').kind, 'commentary');
  assert.equal(catalog.equations.find(e => e.label === '27.3-1').pdf_page, 307);
  assert.ok(catalog.equations.every(e => e.verification_status === 'candidate' && !e.latex));
});
