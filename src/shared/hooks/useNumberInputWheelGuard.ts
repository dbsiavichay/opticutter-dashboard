import { useEffect } from 'react'

// A focused <input type="number"> consumes the mouse wheel and steps its value. On a cut sheet that
// turns an idle scroll into a silently changed measurement, so the field loses focus instead: the
// value stays put and the page scrolls as the user expected. Blurring (rather than preventDefault)
// keeps the scroll working, which is what the gesture was for.
// Mounted once at the app root; covers every number input without touching call sites.
const useNumberInputWheelGuard = (): void => {
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      const el = document.activeElement
      if (el instanceof HTMLInputElement && el.type === 'number' && el === e.target) el.blur()
    }
    document.addEventListener('wheel', onWheel, { passive: true })
    return () => document.removeEventListener('wheel', onWheel)
  }, [])
}

export default useNumberInputWheelGuard
