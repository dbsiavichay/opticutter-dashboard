import { useState } from 'react'
import {
  CBadge,
  CButton,
  CFormInput,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilExternalLink } from '@coreui/icons'

import { fmtDateTime } from 'src/shared/utils/format'
import { ordersApi } from './ordersApi'
import { useAttachments, useDeleteAttachment, useUploadAttachment } from './useOrders'

// Anexos in a dialog rather than in a card at the foot of the page. The card's first element was a
// permanent file input — a control the size of a form field, on the surface a user reads top to
// bottom, for something that happens once or twice in an order's life. The page keeps the one fact
// worth reading at a glance (how many files there are) and this holds the rest.

const ATTACH_MAX_MB = 10
const ATTACH_TYPES = ['application/pdf', 'image/png', 'image/jpeg']

export const humanSize = (b: number) =>
  b < 1024
    ? `${b} B`
    : b < 1_048_576
      ? `${(b / 1024).toFixed(0)} KB`
      : `${(b / 1_048_576).toFixed(1)} MB`

interface OrderAttachmentsModalProps {
  orderId: string
  visible: boolean
  onClose: () => void
  // The order is closed: the backend rejects uploads and deletes with a 422.
  locked: boolean
  canManage: boolean
}

const OrderAttachmentsModal = ({
  orderId,
  visible,
  onClose,
  locked,
  canManage,
}: OrderAttachmentsModalProps) => {
  const attachments = useAttachments(orderId)
  const uploadAtt = useUploadAttachment(orderId)
  const deleteAtt = useDeleteAttachment(orderId)
  const [attachError, setAttachError] = useState<string | null>(null)

  const editable = canManage && !locked

  // Client-side pre-check is UX only; the API is the authority and returns 422 on bad type/size.
  const onPickFile = (file?: File | null) => {
    if (!file) return
    if (!ATTACH_TYPES.includes(file.type)) return setAttachError('Solo PDF, PNG o JPEG.')
    if (file.size > ATTACH_MAX_MB * 1024 * 1024)
      return setAttachError(`Máximo ${ATTACH_MAX_MB} MB.`)
    setAttachError(null)
    uploadAtt.reset()
    uploadAtt.mutate(file)
  }

  const onDeleteAttachment = (attachmentId: number, filename: string) => {
    if (!window.confirm(`¿Eliminar el anexo "${filename}"?`)) return
    deleteAtt.reset()
    deleteAtt.mutate(attachmentId)
  }

  return (
    <CModal visible={visible} onClose={onClose} size="lg" scrollable>
      <CModalHeader>
        <CModalTitle>Anexos</CModalTitle>
      </CModalHeader>
      <CModalBody>
        {editable && (
          <div className="mb-3">
            <CFormInput
              type="file"
              accept="application/pdf,image/png,image/jpeg"
              disabled={uploadAtt.isPending}
              onChange={(e) => {
                onPickFile(e.target.files?.[0])
                e.target.value = ''
              }}
            />
            <div className="text-body-secondary small mt-1">
              PDF, PNG o JPEG · máx {ATTACH_MAX_MB} MB.
              {uploadAtt.isPending && <CSpinner size="sm" className="ms-2" />}
            </div>
            {(attachError || uploadAtt.error) && (
              <div className="text-danger small mt-1">
                {attachError ?? uploadAtt.error?.message}
              </div>
            )}
          </div>
        )}
        {locked && (
          <div className="text-body-secondary small mb-2">
            La orden está cerrada: no se pueden agregar ni quitar anexos.
          </div>
        )}
        {attachments.isLoading ? (
          <CSpinner size="sm" />
        ) : attachments.data && attachments.data.length > 0 ? (
          <CTable small responsive hover className="summary-table mb-0 align-middle">
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>Archivo</CTableHeaderCell>
                <CTableHeaderCell>Tamaño</CTableHeaderCell>
                <CTableHeaderCell>Fecha</CTableHeaderCell>
                <CTableHeaderCell className="text-end">Acciones</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {attachments.data.map((att) => (
                <CTableRow key={att.id}>
                  <CTableDataCell>
                    <CBadge
                      color={att.contentType === 'application/pdf' ? 'danger' : 'info'}
                      className="me-2"
                    >
                      {att.contentType.split('/')[1]?.toUpperCase() ?? 'ARCHIVO'}
                    </CBadge>
                    {att.filename}
                  </CTableDataCell>
                  <CTableDataCell>{humanSize(att.sizeBytes)}</CTableDataCell>
                  <CTableDataCell>{fmtDateTime(att.createdAt)}</CTableDataCell>
                  <CTableDataCell className="text-end">
                    <CButton
                      color="secondary"
                      variant="outline"
                      size="sm"
                      className="me-2"
                      onClick={() => void ordersApi.downloadAttachment(orderId, att.id)}
                    >
                      <CIcon icon={cilExternalLink} className="me-1" />
                      Ver
                    </CButton>
                    {editable && (
                      <CButton
                        color="danger"
                        variant="outline"
                        size="sm"
                        disabled={deleteAtt.isPending}
                        onClick={() => onDeleteAttachment(att.id, att.filename)}
                      >
                        Borrar
                      </CButton>
                    )}
                  </CTableDataCell>
                </CTableRow>
              ))}
            </CTableBody>
          </CTable>
        ) : (
          <div className="text-body-secondary small">Sin anexos.</div>
        )}
        {deleteAtt.error && <div className="text-danger small mt-2">{deleteAtt.error.message}</div>}
      </CModalBody>
      <CModalFooter>
        <CButton color="primary" onClick={onClose}>
          Listo
        </CButton>
      </CModalFooter>
    </CModal>
  )
}

export default OrderAttachmentsModal
