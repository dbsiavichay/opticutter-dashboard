import { useEffect, useRef } from 'react'

// Every editor-wide keyboard shortcut, in one window listener. It used to live inside
// `MaterialGroups`, back when the controls it mirrored were in that card's header. The buttons are
// gone now — the shortcuts ARE the affordance for fullscreen and collapse-all, and the menu only
// documents them — so they belong to the page that owns the state, not to the list.

export interface EditorShortcuts {
  // Ctrl/Cmd+Z. Omitted when there is nothing to undo.
  onUndo?: () => void
  // Supr / Retroceso. Omitted when nothing is selected.
  onDeleteSelection?: () => void
  // Ctrl/Cmd+Shift+E
  onToggleCollapseAll?: () => void
  // Ctrl/Cmd+Shift+F. Omitted when the browser has no Fullscreen API.
  onToggleFullscreen?: () => void
  // Ctrl/Cmd+Enter — the "run it" idiom, and the only combo here that no browser claims. Only the
  // Optimización step passes it, which is also the only place the quick-entry input (where a bare
  // Enter adds a piece) is not on screen.
  onOptimize?: () => void
}

// Whether a keystroke is the user typing into a field, in which case the unmodified shortcuts must
// not fire. Checkboxes and radios are excluded on purpose: selecting a row leaves focus on its
// checkbox, and that is exactly when Delete should remove it.
export const isTextEntry = (el: EventTarget | null): boolean => {
  if (!(el instanceof HTMLElement)) return false
  const tag = el.tagName
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (tag !== 'INPUT') return false
  const type = (el as HTMLInputElement).type
  return type !== 'checkbox' && type !== 'radio'
}

export const useEditorShortcuts = (handlers: EditorShortcuts): void => {
  // Read through a ref so the listener can be mounted once. These are fresh closures on every
  // render, and the pieces editor re-renders on every keystroke in the grid — putting them in the
  // dependency array would re-subscribe the window listener on each one.
  const ref = useRef(handlers)
  useEffect(() => {
    ref.current = handlers
  })

  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      // A modal covers the editor: the expanded-sheet view pages with the keyboard, and silently
      // dropping rows behind it would be invisible until the modal closes.
      if (document.body.classList.contains('modal-open')) return
      const { onUndo, onDeleteSelection, onToggleCollapseAll, onToggleFullscreen, onOptimize } =
        ref.current
      const mod = e.ctrlKey || e.metaKey
      // With Shift held the browser reports the uppercase letter.
      const key = e.key.toLowerCase()

      if (mod && e.key === 'Enter' && onOptimize) {
        e.preventDefault()
        onOptimize()
        return
      }

      // The Ctrl/Cmd+Shift pair works while typing on purpose: both act on the whole workspace, and
      // the grid is nothing but input fields — guarding them would make them feel broken.
      if (mod && e.shiftKey) {
        if (key === 'f' && onToggleFullscreen) {
          e.preventDefault()
          onToggleFullscreen()
        } else if (key === 'e' && onToggleCollapseAll) {
          e.preventDefault()
          onToggleCollapseAll()
        }
        return
      }

      // These two do stay inert inside a field, so the browser's own undo and delete keep working
      // on the text being edited.
      if (isTextEntry(e.target)) return
      if (mod && key === 'z' && onUndo) {
        e.preventDefault()
        onUndo()
        return
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && onDeleteSelection) {
        e.preventDefault()
        onDeleteSelection()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])
}

export default useEditorShortcuts
