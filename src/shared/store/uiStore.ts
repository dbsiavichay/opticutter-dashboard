import { create } from 'zustand'

export type Theme = 'light' | 'dark' | 'auto'

interface UIState {
  sidebarShow: boolean
  sidebarUnfoldable: boolean
  theme: Theme
  setSidebarShow: (value: boolean) => void
  setSidebarUnfoldable: (value: boolean) => void
  setTheme: (value: Theme) => void
}

const SIDEBAR_UNFOLDABLE_KEY = 'cutter.ui.sidebarUnfoldable'

// Absent = first visit: start narrow. The wide sidebar costs 16rem that the
// twelve-column pieces tables on the `fluid` pages need more than the nav does.
const storedUnfoldable = localStorage.getItem(SIDEBAR_UNFOLDABLE_KEY)

const useUIStore = create<UIState>((set) => ({
  // Not persisted: this is mobile visibility, and must start open every load.
  sidebarShow: true,
  sidebarUnfoldable: storedUnfoldable === null ? true : storedUnfoldable === 'true',
  // Not persisted here: CoreUI already stores the color mode itself, under
  // 'coreui-free-react-admin-template-theme' (see App.tsx).
  theme: 'light',

  setSidebarShow: (value) => set({ sidebarShow: value }),

  setSidebarUnfoldable: (value) => {
    localStorage.setItem(SIDEBAR_UNFOLDABLE_KEY, String(value))
    set({ sidebarUnfoldable: value })
  },

  setTheme: (value) => set({ theme: value }),
}))

export default useUIStore
