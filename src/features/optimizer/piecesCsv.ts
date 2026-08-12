import type { BoardProduct } from 'src/features/products/types'
import { materialLabel } from './optimizerForm'
import type { MaterialForm, RequirementForm } from './optimizerForm'
import { downloadBlob } from 'src/shared/utils/download'
import { normalizeText } from 'src/shared/utils/text'

// CSV/TSV import and export for the pieces list. No dependencies: the parser handles
// paste from Excel/Sheets (tab-delimited) and CSV files (comma or semicolon).
// Edge banding is not included in this format (it's a product + sides); it is edited per row in
// the Canto / Tipo / Tapacanto columns of the table.

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

// A CSV row before it is bound to a material group: it keeps the raw Material cell so the
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
}

// A distinct Material value found in the CSV. `key` is the accent/case-insensitive dedupe key
// (so "Melamina Blanca" and "melamina blanca" are ONE entry); `text` is the first raw spelling.
export interface CsvMaterialText {
  key: string
  text: string
  count: number // CSV rows carrying it
}

export interface ParsedPieces {
  rows: RawPieceRow[]
  materialTexts: CsvMaterialText[] // first-appearance order
  warnings: string[] // dimension problems only — material resolution warns from the mapping UI
}

// Parses pasted or file text into raw rows. Pure: it depends on neither the form state nor the
// catalog, so it is cheap to re-run on every keystroke and never allocates material uids.
export const parsePieces = (text: string): ParsedPieces => {
  const warnings: string[] = []
  const rows: RawPieceRow[] = []
  const byKey = new Map<string, CsvMaterialText>()
  if (!text.trim()) return { rows, materialTexts: [], warnings }

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
      label: etiqueta.trim(),
      canRotate: TRUE_WORDS.has(rot),
      lineNo,
    }

    if (Number(row.height) <= 0 || Number(row.width) <= 0) {
      warnings.push(`Fila ${lineNo}: medidas inválidas (largo/ancho).`)
    }

    const key = normalizeText(row.materialText)
    const seen = byKey.get(key)
    if (seen) seen.count += 1
    else byKey.set(key, { key, text: row.materialText, count: 1 })

    rows.push(row)
  })

  return { rows, materialTexts: [...byKey.values()], warnings }
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
    return [matName, r.height, r.width, r.quantity, r.priority, r.label, r.canRotate ? 'sí' : 'no']
      .map(csvCell)
      .join(',')
  })
  return [header, ...lines].join('\n')
}

// Triggers a CSV download without external libraries (Blob + temporary anchor).
export const downloadCsv = (filename: string, csv: string): void => {
  downloadBlob(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' }), filename)
}
