import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { CFormInput, CInputGroup, CInputGroupText } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilSearch } from '@coreui/icons'
import { useDebounce } from 'src/shared/hooks/useDebounce'
import { SEARCH_DEBOUNCE_MS } from 'src/shared/constants'

interface SearchInputProps {
  // Called with the debounced value whenever the query settles.
  onChange: (value: string) => void
  // Optional controlled value: the settled query as the parent knows it (from the URL, or reset by
  // a "Limpiar filtros"). Leave it out for the uncontrolled behaviour.
  value?: string
  placeholder?: string
  delayMs?: number
  className?: string
  style?: CSSProperties
}

// Self-contained search box: an input + magnifier icon that debounces keystrokes
// (via useDebounce) before notifying the parent, so list pages don't reimplement it.
const SearchInput = ({
  onChange,
  value: controlled,
  placeholder,
  delayMs = SEARCH_DEBOUNCE_MS,
  className,
  style,
}: SearchInputProps) => {
  const [value, setValue] = useState(controlled ?? '')
  const debounced = useDebounce(value, delayMs)

  // Keep the latest onChange in a ref so the debounce effect below depends only on the
  // settled value, not on onChange's identity (which changes on every parent render).
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  })
  const isFirst = useRef(true)
  // The last value we handed to the parent. A controlled parent echoes it back one render later,
  // and without this guard that echo would overwrite whatever the user typed during the debounce
  // window — type "abc", wait 350ms, keep typing "d", and the echo of "abc" eats the "d".
  const lastEmitted = useRef(controlled ?? '')

  useEffect(() => {
    // Skip the initial empty value — parents already start from an empty query.
    if (isFirst.current) {
      isFirst.current = false
      return
    }
    lastEmitted.current = debounced
    onChangeRef.current(debounced)
  }, [debounced])

  // Only a change the parent made on its own (cleared filters, a restored URL, back/forward) resets
  // the field; our own echo is ignored.
  useEffect(() => {
    if (controlled !== undefined && controlled !== lastEmitted.current) {
      lastEmitted.current = controlled
      setValue(controlled)
    }
  }, [controlled])

  return (
    <CInputGroup className={className} style={style}>
      <CInputGroupText>
        <CIcon icon={cilSearch} />
      </CInputGroupText>
      <CFormInput
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
    </CInputGroup>
  )
}

export default SearchInput
