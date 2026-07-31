import { useId, useMemo, useState } from 'react'
import {
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCollapse,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilChevronBottom, cilChevronRight } from '@coreui/icons'

import CantoPreview from 'src/shared/components/CantoPreview'
import { cantoNotation, cantoSides, edgesLabel } from './format'
import type { ReviewPiece } from './types'

const Cantos = ({ piece }: { piece: ReviewPiece }) =>
  piece.edges?.sides?.length ? (
    <div className="d-flex align-items-center gap-2" title={edgesLabel(piece.edges)}>
      <CantoPreview sides={cantoSides(piece.edges)} />
      <span className="text-nowrap">{cantoNotation(piece.edges)}</span>
    </div>
  ) : (
    <span className="text-body-secondary">—</span>
  )

interface Row {
  piece: ReviewPiece
  // 1-based position in the whole cut list, kept across groups so a piece can be referred to by
  // number regardless of how the list is split.
  number: number
}

interface MaterialGroup {
  name: string
  rows: Row[]
  units: number
}

interface ReviewPiecesProps {
  pieces: ReviewPiece[]
}

// The cut list, one collapsible card per board. The material moved out of a repeated column and
// into each card's title, which also fixes losing track of which board you're reading once the list
// scrolls past its heading on a phone — and lets you fold away the boards you're not checking.
const ReviewPieces = ({ pieces }: ReviewPiecesProps) => {
  const baseId = useId().replace(/:/g, '')

  const groups = useMemo(() => {
    const byMaterial = new Map<string, MaterialGroup>()
    pieces.forEach((piece, i) => {
      const name = piece.materialName ?? piece.materialCode ?? 'Sin material'
      const group = byMaterial.get(name) ?? { name, rows: [], units: 0 }
      group.rows.push({ piece, number: i + 1 })
      group.units += piece.quantity ?? 0
      byMaterial.set(name, group)
    })
    return [...byMaterial.values()]
  }, [pieces])

  // Open by default — the client came here to check these — but foldable so a long job can be
  // narrowed down to the board in question.
  const [closed, setClosed] = useState<Set<string>>(new Set())
  const toggle = (name: string) =>
    setClosed((prev) => {
      const next = new Set(prev)
      if (!next.delete(name)) next.add(name)
      return next
    })

  return (
    <>
      {groups.map((group, gi) => {
        const open = !closed.has(group.name)
        const bodyId = `pieces-${baseId}-${gi}`
        return (
          <CCard className="mb-3" key={group.name}>
            <CCardHeader className="p-0">
              <CButton
                color="link"
                className="w-100 d-flex align-items-center justify-content-between gap-2 px-3 py-2 text-body text-decoration-none text-start"
                onClick={() => toggle(group.name)}
                aria-expanded={open}
                aria-controls={bodyId}
              >
                {/* Material on its own small line: board names are long enough to wrap the title
                    onto two lines on a phone, which pushed the count around. */}
                <span className="d-block lh-sm">
                  <strong>Piezas</strong>
                  <span className="d-block text-body-secondary small">{group.name}</span>
                </span>
                <span className="d-flex align-items-center gap-2 text-body-secondary small text-nowrap">
                  {group.units} {group.units === 1 ? 'pieza' : 'piezas'}
                  <CIcon icon={open ? cilChevronBottom : cilChevronRight} size="sm" />
                </span>
              </CButton>
            </CCardHeader>

            <CCollapse visible={open}>
              <CCardBody id={bodyId}>
                {/* Mobile: one card per piece — a table this wide can't survive a 375px screen. */}
                <div className="d-md-none">
                  {group.rows.map(({ piece, number }, i) => (
                    <div key={number} className={`py-3 ${i > 0 ? 'border-top' : ''}`}>
                      <div className="d-flex justify-content-between align-items-start gap-2">
                        <div className="fw-semibold">{piece.label ?? `Pieza ${number}`}</div>
                        <div className="text-nowrap">
                          <span className="text-body-secondary small me-1">Cant.</span>
                          <strong>{piece.quantity}</strong>
                        </div>
                      </div>
                      <div className="d-flex justify-content-between align-items-center gap-2 mt-2">
                        <span className="text-nowrap">
                          {piece.height} × {piece.width}{' '}
                          <span className="text-body-secondary small">mm</span>
                        </span>
                        <Cantos piece={piece} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop: the full table */}
                <div className="d-none d-md-block">
                  <CTable small responsive>
                    <CTableHead>
                      <CTableRow>
                        <CTableHeaderCell className="bg-body-tertiary text-end">#</CTableHeaderCell>
                        <CTableHeaderCell className="bg-body-tertiary">Etiqueta</CTableHeaderCell>
                        <CTableHeaderCell className="bg-body-tertiary text-end">
                          Medida (largo × ancho mm)
                        </CTableHeaderCell>
                        <CTableHeaderCell className="bg-body-tertiary text-end">
                          Cant.
                        </CTableHeaderCell>
                        <CTableHeaderCell className="bg-body-tertiary">Cantos</CTableHeaderCell>
                      </CTableRow>
                    </CTableHead>
                    <CTableBody>
                      {group.rows.map(({ piece, number }) => (
                        <CTableRow key={number}>
                          <CTableDataCell className="text-end text-body-secondary">
                            {number}
                          </CTableDataCell>
                          <CTableDataCell>{piece.label ?? '—'}</CTableDataCell>
                          <CTableDataCell className="text-end text-nowrap">
                            {piece.height} × {piece.width}
                          </CTableDataCell>
                          <CTableDataCell className="text-end">{piece.quantity}</CTableDataCell>
                          <CTableDataCell>
                            <Cantos piece={piece} />
                          </CTableDataCell>
                        </CTableRow>
                      ))}
                    </CTableBody>
                  </CTable>
                </div>
              </CCardBody>
            </CCollapse>
          </CCard>
        )
      })}
    </>
  )
}

export default ReviewPieces
