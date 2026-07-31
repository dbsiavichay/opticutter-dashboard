import { useState } from 'react'
import type { ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCol,
  CContainer,
  CRow,
  CSpinner,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'

import { logo } from 'src/assets/brand/logo'
import { ApiError } from 'src/shared/api/types'
import ReferenceNote from 'src/shared/components/ReferenceNote'
import { useReview } from './useReview'
import ReviewPlan from './ReviewPlan'
import ReviewPieces from './ReviewPieces'
import ReviewQuote from './ReviewQuote'
import ReviewActions from './ReviewActions'
import { fmtDate, fmtDateTime } from './format'
import type { ReviewPreOrder } from './types'

// Two independent axes, so the same state reads correctly at both breakpoints: `RailTab` is which
// panel the right rail shows (meaningful everywhere), and `MobileView` is whether the diagram or the
// rail occupies the screen (meaningful only below `lg`, where they can't coexist).
type RailTab = 'pieces' | 'quote'
type MobileView = 'plan' | 'rail'

interface ShellProps {
  children: ReactNode
  wide?: boolean
  // Rendered outside the container so it can span the full width and stick to the viewport bottom.
  footer?: ReactNode
}

const Shell = ({ children, wide = false, footer }: ShellProps) => (
  <div
    className="bg-body-tertiary d-flex flex-column"
    style={{ borderTop: '4px solid #E85050', minHeight: '100dvh' }}
  >
    <CContainer className="py-4 flex-grow-1" style={{ maxWidth: wide ? 1280 : 880 }}>
      <div className="text-center mb-4">
        <CIcon icon={logo} height={48} />
        <div className="text-body-secondary small mt-2">Revisión de cotización</div>
      </div>
      {children}
    </CContainer>
    {footer}
  </div>
)

const InfoView = ({ title, children }: { title: ReactNode; children?: ReactNode }) => (
  <Shell>
    <CCard>
      <CCardBody className="text-center py-5">
        <h5>{title}</h5>
        {children && <div className="text-body-secondary mt-2">{children}</div>}
      </CCardBody>
    </CCard>
  </Shell>
)

const Header = ({ data }: { data: ReviewPreOrder }) => (
  <CCard className="mb-3">
    <CCardBody className="py-3">
      <div className="d-flex align-items-start justify-content-between flex-wrap gap-2">
        <div>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <h5 className="mb-0">{data.reference}</h5>
            {data.status === 'changes_requested' && <CBadge color="info">Cambios pedidos</CBadge>}
            {data.status === 'confirmed' && <CBadge color="success">Confirmada</CBadge>}
          </div>
          <div className="text-body-secondary small">Cliente: {data.clientName}</div>
          {/* Commercial reference (project/site), the same text printed on the proforma. */}
          <ReferenceNote notes={data.notes} variant="header" />
        </div>
        <div className="text-end small">
          {data.status === 'sent' && data.expiresAt && (
            <div>
              Válida hasta el <strong>{fmtDate(data.expiresAt)}</strong>
            </div>
          )}
          {data.confirmedAt && (
            <div className="text-body-secondary">Confirmada: {fmtDateTime(data.confirmedAt)}</div>
          )}
          <div className="text-body-secondary">
            {data.totalBoardsUsed} {data.totalBoardsUsed === 1 ? 'tablero' : 'tableros'} ·{' '}
            {data.totalPieces} {data.totalPieces === 1 ? 'pieza' : 'piezas'}
          </div>
        </div>
      </div>
    </CCardBody>
  </CCard>
)

const Tab = ({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) => (
  <CButton
    color={active ? 'primary' : 'secondary'}
    variant={active ? undefined : 'outline'}
    className="flex-fill"
    onClick={onClick}
    aria-pressed={active}
  >
    {label}
  </CButton>
)

interface MobileTabsProps {
  view: MobileView
  railTab: RailTab
  onPlan: () => void
  onRail: (t: RailTab) => void
}

// Below `lg` the three panels take turns, so one bar drives both axes. Sticky to the top: the piece
// list and the board stack are both long, and having to scroll back up to switch views is what
// makes a tabbed layout tiring on a phone. `bg-body-tertiary` matches the page so cards pass
// cleanly underneath.
const MobileTabs = ({ view, railTab, onPlan, onRail }: MobileTabsProps) => (
  <div
    className="d-flex gap-2 d-lg-none position-sticky bg-body-tertiary py-2 mb-1"
    style={{ top: 0, zIndex: 1019 }}
  >
    <Tab active={view === 'plan'} label="Plano" onClick={onPlan} />
    <Tab
      active={view === 'rail' && railTab === 'pieces'}
      label="Piezas"
      onClick={() => onRail('pieces')}
    />
    <Tab
      active={view === 'rail' && railTab === 'quote'}
      label="Cotización"
      onClick={() => onRail('quote')}
    />
  </div>
)

// From `lg` up the diagram has its own column, so the rail only chooses between its two panels.
const RailTabs = ({ tab, onChange }: { tab: RailTab; onChange: (t: RailTab) => void }) => (
  <div className="d-none d-lg-flex gap-2 mb-3">
    <Tab active={tab === 'pieces'} label="Piezas" onClick={() => onChange('pieces')} />
    <Tab active={tab === 'quote'} label="Cotización" onClick={() => onChange('quote')} />
  </div>
)

const ReviewPage = () => {
  const { token } = useParams()
  const { data, isLoading, error, refetch, isFetching } = useReview(token)
  // The plan leads on mobile: it's the one thing the client can't see anywhere else.
  const [view, setView] = useState<MobileView>('plan')
  const [railTab, setRailTab] = useState<RailTab>('pieces')
  const openRail = (t: RailTab) => {
    setRailTab(t)
    setView('rail')
  }

  if (isLoading) {
    return (
      <Shell>
        <div className="text-center py-5">
          <CSpinner color="primary" />
        </div>
      </Shell>
    )
  }

  if (error) {
    const errStatus = error instanceof ApiError ? error.status : null
    // 404 = token not found or revoked (final — no retry, no technical details shown).
    if (errStatus === 404) {
      return (
        <InfoView title="Enlace no válido">
          Este enlace no es válido o fue reemplazado. Pide a tu vendedor uno nuevo.
        </InfoView>
      )
    }
    if (errStatus == null) {
      return (
        <Shell>
          <CCard>
            <CCardBody className="text-center py-5">
              <h5>No se pudo cargar</h5>
              <div className="text-body-secondary mb-3">Revisa tu conexión e intenta de nuevo.</div>
              <CButton color="primary" onClick={() => void refetch()} disabled={isFetching}>
                {isFetching ? <CSpinner size="sm" /> : 'Reintentar'}
              </CButton>
            </CCardBody>
          </CCard>
        </Shell>
      )
    }
    return <InfoView title="Ocurrió un error">{error.message}</InfoView>
  }

  if (!token || !data) return null

  const status = data.status

  if (status === 'expired') {
    return (
      <InfoView title="Cotización vencida">
        Esta cotización venció{data.expiresAt ? ` el ${fmtDate(data.expiresAt)}` : ''}. Contacta a
        ventas para solicitar una nueva.
      </InfoView>
    )
  }

  if (status === 'rejected') {
    return (
      <InfoView title="Cotización rechazada">
        Esta cotización fue rechazada. Contacta a ventas para más información.
      </InfoView>
    )
  }

  if (status === 'cancelled') {
    return (
      <InfoView title="Cotización retirada">
        Esta cotización ya no está disponible. Contacta a ventas para más información.
      </InfoView>
    )
  }

  const open = status === 'sent' || status === 'changes_requested'
  if (!open && status !== 'confirmed') {
    return <InfoView title="Estado no disponible">{`Estado: ${status}`}</InfoView>
  }

  // Below `lg` only the selected view is on screen; from `lg` up the diagram and the rail always
  // coexist and only `railTab` decides what the rail holds. That is the whole responsive difference.
  const mobileOnly = (v: MobileView) => (view === v ? '' : 'd-none d-lg-block')

  return (
    <Shell wide footer={open ? <ReviewActions token={token} data={data} /> : undefined}>
      {status === 'changes_requested' && (
        <CAlert color="info" className="mb-3">
          <strong>Pediste cambios — el taller está ajustando tu cotización.</strong>
          {data.clientNote && (
            <div className="mt-1 small">Tu nota: &ldquo;{data.clientNote}&rdquo;</div>
          )}
        </CAlert>
      )}
      {status === 'confirmed' && (
        <CAlert color="success">
          Tu pedido <strong>{data.orderCode}</strong> está confirmado
          {data.confirmedAt ? ` (${fmtDateTime(data.confirmedAt)})` : ''}.
        </CAlert>
      )}

      <Header data={data} />

      <MobileTabs view={view} railTab={railTab} onPlan={() => setView('plan')} onRail={openRail} />

      <CRow className="g-3">
        <CCol lg={7} className={mobileOnly('plan')}>
          <ReviewPlan groups={data.layoutGroups ?? []} totalBoards={data.totalBoardsUsed} />
        </CCol>
        <CCol lg={5} className={mobileOnly('rail')}>
          {/* `review-rail` pins this column from `lg` up (see scss) so the piece list stays on
              screen while the boards scroll — the whole point of comparing the two. */}
          <div className="review-rail">
            <RailTabs tab={railTab} onChange={setRailTab} />
            {railTab === 'quote' ? (
              <ReviewQuote data={data} />
            ) : (
              <ReviewPieces pieces={data.pieces ?? []} />
            )}
          </div>
        </CCol>
      </CRow>
    </Shell>
  )
}

export default ReviewPage
