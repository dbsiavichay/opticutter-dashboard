import { useId, useState, type ChangeEvent, type ReactNode } from 'react'
import { CButton, CFormInput, CInputGroup, CInputGroupText } from '@coreui/react'

interface PasswordInputProps {
  value: string
  onChange: (e: ChangeEvent<HTMLInputElement>) => void
  id?: string
  placeholder?: string
  autoComplete?: 'current-password' | 'new-password'
  required?: boolean
  minLength?: number
  disabled?: boolean
  invalid?: boolean
  className?: string
  // Leading addon, for the forms that already show one (the login's padlock).
  startIcon?: ReactNode
}

// The free CoreUI icon set ships `cilLowVision` but no plain eye, so the pair is
// drawn inline: `currentColor` keeps both states legible in either theme without
// adding an icon dependency for two glyphs.
const EyeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <path d="M8 3C4.4 3 1.4 5.2 0 8c1.4 2.8 4.4 5 8 5s6.6-2.2 8-5c-1.4-2.8-4.4-5-8-5zm0 8.5A3.5 3.5 0 1 1 8 4.5a3.5 3.5 0 0 1 0 7zm0-1.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
  </svg>
)

const EyeOffIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <path d="M13.36 11.65 2.35 2.4l.9-1.07 11.01 9.25-.9 1.07zM8 3c-1.06 0-2.06.19-2.98.52l1.5 1.26A3.5 3.5 0 0 1 11.5 8c0 .3-.04.6-.12.87l2.2 1.85A10.3 10.3 0 0 0 16 8c-1.4-2.8-4.4-5-8-5zm0 10c1.1 0 2.14-.2 3.08-.56l-1.51-1.27A3.5 3.5 0 0 1 4.5 8c0-.32.04-.62.13-.91L2.4 5.23A10.3 10.3 0 0 0 0 8c1.4 2.8 4.4 5 8 5z" />
  </svg>
)

// Password field with a reveal toggle. Always starts hidden — the visibility is
// per-render state and is deliberately never persisted, so a shared screen can't
// leak a password typed in an earlier session.
const PasswordInput = ({
  value,
  onChange,
  id,
  placeholder,
  autoComplete,
  required,
  minLength,
  disabled,
  invalid,
  className,
  startIcon,
}: PasswordInputProps) => {
  const [visible, setVisible] = useState(false)
  const fallbackId = useId()
  const inputId = id ?? fallbackId

  return (
    <CInputGroup className={className}>
      {startIcon && <CInputGroupText>{startIcon}</CInputGroupText>}
      <CFormInput
        id={inputId}
        type={visible ? 'text' : 'password'}
        placeholder={placeholder}
        autoComplete={autoComplete}
        value={value}
        onChange={onChange}
        required={required}
        minLength={minLength}
        disabled={disabled}
        invalid={invalid}
      />
      <CButton
        type="button"
        color="secondary"
        variant="outline"
        // Out of the tab order: the toggle is a convenience, and stopping between
        // every password field and the submit button is worse than reaching for it.
        tabIndex={-1}
        disabled={disabled}
        aria-controls={inputId}
        aria-pressed={visible}
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        title={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        onClick={() => setVisible((v) => !v)}
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </CButton>
    </CInputGroup>
  )
}

export default PasswordInput
