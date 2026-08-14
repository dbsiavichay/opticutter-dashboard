import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCol,
  CContainer,
  CForm,
  CFormInput,
  CInputGroup,
  CInputGroupText,
  CRow,
  CSpinner,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilEnvelopeClosed, cilLockLocked } from '@coreui/icons'
import { useLogin } from './useAuth'
import { logo } from 'src/assets/brand/logo'
import { sygnet } from 'src/assets/brand/sygnet'
import { ApiError } from 'src/shared/api/types'

const LoginPage = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: { pathname?: string } })?.from?.pathname ?? '/'

  const login = useLogin()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    login.mutate({ email, password }, { onSuccess: () => void navigate(from, { replace: true }) })
  }

  const errorMsg =
    login.error instanceof ApiError
      ? (login.error.errors[0]?.message ?? login.error.message)
      : login.error
        ? 'Error inesperado. Intente nuevamente.'
        : null

  return (
    <div className="bg-body-tertiary min-vh-100 d-flex flex-row align-items-center">
      <CContainer>
        <CRow className="justify-content-center">
          <CCol md={5} lg={4}>
            {/* The full letterhead lockup — isotype over wordmark — rather than the wordmark alone
                the header and the review page use. This is the one screen with room for it, and the
                first thing anyone sees of the app. */}
            <div className="text-center mb-4">
              <CIcon icon={sygnet} height={56} className="d-block mx-auto mb-3" />
              <CIcon icon={logo} height={44} />
            </div>
            <CCard className="p-4">
              <CCardBody>
                <CForm onSubmit={handleSubmit}>
                  <h1>Iniciar sesión</h1>
                  <p className="text-body-secondary mb-4">Ingresa con tu cuenta</p>

                  {errorMsg && (
                    <CAlert color="danger" className="py-2">
                      {errorMsg}
                    </CAlert>
                  )}

                  <CInputGroup className="mb-3">
                    <CInputGroupText>
                      <CIcon icon={cilEnvelopeClosed} />
                    </CInputGroupText>
                    <CFormInput
                      type="email"
                      placeholder="Email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={login.isPending}
                    />
                  </CInputGroup>

                  <CInputGroup className="mb-4">
                    <CInputGroupText>
                      <CIcon icon={cilLockLocked} />
                    </CInputGroupText>
                    <CFormInput
                      type="password"
                      placeholder="Contraseña"
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={login.isPending}
                    />
                  </CInputGroup>

                  <CButton
                    color="primary"
                    type="submit"
                    className="w-100"
                    disabled={login.isPending}
                  >
                    {login.isPending ? <CSpinner size="sm" /> : 'Entrar'}
                  </CButton>
                </CForm>
              </CCardBody>
            </CCard>
          </CCol>
        </CRow>
      </CContainer>
    </div>
  )
}

export default LoginPage
