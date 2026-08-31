import { useState } from 'react'
import {
  CAlert,
  CButton,
  CFormCheck,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CModalBody,
  CModalFooter,
  CSpinner,
} from '@coreui/react'
import type { Role, User } from 'src/features/auth/types'
import type { UserPayload, UserUpdatePayload } from './types'
import { ApiError } from 'src/shared/api/types'
import { apiErrorMessage } from 'src/shared/api/errors'
import { useActiveBranches } from 'src/features/branches/useBranches'
import PasswordInput from 'src/shared/components/PasswordInput'

interface UserFormProps {
  user: User | null
  onSubmit: (data: UserPayload | UserUpdatePayload) => void
  onCancel: () => void
  isSubmitting: boolean
  error: Error | null
}

const ROLES: { value: Role; label: string }[] = [
  { value: 'administrador', label: 'Administrador' },
  { value: 'vendedor', label: 'Vendedor' },
  { value: 'operador', label: 'Operador' },
  { value: 'canteador', label: 'Canteador' },
]

const UserForm = ({ user, onSubmit, onCancel, isSubmitting, error }: UserFormProps) => {
  const isEdit = user !== null

  const [email, setEmail] = useState(user?.email ?? '')
  const [fullName, setFullName] = useState(user?.fullName ?? '')
  const [role, setRole] = useState<Role>(user?.role ?? 'vendedor')
  const [isActive, setIsActive] = useState(user?.isActive ?? true)
  const [password, setPassword] = useState('')
  const [branchId, setBranchId] = useState<number | null>(user?.branchId ?? null)

  // Admin is global: branch only applies (and is required) for vendedor/operador/canteador.
  const isStaff = role !== 'administrador'
  const { data: branches = [] } = useActiveBranches()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isEdit) {
      const payload: UserUpdatePayload = { email, fullName: fullName || undefined, role, isActive }
      if (password) payload.password = password
      if (isStaff) payload.branchId = branchId
      onSubmit(payload)
    } else {
      const payload: UserPayload = {
        email,
        password,
        role,
        fullName: fullName || undefined,
      }
      if (isStaff) payload.branchId = branchId
      onSubmit(payload)
    }
  }

  const branchError =
    error instanceof ApiError
      ? error.errors.find((e) => e.field === 'branchId')?.message
      : undefined

  const errorMsg = apiErrorMessage(error)

  return (
    <form onSubmit={handleSubmit}>
      <CModalBody>
        {errorMsg && (
          <CAlert color="danger" className="py-2">
            {errorMsg}
          </CAlert>
        )}

        <div className="mb-3">
          <CFormLabel htmlFor="uf-email">Email</CFormLabel>
          <CFormInput
            id="uf-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isSubmitting}
          />
        </div>

        <div className="mb-3">
          <CFormLabel htmlFor="uf-fullname">Nombre completo</CFormLabel>
          <CFormInput
            id="uf-fullname"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            disabled={isSubmitting}
          />
        </div>

        <div className="mb-3">
          <CFormLabel htmlFor="uf-role">Rol</CFormLabel>
          <CFormSelect
            id="uf-role"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            disabled={isSubmitting}
          >
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </CFormSelect>
        </div>

        {isStaff && (
          <div className="mb-3">
            <CFormLabel htmlFor="uf-branch">Sucursal</CFormLabel>
            <CFormSelect
              id="uf-branch"
              value={branchId == null ? '' : String(branchId)}
              onChange={(e) => setBranchId(e.target.value ? Number(e.target.value) : null)}
              required
              invalid={!!branchError}
              disabled={isSubmitting}
            >
              <option value="">— Seleccionar sucursal —</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </CFormSelect>
            {branchError && <div className="invalid-feedback d-block">{branchError}</div>}
          </div>
        )}

        <div className="mb-3">
          <CFormLabel htmlFor="uf-password">
            {isEdit ? 'Nueva contraseña (dejar en blanco para no cambiar)' : 'Contraseña'}
          </CFormLabel>
          <PasswordInput
            id="uf-password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required={!isEdit}
            minLength={8}
            placeholder={isEdit ? 'Dejar en blanco para no cambiar' : ''}
            disabled={isSubmitting}
          />
        </div>

        {isEdit && (
          <div className="mb-3">
            <CFormCheck
              id="uf-active"
              label="Cuenta activa"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              disabled={isSubmitting}
            />
          </div>
        )}
      </CModalBody>

      <CModalFooter>
        <CButton color="secondary" onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </CButton>
        <CButton color="primary" type="submit" disabled={isSubmitting}>
          {isSubmitting ? <CSpinner size="sm" /> : isEdit ? 'Guardar' : 'Crear'}
        </CButton>
      </CModalFooter>
    </form>
  )
}

export default UserForm
