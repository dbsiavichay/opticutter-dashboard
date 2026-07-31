import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  CButton,
  CContainer,
  CDropdown,
  CDropdownItem,
  CDropdownMenu,
  CDropdownToggle,
  CFormLabel,
  CFormTextarea,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CSpinner,
} from '@coreui/react'

import { useConfirmReview, useRejectReview, useRequestChangesReview } from './useReview'
import ReviewConfirmModal from './ReviewConfirmModal'
import { fmtMoney } from './format'
import type { ReviewPreOrder } from './types'

interface ReviewActionsProps {
  token: string
  data: ReviewPreOrder
}

// The decision bar. It sticks to the bottom of the viewport so the primary action stays within
// thumb reach no matter how long the piece list is; the two destructive/slow paths sit behind an
// overflow menu so they never compete with it.
const ReviewActions = ({ token, data }: ReviewActionsProps) => {
  const qc = useQueryClient()
  const confirm = useConfirmReview(token)
  const reject = useRejectReview(token)
  const requestChanges = useRequestChangesReview(token)

  const [confirmModal, setConfirmModal] = useState(false)
  const [rejectModal, setRejectModal] = useState(false)
  const [changesModal, setChangesModal] = useState(false)
  const [rejectNote, setRejectNote] = useState('')
  const [changesNote, setChangesNote] = useState('')

  const closeConfirm = () => {
    const hadError = !!confirm.error
    setConfirmModal(false)
    confirm.reset()
    if (hadError) void qc.invalidateQueries({ queryKey: ['review', token] })
  }

  const closeReject = () => {
    const hadError = !!reject.error
    setRejectModal(false)
    setRejectNote('')
    reject.reset()
    if (hadError) void qc.invalidateQueries({ queryKey: ['review', token] })
  }

  const closeChanges = () => {
    const hadError = !!requestChanges.error
    setChangesModal(false)
    setChangesNote('')
    requestChanges.reset()
    if (hadError) void qc.invalidateQueries({ queryKey: ['review', token] })
  }

  const anyPending = confirm.isPending || reject.isPending || requestChanges.isPending

  return (
    <>
      <div
        className="position-sticky bottom-0 bg-body border-top py-2"
        style={{
          // Clears the iOS home indicator; 0 everywhere else.
          paddingBottom: 'calc(.5rem + env(safe-area-inset-bottom))',
          zIndex: 1020,
        }}
      >
        {/* The bar spans the full width so its background reaches both edges, but its contents line
            up with the page container above it. */}
        <CContainer
          className="d-flex align-items-center justify-content-between gap-2"
          style={{ maxWidth: 1280 }}
        >
          <div className="lh-sm text-truncate">
            <div className="text-body-secondary small">Total</div>
            <div className="fs-5 fw-semibold">{fmtMoney(data.total, data.currency ?? 'USD')}</div>
          </div>
          {/* flex-shrink-0: the actions keep their width and the total truncates instead, so the
              primary button is never clipped on a narrow phone. */}
          <div className="d-flex align-items-center gap-2 flex-shrink-0">
            <CDropdown alignment="end" direction="dropup">
              <CDropdownToggle color="secondary" variant="outline" disabled={anyPending}>
                Más
              </CDropdownToggle>
              <CDropdownMenu>
                <CDropdownItem role="button" onClick={() => setChangesModal(true)}>
                  Solicitar cambios
                </CDropdownItem>
                <CDropdownItem
                  role="button"
                  className="text-danger"
                  onClick={() => setRejectModal(true)}
                >
                  Rechazar cotización
                </CDropdownItem>
              </CDropdownMenu>
            </CDropdown>
            <CButton
              color="primary"
              className="text-nowrap"
              disabled={anyPending}
              onClick={() => setConfirmModal(true)}
            >
              {confirm.isPending ? (
                <CSpinner size="sm" />
              ) : (
                <>
                  Confirmar<span className="d-none d-sm-inline"> pedido</span>
                </>
              )}
            </CButton>
          </div>
        </CContainer>
      </div>

      <ReviewConfirmModal
        visible={confirmModal}
        onClose={closeConfirm}
        onConfirm={() => confirm.mutate(undefined, { onSuccess: () => setConfirmModal(false) })}
        total={data.total}
        currency={data.currency ?? 'USD'}
        totalBoards={data.totalBoardsUsed}
        totalPieces={data.totalPieces}
        isPending={confirm.isPending}
        error={confirm.error ? confirm.error.message || 'No se pudo confirmar.' : null}
      />

      {/* Request changes modal */}
      <CModal visible={changesModal} onClose={closeChanges} alignment="center">
        <CModalHeader>
          <CModalTitle>Solicitar cambios</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <p>Indica qué ajustes necesitas en la cotización. El taller recibirá tu nota.</p>
          <CFormLabel>¿Qué quieres cambiar? (opcional)</CFormLabel>
          <CFormTextarea
            rows={3}
            maxLength={512}
            value={changesNote}
            onChange={(e) => setChangesNote(e.target.value)}
            placeholder="Ej: cambia las dimensiones de la pieza 2, agrega barniz…"
          />
          {requestChanges.error && (
            <div className="text-danger small mt-2">
              {requestChanges.error.message || 'No se pudo enviar la solicitud.'}
            </div>
          )}
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" onClick={closeChanges}>
            Cancelar
          </CButton>
          <CButton
            color="warning"
            disabled={requestChanges.isPending}
            onClick={() =>
              requestChanges.mutate(changesNote || undefined, { onSuccess: closeChanges })
            }
          >
            {requestChanges.isPending ? <CSpinner size="sm" /> : 'Enviar solicitud'}
          </CButton>
        </CModalFooter>
      </CModal>

      {/* Reject modal */}
      <CModal visible={rejectModal} onClose={closeReject} alignment="center">
        <CModalHeader>
          <CModalTitle>Rechazar cotización</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <p>¿Estás seguro de que deseas rechazar esta cotización?</p>
          <CFormLabel>¿Por qué lo rechazas? (opcional)</CFormLabel>
          <CFormTextarea
            rows={3}
            maxLength={512}
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            placeholder="Motivo del rechazo…"
          />
          {reject.error && (
            <div className="text-danger small mt-2">
              {reject.error.message || 'No se pudo rechazar.'}
            </div>
          )}
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" onClick={closeReject}>
            Cancelar
          </CButton>
          <CButton
            color="danger"
            disabled={reject.isPending}
            onClick={() => reject.mutate(rejectNote || undefined, { onSuccess: closeReject })}
          >
            {reject.isPending ? <CSpinner size="sm" /> : 'Rechazar'}
          </CButton>
        </CModalFooter>
      </CModal>
    </>
  )
}

export default ReviewActions
