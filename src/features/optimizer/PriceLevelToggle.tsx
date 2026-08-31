import { CButton, CButtonGroup } from '@coreui/react'

// The three sale prices the catalog carries per product. Fixed in code, not
// fetched: they are columns of the vendor's inventory (ven/pv2/pv3), not a
// configurable list of discounts, so there is nothing to look up. Level 1 is the
// list price — what every unmarked board, tapacanto, retazo and medida manual
// bills at.
export const PRICE_LEVELS = [
  { level: 1, name: 'Precio 1' },
  { level: 2, name: 'Precio 2' },
  { level: 3, name: 'Precio 3' },
] as const

interface PriceLevelToggleProps {
  value: number
  onChange: (level: number) => void
  disabled?: boolean
}

const PriceLevelToggle = ({ value, onChange, disabled }: PriceLevelToggleProps) => (
  <CButtonGroup size="sm" role="group" aria-label="Nivel de precio">
    {PRICE_LEVELS.map((t) => {
      const active = t.level === value
      return (
        <CButton
          key={t.level}
          type="button"
          color="primary"
          variant={active ? undefined : 'outline'}
          active={active}
          aria-pressed={active}
          disabled={disabled}
          onClick={() => onChange(t.level)}
        >
          {t.name}
        </CButton>
      )
    })}
  </CButtonGroup>
)

export default PriceLevelToggle
