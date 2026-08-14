import { CFormSelect } from '@coreui/react'
import { usePriceTiers } from './usePriceTiers'

interface PriceTierSelectProps {
  value: string
  onChange: (code: string) => void
  disabled?: boolean
  invalid?: boolean
  // For callers that label the select from outside instead of stacking a CFormLabel above it.
  id?: string
}

const PriceTierSelect = ({ value, onChange, disabled, invalid, id }: PriceTierSelectProps) => {
  const { data: tiers = [], isLoading } = usePriceTiers()

  return (
    <CFormSelect
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled || isLoading}
      invalid={invalid}
    >
      {tiers.map((t) => (
        <option key={t.code} value={t.code}>
          {t.name}
        </option>
      ))}
    </CFormSelect>
  )
}

export default PriceTierSelect
