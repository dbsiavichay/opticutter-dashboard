import { useCallback, useEffect, useRef } from 'react'

// A horizontal swipe for paging between records on a touch screen.
//
// Pointer events rather than touch events, for two reasons: it is the idiom this codebase already
// speaks (`useZoomPan`), and it is what lets `pointerType` be filtered — without that, a mouse drag
// on the administrador's desktop would page the dialog under them.

// How far the finger must travel before the gesture counts. About a thumb's comfortable arc, and
// well past anything an accidental drag produces.
const SWIPE_MIN_PX = 72
// How much more horizontal than vertical the movement has to be. The axis lock is not optional:
// anything this rides on also scrolls vertically, and without it a diagonal scroll changes the
// record under the reader — the classic failure of a hand-rolled swipe.
const AXIS_DOMINANCE = 1.5
// Below this the direction is still noise, so the lock waits rather than guessing.
const AXIS_DEADZONE_PX = 10

interface SwipeNavOptions {
  // Swipe right: the content follows the finger, bringing the previous record in from the left.
  onPrev?: () => void
  onNext?: () => void
  enabled?: boolean
}

export const useSwipeNav = ({ onPrev, onNext, enabled = true }: SwipeNavOptions) => {
  // The listeners bind once, when the node mounts, and read the current handlers through this.
  // Putting the handlers in a dependency array instead would rebind on every parent render — and the
  // queue this pages through polls, so a refetch mid-gesture would tear the swipe down halfway.
  const handlers = useRef({ onPrev, onNext, enabled })
  useEffect(() => {
    handlers.current = { onPrev, onNext, enabled }
  }, [onPrev, onNext, enabled])

  const detach = useRef<(() => void) | null>(null)

  // A CALLBACK ref, not a `useRef` read inside an effect. `CModal` mounts its content through a
  // transition, so on the render where the dialog opens the effect runs while the node still does
  // not exist: `ref.current` is null, the listeners are never bound, and the gesture silently does
  // nothing forever. A ref callback fires exactly when the node attaches, whenever that is.
  return useCallback((el: HTMLDivElement | null) => {
    detach.current?.()
    detach.current = null
    if (!el) return

    let startX = 0
    let startY = 0
    let pointerId: number | null = null
    // null while the direction is still undecided, 'x' once it is ours, 'y' once it is the
    // scroller's — and from 'y' the gesture never comes back.
    let axis: 'x' | 'y' | null = null

    const reset = () => {
      pointerId = null
      axis = null
    }

    // A gesture that starts inside something with its own horizontal scroll belongs to that element.
    // Nothing here overflows today (the tables wrap), but a table that grows a scrollbar must not
    // silently start stealing page turns.
    const overHorizontalScroller = (target: EventTarget | null): boolean => {
      let node = target instanceof Element ? target : null
      while (node && node !== el) {
        if (node.scrollWidth > node.clientWidth + 1) {
          const { overflowX } = getComputedStyle(node)
          if (overflowX === 'auto' || overflowX === 'scroll') return true
        }
        node = node.parentElement
      }
      return false
    }

    const onDown = (e: PointerEvent) => {
      if (!handlers.current.enabled || e.pointerType === 'mouse') return
      if (overHorizontalScroller(e.target)) return
      pointerId = e.pointerId
      startX = e.clientX
      startY = e.clientY
      axis = null
    }

    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== pointerId || axis !== null) return
      const dx = Math.abs(e.clientX - startX)
      const dy = Math.abs(e.clientY - startY)
      if (dx < AXIS_DEADZONE_PX && dy < AXIS_DEADZONE_PX) return
      axis = dx > dy * AXIS_DOMINANCE ? 'x' : 'y'
    }

    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return
      const dx = e.clientX - startX
      if (axis === 'x' && Math.abs(dx) >= SWIPE_MIN_PX) {
        if (dx < 0) handlers.current.onNext?.()
        else handlers.current.onPrev?.()
      }
      reset()
    }

    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', reset)
    detach.current = () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', reset)
    }
  }, [])
}
