import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { CDropdown, CDropdownMenu, CDropdownToggle, CFormInput } from '@coreui/react'
import { normalizeText } from 'src/shared/utils/text'

export interface SelectOption {
  value: string
  label: string
  sublabel?: string // secondary text (e.g. code), also searchable
}

interface SearchableSelectProps {
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  disabled?: boolean
  size?: 'sm' | 'lg'
  // Optional action pinned under the list (e.g. "Seleccionar otro…" opening a full-catalog
  // picker). Both props must be set for it to render; the menu closes before it fires.
  footerLabel?: string
  onFooterClick?: () => void
  // Where to portal the menu. It defaults to document.body, which sits OUTSIDE an element handed to
  // the Fullscreen API — there the menu mounts but is never painted, so the select looks dead.
  // Callers inside a fullscreen host pass that host. Resolved once, on mount.
  container?: () => Element | null
}

// Text-filter combobox: select-style toggle + search input + filtered list. Replaces CFormSelect
// for long lists (CoreUI free does not ship a searchable select).
const SearchableSelect = ({
  value,
  options,
  onChange,
  placeholder = 'Seleccionar…',
  searchPlaceholder = 'Buscar…',
  emptyText = 'Sin resultados',
  disabled = false,
  size,
  footerLabel,
  onFooterClick,
  container,
}: SearchableSelectProps) => {
  const [visible, setVisible] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = options.find((o) => o.value === value)

  const filtered = useMemo(() => {
    const tokens = normalizeText(query).split(/\s+/).filter(Boolean)
    if (tokens.length === 0) return options
    return options.filter((o) => {
      const hay = normalizeText(`${o.label} ${o.sublabel ?? ''}`)
      return tokens.every((t) => hay.includes(t))
    })
  }, [options, query])

  // On open, focus the search input (filter is cleared in close()). `preventScroll` avoids
  // the page jumping to top: with `portal`, the menu mounts in document.body before Popper.js
  // positions it, so a plain focus() briefly targets a (0,0) element and triggers scroll-into-view.
  useEffect(() => {
    if (visible) inputRef.current?.focus({ preventScroll: true })
  }, [visible])

  const close = () => {
    setVisible(false)
    setQuery('')
  }

  const select = (val: string) => {
    onChange(val)
    close()
  }

  const onSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const first = filtered[0]
      if (first) select(first.value)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      close()
    }
  }

  const toggleLabel = selected
    ? selected.sublabel
      ? `${selected.label} (${selected.sublabel})`
      : selected.label
    : placeholder

  const sizeClass = size === 'sm' ? ' form-select-sm' : size === 'lg' ? ' form-select-lg' : ''

  return (
    <CDropdown
      variant="dropdown"
      autoClose="outside"
      visible={visible}
      onShow={() => setVisible(true)}
      onHide={close}
      portal
      container={container}
    >
      {/* `custom` clones this button and attaches the toggle, bypassing the .btn class (transparent border)
          so the grey form-select border appears like the rest of the form fields. */}
      <CDropdownToggle custom disabled={disabled}>
        <button
          type="button"
          disabled={disabled}
          className={`form-select text-start text-truncate${sizeClass}${
            selected ? '' : ' text-body-secondary'
          }`}
          style={{ width: '100%' }}
        >
          {toggleLabel}
        </button>
      </CDropdownToggle>
      {/* `zIndex` above the modal layer (CoreUI: backdrop 1050, modal 1055) and
          below popover/tooltip. The menu always portals OUT of its parent, so
          inside a modal it landed in the same host at the dropdown's default
          1000 — mounted, positioned, and painted underneath the dialog. Raising
          it is the fix rather than portaling into the modal body, which would
          clip the menu against that body's own scroll.

          The width cap is generous because these lists are product names
          ("Melamina Blanca Ranurada 2440x1220"): at 380 the label truncated on
          most rows and the picker stopped being readable. */}
      <CDropdownMenu style={{ minWidth: 260, maxWidth: 'min(560px, 92vw)', zIndex: 1060 }}>
        <div className="px-2 pt-1 pb-2">
          <CFormInput
            ref={inputRef}
            size="sm"
            value={query}
            placeholder={searchPlaceholder}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onSearchKeyDown}
          />
        </div>
        <div style={{ maxHeight: 240, overflowY: 'auto' }}>
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-body-secondary small">{emptyText}</div>
          ) : (
            filtered.map((o) => (
              <button
                key={o.value}
                type="button"
                className={`dropdown-item d-flex justify-content-between gap-2${
                  o.value === value ? ' active' : ''
                }`}
                onClick={() => select(o.value)}
              >
                <span className="text-truncate">{o.label}</span>
                {o.sublabel && <span className="small opacity-75">{o.sublabel}</span>}
              </button>
            ))
          )}
        </div>
        {footerLabel && onFooterClick && (
          <>
            <hr className="dropdown-divider" />
            {/* `autoClose="outside"` ignores clicks inside the menu, so close it by hand. */}
            <button
              type="button"
              className="dropdown-item text-primary"
              onClick={() => {
                close()
                onFooterClick()
              }}
            >
              {footerLabel}
            </button>
          </>
        )}
      </CDropdownMenu>
    </CDropdown>
  )
}

export default SearchableSelect
