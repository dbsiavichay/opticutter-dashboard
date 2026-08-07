// Case- and accent-insensitive normalization for comparisons and search (Spanish locale).
// Decomposes to NFD and drops the combining marks, so "Melámina" and "melamina" compare equal.
export const normalizeText = (s: string): string =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()
