import { useEffect, useState } from 'react'
import CIcon from '@coreui/icons-react'

import { logo } from 'src/assets/brand/logo'
import { accentFor } from './groupColors'

// Cover for the results pane while /optimize runs. A real shop job (200-350 pieces, several
// materials) takes tens of seconds on the VPS, and the seller is quoting with the client standing
// there — a 12px spinner inside a button reads as "nothing happened". So the wait gets a face: a
// board that fills up with pieces, the wordmark, what the engine is doing and how long it has been
// at it. The elapsed counter is the honest part: it says the app is alive even when the stage text
// has stopped changing.

// A plausible guillotine layout on a 200×120 sheet: three rips, the last strip full-width, and a
// leftover down the right — the same shape the real diagram draws.
const PIECES = [
  { x: 6, y: 6, w: 56, h: 52 },
  { x: 66, y: 6, w: 56, h: 52 },
  { x: 126, y: 6, w: 68, h: 52 },
  { x: 6, y: 62, w: 40, h: 34 },
  { x: 50, y: 62, w: 40, h: 34 },
  { x: 94, y: 62, w: 52, h: 34 },
  { x: 6, y: 100, w: 140, h: 14 },
]

// Seconds → what the engine is plausibly doing. Not progress (the search has no percentage), just
// enough narration that a long wait does not look like a hang.
const STAGES: { at: number; text: string }[] = [
  { at: 0, text: 'Preparando las piezas…' },
  { at: 3, text: 'Probando combinaciones…' },
  { at: 10, text: 'Buscando el mejor aprovechamiento…' },
  { at: 25, text: 'Afinando el corte…' },
]

const stageText = (elapsed: number): string => {
  let text = 'Optimizando…'
  for (const stage of STAGES) if (elapsed >= stage.at) text = stage.text
  return text
}

const OptimizingOverlay = () => {
  const [elapsed, setElapsed] = useState(0)

  // Mounted only while the mutation is pending, so the count starts at the click.
  useEffect(() => {
    const id = setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="optimizing-overlay" role="status" aria-live="polite">
      <div className="optimizing-card">
        <svg className="optimizing-board" viewBox="0 0 200 120" aria-hidden="true">
          <rect className="optimizing-sheet" x="0.5" y="0.5" width="199" height="119" rx="3" />
          {PIECES.map((p, i) => (
            <rect
              key={i}
              className="optimizing-piece"
              x={p.x}
              y={p.y}
              width={p.w}
              height={p.h}
              rx="1.5"
              fill={accentFor(i)}
              style={{ animationDelay: `${i * 0.18}s` }}
            />
          ))}
          <rect className="optimizing-saw" x="0" y="0" width="2" height="120" />
        </svg>
        <CIcon customClassName="optimizing-logo" icon={logo} height={24} />
        <div className="optimizing-stage">{stageText(elapsed)}</div>
        <div className="optimizing-elapsed">{elapsed} s</div>
      </div>
    </div>
  )
}

export default OptimizingOverlay
