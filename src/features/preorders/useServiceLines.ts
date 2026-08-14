import { useState } from 'react'

import type { AdditionalServiceInput, PricingData } from 'src/features/optimizer/types'

// Editable state for the billed additional services (perforación, armado, instalación…), shared by
// the two places that compose a quote: the optimizer's Costos step and the pre-order detail page.
// It used to live inline in the pre-order page, which is why the optimizer had no services at all —
// a quote born in the wizard started empty and could only get them after the fact.
//
// Services are not cut geometry: they never reach the optimizer, and the backend folds them into the
// total *after* the tier discount, undiscounted (`optimizations/pricing.py`). That is what lets the
// wizard preview the total without a round trip — see `servicesTotal` below.

// --- Form model (during editing; numbers may be '' while the user is typing) ---

export interface ServiceLineForm {
  uid: string
  serviceId: string // catalog id ('' = not picked yet)
  name: string // snapshot of the service name (from the catalog on pick)
  unitPrice: number | string
  quantity: number | string
}

let seq = 0
const nextServiceUid = () => `svc-${(seq++).toString(36)}-${Math.random().toString(36).slice(2, 7)}`

export const emptyServiceLine = (): ServiceLineForm => ({
  uid: nextServiceUid(),
  serviceId: '',
  name: '',
  unitPrice: '',
  quantity: 1,
})

// Rebuilds editable form state from stored API lines (a saved pre-order, or an optimizer draft).
export const serviceLineFromApi = (s: AdditionalServiceInput): ServiceLineForm => ({
  uid: nextServiceUid(),
  serviceId: s.serviceId != null ? String(s.serviceId) : '',
  name: s.name,
  unitPrice: s.unitPrice,
  quantity: s.quantity,
})

const isServiceValid = (s: ServiceLineForm): boolean =>
  s.name.trim().length > 0 && Number(s.unitPrice) >= 0 && Number(s.quantity) > 0

// Builds the API contract from form state; drops incomplete rows.
export const buildServiceLines = (lines: ServiceLineForm[]): AdditionalServiceInput[] =>
  lines.filter(isServiceValid).map((s) => ({
    ...(s.serviceId ? { serviceId: Number(s.serviceId) } : {}),
    name: s.name.trim(),
    unitPrice: Number(s.unitPrice) || 0,
    quantity: Number(s.quantity) || 1,
  }))

// Sum of the complete lines, rounded the way the backend rounds it, so the wizard's preview total
// matches the one the server returns once the pre-order exists. Only valid rows count — a half-typed
// row must not move the total the user is reading.
export const servicesTotal = (lines: ServiceLineForm[]): number =>
  Math.round(buildServiceLines(lines).reduce((sum, s) => sum + s.unitPrice * s.quantity, 0) * 100) /
  100

// Folds the services into a quote's pricing for display. `/optimize` takes no services — they are
// not cut geometry, and feeding them in would churn its input hash for a number it does not compute
// — so the wizard adds them here to show the real total before the pre-order exists.
//
// This is exact rather than an estimate, which is the only reason it is allowed: the backend also
// adds the services *after* the tier discount and never discounts them, so `total + servicesTotal`
// is arithmetically the same figure the pre-order comes back with.
export const pricingWithServices = (
  pricing: PricingData,
  lines: ServiceLineForm[],
): PricingData => {
  const total = servicesTotal(lines)
  if (total === 0) return pricing
  return {
    ...pricing,
    servicesTotal: total,
    total: Math.round((pricing.total + total) * 100) / 100,
  }
}

export interface ServiceLinesEditor {
  lines: ServiceLineForm[]
  set: (lines: ServiceLineForm[]) => void
  add: () => void
  update: <K extends keyof ServiceLineForm>(
    uid: string,
    field: K,
    value: ServiceLineForm[K],
  ) => void
  remove: (uid: string) => void
}

// `initial` is a factory, as `useState`'s is: rebuilding the rows from the API mints a fresh uid per
// line, and a plain value would do that on every render only to throw the result away.
export const useServiceLines = (initial?: () => ServiceLineForm[]): ServiceLinesEditor => {
  const [lines, setLines] = useState<ServiceLineForm[]>(initial ?? [])

  return {
    lines,
    set: setLines,
    add: () => setLines((ss) => [...ss, emptyServiceLine()]),
    update: (uid, field, value) =>
      setLines((ss) => ss.map((s) => (s.uid === uid ? { ...s, [field]: value } : s))),
    remove: (uid) => setLines((ss) => ss.filter((s) => s.uid !== uid)),
  }
}

export default useServiceLines
