import type { PreOrderStatus } from './types'

// draft / sent / changes_requested: the quote is still open. It can be edited, it can carry a review
// link, and its expiry date still matters. Every other status is terminal.
//
// This list was written out three times — as `canEdit` on the detail page, as `ACTIVE_STATES` on the
// list page, and again in the review-link card's render condition — which is three places to forget
// when a status is added.
export const OPEN_STATES: PreOrderStatus[] = ['draft', 'sent', 'changes_requested']

export const isOpen = (status: PreOrderStatus) => OPEN_STATES.includes(status)

// Within three days of expiring, and still open: flagged in the list and in the detail header.
export const isExpiringSoon = (expiresAt: string | null | undefined, status: PreOrderStatus) => {
  if (!expiresAt || !isOpen(status)) return false
  const diff = new Date(expiresAt).getTime() - Date.now()
  return diff > 0 && diff <= 3 * 24 * 60 * 60 * 1000
}
