import type { BoardProduct, EdgeBandingProduct } from 'src/features/products/types'
import type {
  EdgeSide,
  InlineMaterialInput,
  MaterialInput,
  MaterialSourceKind,
  PoolFillOrder,
  RequirementInput,
} from './types'

// --- Form model (during editing; numbers may be '' while the user is typing) ---

// A client/company offcut attached to a catalog board: extra finite stock of the
// SAME material, so the optimizer can pack a group's pieces across board + offcuts.
export type OffcutSource = 'clientOffcut' | 'companyOffcut'

export interface OffcutForm {
  uid: string
  source: OffcutSource
  label: string
  height: number | string
  width: number | string
  thickness: number | string
  costPerUnit: number | string
  quantity: number | string
}

export interface MaterialForm {
  uid: string
  source: MaterialSourceKind
  boardId: string // catalog: board product id
  label: string // inline sources (manual/offcut)
  height: number | string
  width: number | string
  thickness: number | string
  costPerUnit: number | string
  // Catalog boards only: attached offcuts (same material) + their fill order.
  offcuts?: OffcutForm[]
  fillOrder?: PoolFillOrder
  // Catalog boards only: is this board billed at the quote's price level rather than the list
  // price? Lives on the material rather than in a Set keyed by materialKey because a field rides
  // along in the autosave and in saved drafts for free. The Set the table reads is derived, and
  // keyed by the CANONICAL uid — see `canonicalMaterialKeys`.
  applyPriceLevel?: boolean
  // Catalog boards only: the client takes the WHOLE board even where the optimizer billed a half
  // one, keeping the uncut half. Lives on the material for the same reasons as `applyPriceLevel`,
  // and like it, it never re-runs the search — the cached plan is reshaped.
  wholeBoard?: boolean
}

export interface EdgeBandingForm {
  productId: string // '' = no edge banding product selected
  sides: Record<EdgeSide, boolean>
  // User's soft/hard intent ('' = auto/derived from the selected product). Drives which
  // coordinated tapacanto (productId) is inferred; NOT sent in the API payload.
  bandType?: '' | BandType
}

export interface RequirementForm {
  materialUid: string
  height: number | string
  width: number | string
  quantity: number | string
  priority: number | string
  label: string
  canRotate: boolean
  edgeBanding: EdgeBandingForm
}

export const SOURCE_LABELS: Record<MaterialSourceKind, string> = {
  catalog: 'Catálogo',
  manual: 'Manual',
  companyOffcut: 'Retazo empresa',
  clientOffcut: 'Retazo cliente',
}

// Sides in the canonical contract order (top, bottom, left, right) with their display labels.
export const EDGE_SIDES: { key: EdgeSide; label: string }[] = [
  { key: 'top', label: 'Superior' },
  { key: 'bottom', label: 'Inferior' },
  { key: 'left', label: 'Izquierdo' },
  { key: 'right', label: 'Derecho' },
]

let seq = 0
export const nextUid = () => `mat-${(seq++).toString(36)}-${Math.random().toString(36).slice(2, 7)}`

export const emptyEdgeBanding = (): EdgeBandingForm => ({
  productId: '',
  sides: { top: false, bottom: false, left: false, right: false },
  bandType: '',
})

export const emptyCatalogMaterial = (): MaterialForm => ({
  uid: nextUid(),
  source: 'catalog',
  boardId: '',
  label: '',
  height: '',
  width: '',
  thickness: '',
  costPerUnit: '',
  offcuts: [],
  fillOrder: 'auto',
  applyPriceLevel: false,
  wholeBoard: false,
})

export const emptyOffcut = (source: OffcutSource = 'clientOffcut'): OffcutForm => ({
  uid: nextUid(),
  source,
  label: '',
  height: '',
  width: '',
  thickness: '',
  costPerUnit: '',
  quantity: 1,
})

export const isOffcutValid = (o: OffcutForm): boolean =>
  Number(o.height) > 0 && Number(o.width) > 0 && Number(o.thickness) > 0

// Deep-clone a material with FRESH uids (material + each offcut) for duplication.
// Offcut uids become payload material keys, so they must be unique per material.
export const cloneMaterial = (m: MaterialForm): MaterialForm => ({
  ...m,
  uid: nextUid(),
  offcuts: m.offcuts ? m.offcuts.map((o) => ({ ...o, uid: nextUid() })) : m.offcuts,
})

// Valid offcuts attached to a catalog board (empty for non-catalog materials).
export const validOffcuts = (m: MaterialForm): OffcutForm[] =>
  m.source === 'catalog' ? (m.offcuts ?? []).filter(isOffcutValid) : []

export const hasOffcuts = (m: MaterialForm): boolean => validOffcuts(m).length > 0

export const emptyRequirement = (materialUid = ''): RequirementForm => ({
  materialUid,
  height: '',
  width: '',
  quantity: 1,
  priority: 0,
  label: '',
  canRotate: false,
  edgeBanding: emptyEdgeBanding(),
})

// A starter group the user never touched: a catalog material with nothing filled in. Used after a
// CSV import to drop the blank card the page opens with once the import brought its own groups.
export const isPristineMaterial = (m: MaterialForm): boolean =>
  m.source === 'catalog' &&
  !m.boardId &&
  !m.label.trim() &&
  m.height === '' &&
  m.width === '' &&
  m.thickness === '' &&
  m.costPerUnit === '' &&
  (m.offcuts ?? []).length === 0

export const isMaterialValid = (m: MaterialForm): boolean =>
  m.source === 'catalog'
    ? !!m.boardId
    : Number(m.height) > 0 && Number(m.width) > 0 && Number(m.thickness) > 0

export const selectedSides = (eb: EdgeBandingForm): EdgeSide[] =>
  EDGE_SIDES.filter((s) => eb.sides[s.key]).map((s) => s.key)

export const hasEdgeBanding = (eb: EdgeBandingForm): boolean => selectedSides(eb).length > 0

// A piece has edge-banding sides selected but no tapacanto (product) chosen. Allowed for a raw
// optimize (geometry only, productId assigned later), but must be resolved before quoting so the
// banding can be priced and drawn — otherwise it produces an unidentified/unpriced banding line.
export const needsBandingProduct = (r: RequirementForm): boolean =>
  hasEdgeBanding(r.edgeBanding) && !r.edgeBanding.productId

// Flat indices of pieces with sides defined but no tapacanto — used to block quoting and flag rows.
export const piecesMissingBandingProduct = (requirements: RequirementForm[]): number[] =>
  requirements.reduce<number[]>((acc, r, i) => {
    if (needsBandingProduct(r)) acc.push(i)
    return acc
  }, [])

// Valid material uids: pieces may only reference one of these.
export const validMaterialUids = (materials: MaterialForm[]): Set<string> =>
  new Set(materials.filter(isMaterialValid).map((m) => m.uid))

// A piece is valid (included in optimization) if it references a valid material and has dimensions > 0.
export const isRequirementValid = (r: RequirementForm, validUids: Set<string>): boolean =>
  validUids.has(r.materialUid) && Number(r.height) > 0 && Number(r.width) > 0

// A "blank" row (just added, untouched): not highlighted as an error even if invalid.
export const isRequirementEmpty = (r: RequirementForm): boolean =>
  r.height === '' && r.width === '' && !r.label.trim() && !hasEdgeBanding(r.edgeBanding)

// Deep clone of a piece (edgeBanding.sides is an object) used when duplicating rows.
export const cloneRequirement = (r: RequirementForm): RequirementForm => ({
  ...r,
  edgeBanding: {
    productId: r.edgeBanding.productId,
    sides: { ...r.edgeBanding.sides },
    bandType: r.edgeBanding.bandType ?? '',
  },
})

export interface PiecesSummary {
  pieces: number // valid rows
  units: number // Σ quantity of valid rows
  areaM2: number // Σ height·width·qty / 1e6
  invalid: number // rows with data but invalid
}

export const piecesSummary = (
  requirements: RequirementForm[],
  materials: MaterialForm[],
): PiecesSummary => {
  const validUids = validMaterialUids(materials)
  let pieces = 0
  let units = 0
  let areaM2 = 0
  let invalid = 0
  for (const r of requirements) {
    if (isRequirementValid(r, validUids)) {
      const qty = Number(r.quantity) || 1
      pieces += 1
      units += qty
      areaM2 += (Number(r.height) * Number(r.width) * qty) / 1_000_000
    } else if (!isRequirementEmpty(r)) {
      invalid += 1
    }
  }
  return { pieces, units, areaM2, invalid }
}

// A row the user started but left unusable. `piecesSummary` only counts these; optimizing needs to
// say which row and what is missing, so the user can fix it without hunting through the grid.
export interface RequirementIssue {
  index: number // flat index into requirements (displayed as index + 1)
  reasons: string[]
}

export const requirementIssues = (
  requirements: RequirementForm[],
  materials: MaterialForm[],
): RequirementIssue[] => {
  const validUids = validMaterialUids(materials)
  const issues: RequirementIssue[] = []
  requirements.forEach((r, index) => {
    // Blank rows are dropped before this runs, so anything invalid here is genuinely half-filled.
    if (isRequirementEmpty(r) || isRequirementValid(r, validUids)) return
    const reasons: string[] = []
    if (!validUids.has(r.materialUid)) reasons.push('sin material definido')
    if (!(Number(r.height) > 0)) reasons.push('falta el largo')
    if (!(Number(r.width) > 0)) reasons.push('falta el ancho')
    issues.push({ index, reasons })
  })
  return issues
}

// Human-readable label for a material, used in the pieces dropdown and diagram.
export const materialLabel = (m: MaterialForm, boards: BoardProduct[]): string => {
  if (m.source === 'catalog') {
    // Product id may arrive as a number at runtime; compare as string to be safe.
    const b = boards.find((x) => String(x.id) === String(m.boardId))
    if (b) return `${b.name} (${b.code})`
    // CSV import pre-labels a group with the text that created it, before a board is picked.
    return m.label.trim() || 'Tablero sin elegir'
  }
  if (m.label.trim()) return m.label.trim()
  const dims = [m.height, m.width, m.thickness].filter((v) => v !== '' && v != null).join('×')
  return dims ? `${SOURCE_LABELS[m.source]} ${dims}` : SOURCE_LABELS[m.source]
}

export interface BuiltPayload {
  materials: MaterialInput[]
  requirements: RequirementInput[]
  validCount: number
}

// Maps each material uid to the key its pieces — and its payload entry — will actually use. Catalog
// boards collapse onto the first block that uses that productId; everything else maps to itself. A
// catalog board with attached offcuts stays DISTINCT (it anchors a pool) so merging can't break the
// pool link. Invalid materials are absent, so every caller falls back to the uid itself.
//
// Exported because the per-board marks have to agree with it: the summary shows ONE row per payload
// material, so a mark ticked on that row belongs to the whole merged group, not to whichever block
// happened to be canonical.
export const canonicalMaterialKeys = (materials: MaterialForm[]): Map<string, string> => {
  const canonicalKey = new Map<string, string>()
  const catalogCanonical = new Map<number, string>()
  for (const m of materials.filter(isMaterialValid)) {
    if (m.source === 'catalog' && !hasOffcuts(m)) {
      const productId = Number(m.boardId)
      const existing = catalogCanonical.get(productId)
      if (existing) {
        canonicalKey.set(m.uid, existing)
      } else {
        catalogCanonical.set(productId, m.uid)
        canonicalKey.set(m.uid, m.uid)
      }
    } else {
      canonicalKey.set(m.uid, m.uid)
    }
  }
  return canonicalKey
}

// The two per-board marks of a merged group, OR-ed onto its canonical key. They are properties of
// the BOARD, not of the block: the seller sees one summary row per board and ticks that. The
// toggles write every block of a group, so this only has to settle quotes saved before they did.
const mergedMarks = (
  materials: MaterialForm[],
  canonicalKey: Map<string, string>,
): Map<string, { applyPriceLevel: boolean; wholeBoard: boolean }> => {
  const marks = new Map<string, { applyPriceLevel: boolean; wholeBoard: boolean }>()
  for (const m of materials) {
    if (m.source !== 'catalog') continue
    const key = canonicalKey.get(m.uid)
    if (!key) continue
    const acc = marks.get(key)
    marks.set(key, {
      applyPriceLevel: !!acc?.applyPriceLevel || !!m.applyPriceLevel,
      wholeBoard: !!acc?.wholeBoard || !!m.wholeBoard,
    })
  }
  return marks
}

// Builds the contract's materials[] + requirements[] from form state. Each material uses its `uid`
// as `key`; pieces reference it via `materialKey`. Only materials actually used by a valid piece are included.
// Catalog materials pointing to the same board are merged into a single payload material so the
// endpoint never receives duplicates (e.g. after duplicating a material or picking the same board in
// two blocks); their pieces are re-pointed to the first block's key. Inline materials (offcuts) stay
// distinct even when their dimensions coincide.
export const buildPayload = (
  materials: MaterialForm[],
  requirements: RequirementForm[],
): BuiltPayload => {
  const validMaterials = materials.filter(isMaterialValid)
  const validUids = validMaterialUids(materials)

  const canonicalKey = canonicalMaterialKeys(materials)
  const marks = mergedMarks(validMaterials, canonicalKey)

  const mappedMaterials: MaterialInput[] = validMaterials
    .filter((m) => canonicalKey.get(m.uid) === m.uid)
    .map((m) => {
      if (m.source === 'catalog') {
        const base = {
          key: m.uid,
          source: 'catalog' as const,
          productId: Number(m.boardId),
          // Read off the merged marks, not off `m`: two blocks of the same board become ONE payload
          // material, and taking only the canonical block's flags dropped a mark set on the other.
          // Only when marked: an omitted flag reads as false on the API and keeps the payload — and
          // the staleness signature built from it — identical to before this feature for every quote
          // that levels nothing.
          ...(marks.get(m.uid)?.applyPriceLevel ? { applyPriceLevel: true } : {}),
          ...(marks.get(m.uid)?.wholeBoard ? { wholeBoard: true } : {}),
        }
        // Only carry fillOrder when the board actually anchors a pool of offcuts.
        return hasOffcuts(m) ? { ...base, fillOrder: m.fillOrder ?? 'auto' } : base
      }
      return {
        key: m.uid,
        source: m.source,
        height: Number(m.height),
        width: Number(m.width),
        thickness: Number(m.thickness),
        costPerUnit: Number(m.costPerUnit) || 0,
        label: m.label.trim() || undefined,
      }
    })

  // Pooled offcuts: extra finite stock of a catalog board. Emitted with a poolKey
  // pointing at that board's key; not referenced by any requirement.
  const pooledOffcuts: InlineMaterialInput[] = []
  for (const m of validMaterials) {
    if (m.source !== 'catalog' || canonicalKey.get(m.uid) !== m.uid) continue
    for (const o of validOffcuts(m)) {
      pooledOffcuts.push({
        key: o.uid,
        source: o.source,
        height: Number(o.height),
        width: Number(o.width),
        thickness: Number(o.thickness),
        costPerUnit: Number(o.costPerUnit) || 0,
        label: o.label.trim() || undefined,
        quantity: Number(o.quantity) || 1,
        poolKey: m.uid,
      })
    }
  }

  const validReqs = requirements.filter((r) => isRequirementValid(r, validUids))

  const mappedReqs: RequirementInput[] = validReqs.map((r) => {
    const sides = selectedSides(r.edgeBanding)
    const pid = Number(r.edgeBanding.productId) || undefined
    const edgeBanding = sides.length ? { sides, ...(pid ? { productId: pid } : {}) } : undefined
    return {
      materialKey: canonicalKey.get(r.materialUid) ?? r.materialUid,
      height: Number(r.height),
      width: Number(r.width),
      quantity: Number(r.quantity) || 1,
      priority: Number(r.priority) || 0,
      label: r.label.trim() || undefined,
      canRotate: r.canRotate,
      ...(edgeBanding ? { edgeBanding } : {}),
    }
  })

  const usedUids = new Set(mappedReqs.map((r) => r.materialKey))
  const materialsUsed = mappedMaterials.filter((m) => usedUids.has(m.key))
  // Keep a pooled offcut when its parent catalog board is actually used.
  const offcutsUsed = pooledOffcuts.filter((o) => o.poolKey != null && usedUids.has(o.poolKey))

  return {
    materials: [...materialsUsed, ...offcutsUsed],
    requirements: mappedReqs,
    validCount: mappedReqs.length,
  }
}

// --- Edge banding notation (business domain) ---
// L = long side = left/right (sides running along the length of the piece)
// C = short side = top/bottom (sides running along the width of the piece)

export const CANTO_NOTATIONS = ['—', '1L', '2L', '1C', '2C', '1L1C', '1L2C', '2L1C', '4L'] as const
export type CantoNotation = (typeof CANTO_NOTATIONS)[number]

const NOTATION_TO_SIDES: Record<CantoNotation, Record<EdgeSide, boolean>> = {
  '—': { top: false, bottom: false, left: false, right: false },
  '1L': { top: false, bottom: false, left: true, right: false },
  '2L': { top: false, bottom: false, left: true, right: true },
  '1C': { top: true, bottom: false, left: false, right: false },
  '2C': { top: true, bottom: true, left: false, right: false },
  '1L1C': { top: true, bottom: false, left: true, right: false },
  '1L2C': { top: true, bottom: true, left: true, right: false },
  '2L1C': { top: true, bottom: false, left: true, right: true },
  '4L': { top: true, bottom: true, left: true, right: true },
}

export function notationFromSides(sides: Record<EdgeSide, boolean>): CantoNotation {
  const l = (sides.left ? 1 : 0) + (sides.right ? 1 : 0)
  const c = (sides.top ? 1 : 0) + (sides.bottom ? 1 : 0)
  if (l === 0 && c === 0) return '—'
  if (l === 2 && c === 2) return '4L'
  let key = ''
  if (l > 0) key += `${l}L`
  if (c > 0) key += `${c}C`
  return (key as CantoNotation) ?? '—'
}

export function sidesFromNotation(n: string): Record<EdgeSide, boolean> {
  return NOTATION_TO_SIDES[n as CantoNotation] ?? NOTATION_TO_SIDES['—']
}

export const CANTO_NOTATION_RE = /^(?:4[Ll]|[12][Ll](?:[12][Cc])?|[12][Cc])$/

// --- Edge banding type (canto suave/duro) ---
// Canonical values match the backend/product catalog ('Soft'/'Hard'). CS = canto suave,
// CD = canto duro — the abbreviations used in the quick-entry notation and PDFs.
export type BandType = 'Soft' | 'Hard'

export const BAND_TYPES: { value: BandType; label: string; abbr: string }[] = [
  { value: 'Soft', label: 'Suave', abbr: 'CS' },
  { value: 'Hard', label: 'Duro', abbr: 'CD' },
]

export const CS_CD_TO_BANDTYPE: Record<string, BandType> = { CS: 'Soft', CD: 'Hard' }
export const BANDTYPE_ABBR: Record<BandType, string> = { Soft: 'CS', Hard: 'CD' }
export const BANDTYPE_LABEL: Record<BandType, string> = { Soft: 'Suave', Hard: 'Duro' }

// A tapacanto covers a board's edge only if it is WIDER than the board is thick — the overhang
// is what the trimmer shaves off. Mirrors edge_width_fits_board in the backend's
// src/modules/products/service.py (EDGE_WIDTH_MIN/MAX_OVERHANG_MM) — keep both in sync.
//
// This used to be a map of one exact width per thickness ({ 15: 19, 36: 40 }), which held while
// the catalog was seed data. The vendor stocks the same design in several widths (18/19/20/22 for
// a 15mm board, 40/45 for a 36mm one), so an exact width hid most of them and left whole designs
// with nothing at all.
export const EDGE_WIDTH_MIN_OVERHANG_MM = 1
export const EDGE_WIDTH_MAX_OVERHANG_MM = 10

// Whether a tapacanto of this width covers a board of this thickness. Read from the board's
// thickness rather than from its coordinated list, because that list is empty when the board has
// no `family` loaded and the rule still applies. Unknown thickness (non-catalog material) accepts
// everything, so the caller shows the whole catalog instead of an empty table.
export const edgeWidthFitsBoard = (thickness: number | undefined, width?: number): boolean => {
  if (thickness == null || width == null) return true
  const overhang = width - thickness
  return overhang >= EDGE_WIDTH_MIN_OVERHANG_MM && overhang <= EDGE_WIDTH_MAX_OVERHANG_MM
}

// A trailing quick-entry token declaring the band type (e.g. "…2L1C CS").
export const BAND_TYPE_TOKEN_RE = /^C[SD]$/i

// Picks the coordinated tapacanto for a band type. `coord` is the board's coordinated list, which
// the backend sorts by width asc (then by the tape's own thickness), so the first match is the
// narrowest tape that covers the edge — the one the shop actually uses. A design stocked in more
// than one width keeps its wider options behind it in the dropdown.
export const inferBandingProductId = (
  coord: EdgeBandingProduct[],
  bandType: BandType | '' | undefined,
): string => {
  const pool = bandType ? coord.filter((p) => p.attributes.bandType === bandType) : coord
  return pool[0] ? String(pool[0].id) : ''
}

// The band type to display for a piece: the explicit choice, or (fallback) the one derived from
// the assigned tapacanto product. Lets the "Tipo" column show the right value for quotes loaded
// with a productId but no explicit bandType, without a hydration step.
export const displayedBandType = (
  eb: EdgeBandingForm,
  byId: Map<string, EdgeBandingProduct>,
): '' | BandType =>
  eb.bandType || ((byId.get(eb.productId)?.attributes.bandType as BandType | undefined) ?? '')
