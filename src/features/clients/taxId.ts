/**
 * Ecuadorian cédula / RUC validation — a port of `src/modules/clients/tax_id.py`.
 *
 * The server is the authority (it answers 422); this exists so the form can say
 * so before a round trip, and so a mistyped cédula is caught while the operator
 * still has the client's document in front of them.
 *
 * Keep in step with the Python module: same rules, same split between a number
 * that must check out and a foreign document that can't.
 */

const VALID_PROVINCES = new Set([...Array.from({ length: 24 }, (_, i) => i + 1), 30])

// Third digit of a 13-digit RUC: 6 = public entity, 9 = private company. Anything else is a natural
// person's RUC (their cédula plus an establishment suffix), which uses the cédula algorithm.
const PUBLIC_DIGIT = 6
const PRIVATE_DIGIT = 9

const NATURAL_COEFFICIENTS = [2, 1, 2, 1, 2, 1, 2, 1, 2]
const PUBLIC_COEFFICIENTS = [3, 2, 7, 6, 5, 4, 3, 2]
const PRIVATE_COEFFICIENTS = [4, 3, 2, 7, 6, 5, 4, 3, 2]

const LENGTH_MSG = 'Debe ser una cédula (10 dígitos) o un RUC (13 dígitos) ecuatoriano.'
const CHECK_MSG = 'El número no corresponde a una cédula o RUC ecuatoriano válido.'

const isDigits = (value: string) => value.length > 0 && /^\d+$/.test(value)

/** Whether this is a company's RUC rather than a person's. */
export const isCompanyRuc = (value: string): boolean => {
  if (!isDigits(value) || value.length !== 13) return false
  const third = Number(value[2])
  return third === PUBLIC_DIGIT || third === PRIVATE_DIGIT
}

/** The reason `value` isn't a valid cédula/RUC, or `null` if it is. */
export const taxIdError = (value: string): string | null => {
  if (!isDigits(value)) return LENGTH_MSG
  if (value.length !== 10 && value.length !== 13) return LENGTH_MSG
  if (!VALID_PROVINCES.has(Number(value.slice(0, 2)))) return CHECK_MSG

  const third = Number(value[2])
  const isPublic = value.length === 13 && third === PUBLIC_DIGIT
  const isPrivate = value.length === 13 && third === PRIVATE_DIGIT
  const isNatural = !isPublic && !isPrivate

  const coefficients = isPublic
    ? PUBLIC_COEFFICIENTS
    : isPrivate
      ? PRIVATE_COEFFICIENTS
      : NATURAL_COEFFICIENTS

  // The check digit sits right after the coefficients it is computed from.
  const checker = Number(value[coefficients.length])
  const base = isNatural ? 10 : 11

  const total = coefficients.reduce((sum, coefficient, index) => {
    const product = Number(value[index]) * coefficient
    // For a natural person it's the digit sum of the product.
    return sum + (isNatural && product >= 10 ? Math.floor(product / 10) + (product % 10) : product)
  }, 0)

  const remainder = total % base
  const expected = remainder === 0 ? 0 : base - remainder
  return expected === checker ? null : CHECK_MSG
}

/**
 * The rule the client form and the API enforce.
 *
 * An all-digits identifier is held to the full algorithm; anything carrying a
 * letter is taken as a foreign document (passport) and accepted as typed. Nine
 * digits is a mistyped cédula, not a passport, so it still fails.
 */
export const identifierError = (value: string): string | null => {
  const trimmed = value.trim()
  if (!trimmed) return null // `required` already covers the empty case
  return isDigits(trimmed) ? taxIdError(trimmed) : null
}
