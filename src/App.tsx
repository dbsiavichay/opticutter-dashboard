import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import useUIStore from 'src/shared/store/uiStore'
import { useAuthStore } from 'src/shared/store/authStore'
import { authApi } from 'src/features/auth/authApi'
import useNumberInputWheelGuard from 'src/shared/hooks/useNumberInputWheelGuard'

import { CSpinner, useColorModes } from '@coreui/react'
import './scss/style.scss'

import { authRoutes } from 'src/features/auth/routes'
import { reviewRoutes } from 'src/features/review/routes'

// Public routes rendered standalone (without the admin layout).
const publicRoutes = [...authRoutes, ...reviewRoutes]

const DefaultLayout = lazy(() => import('src/shared/layout/DefaultLayout'))

const SESSION_FRESHNESS_CHECK_MS = 5 * 60 * 1000

const SessionRestorer = () => {
  const { status, setUser, setStatus, clearSession } = useAuthStore()

  useEffect(() => {
    if (status !== 'loading') return
    authApi
      .me()
      .then((user) => {
        setUser(user)
        setStatus('authenticated')
      })
      .catch(() => clearSession())
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // A tab left open across midnight keeps a valid access token for up to 30 min
  // after the day rolls over. Re-check the login date on focus and periodically so
  // it gets bounced to /login without waiting for the next API call to 401.
  useEffect(() => {
    if (status !== 'authenticated') return
    const check = () => useAuthStore.getState().ensureFreshSession()
    const onVisibility = () => {
      if (document.visibilityState === 'visible') check()
    }
    document.addEventListener('visibilitychange', onVisibility)
    const interval = setInterval(check, SESSION_FRESHNESS_CHECK_MS)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      clearInterval(interval)
    }
  }, [status])

  return null
}

const RequireAuth = ({ children }: { children: React.ReactNode }) => {
  const status = useAuthStore((s) => s.status)
  const location = useLocation()

  if (status === 'idle' || status === 'loading') {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center">
        <CSpinner color="primary" />
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}

const App = () => {
  const { isColorModeSet, setColorMode } = useColorModes('coreui-free-react-admin-template-theme')
  const storedTheme = useUIStore((state) => state.theme)

  // Public routes included: the review page has number inputs too.
  useNumberInputWheelGuard()

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const rawTheme = urlParams.get('theme')
    const theme = rawTheme?.match(/^[A-Za-z0-9\s]+/)?.[0]
    if (theme) {
      setColorMode(theme)
    }

    if (isColorModeSet()) {
      return
    }

    setColorMode(storedTheme)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <BrowserRouter>
      <SessionRestorer />
      <Suspense
        fallback={
          <div className="pt-3 text-center">
            <CSpinner color="primary" variant="grow" />
          </div>
        }
      >
        <Routes>
          {publicRoutes.map((route) => {
            const Element = route.element
            return Element ? (
              <Route key={route.path} path={route.path} element={<Element />} />
            ) : null
          })}
          <Route
            path="*"
            element={
              <RequireAuth>
                <DefaultLayout />
              </RequireAuth>
            }
          />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default App
