import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CForm,
  CFormLabel,
  CRow,
  CSpinner,
} from '@coreui/react'
import { ApiError } from 'src/shared/api/types'
import FieldError from 'src/shared/components/FieldError'
import PasswordInput from 'src/shared/components/PasswordInput'
import { useAuthStore } from 'src/shared/store/authStore'
import { useCurrentUser, useLogin } from 'src/features/auth/useAuth'
import { useChangePassword } from './useProfile'

const MIN_LENGTH = 8

type FieldKey = 'currentPassword' | 'newPassword' | 'confirmPassword'

// Maps the change-password error to per-field messages: 401 → wrong current password,
// 422 → backend field validation (body.<field>).
const serverFieldErrors = (error: Error | null): Record<string, string> => {
  if (!(error instanceof ApiError)) return {}
  if (error.status === 401) {
    return { currentPassword: error.errors[0]?.message ?? 'La contraseña actual es incorrecta.' }
  }
  const out: Record<string, string> = {}
  for (const e of error.errors) {
    if (!e.field) continue
    const key = e.field.replace(/^body\./, '')
    if (key === 'newPassword' || key === 'currentPassword') out[key] = e.message
  }
  return out
}

const ChangePasswordPage = () => {
  const navigate = useNavigate()
  const user = useCurrentUser()
  const changePassword = useChangePassword()
  const relogin = useLogin()
  const clearSession = useAuthStore((s) => s.clearSession)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({})

  const busy = changePassword.isPending || relogin.isPending

  const onChange =
    (key: FieldKey, setter: (v: string) => void) => (e: ChangeEvent<HTMLInputElement>) => {
      setter(e.target.value)
      setClientErrors((prev) => {
        if (!prev[key]) return prev
        const next = { ...prev }
        delete next[key]
        return next
      })
      changePassword.reset()
    }

  const validate = (): Record<string, string> => {
    const errors: Record<string, string> = {}
    if (!currentPassword) errors.currentPassword = 'Ingresa tu contraseña actual.'
    if (newPassword.length < MIN_LENGTH)
      errors.newPassword = `La nueva contraseña debe tener al menos ${MIN_LENGTH} caracteres.`
    if (confirmPassword !== newPassword) errors.confirmPassword = 'Las contraseñas no coinciden.'
    return errors
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!user) return
    const errors = validate()
    if (Object.keys(errors).length > 0) {
      setClientErrors(errors)
      return
    }
    setClientErrors({})
    changePassword.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          // The 204 revoked every refresh token (incl. ours). Re-login silently with the
          // new password to obtain a fresh, valid pair and keep the session alive.
          relogin.mutate(
            { email: user.email, password: newPassword },
            {
              onSuccess: () => void navigate('/profile', { state: { passwordChanged: true } }),
              onError: () => {
                clearSession()
                void navigate('/login')
              },
            },
          )
        },
      },
    )
  }

  const fieldErrors = { ...serverFieldErrors(changePassword.error), ...clientErrors }

  return (
    <CRow className="justify-content-center">
      <CCol xs={12} md={8} lg={5}>
        <CCard className="mb-4">
          <CCardHeader>
            <strong>Cambiar contraseña</strong>
          </CCardHeader>
          <CCardBody>
            <CForm onSubmit={handleSubmit}>
              <div className="mb-3">
                <CFormLabel>Contraseña actual</CFormLabel>
                <PasswordInput
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={onChange('currentPassword', setCurrentPassword)}
                  invalid={!!fieldErrors.currentPassword}
                  disabled={busy}
                />
                <FieldError name="currentPassword" errors={fieldErrors} />
              </div>

              <div className="mb-3">
                <CFormLabel>Nueva contraseña</CFormLabel>
                <PasswordInput
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={onChange('newPassword', setNewPassword)}
                  invalid={!!fieldErrors.newPassword}
                  minLength={MIN_LENGTH}
                  disabled={busy}
                />
                <FieldError name="newPassword" errors={fieldErrors} />
                <div className="form-text">Mínimo {MIN_LENGTH} caracteres.</div>
              </div>

              <div className="mb-4">
                <CFormLabel>Confirmar nueva contraseña</CFormLabel>
                <PasswordInput
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={onChange('confirmPassword', setConfirmPassword)}
                  invalid={!!fieldErrors.confirmPassword}
                  disabled={busy}
                />
                <FieldError name="confirmPassword" errors={fieldErrors} />
              </div>

              <div className="d-flex justify-content-end gap-2">
                <CButton
                  color="secondary"
                  variant="outline"
                  type="button"
                  disabled={busy}
                  onClick={() => void navigate('/profile')}
                >
                  Cancelar
                </CButton>
                <CButton color="primary" type="submit" disabled={busy}>
                  {busy ? <CSpinner size="sm" className="me-1" /> : null}
                  Actualizar contraseña
                </CButton>
              </div>
            </CForm>
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>
  )
}

export default ChangePasswordPage
