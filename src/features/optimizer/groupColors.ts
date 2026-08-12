// Accent colors that tell one material group apart from the next in the pieces editor.
//
// Deliberately NOT the `PALETTE` from shared/utils/cutDrawing: that one already means "pieces of the
// same size" in the cut diagram, and with both on screen at once the same swatch would carry two
// unrelated meanings. These are deeper and more saturated so they read as UI chrome (a bar down the
// side of a card) rather than as data, and hold contrast in both light and dark themes.
export const GROUP_ACCENTS = [
  '#4338ca',
  '#0f766e',
  '#b45309',
  '#be123c',
  '#7c3aed',
  '#0e7490',
  '#4d7c0f',
  '#a21caf',
] as const

// Stable accent for a group by its position in the list.
export const accentFor = (index: number): string =>
  GROUP_ACCENTS[index % GROUP_ACCENTS.length] ?? GROUP_ACCENTS[0]
