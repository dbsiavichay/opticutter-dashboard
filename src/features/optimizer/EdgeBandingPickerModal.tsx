import { useMemo, useState } from 'react'
import {
  CButton,
  CFormCheck,
  CFormInput,
  CFormSelect,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'

import type { EdgeBandingProduct } from 'src/features/products/types'
import { fmtMoney } from 'src/shared/utils/format'
import { normalizeText } from 'src/shared/utils/text'
import type { ModalContainer } from './types'
import type { BandType } from './optimizerForm'
import { BANDTYPE_LABEL, BAND_TYPES, edgeWidthFitsBoard } from './optimizerForm'

interface EdgeBandingPickerModalProps {
  visible: boolean
  // The full active catalog; filtering happens in memory (no server round-trip per keystroke).
  products: EdgeBandingProduct[]
  // Currently assigned productId ('' = none), highlighted in the list.
  value: string
  // The board's thickness (mm). When set, the list is narrowed to the widths that cover it —
  // several, since a design is stocked in more than one — unless the user lifts the filter;
  // undefined (non-catalog material) shows the whole catalog.
  boardThickness?: number
  pieceLabel?: string
  container?: ModalContainer
  onSelect: (product: EdgeBandingProduct) => void
  onClear: () => void
  onClose: () => void
}

const attrText = (p: EdgeBandingProduct): string =>
  `${p.name} ${p.code} ${p.attributes.color ?? ''} ${p.attributes.family ?? ''} ${p.attributes.alias ?? ''}`

const num = (n?: number): string => (n == null ? '—' : String(n))

// Full-catalog tapacanto picker, opened from the "Seleccionar otro…" action in the row's
// dropdown. The row's own list stays coordinated with the board; this is the escape hatch for
// a deliberately contrasting edge banding, which the backend accepts without restriction.
const EdgeBandingPickerModal = ({
  visible,
  products,
  value,
  boardThickness,
  pieceLabel,
  container,
  onSelect,
  onClear,
  onClose,
}: EdgeBandingPickerModalProps) => {
  // Filters are plain local state: the caller mounts this modal only while it is open (and keys
  // it by row), so every opening starts from the default view without a reset effect.
  const [query, setQuery] = useState('')
  const [bandType, setBandType] = useState<'' | BandType>('')
  const [allWidths, setAllWidths] = useState(false)

  const widthFilterActive = boardThickness != null && !allWidths

  const filtered = useMemo(() => {
    const tokens = normalizeText(query).split(/\s+/).filter(Boolean)
    return products.filter((p) => {
      if (widthFilterActive && !edgeWidthFitsBoard(boardThickness, p.attributes.width)) return false
      if (bandType && p.attributes.bandType !== bandType) return false
      if (tokens.length === 0) return true
      const hay = normalizeText(attrText(p))
      return tokens.every((t) => hay.includes(t))
    })
  }, [products, query, bandType, widthFilterActive, boardThickness])

  return (
    <CModal visible={visible} onClose={onClose} size="lg" alignment="center" container={container}>
      <CModalHeader>
        <CModalTitle>Seleccionar tapacanto{pieceLabel ? ` · ${pieceLabel}` : ''}</CModalTitle>
      </CModalHeader>
      <CModalBody>
        <div className="d-flex flex-wrap gap-2 align-items-center mb-2">
          <CFormInput
            size="sm"
            autoFocus
            style={{ flex: '1 1 220px', minWidth: 180 }}
            placeholder="Buscar por nombre, código o color…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <CFormSelect
            size="sm"
            style={{ width: 130 }}
            value={bandType}
            onChange={(e) => setBandType(e.target.value as '' | BandType)}
          >
            <option value="">Todo tipo</option>
            {BAND_TYPES.map((bt) => (
              <option key={bt.value} value={bt.value}>
                {bt.label}
              </option>
            ))}
          </CFormSelect>
        </div>

        {boardThickness != null && (
          <CFormCheck
            className="mb-2 small"
            id="edge-banding-all-widths"
            checked={allWidths}
            onChange={(e) => setAllWidths(e.target.checked)}
            label={`Mostrar tapacantos de cualquier ancho (el tablero es de ${boardThickness}mm)`}
          />
        )}

        <div style={{ maxHeight: '50vh', overflow: 'auto' }}>
          <CTable small hover bordered className="mb-0 align-middle">
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>Nombre</CTableHeaderCell>
                <CTableHeaderCell>Código</CTableHeaderCell>
                <CTableHeaderCell>Tipo</CTableHeaderCell>
                <CTableHeaderCell className="text-end text-nowrap">Ancho (mm)</CTableHeaderCell>
                <CTableHeaderCell className="text-end text-nowrap">Espesor (mm)</CTableHeaderCell>
                <CTableHeaderCell>Color</CTableHeaderCell>
                <CTableHeaderCell className="text-end">Precio</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {filtered.map((p) => {
                const isCurrent = String(p.id) === value
                return (
                  <CTableRow
                    key={p.id}
                    active={isCurrent}
                    style={{ cursor: 'pointer' }}
                    onClick={() => onSelect(p)}
                  >
                    <CTableDataCell className="fw-semibold">{p.name}</CTableDataCell>
                    <CTableDataCell className="text-body-secondary">{p.code}</CTableDataCell>
                    <CTableDataCell>
                      {p.attributes.bandType
                        ? (BANDTYPE_LABEL[p.attributes.bandType as BandType] ??
                          p.attributes.bandType)
                        : '—'}
                    </CTableDataCell>
                    <CTableDataCell className="text-end">{num(p.attributes.width)}</CTableDataCell>
                    <CTableDataCell className="text-end">
                      {num(p.attributes.thickness)}
                    </CTableDataCell>
                    <CTableDataCell>{p.attributes.color ?? '—'}</CTableDataCell>
                    <CTableDataCell className="text-end">{fmtMoney(p.price)}</CTableDataCell>
                  </CTableRow>
                )
              })}
              {filtered.length === 0 && (
                <CTableRow>
                  <CTableDataCell
                    colSpan={7}
                    className="text-center text-body-secondary small py-3"
                  >
                    Sin tapacantos que coincidan.
                    {widthFilterActive && ' Prueba mostrando los de cualquier ancho.'}
                  </CTableDataCell>
                </CTableRow>
              )}
            </CTableBody>
          </CTable>
        </div>
      </CModalBody>
      <CModalFooter>
        <CButton color="secondary" variant="outline" onClick={onClear}>
          Quitar tapacanto
        </CButton>
        <CButton color="secondary" onClick={onClose}>
          Cancelar
        </CButton>
      </CModalFooter>
    </CModal>
  )
}

export default EdgeBandingPickerModal
