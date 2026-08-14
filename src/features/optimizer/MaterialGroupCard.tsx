import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent } from 'react'
import { CBadge, CButton, CFormInput, CFormLabel, CFormSelect } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilChevronBottom, cilChevronRight, cilCopy, cilPlus, cilTrash } from '@coreui/icons'

import SearchableSelect from 'src/shared/components/SearchableSelect'
import type { BoardProduct, EdgeBandingProduct } from 'src/features/products/types'
import type { MaterialSourceKind, ModalContainer, PoolFillOrder } from './types'
import type {
  BandType,
  MaterialForm,
  OffcutForm,
  OffcutSource,
  RequirementForm,
} from './optimizerForm'
import {
  BAND_TYPE_TOKEN_RE,
  CANTO_NOTATION_RE,
  CS_CD_TO_BANDTYPE,
  SOURCE_LABELS,
  emptyOffcut,
  emptyRequirement,
  hasEdgeBanding,
  inferBandingProductId,
  isRequirementEmpty,
  sidesFromNotation,
} from './optimizerForm'
import type { PiecesEditor } from './usePiecesEditor'
import { useBoardEdgeBandings } from './useOptimizer'
import PieceRowsTable from './PieceRowsTable'

const SOURCES: MaterialSourceKind[] = ['catalog', 'companyOffcut', 'clientOffcut']

const FILL_ORDER_OPTIONS: { value: PoolFillOrder; label: string }[] = [
  { value: 'auto', label: 'Automático (menos desperdicio)' },
  { value: 'offcutsFirst', label: 'Retazo primero' },
  { value: 'catalogFirst', label: 'Tablero primero' },
]

const OFFCUT_SOURCES: { value: OffcutSource; label: string }[] = [
  { value: 'clientOffcut', label: 'Retazo cliente' },
  { value: 'companyOffcut', label: 'Retazo empresa' },
]

interface MaterialGroupCardProps {
  material: MaterialForm
  // Color identifying this group at a glance: a bar down the card's left edge plus a matching dot in
  // its header. With several groups stacked, the border alone doesn't say where one ends.
  accent: string
  rows: RequirementForm[]
  startIndex: number
  materialValid: boolean
  collapsed: boolean
  editor: PiecesEditor
  boards: BoardProduct[]
  edgeBandings: EdgeBandingProduct[]
  // Fullscreen portal target for the portaled overlays in this card: the board / tapacanto dropdown
  // menus and the modals opened from inside the pieces table.
  container?: ModalContainer
  onToggle: () => void
  onUpdate: <K extends keyof MaterialForm>(uid: string, field: K, value: MaterialForm[K]) => void
  onRequestDelete: (m: MaterialForm) => void
  onDuplicate: (m: MaterialForm) => void
}

const boardDims = (b?: BoardProduct): string | null => {
  if (!b) return null
  const { height, width, thickness } = b.attributes
  if (!height || !width) return null
  return `${width}×${height}${thickness ? `×${thickness}` : ''} mm`
}

// Quick-entry format: "720x400", "720x400x4", "720x400x4 Label", "720x400x4 Label 1L2C CS".
// Separator: x, X, ×, *. Decimal: dot or comma. Edge notation and optional CS/CD (canto
// suave/duro) go LAST, after the label — CS/CD after the notation (e.g. "…2L1C CS").
const QUICK_REGEX =
  /^(\d+(?:[.,]\d+)?)\s*[xX×*]\s*(\d+(?:[.,]\d+)?)(?:\s*[xX×*]\s*(\d+(?:[.,]\d+)?))?(?:\s+(.+))?$/

const parseQuickEntry = (
  text: string,
): {
  height: number
  width: number
  quantity: number
  label: string
  notation: string | null
  bandType: BandType | null
} | null => {
  const m = text.trim().match(QUICK_REGEX)
  if (!m) return null
  const toNum = (s?: string) => (s ? Number(s.replace(',', '.')) : 0)
  const remaining = (m[4] ?? '').trim()
  let notation: string | null = null
  let bandType: BandType | null = null
  let label = remaining
  if (remaining) {
    const parts = remaining.split(/\s+/)
    // Pop from the end: an optional CS/CD band-type token, then an optional canto notation.
    let last = parts[parts.length - 1]
    if (last && BAND_TYPE_TOKEN_RE.test(last)) {
      bandType = CS_CD_TO_BANDTYPE[last.toUpperCase()] ?? null
      parts.pop()
      last = parts[parts.length - 1]
    }
    if (last && CANTO_NOTATION_RE.test(last)) {
      notation = last.toUpperCase()
      parts.pop()
    }
    // A band type without banded sides is meaningless — drop it.
    if (!notation) bandType = null
    label = parts.join(' ')
  }
  return {
    height: toNum(m[1]),
    width: toNum(m[2]),
    quantity: m[3] ? Math.max(1, Math.round(toNum(m[3]))) : 1,
    label: label.trim(),
    notation,
    bandType,
  }
}

const MaterialGroupCard = ({
  material: m,
  accent,
  rows,
  startIndex,
  materialValid,
  collapsed,
  editor,
  boards,
  edgeBandings,
  container,
  onToggle,
  onUpdate,
  onRequestDelete,
  onDuplicate,
}: MaterialGroupCardProps) => {
  const [quickText, setQuickText] = useState('')
  const [quickError, setQuickError] = useState('')

  // Tapacantos coordinated with this group's board (same family + width rule). Empty for
  // non-catalog sources or catalog gaps — the table falls back to the global list.
  const boardId = m.source === 'catalog' && m.boardId ? String(m.boardId) : undefined
  const { data: boardEdgeBandings = [] } = useBoardEdgeBandings(boardId)

  const invalidCount = rows.filter(
    (r) =>
      !(materialValid && Number(r.height) > 0 && Number(r.width) > 0) && !isRequirementEmpty(r),
  ).length

  const board =
    m.source === 'catalog' ? boards.find((b) => String(b.id) === String(m.boardId)) : undefined
  const dims = m.source === 'catalog' ? boardDims(board) : null

  // A CSV import labels the groups it creates with the text that produced them. Until a board is
  // picked, that text is the only thing telling two pending groups apart, so it takes the dims slot.
  const pendingLabel = m.source === 'catalog' && !m.boardId ? m.label.trim() : ''

  // Two rules, both waiting on the board's coordinated list, which loads asynchronously:
  //
  // 1. When the board CHANGES, re-infer the tapacanto for EVERY banded piece from its band type: a
  //    new board invalidates prior tapacanto choices (manual picks included). The change is detected
  //    here and applied once the new list arrives. Crucially it does NOT fire on initial mount, so
  //    loading an existing quote never clobbers its saved tapacantos.
  // 2. Otherwise, only fill the GAPS — pieces that know their sides and type but carry no product.
  //    That is what an import or a paste produces (the file has the canto, not the catalog), and it
  //    is what keeps "Crear cotización" unblocked without touching an assigned tapacanto.
  //    Deliberate trade: picking "— Sin tapacanto —" on a banded row does not stick, it gets the
  //    coordinated one back. That state is already an error the app refuses to quote
  //    (needsBandingProduct paints the row red), so the rule only ever replaces an error with the
  //    sane default — to really drop the banding, clear the Canto column instead.
  const coordinatedKey = boardEdgeBandings.map((p) => p.id).join(',')
  // Counts the gaps rule 2 has to close. As a dependency it goes N→0 and then holds, so the effect
  // settles instead of looping.
  const missingProduct = rows.filter(
    (r) => hasEdgeBanding(r.edgeBanding) && !r.edgeBanding.productId,
  ).length
  const prevBoardId = useRef(boardId)
  const pendingReinfer = useRef(false)
  useEffect(() => {
    if (prevBoardId.current !== boardId) {
      prevBoardId.current = boardId
      pendingReinfer.current = true
    }
    if (!boardId || boardEdgeBandings.length === 0) return
    const reinferAll = pendingReinfer.current
    if (!reinferAll && missingProduct === 0) return
    pendingReinfer.current = false
    editor.updateGroup(m.uid, (r) => {
      if (!hasEdgeBanding(r.edgeBanding)) return r
      if (!reinferAll && r.edgeBanding.productId) return r
      const productId = inferBandingProductId(boardEdgeBandings, r.edgeBanding.bandType)
      if (!productId || productId === r.edgeBanding.productId) return r
      return { ...r, edgeBanding: { ...r.edgeBanding, productId } }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m.uid, boardId, coordinatedKey, missingProduct])

  // Pooled offcuts attached to this catalog board (same material, finite stock).
  const offcuts = m.offcuts ?? []
  const setOffcuts = (next: OffcutForm[]) => onUpdate(m.uid, 'offcuts', next)
  const addOffcut = () => setOffcuts([...offcuts, emptyOffcut()])
  const updateOffcut = <K extends keyof OffcutForm>(uid: string, field: K, value: OffcutForm[K]) =>
    setOffcuts(offcuts.map((o) => (o.uid === uid ? { ...o, [field]: value } : o)))
  const removeOffcut = (uid: string) => setOffcuts(offcuts.filter((o) => o.uid !== uid))

  const handleQuickEntry = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    if (!quickText.trim()) return
    const parsed = parseQuickEntry(quickText)
    if (!parsed) {
      setQuickError('Formato: 720×400 o 720×400×4 Etiqueta 1L2C CS')
      return
    }
    const req = emptyRequirement(m.uid)
    req.height = parsed.height
    req.width = parsed.width
    req.quantity = parsed.quantity
    req.label = parsed.label
    if (parsed.notation) {
      const lastEb = rows[rows.length - 1]?.edgeBanding
      const bandType: '' | BandType = parsed.bandType ?? lastEb?.bandType ?? ''
      const productId =
        inferBandingProductId(boardEdgeBandings, bandType) || lastEb?.productId || ''
      req.edgeBanding = {
        productId,
        sides: sidesFromNotation(parsed.notation),
        bandType,
      }
    }
    editor.addMany([req], false)
    setQuickText('')
    setQuickError('')
  }

  return (
    <div className="material-group mb-3" style={{ '--group-accent': accent } as CSSProperties}>
      <div className="d-flex flex-wrap gap-2 align-items-end py-2">
        <CButton
          size="sm"
          color="secondary"
          variant="ghost"
          type="button"
          className="px-1"
          title={collapsed ? 'Expandir piezas' : 'Plegar piezas'}
          onClick={onToggle}
        >
          <CIcon icon={collapsed ? cilChevronRight : cilChevronBottom} />
        </CButton>

        <div style={{ width: 150 }}>
          <CFormLabel className="small mb-1">Fuente</CFormLabel>
          <CFormSelect
            size="sm"
            value={m.source}
            onChange={(e) => onUpdate(m.uid, 'source', e.target.value as MaterialSourceKind)}
          >
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {SOURCE_LABELS[s]}
              </option>
            ))}
          </CFormSelect>
        </div>

        {m.source === 'catalog' ? (
          <div style={{ minWidth: 220, flex: '1 1 260px' }}>
            {/* Dims sit on the label line (not below the select) so the field keeps the same height
                as the others and all selects stay vertically aligned. */}
            <div className="d-flex justify-content-between align-items-baseline gap-2 mb-1">
              <CFormLabel className="small mb-0">Tablero</CFormLabel>
              {pendingLabel ? (
                <span
                  className="small text-warning-emphasis text-truncate"
                  style={{ maxWidth: 180 }}
                  title={`Importado como “${pendingLabel}”`}
                >
                  {pendingLabel}
                </span>
              ) : (
                dims && <span className="small text-body-secondary text-nowrap">{dims}</span>
              )}
            </div>
            <SearchableSelect
              size="sm"
              value={String(m.boardId)}
              placeholder="Seleccionar…"
              searchPlaceholder="Buscar por nombre o código…"
              emptyText="Sin tableros que coincidan"
              options={boards.map((b) => ({
                value: String(b.id),
                label: b.name,
                sublabel: b.code,
              }))}
              onChange={(v) => onUpdate(m.uid, 'boardId', v)}
              container={container}
            />
          </div>
        ) : (
          <>
            <div style={{ flex: '1 1 160px', minWidth: 140 }}>
              <CFormLabel className="small mb-1">Etiqueta</CFormLabel>
              <CFormInput
                size="sm"
                value={m.label}
                placeholder="Retazo bodega 3"
                onChange={(e) => onUpdate(m.uid, 'label', e.target.value)}
              />
            </div>
            <div style={{ width: 80 }}>
              <CFormLabel className="small mb-1">Largo</CFormLabel>
              <CFormInput
                size="sm"
                type="number"
                min={1}
                value={m.height}
                onChange={(e) => onUpdate(m.uid, 'height', e.target.value)}
              />
            </div>
            <div style={{ width: 80 }}>
              <CFormLabel className="small mb-1">Ancho</CFormLabel>
              <CFormInput
                size="sm"
                type="number"
                min={1}
                value={m.width}
                onChange={(e) => onUpdate(m.uid, 'width', e.target.value)}
              />
            </div>
            <div style={{ width: 80 }}>
              <CFormLabel className="small mb-1">Grosor</CFormLabel>
              <CFormInput
                size="sm"
                type="number"
                min={1}
                value={m.thickness}
                onChange={(e) => onUpdate(m.uid, 'thickness', e.target.value)}
              />
            </div>
            <div style={{ width: 110 }}>
              <CFormLabel className="small mb-1">Costo unit.</CFormLabel>
              <CFormInput
                size="sm"
                type="number"
                min={0}
                step="0.01"
                value={m.costPerUnit}
                onChange={(e) => onUpdate(m.uid, 'costPerUnit', e.target.value)}
              />
            </div>
          </>
        )}

        <div className="ms-auto d-flex align-items-center gap-2">
          <span className="small text-body-secondary text-nowrap">
            <strong className="text-body">{rows.length}</strong> piezas
          </span>
          {invalidCount > 0 && (
            <CBadge color="danger" title="Piezas con datos incompletos">
              {invalidCount} incompletas
            </CBadge>
          )}
          <CButton
            size="sm"
            variant="ghost"
            color="secondary"
            type="button"
            title="Duplicar material y sus piezas"
            onClick={() => onDuplicate(m)}
          >
            <CIcon icon={cilCopy} />
          </CButton>
          <CButton
            size="sm"
            variant="ghost"
            color="danger"
            type="button"
            title="Eliminar material"
            onClick={() => onRequestDelete(m)}
          >
            <CIcon icon={cilTrash} />
          </CButton>
        </div>
      </div>

      {!collapsed && (
        <div>
          {/* Offcuts, when there are any. The panel they used to live in — a bordered, tinted box
              with a two-line explanation, shown even when empty — was the deepest nesting on the
              screen. Empty is now just the "+ Retazo" button in the row below the table, which
              carries the explanation in its tooltip. */}
          {m.source === 'catalog' && offcuts.length > 0 && (
            <div className="mb-2">
              <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
                <span className="small fw-semibold">Retazos</span>
                <CFormLabel className="small mb-0 ms-auto text-nowrap">Orden de llenado</CFormLabel>
                <CFormSelect
                  size="sm"
                  style={{ width: 230 }}
                  value={m.fillOrder ?? 'auto'}
                  onChange={(e) => onUpdate(m.uid, 'fillOrder', e.target.value as PoolFillOrder)}
                >
                  {FILL_ORDER_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </CFormSelect>
              </div>

              {offcuts.map((o) => (
                <div key={o.uid} className="d-flex flex-wrap gap-2 align-items-end mb-2">
                  <div style={{ width: 140 }}>
                    <CFormLabel className="small mb-1">Tipo</CFormLabel>
                    <CFormSelect
                      size="sm"
                      value={o.source}
                      onChange={(e) =>
                        updateOffcut(o.uid, 'source', e.target.value as OffcutSource)
                      }
                    >
                      {OFFCUT_SOURCES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </CFormSelect>
                  </div>
                  <div style={{ flex: '1 1 140px', minWidth: 120 }}>
                    <CFormLabel className="small mb-1">Etiqueta</CFormLabel>
                    <CFormInput
                      size="sm"
                      value={o.label}
                      placeholder="Retazo cliente"
                      onChange={(e) => updateOffcut(o.uid, 'label', e.target.value)}
                    />
                  </div>
                  <div style={{ width: 80 }}>
                    <CFormLabel className="small mb-1">Largo</CFormLabel>
                    <CFormInput
                      size="sm"
                      type="number"
                      min={1}
                      value={o.height}
                      onChange={(e) => updateOffcut(o.uid, 'height', e.target.value)}
                    />
                  </div>
                  <div style={{ width: 80 }}>
                    <CFormLabel className="small mb-1">Ancho</CFormLabel>
                    <CFormInput
                      size="sm"
                      type="number"
                      min={1}
                      value={o.width}
                      onChange={(e) => updateOffcut(o.uid, 'width', e.target.value)}
                    />
                  </div>
                  <div style={{ width: 80 }}>
                    <CFormLabel className="small mb-1">Grosor</CFormLabel>
                    <CFormInput
                      size="sm"
                      type="number"
                      min={1}
                      value={o.thickness}
                      onChange={(e) => updateOffcut(o.uid, 'thickness', e.target.value)}
                    />
                  </div>
                  <div style={{ width: 90 }}>
                    <CFormLabel className="small mb-1">Costo</CFormLabel>
                    <CFormInput
                      size="sm"
                      type="number"
                      min={0}
                      step="0.01"
                      value={o.costPerUnit}
                      onChange={(e) => updateOffcut(o.uid, 'costPerUnit', e.target.value)}
                    />
                  </div>
                  <div style={{ width: 70 }}>
                    <CFormLabel className="small mb-1">Cant.</CFormLabel>
                    <CFormInput
                      size="sm"
                      type="number"
                      min={1}
                      value={o.quantity}
                      onChange={(e) => updateOffcut(o.uid, 'quantity', e.target.value)}
                    />
                  </div>
                  <CButton
                    size="sm"
                    variant="ghost"
                    color="danger"
                    type="button"
                    title="Quitar retazo"
                    onClick={() => removeOffcut(o.uid)}
                  >
                    <CIcon icon={cilTrash} />
                  </CButton>
                </div>
              ))}
            </div>
          )}
          <PieceRowsTable
            materialUid={m.uid}
            rows={rows}
            startIndex={startIndex}
            materialValid={materialValid}
            editor={editor}
            edgeBandings={edgeBandings}
            boardEdgeBandings={boardEdgeBandings}
            boardThickness={board?.attributes.thickness}
            container={container}
          />
          <div className="d-flex align-items-center gap-2 mt-2 flex-wrap">
            {/* Icon-only: the input beside it already says how to add a piece, and Enter on the last
                row of the table does the same. This is the explicit affordance, not the main path. */}
            <CButton
              size="sm"
              color="primary"
              variant="outline"
              type="button"
              title="Agregar pieza"
              onClick={() => editor.addTo(m.uid)}
            >
              <CIcon icon={cilPlus} />
            </CButton>
            <CFormInput
              size="sm"
              value={quickText}
              onChange={(e) => {
                setQuickText(e.target.value)
                setQuickError('')
              }}
              onKeyDown={handleQuickEntry}
              placeholder="720×400×4  Etiqueta  1L2C  CS  (Enter para agregar)"
              invalid={!!quickError}
              style={{ maxWidth: 380 }}
            />
            {quickError && <small className="text-danger">{quickError}</small>}
            {m.source === 'catalog' && (
              <CButton
                size="sm"
                color="secondary"
                variant="outline"
                type="button"
                className="ms-auto"
                title="El cliente puede aportar retazos del mismo material; las piezas se optimizan sobre ellos y el tablero de catálogo."
                onClick={addOffcut}
              >
                <CIcon icon={cilPlus} className="me-1" />
                Retazo
              </CButton>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default MaterialGroupCard
