import { useState } from 'react'
import {
  CAlert,
  CButton,
  CFormCheck,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CSpinner,
} from '@coreui/react'

import { fmtMoney } from './format'

interface ReviewConfirmModalProps {
  visible: boolean
  onClose: () => void
  onConfirm: () => void
  total: number
  currency: string
  totalBoards: number
  totalPieces: number
  isPending: boolean
  error?: string | null
}

// Confirming is irreversible — it mints the order — so it asks for an explicit acknowledgement
// instead of firing on a single tap, which on a phone is easy to do by accident.
const ReviewConfirmModal = ({
  visible,
  onClose,
  onConfirm,
  total,
  currency,
  totalBoards,
  totalPieces,
  isPending,
  error,
}: ReviewConfirmModalProps) => {
  const [accepted, setAccepted] = useState(false)

  // Reopening must start unchecked: the declaration is per confirmation, not per session. Adjusted
  // during render rather than in an effect, which is React's recommended way to reset state on a
  // prop change and avoids the extra render pass an effect would cost.
  const [wasVisible, setWasVisible] = useState(visible)
  if (visible !== wasVisible) {
    setWasVisible(visible)
    if (visible) setAccepted(false)
  }

  return (
    <CModal visible={visible} onClose={onClose} alignment="center">
      <CModalHeader>
        <CModalTitle>Confirmar pedido</CModalTitle>
      </CModalHeader>
      <CModalBody>
        <div className="d-flex justify-content-between align-items-baseline">
          <span className="text-body-secondary">Total a pagar</span>
          <span className="fs-4 fw-semibold">{fmtMoney(total, currency)}</span>
        </div>
        <div className="text-body-secondary small mb-3">
          {totalBoards} {totalBoards === 1 ? 'tablero' : 'tableros'} · {totalPieces}{' '}
          {totalPieces === 1 ? 'pieza' : 'piezas'}
        </div>

        {/* The order is born `confirmed` but only enters the cutting queue once someone registers
            the payment, so the note that used to say "pasa a producción" was telling the client the
            opposite of what happens. It is an alert, not muted small print: a client who believes
            the saw is already running is the one who calls the shop the next day. */}
        <CAlert color="info" className="small py-2">
          <strong>Confirmar no inicia el corte.</strong> Tu pedido entra a la cola de producción una
          vez registrado el pago: comunícate con tu asesor para coordinarlo y lo atendemos cuanto
          antes.
        </CAlert>

        <CFormCheck
          id="review-declaration"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          label="Declaro haber revisado las medidas, los cantos y los materiales, y autorizo la producción de este pedido."
        />

        <div className="text-body-secondary small mt-3">
          Una vez confirmado, el pedido queda en firme y ya no se puede modificar desde este enlace.
        </div>

        {error && <div className="text-danger small mt-2">{error}</div>}
      </CModalBody>
      <CModalFooter>
        <CButton color="secondary" variant="outline" onClick={onClose} disabled={isPending}>
          Cancelar
        </CButton>
        <CButton color="primary" disabled={!accepted || isPending} onClick={onConfirm}>
          {isPending ? <CSpinner size="sm" /> : 'Confirmar pedido'}
        </CButton>
      </CModalFooter>
    </CModal>
  )
}

export default ReviewConfirmModal
