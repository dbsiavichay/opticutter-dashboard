import type { EdgeSide } from './types'
import type { BandType, CantoNotation } from './optimizerForm'
import { CS_CD_TO_BANDTYPE, sidesFromNotation } from './optimizerForm'

// Reads the "Etiqueta" column of an imported cut list as EDGE BANDING (canto), which is what the
// workshop's commercial cutting program puts there: its own <edge_band> block always ships empty and
// the banding travels in the free-text label ('1L CS', '4L CD BL', 'NO', '1L CS DIV 1/60 1/35').
//
// The notation is the same one this app prints: L = long side (left/right), C = short side
// (top/bottom), CS = canto suave, CD = canto duro. A trailing code ('BL', 'JAP') names the design
// FAMILY of the tapacanto, which is only meaningful against the catalog — so it is reported, never
// resolved here (the piece gets its board's coordinated tapacanto and the import warns about it).
//
// Pure and catalog-free: the import modal re-runs it on every keystroke.

// Shop annotation for internal divisions ('DIV 1/60 1/35'): a note for the operator, not banding.
// From this token on, the rest of the label is kept verbatim as the piece's own text.
const STOP_WORDS = new Set(['DIV'])

// Explicit "this piece carries no banding" written by the commercial program.
const NO_BANDING_WORDS = new Set(['NO', 'N/A', '-'])

// One '<count><side>' group at the start of a token: '1L', '4L', and the glued '1L2C' / '1LCS'.
const COUNT_RE = /^(\d+)([LC])/

// A design family code ('BL', 'JAP'). Kept short on purpose: anything longer is prose, not a code,
// and ends the banding part of the label.
const FAMILY_RE = /^[A-Z]{1,4}$/

export interface ParsedCanto {
  notation: CantoNotation
  sides: Record<EdgeSide, boolean>
  // '' when the label states sides but not the type (e.g. a bare '1L') — the row still imports, and
  // the tapacanto inference then just takes the first coordinated one.
  bandType: '' | BandType
  // Family codes found after the type ('BL', 'JAP'). They name a tapacanto of a DIFFERENT design
  // than the piece's board, which only the user can confirm.
  familyTokens: string[]
  // The label declared more than one banding run ('1L CS 1L CS BL', '1L CD 1C CS'): the sides are
  // merged but a single piece can only carry one tapacanto, so the choice needs a human.
  mixed: boolean
  // Text that was not part of the banding notation ('DIV 1/60 1/35'), in its original spelling.
  leftover: string
  // The row should be looked at before quoting: an unresolvable family, or a mixed label.
  needsReview: boolean
}

const notationFromCounts = (long: number, short: number): CantoNotation => {
  if (long === 0 && short === 0) return '—'
  if (long === 2 && short === 2) return '4L'
  return `${long ? `${long}L` : ''}${short ? `${short}C` : ''}` as CantoNotation
}

const noBanding = (leftover = ''): ParsedCanto => ({
  notation: '—',
  // Copied: sidesFromNotation hands back a shared lookup entry, and each piece owns its sides.
  sides: { ...sidesFromNotation('—') },
  bandType: '',
  familyTokens: [],
  mixed: false,
  leftover,
  needsReview: false,
})

/**
 * Reads an imported "Etiqueta" as edge banding.
 *
 * Returns `null` when the text is not banding notation at all (no L/C counts), so the caller can
 * keep it as the piece's own label — which is what this app's OWN csv export writes there
 * ('Puerta'). An explicit 'NO' returns a no-banding result instead, so it does not survive as text.
 */
export const parseCantoLabel = (text: string): ParsedCanto | null => {
  const raw = text.trim()
  if (!raw) return null
  if (NO_BANDING_WORDS.has(raw.toUpperCase())) return noBanding()

  let long = 0
  let short = 0
  let bandType: '' | BandType = ''
  let bandTokens = 0
  let segments = 0
  let sawBandSinceCount = false
  const familyTokens: string[] = []
  const leftover: string[] = []

  const tokens = raw.split(/\s+/)
  for (const [i, original] of tokens.entries()) {
    let rest = original.toUpperCase()

    // Counts first: they may be glued to each other and to the type ('1L2C', '1LCS').
    let sawCount = false
    for (;;) {
      const m = COUNT_RE.exec(rest)
      if (!m) break
      if (!sawCount && sawBandSinceCount) segments += 1
      sawCount = true
      sawBandSinceCount = false
      const n = Number(m[1])
      // '4L' is how this notation says ALL FOUR sides — not four long ones. It is the same shape
      // the backend prints (edge_banding_notation collapses 2 long + 2 short into '4L').
      if (m[2] === 'L') {
        if (n >= 4) {
          long += 2
          short += 2
        } else long += n
      } else short += n
      rest = rest.slice(m[0].length)
    }
    if (sawCount && segments === 0) segments = 1
    if (!rest) continue

    if (rest === 'CS' || rest === 'CD') {
      bandTokens += 1
      sawBandSinceCount = true
      // First one wins: a second type belongs to another run, which this piece cannot express.
      if (!bandType) bandType = CS_CD_TO_BANDTYPE[rest] ?? ''
      continue
    }

    if (!STOP_WORDS.has(rest) && FAMILY_RE.test(rest)) {
      familyTokens.push(rest)
      continue
    }

    // Not notation any more: this token and everything after it is the operator's own text.
    leftover.push(...tokens.slice(i))
    break
  }

  // No sides declared: this was never a canto (a bare type is meaningless without sides).
  if (long === 0 && short === 0) return null

  // A piece has two long sides and two short ones; a merged label can claim more.
  const notation = notationFromCounts(Math.min(long, 2), Math.min(short, 2))
  const mixed = bandTokens > 1 || segments > 1
  return {
    notation,
    // Copied: sidesFromNotation hands back a shared lookup entry, and each piece owns its sides.
    sides: { ...sidesFromNotation(notation) },
    bandType,
    familyTokens,
    mixed,
    leftover: leftover.join(' '),
    needsReview: mixed || familyTokens.length > 0,
  }
}
