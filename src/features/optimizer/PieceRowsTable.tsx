import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ClipboardEvent, KeyboardEvent } from 'react'
import {
  CButton,
  CFormCheck,
  CFormInput,
  CFormSelect,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import {
  cilArrowBottom,
  cilArrowThickBottom,
  cilArrowThickTop,
  cilCopy,
  cilMove,
  cilTrash,
} from '@coreui/icons'

import SearchableSelect from 'src/shared/components/SearchableSelect'
import type { SelectOption } from 'src/shared/components/SearchableSelect'
import CantoPreview from 'src/shared/components/CantoPreview'
import type { EdgeBandingProduct } from 'src/features/products/types'
import type { BandType, RequirementForm } from './optimizerForm'
import {
  BANDTYPE_ABBR,
  BAND_TYPES,
  CANTO_NOTATIONS,
  displayedBandType,
  edgeWidthForThickness,
  inferBandingProductId,
  isRequirementEmpty,
  needsBandingProduct,
  notationFromSides,
  sidesFromNotation,
} from './optimizerForm'
import type { ModalContainer } from './types'
import EdgeBandingPickerModal from './EdgeBandingPickerModal'
import type { FillScope, FillableField, PiecesEditor, SortDir, SortField } from './usePiecesEditor'
import { parsePieces } from './piecesCsv'
import { rowsToRequirements } from './piecesImport'

interface PieceRowsTableProps {
  materialUid: string
  rows: RequirementForm[]
  // Flat index of this group's first row within editor.requirements (local + startIndex = flat).
  startIndex: number
  materialValid: boolean
  editor: PiecesEditor
  // Global edge-banding catalog (fallback for manual selection / non-catalog materials).
  edgeBandings: EdgeBandingProduct[]
  // Tapacantos coordinated with this group's board (same family + width); empty ⇒ use the global list.
  boardEdgeBandings: EdgeBandingProduct[]
  // Board thickness (catalog materials only), used to pre-filter the full-catalog picker to the
  // banding width that physically covers this board.
  boardThickness?: number
  // Fullscreen portal target for the picker modal; omitted where there is no fullscreen host.
  container?: ModalContainer
}

// Fields that accept a pasted column of values to create rows.
const PASTEABLE_FIELDS = new Set(['height', 'width', 'quantity', 'priority', 'label'])

// data-col → field mapping (material column removed). Cols 5-7 are the banding controls.
const COL_FIELDS: FillableField[] = [
  'height', // col 0
  'width', // col 1
  'quantity', // col 2
  'priority', // col 3
  'label', // col 4
  'edgeBandingSides', // col 5 — banding sides (Canto)
  'edgeBandingBandType', // col 6 — banding type (Tipo: suave/duro)
  'edgeBandingProductId', // col 7 — banding product (Tapacanto)
]
// Tapacanto (product) is a SearchableSelect outside the grid, so keyboard nav ends at Tipo (col 6).
const LAST_COL = 6
const TEXT_COL = 4
const SELECT_COLS = new Set([5, 6])

// Fill handle shown in the bottom-right corner of the active cell.
const handleStyle: CSSProperties = {
  position: 'absolute',
  right: 1,
  bottom: 1,
  width: 9,
  height: 9,
  background: 'var(--cui-primary)',
  border: '1px solid var(--cui-white, #fff)',
  borderRadius: 1,
  cursor: 'ns-resize',
  touchAction: 'none',
  zIndex: 3,
}

// Sticky column header so it stays visible while a large group scrolls inside its own box.
const thStyle: CSSProperties = {
  position: 'sticky',
  top: 0,
  background: 'var(--cui-body-bg)',
  zIndex: 2,
}

// Grip in the "#" column: grab it to drag-reorder the row within its material.
const rowHandleStyle: CSSProperties = {
  cursor: 'grab',
  touchAction: 'none',
  color: 'var(--cui-secondary-color)',
  display: 'inline-flex',
  alignItems: 'center',
}

const PieceRowsTable = ({
  materialUid,
  rows,
  startIndex,
  materialValid,
  editor,
  edgeBandings,
  boardEdgeBandings,
  boardThickness,
  container,
}: PieceRowsTableProps) => {
  const {
    selected,
    focusRow,
    clearFocus,
    addTo,
    remove,
    removeSelected,
    duplicate,
    update,
    fillDownGroup,
    fillRange,
    moveRow,
    sortGroup,
    toggleSelect,
    selectMany,
    pasteIntoField,
    pasteRows,
  } = editor

  // Lookup for every edge banding we might reference (coordinated + global fallback): used to
  // derive a piece's displayed band type from its assigned tapacanto product.
  const byId = useMemo(() => {
    const map = new Map<string, EdgeBandingProduct>()
    for (const p of [...boardEdgeBandings, ...edgeBandings]) map.set(String(p.id), p)
    return map
  }, [boardEdgeBandings, edgeBandings])

  const containerRef = useRef<HTMLDivElement>(null)
  // Cell showing the fill handle (follows focus, like Excel's "active cell"). Local row index.
  const [activeCell, setActiveCell] = useState<{ row: number; col: number } | null>(null)
  // Active fill drag. `targetRow` is the local row under the pointer (clamped to this group).
  const [drag, setDrag] = useState<{ srcRow: number; col: number; targetRow: number } | null>(null)
  // Active row-reorder drag (from the "#" grip). Separate from the fill drag above.
  const [rowDrag, setRowDrag] = useState<{ srcRow: number; targetRow: number } | null>(null)
  const [sort, setSort] = useState<{ field: SortField; dir: SortDir } | null>(null)
  // Local row whose full-catalog tapacanto picker is open (one shared modal instance).
  const [pickerRow, setPickerRow] = useState<number | null>(null)

  const flatOf = (local: number) => startIndex + local

  // Applies a tapacanto choice to a piece, keeping the band type in sync with the chosen
  // product so the "Tipo" column never contradicts it. Shared by the dropdown and the picker.
  const setBandingProduct = (flat: number, req: RequirementForm, productId: string) => {
    const bandType =
      (byId.get(productId)?.attributes.bandType as BandType | undefined) ??
      req.edgeBanding.bandType ??
      ''
    update(flat, 'edgeBanding', { ...req.edgeBanding, productId, bandType })
  }

  const pickerReq = pickerRow == null ? undefined : rows[pickerRow]

  // Programmatically focus a cell by local position (data-row / data-col).
  const focusCell = useCallback((row: number, col: number) => {
    const el = containerRef.current?.querySelector<HTMLElement>(
      `[data-row="${row}"][data-col="${col}"]`,
    )
    el?.focus()
    if (el instanceof HTMLInputElement) el.select()
  }, [])

  // After adding a row in THIS group, focus its first dimension input.
  useEffect(() => {
    if (focusRow == null) return
    if (focusRow < startIndex || focusRow >= startIndex + rows.length) return
    focusCell(focusRow - startIndex, 0)
    clearFocus()
  }, [focusRow, startIndex, rows.length, focusCell, clearFocus])

  const groupIndices = rows.map((_, l) => flatOf(l))
  const selInGroup = groupIndices.filter((i) => selected.has(i))
  const allSelected = rows.length > 0 && selInGroup.length === rows.length
  const fillScope: FillScope = selInGroup.length > 0 ? 'selected' : 'all'

  const handleSort = (field: SortField) => {
    const dir: SortDir = sort?.field === field && sort.dir === 'asc' ? 'desc' : 'asc'
    setSort({ field, dir })
    sortGroup(materialUid, field, dir)
  }

  // Supr deletes the row the caret is in, from any cell — no need to reach for the checkbox or the
  // trash icon first. Bound on the row so it also covers the selects and the Rotar checkbox, which
  // have no key handler of their own.
  //
  // The cost is that Supr no longer deletes characters forward inside these cells; Retroceso still
  // does, and it stays the text-editing key (the window-level shortcut ignores it while typing).
  // With rows checked, Supr deletes the whole selection instead, matching the "Eliminar (n)" button.
  const handleRowKeyDown = (e: KeyboardEvent<HTMLElement>, local: number) => {
    if (e.key !== 'Delete') return
    e.preventDefault()
    // Stops the event reaching the window-level shortcut in MaterialGroups, which would otherwise
    // delete the selection a second time.
    e.stopPropagation()
    const col = Number((e.target as HTMLElement).dataset?.col)
    if (selected.size > 0) removeSelected()
    else remove(flatOf(local))
    // Keep the caret in the grid: the row below slides into this position, so re-focus the same
    // column there (or the new last row when the deleted one was at the bottom).
    if (!Number.isNaN(col)) {
      const target = Math.max(0, Math.min(local, rows.length - 2))
      requestAnimationFrame(() => focusCell(target, col))
    }
  }

  // Keyboard navigation within this group's grid.
  const handleKeyDown = (e: KeyboardEvent<HTMLElement>, row: number, col: number) => {
    switch (e.key) {
      case 'Enter':
        if (SELECT_COLS.has(col)) return // selects use Enter to open/close
        e.preventDefault()
        if (row === rows.length - 1) addTo(materialUid)
        else focusCell(row + 1, col)
        break

      case 'ArrowDown':
        if (SELECT_COLS.has(col)) return
        e.preventDefault()
        focusCell(row + 1, col)
        break

      case 'ArrowUp':
        if (SELECT_COLS.has(col)) return
        e.preventDefault()
        if (row > 0) focusCell(row - 1, col)
        break

      case 'ArrowRight': {
        if (col === LAST_COL) {
          e.preventDefault()
          if (row < rows.length - 1) focusCell(row + 1, 0)
          break
        }
        if (col === TEXT_COL) {
          const inp = e.currentTarget as HTMLInputElement
          if (inp.selectionStart !== inp.value.length) return
        }
        e.preventDefault()
        focusCell(row, col + 1)
        break
      }

      case 'ArrowLeft': {
        if (col === TEXT_COL) {
          const inp = e.currentTarget as HTMLInputElement
          if (inp.selectionStart !== 0) return
          e.preventDefault()
          focusCell(row, col - 1)
          break
        }
        if (col === 0) {
          e.preventDefault()
          if (row > 0) focusCell(row - 1, LAST_COL)
          break
        }
        e.preventDefault()
        focusCell(row, col - 1)
        break
      }
    }
  }

  // Table paste: overwrites from the active row and creates new rows within this group as needed.
  const handlePaste = useCallback(
    (e: ClipboardEvent) => {
      const text = e.clipboardData.getData('text')
      if (!text) return
      const lines = text
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean)
      if (lines.length <= 1) return

      const active = document.activeElement as HTMLElement | null
      const rawRow = Number(active?.dataset.row)
      const startFlat = flatOf(isNaN(rawRow) ? 0 : rawRow)

      if (text.includes('\t')) {
        e.preventDefault()
        // The material column of the pasted text is ignored on purpose: a paste inside a group
        // always belongs to that group. Only the import modal may create groups.
        const { rows: parsed } = parsePieces(text)
        if (parsed.length)
          pasteRows(startFlat, rowsToRequirements(parsed, materialUid), materialUid)
        return
      }

      if (!(active instanceof HTMLInputElement)) return
      const field = active.dataset.field as 'height' | 'width' | 'quantity' | 'priority' | 'label'
      if (!field || !PASTEABLE_FIELDS.has(field) || isNaN(rawRow)) return
      e.preventDefault()
      pasteIntoField(startFlat, field, lines)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pasteRows, pasteIntoField, startIndex, materialUid],
  )

  // Local row under the pointer's Y coordinate (clamped to this group's rows).
  const rowFromY = (y: number): number => {
    const trs = containerRef.current?.querySelectorAll('tbody tr')
    if (!trs || trs.length === 0) return 0
    for (let idx = 0; idx < trs.length; idx++) {
      const tr = trs[idx]
      if (tr && y < tr.getBoundingClientRect().bottom) return idx
    }
    return trs.length - 1
  }

  const inFillRange = (col: number, row: number): boolean => {
    if (!drag || drag.col !== col) return false
    return (
      row >= Math.min(drag.srcRow, drag.targetRow) && row <= Math.max(drag.srcRow, drag.targetRow)
    )
  }

  const cellStyle = (col: number, row: number, minWidth: number): CSSProperties => ({
    minWidth,
    position: 'relative',
    ...(inFillRange(col, row) ? { boxShadow: 'inset 0 0 0 2px var(--cui-primary)' } : {}),
  })

  const renderHandle = (row: number, col: number) => {
    if (!activeCell || activeCell.row !== row || activeCell.col !== col) return null
    return (
      <span
        title="Arrastrar para clonar"
        style={handleStyle}
        onPointerDown={(e) => {
          e.preventDefault()
          e.currentTarget.setPointerCapture(e.pointerId)
          setDrag({ srcRow: row, col, targetRow: row })
        }}
        onPointerMove={(e) => {
          const target = rowFromY(e.clientY)
          setDrag((d) => (!d || d.targetRow === target ? d : { ...d, targetRow: target }))
        }}
        onPointerUp={(e) => {
          e.currentTarget.releasePointerCapture(e.pointerId)
          const field = drag && COL_FIELDS[drag.col]
          if (drag && field) fillRange(flatOf(drag.srcRow), flatOf(drag.targetRow), field)
          setDrag(null)
        }}
        onPointerCancel={() => setDrag(null)}
      />
    )
  }

  // Grip in the "#" column: drag it to reorder the row within its material (moveRow clamps to the
  // group). Same Pointer-Events pattern as the fill handle, but a distinct drag state.
  const renderRowHandle = (local: number) => (
    <span
      title="Arrastrar para reordenar"
      style={rowHandleStyle}
      onPointerDown={(e) => {
        e.preventDefault()
        e.currentTarget.setPointerCapture(e.pointerId)
        setRowDrag({ srcRow: local, targetRow: local })
      }}
      onPointerMove={(e) => {
        const target = rowFromY(e.clientY)
        setRowDrag((d) => (!d || d.targetRow === target ? d : { ...d, targetRow: target }))
      }}
      onPointerUp={(e) => {
        e.currentTarget.releasePointerCapture(e.pointerId)
        if (rowDrag && rowDrag.srcRow !== rowDrag.targetRow) {
          moveRow(flatOf(rowDrag.srcRow), flatOf(rowDrag.targetRow))
        }
        setRowDrag(null)
      }}
      onPointerCancel={() => setRowDrag(null)}
    >
      <CIcon icon={cilMove} size="sm" />
    </span>
  )

  // "Fill down" button in a column header.
  const renderFill = (field: FillableField, title: string) => (
    <CButton
      size="sm"
      variant="ghost"
      color="secondary"
      type="button"
      className="p-1 ms-1"
      title={`${title} (aplicar a ${fillScope === 'selected' ? 'seleccionadas' : 'todas'})`}
      onClick={() => fillDownGroup(materialUid, field, fillScope)}
    >
      <CIcon icon={cilArrowBottom} size="sm" />
    </CButton>
  )

  // Sortable header label: click toggles asc/desc for this group.
  const sortIcon = (field: SortField) =>
    sort?.field === field ? (
      <CIcon
        icon={sort.dir === 'asc' ? cilArrowThickTop : cilArrowThickBottom}
        size="sm"
        className="ms-1"
      />
    ) : null

  const renderSort = (field: SortField, label: string) => (
    <span
      role="button"
      title="Ordenar"
      style={{ cursor: 'pointer', userSelect: 'none' }}
      onClick={() => handleSort(field)}
    >
      {label}
      {sortIcon(field)}
    </span>
  )

  return (
    <div style={{ maxHeight: '55vh', overflow: 'auto' }} ref={containerRef} onPaste={handlePaste}>
      <CTable small bordered className="mb-0 pieces-table">
        <CTableHead>
          <CTableRow>
            <CTableHeaderCell className="text-center" style={{ ...thStyle, width: 36 }}>
              <CFormCheck
                checked={allSelected}
                onChange={(e) => selectMany(groupIndices, e.target.checked)}
                title="Seleccionar todo el grupo"
              />
            </CTableHeaderCell>
            <CTableHeaderCell className="text-center" style={{ ...thStyle, width: 48 }}>
              #
            </CTableHeaderCell>
            <CTableHeaderCell style={thStyle}>
              {renderSort('height', 'Largo (mm)')}
              {renderFill('height', 'Igualar largo')}
            </CTableHeaderCell>
            <CTableHeaderCell style={thStyle}>
              {renderSort('width', 'Ancho (mm)')}
              {renderFill('width', 'Igualar ancho')}
            </CTableHeaderCell>
            <CTableHeaderCell style={thStyle}>
              {renderSort('quantity', 'Cant.')}
              {renderFill('quantity', 'Igualar cantidad')}
            </CTableHeaderCell>
            <CTableHeaderCell style={thStyle}>
              {renderSort('priority', 'Prior.')}
              {renderFill('priority', 'Igualar prioridad')}
            </CTableHeaderCell>
            <CTableHeaderCell style={thStyle}>
              {renderSort('label', 'Etiqueta')}
              {renderFill('label', 'Igualar etiqueta')}
            </CTableHeaderCell>
            <CTableHeaderCell className="text-center" style={thStyle}>
              Rotar
              {renderFill('canRotate', 'Igualar rotación')}
            </CTableHeaderCell>
            <CTableHeaderCell style={thStyle}>
              Canto
              {renderFill('edgeBandingSides', 'Igualar lados de canto')}
            </CTableHeaderCell>
            <CTableHeaderCell style={thStyle}>
              Tipo
              {renderFill('edgeBandingBandType', 'Igualar tipo (suave/duro)')}
            </CTableHeaderCell>
            <CTableHeaderCell style={thStyle}>Tapacanto</CTableHeaderCell>
            <CTableHeaderCell style={thStyle} />
          </CTableRow>
        </CTableHead>
        <CTableBody>
          {rows.map((req, local) => {
            const i = flatOf(local)
            const rowValid = materialValid && Number(req.height) > 0 && Number(req.width) > 0
            // Edge banding sides defined but no tapacanto picked: valid to optimize, invalid to quote.
            const bandingMissing = needsBandingProduct(req)
            const isError = bandingMissing || (!rowValid && !isRequirementEmpty(req))
            const cantoNotation = notationFromSides(req.edgeBanding.sides)
            const cantoBandType = displayedBandType(req.edgeBanding, byId)
            // Tapacanto options: coordinated with the board, narrowed to the displayed band type;
            // if the board has no coordinated match, fall back to the global catalog.
            const scoped = boardEdgeBandings.filter(
              (p) => !cantoBandType || p.attributes.bandType === cantoBandType,
            )
            const tapacantoOptions = scoped.length ? scoped : edgeBandings
            // A tapacanto picked from the full catalog (deliberate contrast) is not in the
            // coordinated list, and an option the select can't find renders as the placeholder —
            // so the assigned product is always appended when missing.
            const options: SelectOption[] = [
              { value: '', label: '— Sin tapacanto —' },
              ...tapacantoOptions.map((p) => ({
                value: String(p.id),
                label: p.name,
                sublabel: p.code,
              })),
            ]
            const assignedId = String(req.edgeBanding.productId)
            const assigned = assignedId ? byId.get(assignedId) : undefined
            if (assigned && !options.some((o) => o.value === assignedId)) {
              options.push({ value: assignedId, label: assigned.name, sublabel: assigned.code })
            }
            const isDropTarget =
              !!rowDrag && rowDrag.srcRow !== rowDrag.targetRow && rowDrag.targetRow === local
            return (
              <CTableRow
                key={i}
                color={isError ? 'danger' : undefined}
                style={rowDrag?.srcRow === local ? { opacity: 0.5 } : undefined}
                onKeyDown={(e) => handleRowKeyDown(e, local)}
              >
                <CTableDataCell className="text-center">
                  <CFormCheck checked={selected.has(i)} onChange={() => toggleSelect(i)} />
                </CTableDataCell>
                <CTableDataCell
                  className="text-center text-body-secondary"
                  style={{
                    position: 'relative',
                    width: 48,
                    ...(isDropTarget ? { boxShadow: 'inset 0 0 0 2px var(--cui-primary)' } : {}),
                  }}
                >
                  <div className="d-flex align-items-center justify-content-center gap-1">
                    {renderRowHandle(local)}
                    <span>{i + 1}</span>
                  </div>
                </CTableDataCell>
                <CTableDataCell style={cellStyle(0, local, 64)}>
                  <CFormInput
                    size="sm"
                    type="number"
                    min={1}
                    data-row={local}
                    data-col={0}
                    data-field="height"
                    value={req.height}
                    onFocus={() => setActiveCell({ row: local, col: 0 })}
                    onChange={(e) => update(i, 'height', e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, local, 0)}
                  />
                  {renderHandle(local, 0)}
                </CTableDataCell>
                <CTableDataCell style={cellStyle(1, local, 64)}>
                  <CFormInput
                    size="sm"
                    type="number"
                    min={1}
                    data-row={local}
                    data-col={1}
                    data-field="width"
                    value={req.width}
                    onFocus={() => setActiveCell({ row: local, col: 1 })}
                    onChange={(e) => update(i, 'width', e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, local, 1)}
                  />
                  {renderHandle(local, 1)}
                </CTableDataCell>
                <CTableDataCell style={cellStyle(2, local, 56)}>
                  <CFormInput
                    size="sm"
                    type="number"
                    min={1}
                    max={10000}
                    data-row={local}
                    data-col={2}
                    data-field="quantity"
                    value={req.quantity}
                    onFocus={() => setActiveCell({ row: local, col: 2 })}
                    onChange={(e) => update(i, 'quantity', e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, local, 2)}
                  />
                  {renderHandle(local, 2)}
                </CTableDataCell>
                <CTableDataCell style={cellStyle(3, local, 56)}>
                  <CFormInput
                    size="sm"
                    type="number"
                    min={0}
                    data-row={local}
                    data-col={3}
                    data-field="priority"
                    value={req.priority}
                    onFocus={() => setActiveCell({ row: local, col: 3 })}
                    onChange={(e) => update(i, 'priority', e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, local, 3)}
                  />
                  {renderHandle(local, 3)}
                </CTableDataCell>
                <CTableDataCell style={cellStyle(4, local, 110)}>
                  <CFormInput
                    size="sm"
                    data-row={local}
                    data-col={4}
                    data-field="label"
                    value={req.label}
                    onFocus={() => setActiveCell({ row: local, col: 4 })}
                    onChange={(e) => update(i, 'label', e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, local, 4)}
                    placeholder="Puerta izq."
                  />
                  {renderHandle(local, 4)}
                </CTableDataCell>
                <CTableDataCell className="text-center" style={{ minWidth: 60 }}>
                  <CFormCheck
                    checked={req.canRotate}
                    onChange={(e) => update(i, 'canRotate', e.target.checked)}
                  />
                </CTableDataCell>
                <CTableDataCell style={cellStyle(5, local, 130)}>
                  <div className="d-flex align-items-center gap-1">
                    <CantoPreview sides={req.edgeBanding.sides} />
                    <CFormSelect
                      size="sm"
                      value={cantoNotation}
                      data-row={local}
                      data-col={5}
                      onFocus={() => setActiveCell({ row: local, col: 5 })}
                      onChange={(e) => {
                        const sides = sidesFromNotation(e.target.value)
                        const next = { ...req.edgeBanding, sides }
                        // First time a canto is set: infer the coordinated tapacanto for the current type.
                        if (Object.values(sides).some(Boolean) && !next.productId) {
                          next.productId = inferBandingProductId(boardEdgeBandings, next.bandType)
                        }
                        update(i, 'edgeBanding', next)
                      }}
                      onKeyDown={(e) => handleKeyDown(e, local, 5)}
                    >
                      {CANTO_NOTATIONS.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </CFormSelect>
                    {cantoBandType && (
                      <span className="small text-body-secondary">
                        {BANDTYPE_ABBR[cantoBandType]}
                      </span>
                    )}
                  </div>
                  {renderHandle(local, 5)}
                </CTableDataCell>
                <CTableDataCell style={cellStyle(6, local, 90)}>
                  <CFormSelect
                    size="sm"
                    value={cantoBandType}
                    disabled={cantoNotation === '—'}
                    data-row={local}
                    data-col={6}
                    onFocus={() => setActiveCell({ row: local, col: 6 })}
                    onChange={(e) => {
                      const bandType = e.target.value as '' | BandType
                      const productId =
                        inferBandingProductId(boardEdgeBandings, bandType) ||
                        req.edgeBanding.productId
                      update(i, 'edgeBanding', { ...req.edgeBanding, bandType, productId })
                    }}
                    onKeyDown={(e) => handleKeyDown(e, local, 6)}
                  >
                    <option value="">—</option>
                    {BAND_TYPES.map((bt) => (
                      <option key={bt.value} value={bt.value}>
                        {bt.label}
                      </option>
                    ))}
                  </CFormSelect>
                  {renderHandle(local, 6)}
                </CTableDataCell>
                {/* onFocus on the cell captures focus from the inner SearchableSelect button so the
                    drag fill handle appears; the handle fills edgeBandingProductId down the group. */}
                <CTableDataCell
                  style={{
                    ...cellStyle(7, local, 170),
                    ...(bandingMissing ? { boxShadow: 'inset 0 0 0 2px var(--cui-danger)' } : {}),
                  }}
                  title={
                    bandingMissing ? 'Selecciona el tapacanto para el canto definido' : undefined
                  }
                  onFocus={() => setActiveCell({ row: local, col: 7 })}
                >
                  <SearchableSelect
                    size="sm"
                    value={String(req.edgeBanding.productId)}
                    disabled={cantoNotation === '—'}
                    placeholder={bandingMissing ? '⚠ Falta tapacanto' : '—'}
                    searchPlaceholder="Buscar tapacanto…"
                    emptyText="Sin tapacantos que coincidan"
                    options={options}
                    onChange={(v) => setBandingProduct(i, req, v)}
                    footerLabel="Seleccionar otro…"
                    onFooterClick={() => setPickerRow(local)}
                  />
                  {renderHandle(local, 7)}
                </CTableDataCell>
                <CTableDataCell className="text-nowrap">
                  <CButton
                    size="sm"
                    variant="ghost"
                    color="secondary"
                    type="button"
                    title="Duplicar pieza"
                    onClick={() => duplicate(i)}
                  >
                    <CIcon icon={cilCopy} />
                  </CButton>
                  <CButton
                    size="sm"
                    variant="ghost"
                    color="danger"
                    type="button"
                    title="Eliminar pieza (Supr)"
                    onClick={() => remove(i)}
                  >
                    <CIcon icon={cilTrash} />
                  </CButton>
                </CTableDataCell>
              </CTableRow>
            )
          })}
          {rows.length === 0 && (
            <CTableRow>
              <CTableDataCell colSpan={12} className="text-center text-body-secondary small py-3">
                Sin piezas en este material. Usa “Agregar pieza” o la entrada rápida.
              </CTableDataCell>
            </CTableRow>
          )}
        </CTableBody>
      </CTable>

      {pickerReq && pickerRow != null && (
        <EdgeBandingPickerModal
          key={pickerRow}
          visible
          products={edgeBandings}
          value={String(pickerReq.edgeBanding.productId)}
          compatibleWidth={edgeWidthForThickness(boardThickness)}
          pieceLabel={pickerReq.label.trim() || `Pieza ${flatOf(pickerRow) + 1}`}
          container={container}
          onSelect={(p) => {
            setBandingProduct(flatOf(pickerRow), pickerReq, String(p.id))
            setPickerRow(null)
          }}
          onClear={() => {
            setBandingProduct(flatOf(pickerRow), pickerReq, '')
            setPickerRow(null)
          }}
          onClose={() => setPickerRow(null)}
        />
      )}
    </div>
  )
}

export default PieceRowsTable
