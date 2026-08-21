import type { ReactNode } from 'react'
import { CBadge, CDropdown, CDropdownMenu, CDropdownToggle } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilFilter } from '@coreui/icons'

interface FilterMenuProps {
  // Total count across every field inside, shown as a badge on the toggle —
  // the whole point of collapsing several filters behind one button is that
  // their state must still be visible without opening it.
  activeCount: number
  onClear: () => void
  children: ReactNode
}

// One "Filtros" button holding several filter fields (each typically a
// labeled FilterCheckboxList section) in a single panel, instead of one
// dropdown per field cluttering the toolbar. Meant for list pages whose
// filters have outgrown a couple of inline controls; the search box stays
// outside it, on the toolbar, since that's the one every visit uses.
const FilterMenu = ({ activeCount, onClear, children }: FilterMenuProps) => (
  <CDropdown variant="dropdown" autoClose="outside">
    <CDropdownToggle
      color="secondary"
      variant="outline"
      className="d-flex align-items-center gap-2"
    >
      <CIcon icon={cilFilter} />
      Filtros
      {activeCount > 0 && (
        <CBadge color="primary" shape="rounded-pill">
          {activeCount}
        </CBadge>
      )}
    </CDropdownToggle>
    <CDropdownMenu style={{ minWidth: 260, maxWidth: 340, padding: '0.5rem 0' }}>
      <div style={{ maxHeight: 420, overflowY: 'auto' }}>{children}</div>
      {activeCount > 0 && (
        <>
          <hr className="dropdown-divider" />
          <button type="button" className="dropdown-item text-primary" onClick={onClear}>
            Limpiar filtros
          </button>
        </>
      )}
    </CDropdownMenu>
  </CDropdown>
)

export default FilterMenu
