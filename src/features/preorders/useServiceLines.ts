import { useState } from 'react'

import type { AdditionalServiceInput, PricingData } from 'src/features/optimizer/types'

// Editable state for the billed additional services (perforación, armado, instalación…), shared by
// the two places that compose a quote: the optimizer's Costos step and the pre-order detail page.
// It used to live inline in the pre-order page, which is why the optimizer had no services at all —
// a quote born in the wizard started empty and could only get them after the fact.
//
// Services are not cut geometry: they never reach the optimizer, and the backend folds them into the
// net subtotal, converting them out of tax first (`optimizations/pricing.py`). That is what lets the
// wizard preview the total without a round trip — see `pricingWithServices` below.

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

const round2 = (n: number) => Math.round(n * 100) / 100

// Sum of the complete lines AS TYPED, i.e. tax included — that is how staff registers a service
// price, and it is what the editor's own running total shows. Only valid rows count: a half-typed
// row must not move the number the user is reading.
export const servicesTotal = (lines: ServiceLineForm[]): number =>
  round2(buildServiceLines(lines).reduce((sum, s) => sum + s.unitPrice * s.quantity, 0))

// The same sum NET of tax, which is what reaches a document: every other line on a quote is net, so
// the services convert too and one IVA line then covers the whole thing. Rounded per line, exactly
// as `build_pricing` does it, so the column adds up to the subtotal on both sides.
export const servicesNetTotal = (lines: ServiceLineForm[], taxRate: number): number =>
  round2(
    buildServiceLines(lines).reduce(
      (sum, s) => sum + round2((s.unitPrice * s.quantity) / (1 + taxRate)),
      0,
    ),
  )

// Folds the services into a quote's pricing for display. `/optimize` takes no services — they are
// not cut geometry, and feeding them in would churn its input hash for a number it does not compute
// — so the wizard adds them here to show the real total before the pre-order exists.
//
// It therefore assumes `pricing` carries NO services yet, which holds for both callers (they pass a
// raw `/optimize` result); the pre-order detail page reads the server's own figures instead.
//
// The services are taxable like everything else, so they join the SUBTOTAL and the tax is
// recomputed over it — adding them to an already-taxed total would undercharge the IVA on them.
// This mirrors `build_pricing` step for step, which is the only reason a local computation is
// allowed here at all; it is still a preview, and the server recomputes it when the quote is saved.
export const pricingWithServices = (
  pricing: PricingData,
  lines: ServiceLineForm[],
): PricingData => {
  const net = servicesNetTotal(lines, pricing.taxRate)
  if (net === 0) return pricing
  const subtotal = round2(pricing.subtotal + net)
  const taxAmount = round2(subtotal * pricing.taxRate)
  return {
    ...pricing,
    servicesTotal: net,
    subtotal,
    taxAmount,
    total: round2(subtotal + taxAmount),
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
