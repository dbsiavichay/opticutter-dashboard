import {
  CButton,
  CFormSelect,
  CListGroup,
  CListGroupItem,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CSpinner,
} from '@coreui/react'
import { useDeleteDraft, useDrafts } from './useDrafts'

import CIcon from '@coreui/icons-react'
import { cilTrash } from '@coreui/icons'
import { useActiveBranches } from 'src/features/branches/useBranches'
import { useIsGlobalBranchRole } from 'src/features/auth/useAuth'
import { useState } from 'react'
import { fmtDate } from 'src/shared/utils/format'
import type { ModalContainer } from './types'

interface DraftsModalProps {
  visible: boolean
  loadingId: number | null
  onLoad: (id: number) => void
  container?: ModalContainer
  onClose: () => void
}

const DraftsModal = ({ visible, loadingId, onLoad, container, onClose }: DraftsModalProps) => {
  const isGlobalBranch = useIsGlobalBranchRole()
  const [branchId, setBranchId] = useState('')
  const { data: branches = [] } = useActiveBranches()
  const { data, isLoading } = useDrafts(branchId ? Number(branchId) : undefined)
  const deleteDraft = useDeleteDraft()
  const drafts = data?.items ?? []

  const handleDelete = (id: number, name: string) => {
    if (!window.confirm(`¿Eliminar el borrador "${name}"? Esta acción no se puede deshacer.`))
      return
    deleteDraft.mutate(id)
  }

  return (
    <CModal visible={visible} onClose={onClose} size="lg" alignment="center" container={container}>
      <CModalHeader>
        <CModalTitle>Borradores guardados</CModalTitle>
      </CModalHeader>
      <CModalBody>
        {isGlobalBranch && (
          <CFormSelect
            className="mb-3"
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
          >
            <option value="">Todas las sucursales</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </CFormSelect>
        )}
        {isLoading ? (
          <div className="text-center py-4">
            <CSpinner />
          </div>
        ) : drafts.length === 0 ? (
          <p className="text-body-secondary text-center py-4 mb-0">
            No tienes borradores guardados todavía. Usa «Guardar borrador» para conservar tu trabajo
            y retomarlo después.
          </p>
        ) : (
          <CListGroup>
            {drafts.map((d) => {
              const isLoadingThis = loadingId === d.id
              const isDeletingThis = deleteDraft.isPending && deleteDraft.variables === d.id
              return (
                <CListGroupItem
                  key={d.id}
                  className="d-flex align-items-center justify-content-between gap-2"
                >
                  <div style={{ minWidth: 0 }}>
                    <div className="fw-semibold text-truncate">{d.name}</div>
                    <div className="small text-body-secondary">
                      {d.branch.name} · Actualizado el {fmtDate(d.updatedAt)}
                    </div>
                  </div>
                  <div className="d-flex gap-2 flex-shrink-0">
                    <CButton
                      color="primary"
                      size="sm"
                      disabled={isLoadingThis}
                      onClick={() => onLoad(d.id)}
                    >
                      {isLoadingThis ? <CSpinner size="sm" /> : 'Cargar'}
                    </CButton>
                    <CButton
                      color="danger"
                      variant="ghost"
                      size="sm"
                      disabled={isDeletingThis}
                      onClick={() => handleDelete(d.id, d.name)}
                    >
                      {isDeletingThis ? <CSpinner size="sm" /> : <CIcon icon={cilTrash} />}
                    </CButton>
                  </div>
                </CListGroupItem>
              )
            })}
          </CListGroup>
        )}
      </CModalBody>
      <CModalFooter>
        <CButton color="secondary" onClick={onClose}>
          Cerrar
        </CButton>
      </CModalFooter>
    </CModal>
  )
}

export default DraftsModal
