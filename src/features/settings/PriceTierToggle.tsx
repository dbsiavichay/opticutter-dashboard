import { CButton, CButtonGroup, CSpinner } from '@coreui/react'

import { usePriceTiers } from './usePriceTiers'

// Segmented picker for the price tier, for the one place that sits beside the totals it moves: the
// optimizer's Costos step. A dropdown there cost two clicks and hid the alternatives, and with the
// select pinned above a long table the user had to scroll up, change it, and scroll back down to
// read the result. There are only ever a handful of tiers, so they all fit on one row.
//
// `PriceTierSelect` (the plain CFormSelect) stays for the forms that need a field.

interface PriceTierToggleProps {
  value: string
  onChange: (code: string) => void
  disabled?: boolean
}

const PriceTierToggle = ({ value, onChange, disabled }: PriceTierToggleProps) => {
  const { data: tiers = [], isLoading } = usePriceTiers()

  if (isLoading) return <CSpinner size="sm" />

  // Retired tiers are hidden, except the one currently applied — a quote saved under it must still
  // show what it is rather than silently reading as "none of these".
  const shown = tiers.filter((t) => t.isActive || t.code === value)
  if (shown.length === 0) return null

  return (
    <CButtonGroup size="sm" role="group" aria-label="Nivel de precio">
      {shown.map((t) => {
        const active = t.code === value
        return (
          <CButton
            key={t.code}
            type="button"
            color="primary"
            variant={active ? undefined : 'outline'}
            active={active}
            aria-pressed={active}
            disabled={disabled}
            onClick={() => onChange(t.code)}
          >
            {t.name}
            {t.rate > 0 && (
              <span className={active ? 'ms-1' : 'ms-1 text-body-secondary'}>
                −{Math.round(t.rate * 100)}%
              </span>
            )}
          </CButton>
        )
      })}
    </CButtonGroup>
  )
}

export default PriceTierToggle
