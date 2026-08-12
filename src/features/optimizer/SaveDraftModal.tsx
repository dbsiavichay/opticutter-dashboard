import {
  CButton,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CSpinner,
} from '@coreui/react'
import { useCurrentUser, useHasRole, useIsGlobalBranchRole } from 'src/features/auth/useAuth'

import { ApiError } from 'src/shared/api/types'
import { useActiveBranches } from 'src/features/branches/useBranches'
import { useState } from 'react'
import type { ModalContainer } from './types'

interface SaveDraftModalProps {
  visible: boolean
  isSaving: boolean
  // Global admin must pick a branch; for non-admin staff this is null and not sent.
  onSave: (name: string, branchId: number | null) => void
  container?: ModalContainer
  onClose: () => void
  error?: Error | null
}

const NAME_MAX = 128

// Default suggestion: "Borrador 14/06/2026".
const suggestedName = () =>
  `Borrador ${new Date().toLocaleDateString('es-EC', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })}`

const SaveDraftModal = ({
  visible,
  isSaving,
  onSave,
  container,
  onClose,
  error,
}: SaveDraftModalProps) => {
  const [name, setName] = useState(suggestedName)

  const user = useCurrentUser()
  const isAdmin = useHasRole('administrador')
  const isGlobalBranch = useIsGlobalBranchRole()
  const { data: branches = [] } = useActiveBranches()

  // Admin: no pre-selection (required field). Non-admin: pre-selects their home branch.
  const defaultBranchId = isAdmin ? '' : String(user?.branchId ?? '')
  const [branchId, setBranchId] = useState(defaultBranchId)

  // Reset state each time the modal opens ("adjust state during render" pattern instead of an effect:
  // https://react.dev/learn/you-might-not-need-an-effect).
  const [wasVisible, setWasVisible] = useState(visible)
  if (visible !== wasVisible) {
    setWasVisible(visible)
    if (visible) {
      setName(suggestedName())
      setBranchId(defaultBranchId)
    }
  }

  const trimmed = name.trim()
  const canSave = trimmed.length > 0 && !isSaving && (!isAdmin || !!branchId)

  const branchError =
    error instanceof ApiError
      ? error.errors.find((e) => e.field === 'branchId')?.message
      : undefined

  const handleSave = () => {
    if (!canSave) return
    onSave(trimmed, isGlobalBranch && branchId ? Number(branchId) : null)
  }

  return (
    <CModal visible={visible} onClose={onClose} alignment="center" container={container}>
      <CModalHeader>
        <CModalTitle>Guardar borrador</CModalTitle>
      </CModalHeader>
      <CModalBody>
        <CFormLabel>Nombre del borrador</CFormLabel>
        <CFormInput
          autoFocus
          value={name}
          maxLength={NAME_MAX}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          placeholder="Ej.: Cocina familia Pérez"
        />
        {isGlobalBranch && (
          <>
            <CFormLabel className="mt-3">
              Sucursal {isAdmin && <span className="text-danger">*</span>}
            </CFormLabel>
            <CFormSelect
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              invalid={!!branchError}
            >
              <option value="">— Seleccionar sucursal —</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </CFormSelect>
            {branchError && <div className="invalid-feedback d-block">{branchError}</div>}
          </>
        )}
        <p className="text-body-secondary small mt-2 mb-0">
          Se guarda el estado actual (materiales y piezas) para retomarlo después.
        </p>
      </CModalBody>
      <CModalFooter>
        <CButton color="secondary" onClick={onClose}>
          Cancelar
        </CButton>
        <CButton color="primary" disabled={!canSave} onClick={handleSave}>
          {isSaving ? <CSpinner size="sm" /> : 'Guardar'}
        </CButton>
      </CModalFooter>
    </CModal>
  )
}

export default SaveDraftModal
