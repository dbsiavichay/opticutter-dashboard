import { useCallback, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent, PointerEvent, ReactNode } from 'react'

interface SplitPaneProps {
  left: ReactNode
  right: ReactNode
  // localStorage key for the remembered ratio. Versioned like the other optimizer keys.
  storageKey: string
  // Left pane width as a percentage, used the first time (no stored value yet).
  defaultLeft?: number
  // Accessible name for the divider.
  label?: string
}

// Keeps both panes wide enough to stay usable: the pieces grid needs room for 12 columns, the
// diagram needs enough to read the piece labels.
const MIN_PCT = 30
const MAX_PCT = 75
const KEY_STEP = 2

const clampPct = (n: number) => Math.max(MIN_PCT, Math.min(MAX_PCT, n))

const loadPct = (key: string, fallback: number): number => {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    const n = Number(raw)
    return Number.isFinite(n) ? clampPct(n) : fallback
  } catch {
    return fallback
  }
}

const savePct = (key: string, pct: number): void => {
  try {
    localStorage.setItem(key, String(pct))
  } catch {
    /* storage quota exceeded / private mode: the ratio just won't persist */
  }
}

// Two panes with a divider the user drags to trade width between them. Grid columns live in
// `.optimizer-split` (scss); this only feeds it the left width and handles the drag. Below `lg` the
// stylesheet stacks the panes and hides the divider, so the ratio is inert there.
const SplitPane = ({
  left,
  right,
  storageKey,
  defaultLeft = 58,
  label = 'Ajustar ancho de los paneles',
}: SplitPaneProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [leftPct, setLeftPct] = useState(() => loadPct(storageKey, defaultLeft))
  const [dragging, setDragging] = useState(false)

  const commit = useCallback(
    (pct: number) => {
      const next = clampPct(pct)
      setLeftPct(next)
      savePct(storageKey, next)
    },
    [storageKey],
  )

  // Same Pointer Events shape as the grid's fill handle: capture on the divider so the drag survives
  // the pointer leaving it, and read the ratio off the container's box.
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragging(true)
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragging) return
    const box = containerRef.current?.getBoundingClientRect()
    if (!box || box.width === 0) return
    setLeftPct(clampPct(((e.clientX - box.left) / box.width) * 100))
  }

  const endDrag = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragging) return
    e.currentTarget.releasePointerCapture(e.pointerId)
    setDragging(false)
    commit(leftPct)
  }

  // Keyboard equivalent: the divider is focusable, so the ratio is reachable without a pointer.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      commit(leftPct - KEY_STEP)
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      commit(leftPct + KEY_STEP)
    }
  }

  return (
    <div
      ref={containerRef}
      className="optimizer-split"
      style={{ '--split-left': `${leftPct}%` } as CSSProperties}
    >
      <div>{left}</div>
      <div
        className={`optimizer-split-divider${dragging ? ' is-dragging' : ''}`}
        role="separator"
        aria-orientation="vertical"
        aria-label={label}
        aria-valuenow={Math.round(leftPct)}
        aria-valuemin={MIN_PCT}
        aria-valuemax={MAX_PCT}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
      />
      <div>{right}</div>
    </div>
  )
}

export default SplitPane
