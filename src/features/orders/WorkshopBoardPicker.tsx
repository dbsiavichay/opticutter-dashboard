import { CBadge, CButton, CModal, CModalBody, CModalHeader, CModalTitle } from '@coreui/react'

import { stripHalfSuffix } from 'src/shared/utils/halfBoard'
import type { CutBoard } from './types'

interface WorkshopBoardPickerProps {
  visible: boolean
  boards: CutBoard[]
  currentId: number | null
  onSelect: (boardId: number) => void
  onClose: () => void
  // Portal target, so the dialog is painted when the shell is in native fullscreen.
  container?: () => Element | null
}

// The board list, behind a tap on the top bar's pager instead of a permanent chip strip. The strip
// cost a whole row on a screen whose whole point is that nothing scrolls, and a shift only picks a
// board out of order now and then — `‹ ›` covers the rest. What it must NOT lose is the per-board
// progress, which is how the operador finds the one still pending.
const WorkshopBoardPicker = ({
  visible,
  boards,
  currentId,
  onSelect,
  onClose,
  container,
}: WorkshopBoardPickerProps) => (
  <CModal
    visible={visible}
    onClose={onClose}
    size="lg"
    scrollable
    alignment="center"
    container={container}
  >
    <CModalHeader>
      <CModalTitle>Tableros</CModalTitle>
    </CModalHeader>
    <CModalBody>
      <div className="workshop-picker">
        {boards.map((b) => {
          const { cutPieces, totalPieces } = b.progress
          const done = totalPieces > 0 && cutPieces >= totalPieces
          return (
            <CButton
              key={b.id}
              size="lg"
              color={done ? 'success' : cutPieces > 0 ? 'primary' : 'secondary'}
              variant={b.id === currentId ? undefined : 'outline'}
              className="workshop-picker__item text-start"
              onClick={() => onSelect(b.id)}
            >
              <span className="d-flex align-items-center gap-2">
                <span className="fw-semibold">Tablero {b.sheetNumber}</span>
                {b.halfBoard && <CBadge color="info">½ medio</CBadge>}
                <span className="ms-auto text-nowrap">
                  {done ? '✓ Listo' : `${cutPieces}/${totalPieces}`}
                </span>
              </span>
              <span className="small d-block text-truncate">{stripHalfSuffix(b.productName)}</span>
            </CButton>
          )
        })}
      </div>
    </CModalBody>
  </CModal>
)

export default WorkshopBoardPicker
