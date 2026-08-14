import { useMemo } from 'react'

import { PALETTE, bandedSides, pieceSig } from 'src/shared/utils/cutDrawing'
import type { LayoutGroup } from './types'

export interface LegendEntry {
  sig: string
  color: string
  count: number
}

export interface PieceColors {
  // Stable color per piece signature, assigned in first-appearance order across every sheet, so the
  // same measurement reads the same in the thumbnails, the big sheet and the legend.
  colorFor: (sig: string) => string
  legend: LegendEntry[]
  hasEdgeBanding: boolean
}

// Shared by the wizard's sheet viewer and the pre-order diagram: both need one palette assignment
// over the whole result, not per sheet.
export const usePieceColors = (layoutGroups: LayoutGroup[]): PieceColors =>
  useMemo(() => {
    const colors = new Map<string, string>()
    const counts = new Map<string, number>()
    let banding = false
    for (const group of layoutGroups) {
      for (const p of group.layout.placedPieces) {
        const sig = pieceSig(p)
        if (!colors.has(sig)) colors.set(sig, PALETTE[colors.size % PALETTE.length] ?? PALETTE[0])
        // Each group represents `count` identical physical sheets.
        counts.set(sig, (counts.get(sig) ?? 0) + group.count)
        if (bandedSides(p).length > 0) banding = true
      }
    }
    return {
      colorFor: (sig: string) => colors.get(sig) ?? PALETTE[0],
      legend: [...colors.keys()].map((sig) => ({
        sig,
        color: colors.get(sig) ?? PALETTE[0],
        count: counts.get(sig) ?? 0,
      })),
      hasEdgeBanding: banding,
    }
  }, [layoutGroups])
