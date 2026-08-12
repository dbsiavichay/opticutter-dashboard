import {
  CAlert,
  CBadge,
  CButton,
  CButtonGroup,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CRow,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilCalculator, cilLoopCircular } from '@coreui/icons'

import { fmtMoney } from 'src/features/review/format'
import PricingBlock from 'src/shared/components/PricingBlock'
import { stripHalfSuffix } from 'src/shared/utils/halfBoard'
import type { OptimizeResponse, PackingStrategy } from './types'
import CutLayoutDiagram from './CutLayoutDiagram'

interface OptimizationPreviewProps {
  result?: OptimizeResponse
  isPending: boolean
  error?: Error | null
  // When provided, the header shows an "Optimizar" button. Pre-orders use it as Save+Recalculate
  // alongside their sticky action bar; the optimizer drives everything from here.
  canOptimize?: boolean
  onOptimize?: () => void
  // Primary button label. Defaults to "Optimizar".
  optimizeLabel?: string
  // Cut heuristic picker, rendered in the header when both are provided. Omitted by pre-orders,
  // which keep it in their action bar.
  strategy?: PackingStrategy
  onStrategyChange?: (s: PackingStrategy) => void
  // "Otra alternativa": bumps the variant seed for a different deterministic layout. Shown only
  // once there is a result to vary.
  onAlternative?: () => void
  variant?: number
  // Portal target for the expanded-sheet modal; see CutLayoutDiagram.modalContainer.
  modalContainer?: () => Element | null
}

const STRATEGY_OPTIONS: { value: PackingStrategy; label: string }[] = [
  { value: 'longOffcuts', label: 'Retazos largos' },
  { value: 'default', label: 'Máxima eficiencia' },
]

const meters = (n?: number | null) => (n != null ? `${n.toFixed(2)} m` : '—')

interface KpiProps {
  label: string
  value: string | number
}

// Compact KPI tile with a subtle border, so the four headline metrics read as a scannable group.
const Kpi = ({ label, value }: KpiProps) => (
  <CCol xs={6} md={3}>
    <div className="border rounded-3 p-2 h-100">
      <div className="text-body-secondary small text-uppercase">{label}</div>
      <div className="fs-5 fw-semibold">{value}</div>
    </div>
  </CCol>
)

const OptimizationPreview = ({
  result,
  isPending,
  error,
  canOptimize,
  onOptimize,
  optimizeLabel = 'Optimizar',
  strategy,
  onStrategyChange,
  onAlternative,
  variant = 0,
  modalContainer,
}: OptimizationPreviewProps) => {
  const showStrategy = strategy != null && !!onStrategyChange
  return (
    <CCard className="mb-3">
      {/* Actions live in this header rather than a bar pinned to the bottom of the viewport: with
          the results pane sticky, they stay reachable without permanently spending a strip of
          screen height. */}
      <CCardHeader className="d-flex flex-wrap justify-content-between align-items-center gap-2">
        <strong>Vista previa de optimización</strong>
        <div className="d-flex flex-wrap align-items-center gap-2">
          {showStrategy && (
            <CButtonGroup size="sm" role="group" aria-label="Heurística de corte">
              {STRATEGY_OPTIONS.map((o) => {
                const active = strategy === o.value
                return (
                  <CButton
                    key={o.value}
                    type="button"
                    color="primary"
                    variant={active ? undefined : 'outline'}
                    active={active}
                    disabled={isPending}
                    title={
                      o.value === 'longOffcuts'
                        ? 'Agrupa el sobrante en una tira larga reutilizable'
                        : 'Minimiza el desperdicio total'
                    }
                    onClick={() => onStrategyChange?.(o.value)}
                  >
                    {o.label}
                  </CButton>
                )
              })}
            </CButtonGroup>
          )}
          {result && onAlternative && (
            <CButton
              size="sm"
              color="secondary"
              variant="outline"
              type="button"
              disabled={!canOptimize || isPending}
              onClick={onAlternative}
              title="Genera una distribución alternativa con las mismas piezas"
            >
              <CIcon icon={cilLoopCircular} className="me-1" />
              Otra alternativa
              {variant > 0 && <span className="ms-1 badge text-bg-secondary">#{variant}</span>}
            </CButton>
          )}
          {onOptimize ? (
            <CButton
              size="sm"
              color="primary"
              type="button"
              disabled={!canOptimize || isPending}
              onClick={onOptimize}
            >
              {isPending ? (
                <CSpinner size="sm" />
              ) : (
                <>
                  <CIcon icon={cilCalculator} className="me-1" />
                  {optimizeLabel}
                </>
              )}
            </CButton>
          ) : (
            isPending && (
              <span className="text-body-secondary small d-flex align-items-center gap-2">
                <CSpinner size="sm" />
                Optimizando…
              </span>
            )
          )}
        </div>
      </CCardHeader>
      <CCardBody>
        {error && (
          <CAlert color="danger" className="py-2 small mb-3">
            {error.message || 'Error al optimizar. Intente nuevamente.'}
          </CAlert>
        )}
        {!result && !error && (
          <div className="text-body-secondary small">
            Define materiales y piezas, luego presiona “Optimizar” para ver tableros, costo,
            eficiencia y el diagrama de cortes — sin crear nada.
          </div>
        )}
        {result && (
          <>
            <CRow className="g-2 mb-3">
              <Kpi label="Tableros usados" value={result.totalBoardsUsed} />
              <Kpi
                label="Costo estimado"
                value={fmtMoney((result.totalBoardsCost ?? 0) + (result.totalEdgeBandingCost ?? 0))}
              />
              <Kpi label="Corte lineal" value={meters(result.totalCutLinearM)} />
              <Kpi label="Tapacanto lineal" value={meters(result.totalEdgeBandingLinearM)} />
            </CRow>

            {result.pricing && (
              <div className="mb-3">
                <PricingBlock pricing={result.pricing} />
              </div>
            )}

            {result.materialsSummary?.length > 0 && (
              <CTable small responsive className="mb-3">
                <CTableHead>
                  <CTableRow>
                    <CTableHeaderCell className="bg-body-tertiary">Material</CTableHeaderCell>
                    <CTableHeaderCell className="bg-body-tertiary">Medida</CTableHeaderCell>
                    <CTableHeaderCell className="bg-body-tertiary text-end">
                      Tableros
                    </CTableHeaderCell>
                    <CTableHeaderCell className="bg-body-tertiary text-end">
                      Efic. avg
                    </CTableHeaderCell>
                    <CTableHeaderCell className="bg-body-tertiary text-end">Costo</CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {result.materialsSummary.map((m) => (
                    <CTableRow key={m.materialKey}>
                      <CTableDataCell>
                        {stripHalfSuffix(m.productName) ?? m.productCode ?? m.materialKey}{' '}
                        {m.halfBoard && <CBadge color="info">½ medio</CBadge>}
                      </CTableDataCell>
                      <CTableDataCell className="text-nowrap">
                        {m.width}×{m.height}×{m.thickness} mm
                      </CTableDataCell>
                      <CTableDataCell className="text-end">{m.count}</CTableDataCell>
                      <CTableDataCell className="text-end">
                        {m.avgEfficiency != null ? `${m.avgEfficiency.toFixed(1)}%` : '—'}
                      </CTableDataCell>
                      <CTableDataCell className="text-end">{fmtMoney(m.totalCost)}</CTableDataCell>
                    </CTableRow>
                  ))}
                </CTableBody>
              </CTable>
            )}

            {result.edgeBandingsSummary?.length > 0 && (
              <CTable small responsive className="mb-3">
                <CTableHead>
                  <CTableRow>
                    <CTableHeaderCell className="bg-body-tertiary">Tapacanto</CTableHeaderCell>
                    <CTableHeaderCell className="bg-body-tertiary text-end">
                      m netos
                    </CTableHeaderCell>
                    <CTableHeaderCell className="bg-body-tertiary text-end">
                      m facturados
                    </CTableHeaderCell>
                    <CTableHeaderCell className="bg-body-tertiary text-end">
                      Precio/m
                    </CTableHeaderCell>
                    <CTableHeaderCell className="bg-body-tertiary text-end">Costo</CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {result.edgeBandingsSummary.map((e) => (
                    <CTableRow key={e.productId ?? 'sin-producto'}>
                      <CTableDataCell>
                        {e.productName ?? e.productCode ?? 'Sin asignar'}
                        {e.color ? <span className="text-body-secondary"> · {e.color}</span> : null}
                      </CTableDataCell>
                      <CTableDataCell className="text-end">
                        {e.netLinearM.toFixed(2)}
                      </CTableDataCell>
                      <CTableDataCell className="text-end">{e.billedLinearM}</CTableDataCell>
                      <CTableDataCell className="text-end">
                        {e.pricePerM ? fmtMoney(e.pricePerM) : '—'}
                      </CTableDataCell>
                      <CTableDataCell className="text-end">
                        {e.totalCost ? fmtMoney(e.totalCost) : '—'}
                      </CTableDataCell>
                    </CTableRow>
                  ))}
                </CTableBody>
              </CTable>
            )}

            <CutLayoutDiagram
              layoutGroups={result.layoutGroups}
              materialsSummary={result.materialsSummary}
              modalContainer={modalContainer}
            />
          </>
        )}
      </CCardBody>
    </CCard>
  )
}

export default OptimizationPreview
