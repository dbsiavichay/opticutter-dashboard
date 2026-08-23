// Must match the backend's `BoardSubtype`/`EdgeBandingSubtype` enum values
// exactly (src/modules/products/types/board.py, types/edge_banding.py). Canonical
// values are English — what's sent/stored/filtered on — because the backend
// normalizes the vendor's Spanish text into these on sync (e.g. "Pino" ->
// "Pine"). The shop floor still thinks and talks in Spanish, so the UI shows
// SUBTYPE_LABELS' translation (the same terms this catalog used before the
// backend switched to English) instead of the raw value; only the wire value
// changed, not what a person reads.
export const BOARD_SUBTYPES = [
  'MDP',
  'MDF',
  'HDF',
  'Plywood',
  'Pine',
  'Natural Wood',
  'High Gloss',
  'Math Soft',
  'OSB',
  'Veneer',
] as const

export const EDGE_BANDING_SUBTYPES = ['Wood Grain', 'Solid', 'Gloss', 'Matte Soft', 'Wood'] as const

// English canonical value -> Spanish label shown to the user. Values with no
// entry here (MDP/MDF/HDF/OSB/Plywood/High Gloss/Math Soft) render as-is —
// they were never translated even before the backend's values were English.
export const SUBTYPE_LABELS: Record<string, string> = {
  Pine: 'Pino',
  'Natural Wood': 'Madera Natural',
  Veneer: 'Enchapado',
  'Wood Grain': 'Canto Maderado',
  Solid: 'Canto Solido',
  Gloss: 'Canto Gloss',
  'Matte Soft': 'Canto Math Soft',
  Wood: 'Canto Madera',
}

export const subtypeLabel = (value: string): string => SUBTYPE_LABELS[value] ?? value
