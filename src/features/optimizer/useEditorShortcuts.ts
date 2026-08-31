import { useEffect, useRef } from 'react'

// Every editor-wide keyboard shortcut, in one window listener. It used to live inside
// `MaterialGroups`, back when the controls it mirrored were in that card's header. The buttons are
// gone now — the shortcuts ARE the affordance, and the menu only documents them — so they belong to
// the page that owns the state, not to the list.
//
// Combos ruled out because the browser keeps them and `preventDefault` cannot take them back:
// Ctrl+Shift+N (incognito), Ctrl+Shift+I/J/C (devtools), Ctrl+Shift+P (Firefox private window),
// Ctrl+N/T/W. Everything below is interceptable in Chrome, Firefox and Safari.

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
  // Costos step passes it, which is the step that owns the run. Safe there despite the service
  // lines being text inputs: Ctrl+Enter means nothing to a field, and the quick-entry input (where
  // a bare Enter adds a piece) is back on Despiece.
  onOptimize?: () => void
  // Ctrl/Cmd+F. Overriding the browser's own find is legitimate here and only here: every value in
  // the pieces grid lives in an `<input>`, and find-in-page does not match input values — so the key
  // the user reaches for finds literally nothing today.
  onFind?: () => void
  // Ctrl/Cmd+I
  onImport?: () => void
  // Ctrl/Cmd+Shift+S
  onExport?: () => void
  // Ctrl/Cmd+Alt+N
  onNew?: () => void
  // Ctrl/Cmd+O
  onOpenDrafts?: () => void
  // Ctrl/Cmd+S
  onSaveDraft?: () => void
  // Alt+← / Alt+→. Unlike the rest these stay inert inside a field — see the guard below.
  onPrevStep?: () => void
  onNextStep?: () => void
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
      const {
        onUndo,
        onDeleteSelection,
        onToggleCollapseAll,
        onToggleFullscreen,
        onOptimize,
        onFind,
        onImport,
        onExport,
        onNew,
        onOpenDrafts,
        onSaveDraft,
        onPrevStep,
        onNextStep,
      } = ref.current
      const mod = e.ctrlKey || e.metaKey
      // With Shift held the browser reports the uppercase letter.
      const key = e.key.toLowerCase()

      if (mod && e.key === 'Enter' && onOptimize) {
        e.preventDefault()
        onOptimize()
        return
      }

      // Everything from here to the `isTextEntry` guard acts on the whole workspace rather than on
      // the text under the cursor, so it fires while typing on purpose: the grid is nothing but
      // input fields, and guarding these would make them feel broken.
      if (mod && e.altKey) {
        // `e.code`, not `e.key`: on macOS Alt+N is a dead key and `e.key` arrives as "˜".
        if (e.code === 'KeyN' && onNew) {
          e.preventDefault()
          onNew()
        }
        return
      }

      if (mod && e.shiftKey) {
        if (key === 'f' && onToggleFullscreen) {
          e.preventDefault()
          onToggleFullscreen()
        } else if (key === 'e' && onToggleCollapseAll) {
          e.preventDefault()
          onToggleCollapseAll()
        } else if (key === 's' && onExport) {
          e.preventDefault()
          onExport()
        }
        return
      }

      if (mod) {
        if (key === 's' && onSaveDraft) {
          e.preventDefault()
          onSaveDraft()
          return
        }
        if (key === 'o' && onOpenDrafts) {
          e.preventDefault()
          onOpenDrafts()
          return
        }
        if (key === 'i' && onImport) {
          e.preventDefault()
          onImport()
          return
        }
        if (key === 'f' && onFind) {
          e.preventDefault()
          onFind()
          return
        }
      }

      // These stay inert inside a field, so the browser's own undo, delete and word-jump keep
      // working on the text being edited. Alt+←/→ is here rather than above for that last reason:
      // on macOS it moves the caret by word, which a pieces grid full of inputs needs.
      if (isTextEntry(e.target)) return
      if (mod && key === 'z' && onUndo) {
        e.preventDefault()
        onUndo()
        return
      }
      if (e.altKey && !mod) {
        if (e.key === 'ArrowLeft' && onPrevStep) {
          e.preventDefault()
          onPrevStep()
          return
        }
        if (e.key === 'ArrowRight' && onNextStep) {
          e.preventDefault()
          onNextStep()
          return
        }
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
