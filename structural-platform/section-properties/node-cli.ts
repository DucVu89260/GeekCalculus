import { calculateSectionProperties, DemoCalculationError } from './index'

// The bridge reads exactly one request and emits exactly one JSON result.
let input = ''
for await (const chunk of process.stdin) input += chunk
try {
  const result = await calculateSectionProperties(JSON.parse(input))
  process.stdout.write(JSON.stringify(result))
} catch (error) {
  const payload = error instanceof DemoCalculationError
    ? { status: 'error', code: error.code, message: error.message, errors: error.errors, details: error.details }
    : { status: 'error', code: 'CALCULATION_ERROR', message: error instanceof Error ? error.message : 'Calculation failed.' }
  process.stdout.write(JSON.stringify(payload))
  process.exitCode = 2
}
