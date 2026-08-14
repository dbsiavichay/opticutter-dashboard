// Shortcut hints, named for the keyboard in front of the user.
//
// The shortcuts themselves are identical on every platform — the handlers test
// `e.ctrlKey || e.metaKey`, so Ctrl and ⌘ both work — so ONLY the labels branch here. The app runs
// mostly on Windows, where printing ⌥ or ⌘ names keys that keyboard does not have; on a Mac the
// reverse is true, and "Ctrl+Alt+N" reads as someone else's app.
//
// Read once at module load: the platform does not change mid-session.
const isMac = /Mac|iPhone|iPad|iPod/i.test(
  typeof navigator === 'undefined' ? '' : navigator.userAgent,
)

// Modifier names for shortcut hints. Compose them: `${KEY.mod}+${KEY.shift}+S`.
export const KEY = {
  /** Ctrl on Windows/Linux, ⌘ on macOS — the handlers treat them as the same key. */
  mod: isMac ? '⌘' : 'Ctrl',
  alt: isMac ? '⌥' : 'Alt',
  shift: isMac ? '⇧' : 'Shift',
  enter: isMac ? '↵' : 'Enter',
} as const
