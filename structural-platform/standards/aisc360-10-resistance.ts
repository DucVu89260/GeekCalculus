import factors from './aisc360-10-strength-factors.json'

export type DesignMethod = 'LRFD' | 'ASD'
export type StrengthKey = keyof typeof factors.factors

export function selectedMethod(input: unknown): DesignMethod {
  if (input === 'LRFD' || input === 'ASD') return input
  throw new RangeError('Only LRFD or ASD design methods are supported.')
}
export function getFactor(key: StrengthKey) {
  const entry = factors.factors[key]
  if (!entry || !Number.isFinite(entry.phi) || !Number.isFinite(entry.omega) || entry.phi <= 0 || entry.omega <= 0) {
    throw new Error('Missing or invalid AISC360-10 phi/Omega factor: ' + key)
  }
  return { ...entry, key, edition: factors.edition }
}
export function availableStrength(nominal: number, method: DesignMethod, key: StrengthKey) {
  selectedMethod(method)
  if (!Number.isFinite(nominal) || nominal < 0) throw new RangeError('Nominal resistance must be nonnegative and finite.')
  const record = getFactor(key)
  return method === 'LRFD' ? record.phi * nominal : nominal / record.omega
}
export function factorNotation(method: DesignMethod, key: StrengthKey) {
  const f = getFactor(key)
  return method === 'LRFD' ? { symbol: 'φ',value: f.phi, equation: 'φ × Rn', ...f }
    : { symbol:'Ω',value:f.omega,equation:'Rn / Ω',...f }
}
/** Only the rolled I-shaped web G2.1(a) uses the exceptional coefficients. */
export function webShearFactorKey(input: { fabrication: string; h_mm: number; tf_mm: number; tw_mm: number; e_mpa: number; fy_mpa: number }): StrengthKey {
  const { fabrication,h_mm,tf_mm,tw_mm,e_mpa,fy_mpa } = input
  if (![h_mm,tf_mm,tw_mm,e_mpa,fy_mpa].every(v=>typeof v==='number' && Number.isFinite(v) && v>0) || h_mm<=2*tf_mm) {
    throw new RangeError('Invalid geometry/material for G2.1(a) selection')
  }
  const clearWebSlenderness = (h_mm-2*tf_mm)/tw_mm
  return fabrication==='ROLLED' && clearWebSlenderness <= 2.24*Math.sqrt(e_mpa/fy_mpa)
    ? 'SHEAR_ROLLED_G21A' : 'SHEAR_GENERAL'
}
export function allFactors() { return factors }
