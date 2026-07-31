import { useId, useMemo, useState } from 'react'
import { CBadge, CButton, CCard, CCardBody, CCollapse } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilChevronBottom, cilChevronRight } from '@coreui/icons'

import SheetSvg from 'src/shared/components/SheetSvg'
import { stripHalfSuffix } from 'src/shared/utils/halfBoard'
import { EDGE_COLOR, PALETTE, bandedSides, pieceLabel, pieceSig } from 'src/shared/utils/cutDrawing'
import ReviewSheetModal from './ReviewSheetModal'
import type { ReviewLayoutGroup } from './types'

// Identical sheets are grouped into one pattern, so a group covers a *range* of physical boards.
// The server's `sheetNumbers` restarts at 1 for every material, so a job mixing two boards would
// show two "Tablero 1"; numbering by running position across the groups keeps it unambiguous.
const boardRange = (groups: ReviewLayoutGroup[]) => {
  let n = 0
  return groups.map((group) => {
    const from = n + 1
    n += group.count
    return { from, to: n }
  })
}

const boardTitle = (from: number, to: number, totalBoards: number) =>
  from === to ? `Tablero ${from} de ${totalBoards}` : `Tableros ${from}–${to} de ${totalBoards}`

interface ReviewPlanProps {
  groups: ReviewLayoutGroup[]
  totalBoards: number
}

// The client's view of how their boards get cut. Deliberately without the shop's metrics
// (efficiency, linear cut, waste): what matters here is that every piece they ordered is there.
const ReviewPlan = ({ groups, totalBoards }: ReviewPlanProps) => {
  // Index rather than the group itself, so the expanded view can page to the next board.
  const [detailIndex, setDetailIndex] = useState<number | null>(null)
  const [showLegend, setShowLegend] = useState(false)
  const legendId = `legend-${useId().replace(/:/g, '')}`
  const ranges = useMemo(() => boardRange(groups), [groups])
  const titleAt = (i: number) => {
    const r = ranges[i]
    return r ? boardTitle(r.from, r.to, totalBoards) : 'Tablero'
  }

  // One stable color per piece size across every board, so the same piece reads the same anywhere.
  const { colorFor, legend, hasEdgeBanding } = useMemo(() => {
    const colors = new Map<string, string>()
    const counts = new Map<string, number>()
    let banding = false
    for (const group of groups) {
      for (const p of group.placedPieces) {
        const sig = pieceSig(p)
        if (!colors.has(sig)) colors.set(sig, PALETTE[colors.size % PALETTE.length] ?? PALETTE[0])
        counts.set(sig, (counts.get(sig) ?? 0) + group.count)
        if (bandedSides(p).length > 0) banding = true
      }
    }
    return {
      colorFor: (sig: string) => colors.get(sig) ?? PALETTE[0],
      legend: [...colors.keys()].map((sig) => ({
        sig,
        color: colors.get(sig) ?? PALETTE[0],
        count: counts.get(sig) ?? 0,
      })),
      hasEdgeBanding: banding,
    }
  }, [groups])

  if (!groups.length) {
    return (
      <CCard>
        <CCardBody className="text-body-secondary small text-center py-4">
          El diagrama de corte todavía no está disponible para esta cotización.
        </CCardBody>
      </CCard>
    )
  }

  return (
    <div>
      {/* Collapsed by default: the legend grows with the number of distinct sizes and can push the
          first board off the screen, while it's only needed once to learn the color code. */}
      <CButton
        color="link"
        size="sm"
        className="p-0 mb-2 small text-body-secondary text-decoration-none d-inline-flex align-items-center gap-1"
        onClick={() => setShowLegend((v) => !v)}
        aria-expanded={showLegend}
        aria-controls={legendId}
      >
        <CIcon icon={showLegend ? cilChevronBottom : cilChevronRight} size="sm" />
        Leyenda de colores
        <span>({legend.length})</span>
      </CButton>

      <CCollapse visible={showLegend}>
        {/* A grid rather than wrapped flex: with flex the entries start wherever the previous one
            ended, so the swatches zig-zag and the list is hard to scan. Fixed tracks line the
            swatches and counts up in columns and still reflow by available width. */}
        <div
          id={legendId}
          className="mb-3 small"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(11rem, 1fr))',
            columnGap: '1rem',
            rowGap: '.25rem',
          }}
        >
          {legend.map((l) => (
            <span key={l.sig} className="d-inline-flex align-items-center gap-2 text-nowrap">
              <span
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 2,
                  background: l.color,
                  display: 'inline-block',
                  flexShrink: 0,
                }}
              />
              <span>{l.sig} mm</span>
              <span className="text-body-secondary ms-auto">×{l.count}</span>
            </span>
          ))}
          {hasEdgeBanding && (
            <span className="d-inline-flex align-items-center gap-2 text-body-secondary text-nowrap">
              <span
                style={{
                  width: 12,
                  height: 4,
                  borderRadius: 2,
                  background: EDGE_COLOR,
                  display: 'inline-block',
                  flexShrink: 0,
                }}
              />
              <span>Tapacanto</span>
            </span>
          )}
        </div>
      </CCollapse>

      {groups.map((group, i) => (
        // Keyed by position: `sheetNumbers` is not unique across materials.
        <CCard className="mb-3" key={i}>
          <CCardBody>
            <div className="d-flex align-items-center justify-content-between gap-2 mb-2 flex-wrap">
              <div>
                <strong>{titleAt(i)}</strong>
                {group.count > 1 && (
                  <CBadge color="secondary" className="ms-2" title="Se cortan idénticos">
                    ×{group.count} iguales
                  </CBadge>
                )}
                {group.sheet.halfBoard && (
                  <CBadge color="info" className="ms-2">
                    ½ medio
                  </CBadge>
                )}
                <div className="text-body-secondary small">
                  {stripHalfSuffix(group.sheet.materialName ?? undefined) ?? 'Tablero'}
                </div>
              </div>
            </div>

            <div
              role="button"
              title="Ampliar tablero"
              style={{ cursor: 'zoom-in' }}
              onClick={() => setDetailIndex(i)}
            >
              <SheetSvg
                layout={{
                  material: group.sheet,
                  placedPieces: group.placedPieces,
                  remainders: group.remainders,
                }}
                colorFor={colorFor}
                labelFor={(p) => pieceLabel(p.pieceId) || `${p.originalWidth}×${p.originalHeight}`}
              />
            </div>

            <div className="d-flex flex-wrap align-items-center gap-3 mt-2 small text-body-secondary">
              <span>
                {group.sheet.width} × {group.sheet.height} mm
              </span>
              <span>{group.piecesCount} piezas</span>
              {/* A real button, not a label: it reads as the affordance it is, so tapping the words
                  works as well as tapping the board, and it's reachable by keyboard. */}
              <CButton
                color="link"
                size="sm"
                className="ms-auto p-0 small text-decoration-underline"
                onClick={() => setDetailIndex(i)}
              >
                Toca para ampliar
              </CButton>
            </div>
          </CCardBody>
        </CCard>
      ))}

      <ReviewSheetModal
        groups={groups}
        index={detailIndex}
        onIndexChange={setDetailIndex}
        colorFor={colorFor}
        titleFor={titleAt}
        onClose={() => setDetailIndex(null)}
      />
    </div>
  )
}

export default ReviewPlan
