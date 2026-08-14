import type { BoardProduct } from 'src/features/products/types'
import { BANDTYPE_ABBR, materialLabel, notationFromSides } from './optimizerForm'
import type { MaterialForm, RequirementForm } from './optimizerForm'
import { parseCantoLabel } from './piecesCanto'
import type { ParsedCanto } from './piecesCanto'
import { downloadBlob } from 'src/shared/utils/download'
import { normalizeText } from 'src/shared/utils/text'

// Import and export for the pieces list. No dependencies: it handles paste from Excel/Sheets
// (tab-delimited), CSV files (comma or semicolon) and the XML the workshop's commercial cutting
// program writes — both of that program's formats carry the very same rows.
//
// The Etiqueta column is read as EDGE BANDING when it looks like the workshop notation
// ('1L CS', '4L CD BL'), because that is where the commercial program keeps it; see piecesCanto.ts.
// Anything else stays as the piece's own free text. The tapacanto PRODUCT is not in this format:
// it is inferred from the group's board once the material is mapped.

// Column order matches the visual order of the table.
export const CSV_COLUMNS = [
  'Material',
  'Largo',
  'Ancho',
  'Cantidad',
  'Prioridad',
  'Etiqueta',
  'Rotar',
] as const

// Known header words used to detect (and skip) a header row.
const HEADER_WORDS = [
  'material',
  'alto',
  'altura',
  'height',
  'ancho',
  'width',
  'cant',
  'cantidad',
  'qty',
  'quantity',
  'prior',
  'prioridad',
  'priority',
  'etiqueta',
  'label',
  'nombre',
  'rotar',
  'rotate',
  'giro',
]

// Anything outside this set (including 'no', '0', 'false' and a blank cell) reads as "do not rotate".
const TRUE_WORDS = new Set(['si', 'sí', 'x', '1', 'true', 'verdadero', 'yes', '✓'])

// Converts text to a number, accepting comma as decimal separator. Returns '' if not a number.
const parseNum = (s: string): number | string => {
  const t = s.trim().replace(',', '.')
  if (t === '') return ''
  const n = Number(t)
  return Number.isFinite(n) ? n : ''
}

// Detects the delimiter: tab (spreadsheet paste) takes priority; otherwise ';' or ','.
const detectDelimiter = (text: string): string => {
  if (text.includes('\t')) return '\t'
  const firstLine = text.split(/\r?\n/, 1)[0] ?? ''
  const semis = (firstLine.match(/;/g) ?? []).length
  const commas = (firstLine.match(/,/g) ?? []).length
  return semis > commas ? ';' : ','
}

// Splits a line respecting double-quoted fields ("a,b" stays intact) and escaped quotes ("").
const splitLine = (line: string, delimiter: string): string[] => {
  const cells: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else inQuotes = false
      } else cur += ch
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === delimiter) {
      cells.push(cur)
      cur = ''
    } else cur += ch
  }
  cells.push(cur)
  return cells.map((c) => c.trim())
}

// Treat as a header if ≥2 cells exactly match a known word (avoids false positives
// for labels that happen to contain "alto", "ancho", etc.).
const looksLikeHeader = (cells: string[]): boolean => {
  const words = new Set(HEADER_WORDS)
  const hits = cells.filter((c) => words.has(normalizeText(c))).length
  return hits >= 2
}

// A parsed row before it is bound to a material group: it keeps the raw Material cell so the
// destination can be resolved — and overridden by the user — at confirm time. See piecesImport.ts.
export interface RawPieceRow {
  materialText: string // Material cell, '' when missing or blank
  height: number | string
  width: number | string
  quantity: number | string
  priority: number | string
  label: string
  canRotate: boolean
  lineNo: number // 1-based source line, for warnings
  // Edge banding read off the Etiqueta; absent when that text was not banding notation.
  canto?: ParsedCanto
}

// A distinct Material value found in the CSV. `key` is the accent/case-insensitive dedupe key
// (so "Melamina Blanca" and "melamina blanca" are ONE entry); `text` is the first raw spelling.
export interface CsvMaterialText {
  key: string
  text: string
  count: number // CSV rows carrying it
}

// What the Etiqueta column turned out to be, in PIECES (quantity), so the import can say what it
// did with it and which rows a human still has to look at.
export interface CantoSummary {
  banded: number // pieces that came in with edge banding
  needsReview: number // …of those, the ones carrying a family code or a mixed label
  mixed: number // pieces whose label declared more than one banding run
  familyTokens: { token: string; pieces: number }[] // e.g. [{ token: 'BL', pieces: 133 }]
}

export interface ParsedPieces {
  rows: RawPieceRow[]
  materialTexts: CsvMaterialText[] // first-appearance order
  warnings: string[] // dimension/format problems — material resolution warns from the mapping UI
  canto: CantoSummary
}

// Splits an imported Etiqueta into edge banding and the piece's own text. A row that needs a human
// keeps its ORIGINAL text so it can be found later in the pieces table; a cleanly read one drops it,
// since the Canto/Tipo columns now say the same thing.
const readEtiqueta = (etiqueta: string): Pick<RawPieceRow, 'label' | 'canto'> => {
  const canto = parseCantoLabel(etiqueta)
  if (!canto) return { label: etiqueta }
  return { label: canto.needsReview ? etiqueta : canto.leftover, canto }
}

const summarizeCanto = (rows: RawPieceRow[]): CantoSummary => {
  const familyPieces = new Map<string, number>()
  let banded = 0
  let needsReview = 0
  let mixed = 0
  for (const row of rows) {
    const canto = row.canto
    if (!canto || canto.notation === '—') continue
    const pieces = Number(row.quantity) || 1
    banded += pieces
    if (canto.needsReview) needsReview += pieces
    if (canto.mixed) mixed += pieces
    for (const token of canto.familyTokens) {
      familyPieces.set(token, (familyPieces.get(token) ?? 0) + pieces)
    }
  }
  return {
    banded,
    needsReview,
    mixed,
    familyTokens: [...familyPieces.entries()]
      .map(([token, pieces]) => ({ token, pieces }))
      .sort((a, b) => b.pieces - a.pieces),
  }
}

const emptyParse = (warnings: string[] = []): ParsedPieces => ({
  rows: [],
  materialTexts: [],
  warnings,
  canto: { banded: 0, needsReview: 0, mixed: 0, familyTokens: [] },
})

// The commercial program's XML: a flat <data><parts><row> list carrying the same fields as its CSV.
const looksLikeXml = (text: string): boolean => /^\s*(<\?xml|<data\b)/i.test(text)

const finish = (rows: RawPieceRow[], warnings: string[]): ParsedPieces => {
  const byKey = new Map<string, CsvMaterialText>()
  for (const row of rows) {
    const key = normalizeText(row.materialText)
    const seen = byKey.get(key)
    if (seen) seen.count += 1
    else byKey.set(key, { key, text: row.materialText, count: 1 })
  }
  return { rows, materialTexts: [...byKey.values()], warnings, canto: summarizeCanto(rows) }
}

// Parses the commercial program's XML. Its own <edge_band> block always ships empty — the banding
// lives in <label>, exactly like the CSV's Etiqueta — so both formats go through the same reader.
const parseXmlPieces = (text: string): ParsedPieces => {
  const doc = new DOMParser().parseFromString(text, 'application/xml')
  if (doc.querySelector('parsererror')) {
    return emptyParse(['No se pudo leer el XML: el archivo parece incompleto o dañado.'])
  }

  const warnings: string[] = []
  const rows: RawPieceRow[] = []
  const read = (row: Element, tag: string): string =>
    row.querySelector(`:scope > ${tag}`)?.textContent?.trim() ?? ''

  const xmlRows = doc.querySelectorAll('parts > row')
  if (xmlRows.length === 0) return emptyParse(['El XML no contiene piezas (<parts><row>).'])

  xmlRows.forEach((xmlRow, idx) => {
    // useit=0 marks a piece the operator disabled in the other program: it is not part of the job.
    if (read(xmlRow, 'useit') === '0') return

    const lineNo = idx + 1
    const q = parseNum(read(xmlRow, 'quantity'))
    const row: RawPieceRow = {
      materialText: read(xmlRow, 'material'),
      height: parseNum(read(xmlRow, 'length')), // Largo = alto, the first measurement
      width: parseNum(read(xmlRow, 'width')),
      quantity: q === '' ? 1 : q,
      priority: 0, // the XML has no priority field
      canRotate: read(xmlRow, 'allow_rotation') === '1',
      lineNo,
      ...readEtiqueta(read(xmlRow, 'label')),
    }

    if (Number(row.height) <= 0 || Number(row.width) <= 0) {
      warnings.push(`Fila ${lineNo}: medidas inválidas (largo/ancho).`)
    }
    rows.push(row)
  })

  return finish(rows, warnings)
}

// Parses pasted or file text into raw rows. Pure: it depends on neither the form state nor the
// catalog, so it is cheap to re-run on every keystroke and never allocates material uids.
export const parsePieces = (text: string): ParsedPieces => {
  if (!text.trim()) return emptyParse()
  if (looksLikeXml(text)) return parseXmlPieces(text)

  const warnings: string[] = []
  const rows: RawPieceRow[] = []
  const delimiter = detectDelimiter(text)
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '')

  lines.forEach((line, idx) => {
    const cells = splitLine(line, delimiter)
    if (idx === 0 && looksLikeHeader(cells)) return // skip header row

    const [material = '', alto = '', ancho = '', cant = '', prior = '', etiqueta = '', rotar = ''] =
      cells
    const lineNo = idx + 1

    const q = parseNum(cant)
    const p = parseNum(prior)
    const rot = normalizeText(rotar)

    const row: RawPieceRow = {
      materialText: material.trim(),
      height: parseNum(alto),
      width: parseNum(ancho),
      quantity: q === '' ? 1 : q,
      priority: p === '' ? 0 : p,
      canRotate: TRUE_WORDS.has(rot),
      lineNo,
      ...readEtiqueta(etiqueta.trim()),
    }

    if (Number(row.height) <= 0 || Number(row.width) <= 0) {
      warnings.push(`Fila ${lineNo}: medidas inválidas (largo/ancho).`)
    }
    rows.push(row)
  })

  return finish(rows, warnings)
}

// A Material column full of numbers almost always means the CSV omitted that column: the parser is
// positional, so Largo lands in it. Used to warn instead of silently importing garbage material names.
export const looksLikeMissingMaterialColumn = (texts: CsvMaterialText[]): boolean =>
  texts.length >= 3 && texts.every((t) => t.text !== '' && parseNum(t.text) !== '')

const csvCell = (v: string | number): string => {
  const s = String(v)
  // Wrap in quotes if the value contains delimiters or quotes (standard CSV).
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// Etiqueta on the way out: the edge banding first ('1L CS'), then the piece's own text. That is the
// shape the workshop's program writes and the order parseCantoLabel reads back, so exporting and
// re-importing keeps the banding instead of dropping it. The tapacanto product stays out — it is
// re-inferred from the board.
const etiquetaFor = (r: RequirementForm): string => {
  const notation = notationFromSides(r.edgeBanding.sides)
  if (notation === '—') return r.label
  const abbr = r.edgeBanding.bandType ? BANDTYPE_ABBR[r.edgeBanding.bandType] : ''
  return [notation, abbr, r.label].filter(Boolean).join(' ')
}

// Serializes the current list to CSV (comma-delimited, dot decimals, rotate as sí/no).
export const requirementsToCsv = (
  requirements: RequirementForm[],
  materials: MaterialForm[],
  boards: BoardProduct[],
): string => {
  const byUid = new Map(materials.map((m) => [m.uid, m]))
  const header = CSV_COLUMNS.join(',')
  const lines = requirements.map((r) => {
    const m = byUid.get(r.materialUid)
    const matName = m ? materialLabel(m, boards) : ''
    return [
      matName,
      r.height,
      r.width,
      r.quantity,
      r.priority,
      etiquetaFor(r),
      r.canRotate ? 'sí' : 'no',
    ]
      .map(csvCell)
      .join(',')
  })
  return [header, ...lines].join('\n')
}

// Triggers a CSV download without external libraries (Blob + temporary anchor).
export const downloadCsv = (filename: string, csv: string): void => {
  downloadBlob(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' }), filename)
}
