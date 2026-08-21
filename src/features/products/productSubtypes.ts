// Must match the backend's `BoardSubtype`/`EdgeBandingSubtype` enum values
// exactly (src/modules/products/types/board.py, types/edge_banding.py).
export const BOARD_SUBTYPES = [
  'MDP',
  'MDF',
  'HDF',
  'Plywood',
  'Pino',
  'Madera Natural',
  'High Gloss',
  'Math Soft',
  'OSB',
  'Enchapado',
] as const

export const EDGE_BANDING_SUBTYPES = [
  'Canto Maderado',
  'Canto Solido',
  'Canto Gloss',
  'Canto Math Soft',
  'Canto Madera',
] as const
