import type { BoardProduct } from 'src/features/products/types'
import { normalizeText } from 'src/shared/utils/text'
import { emptyCatalogMaterial, emptyRequirement, materialLabel } from './optimizerForm'
import type { MaterialForm, RequirementForm } from './optimizerForm'
import type { CsvMaterialText, RawPieceRow } from './piecesCsv'

// Second half of the CSV import: binds the raw Material text of each row to a destination.
// Split from piecesCsv.ts because this layer needs the form model, the product catalog and uid
// generation, while the parser stays pure (it re-runs on every keystroke of the import modal).

// Where the pieces carrying a given CSV material text will land.
export type ImportTarget =
  | { kind: 'material'; uid: string } // an existing group
  | { kind: 'board'; boardId: string } // a catalog board → creates a group
  | { kind: 'new' } // an empty group labelled with the CSV text
  | { kind: 'skip' } // drop these rows

// How the destination was found. Drives the badge and the "review me" row highlight.
export type TargetMatch = 'group' | 'board' | 'none'

export interface MaterialMapping extends CsvMaterialText {
  target: ImportTarget
  match: TargetMatch
  ambiguous: boolean // the name is shared by several catalog boards
}

// Full label of a catalog board, matching what materialLabel() renders for a chosen board.
const boardLabel = (b: BoardProduct): string => `${b.name} (${b.code})`

// Auto-resolves each distinct CSV text. Pure, so the modal can re-run it whenever the CSV, the
// groups or the (async) board catalog change, and just overlay the user's picks on top.
export const resolveMaterialTargets = (
  texts: CsvMaterialText[],
  materials: MaterialForm[],
  boards: BoardProduct[],
): MaterialMapping[] => {
  // Catalog indexes, built once per call.
  const byFull = new Map<string, BoardProduct>()
  const byCode = new Map<string, BoardProduct>()
  const byName = new Map<string, BoardProduct>()
  const dupName = new Set<string>()
  for (const b of boards) {
    const name = normalizeText(b.name)
    if (byName.has(name)) dupName.add(name)
    else byName.set(name, b)
    if (!byFull.has(normalizeText(boardLabel(b)))) byFull.set(normalizeText(boardLabel(b)), b)
    if (!byCode.has(normalizeText(b.code))) byCode.set(normalizeText(b.code), b)
  }

  // Existing groups, by display label / explicit label and by the board they point at.
  const groupByLabel = new Map<string, MaterialForm>()
  const groupByBoard = new Map<string, MaterialForm>()
  for (const m of materials) {
    // A catalog material with no board renders as the literal 'Tablero sin elegir' unless it carries
    // a label, so only index the display label when it actually identifies the material.
    if (m.source !== 'catalog' || m.boardId) {
      const k = normalizeText(materialLabel(m, boards))
      if (!groupByLabel.has(k)) groupByLabel.set(k, m)
    }
    const own = normalizeText(m.label)
    if (own && !groupByLabel.has(own)) groupByLabel.set(own, m)
    if (m.source === 'catalog' && m.boardId && !groupByBoard.has(String(m.boardId))) {
      groupByBoard.set(String(m.boardId), m)
    }
  }

  const first = materials[0]

  const mappings = texts.map<MaterialMapping>((t) => {
    const base = { ...t, ambiguous: false }

    // Blank Material cell: keep the historical behaviour of falling into the first group.
    if (t.key === '') {
      return first
        ? { ...base, target: { kind: 'material', uid: first.uid }, match: 'none' }
        : { ...base, target: { kind: 'new' }, match: 'none' }
    }

    const group = groupByLabel.get(t.key)
    if (group) return { ...base, target: { kind: 'material', uid: group.uid }, match: 'group' }

    const board = byFull.get(t.key) ?? byCode.get(t.key) ?? byName.get(t.key)
    if (board) {
      // The board already has a group: send the pieces there instead of creating a second one.
      const owned = groupByBoard.get(String(board.id))
      if (owned) return { ...base, target: { kind: 'material', uid: owned.uid }, match: 'group' }
      return {
        ...base,
        target: { kind: 'board', boardId: String(board.id) },
        match: 'board',
        ambiguous: dupName.has(t.key),
      }
    }

    return { ...base, target: { kind: 'new' }, match: 'none' }
  })

  // Compatibility with the previous behaviour: a CSV whose Material column is free text, imported
  // into a workspace with a single group, used to land entirely in that group. Keep it that way
  // instead of stranding every piece in a new board-less group. `match` stays 'none' so the UI
  // still says the text did not resolve.
  const only = mappings[0]
  if (mappings.length === 1 && only && only.match === 'none' && materials.length === 1 && first) {
    return [{ ...only, target: { kind: 'material', uid: first.uid } }]
  }

  return mappings
}

// <select> value codec. Kinds carrying an id are encoded as 'mat:<uid>' / 'board:<id>'.
export const targetToValue = (t: ImportTarget): string => {
  if (t.kind === 'material') return `mat:${t.uid}`
  if (t.kind === 'board') return `board:${t.boardId}`
  return t.kind
}

export const targetFromValue = (v: string): ImportTarget => {
  if (v.startsWith('mat:')) return { kind: 'material', uid: v.slice(4) }
  if (v.startsWith('board:')) return { kind: 'board', boardId: v.slice(6) }
  return v === 'skip' ? { kind: 'skip' } : { kind: 'new' }
}

// Human-readable destination, for the pieces preview.
export const targetLabel = (
  t: ImportTarget,
  materials: MaterialForm[],
  boards: BoardProduct[],
): string => {
  if (t.kind === 'material') {
    const m = materials.find((x) => x.uid === t.uid)
    return m ? materialLabel(m, boards) : '—'
  }
  if (t.kind === 'board') {
    const b = boards.find((x) => String(x.id) === t.boardId)
    return b ? boardLabel(b) : '—'
  }
  return t.kind === 'skip' ? '—' : 'Grupo nuevo'
}

const rowToRequirement = (row: RawPieceRow, materialUid: string): RequirementForm => {
  const req = emptyRequirement(materialUid)
  req.height = row.height
  req.width = row.width
  req.quantity = row.quantity
  req.priority = row.priority
  req.label = row.label
  req.canRotate = row.canRotate
  // Sides and soft/hard come from the file's Etiqueta; the tapacanto PRODUCT does not — it depends
  // on the catalog, so it is left empty and filled in by the group once its board is known
  // (MaterialGroupCard). That also keeps this function pure and catalog-free.
  if (row.canto && row.canto.notation !== '—') {
    req.edgeBanding = { productId: '', sides: { ...row.canto.sides }, bandType: row.canto.bandType }
  }
  return req
}

// Grouped-view paste: every row is pinned to the group being pasted into (never creates groups).
export const rowsToRequirements = (rows: RawPieceRow[], materialUid: string): RequirementForm[] =>
  rows.map((r) => rowToRequirement(r, materialUid))

export interface ImportResult {
  requirements: RequirementForm[]
  newMaterials: MaterialForm[]
  skipped: number
}

// Binds rows to their destination, creating one MaterialForm per new destination. Material uids are
// generated HERE — once, on confirm — never while parsing or previewing.
export const buildImport = (rows: RawPieceRow[], mappings: MaterialMapping[]): ImportResult => {
  const newMaterials: MaterialForm[] = []
  const byBoard = new Map<string, MaterialForm>() // two spellings of one board share a group
  const uidByKey = new Map<string, string>()
  const skippedKeys = new Set<string>()

  for (const m of mappings) {
    if (m.target.kind === 'skip') {
      skippedKeys.add(m.key)
      continue
    }
    if (m.target.kind === 'material') {
      uidByKey.set(m.key, m.target.uid)
      continue
    }
    if (m.target.kind === 'board') {
      const existing = byBoard.get(m.target.boardId)
      if (existing) {
        uidByKey.set(m.key, existing.uid)
        continue
      }
      const created = { ...emptyCatalogMaterial(), boardId: m.target.boardId }
      byBoard.set(m.target.boardId, created)
      newMaterials.push(created)
      uidByKey.set(m.key, created.uid)
      continue
    }
    // 'new': one board-less group per text, labelled so the user can tell them apart.
    const created = { ...emptyCatalogMaterial(), label: m.text }
    newMaterials.push(created)
    uidByKey.set(m.key, created.uid)
  }

  const requirements: RequirementForm[] = []
  let skipped = 0
  for (const row of rows) {
    const key = normalizeText(row.materialText)
    if (skippedKeys.has(key)) {
      skipped += 1
      continue
    }
    const uid = uidByKey.get(key)
    if (uid == null) {
      skipped += 1
      continue
    }
    requirements.push(rowToRequirement(row, uid))
  }

  return { requirements, newMaterials, skipped }
}
