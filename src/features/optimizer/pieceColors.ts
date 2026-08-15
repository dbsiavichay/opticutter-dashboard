import { useMemo } from 'react'

import { PALETTE, pieceSig } from 'src/shared/utils/cutDrawing'
import type { LayoutGroup } from './types'

export interface PieceColors {
  // Stable color per piece signature, assigned in first-appearance order across every sheet, so the
  // same measurement reads the same in the thumbnails and in the big sheet.
  colorFor: (sig: string) => string
}

// Shared by the wizard's sheet viewer and the pre-order diagram: both need one palette assignment
// over the whole result, not per sheet.
//
// It used to also build a legend — a swatch and a count per distinct measurement, plus a tapacanto
// key. That list is gone: the colour is a grouping cue, not a code to look up, and every piece is
// labelled with its own measurement on the sheet itself.
export const usePieceColors = (layoutGroups: LayoutGroup[]): PieceColors =>
  useMemo(() => {
    const colors = new Map<string, string>()
    for (const group of layoutGroups) {
      for (const p of group.layout.placedPieces) {
        const sig = pieceSig(p)
        if (!colors.has(sig)) colors.set(sig, PALETTE[colors.size % PALETTE.length] ?? PALETTE[0])
      }
    }
    return { colorFor: (sig: string) => colors.get(sig) ?? PALETTE[0] }
  }, [layoutGroups])
