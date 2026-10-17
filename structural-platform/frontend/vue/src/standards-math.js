import katex from 'katex'

export function renderStandardMath(expression) {
  const latex = typeof expression === 'string' ? expression.trim() : ''
  if (!latex) return { html: '', usable: false, error: '' }
  if (latex.length > 20000 || /\\(?:href|url|html\w*|includegraphics|def|gdef|newcommand|renewcommand|input|write|require)\b/i.test(latex)) {
    return { html: '', usable: false, error: 'Unsupported active content or macro definition.' }
  }
  try {
    const html = katex.renderToString(latex, {
      displayMode: true, throwOnError: true, trust: false, strict: 'error',
      output: 'htmlAndMathml', maxExpand: 200, maxSize: 20,
    })
    return { html, usable: true, error: '' }
  } catch (error) {
    return { html: '', usable: false, error: error.message }
  }
}
