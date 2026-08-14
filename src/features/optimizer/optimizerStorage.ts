import type { MaterialForm, RequirementForm } from './optimizerForm'
import type { AdditionalServiceInput } from './types'

// Optimizer autosave in localStorage: safety net against accidental page refresh. Stores a copy of
// the current session (this browser), complementary to named drafts on the server.
// The key is versioned; if the schema changes, bump the suffix and stale data is discarded on read.
const KEY = 'cutter:optimizer:autosave:v1'

export interface OptimizerAutosave {
  version: 1
  savedAt: number
  draftId: number | null
  draftName: string
  materials: MaterialForm[]
  requirements: RequirementForm[]
  // Billed additional services, stored in API shape (complete lines only — a half-typed row is not
  // worth restoring). Optional, and the version stays 1 on purpose: the field is purely additive, so
  // an older payload still loads, whereas bumping the key would throw away whatever work is sitting
  // in an open tab right now.
  services?: AdditionalServiceInput[]
}

export const loadAutosave = (): OptimizerAutosave | null => {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as OptimizerAutosave
    return data.version === 1 && Array.isArray(data.materials) ? data : null
  } catch {
    return null
  }
}

export const saveAutosave = (data: OptimizerAutosave): void => {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
  } catch {
    /* storage quota exceeded: ignore */
  }
}

export const clearAutosave = (): void => {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* noop */
  }
}
