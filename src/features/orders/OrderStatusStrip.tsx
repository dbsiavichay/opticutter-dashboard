import { CAlert } from '@coreui/react'

import { fmtDateTime } from 'src/shared/utils/format'
import type { BandingStatus, OrderStatus } from './types'

// One line for "where is this order". It replaces four tinted cards — En corte, Canteado,
// Despachada, Forma de pago — that were stacked full-width above the content. Three of them are the
// same subject (how far along the order is) split by status, and on a dispatched order with edge
// banding all three were on screen at once, each costing a frame and a heading to say one sentence.
//
// Cutting and banding are parallel tracks: an order can be `cutting` and `in_progress` at the same
// time. So the cut track is the sentence and the banding track rides the same line on the right,
// the way the pre-order strip carries its review link. The full who/when trail of the banding, the
// only thing the compression drops, stays reachable in the line's `title`.
//
// Payment is not here: it is not progress, it is money, and it now sits with the totals — the same
// reasoning that put the price level next to the totals in the wizard rather than on a toolbar.

interface BandingInfo {
  status?: BandingStatus
  startedByLabel?: string | null
  startedAt?: string | null
  finishedByLabel?: string | null
  finishedAt?: string | null
}

interface OrderStatusStripProps {
  status: OrderStatus
  assignedToLabel?: string | null
  assignedAt?: string | null
  // No `dispatchedAt`: the identity block's date line owns every timestamp on this page.
  dispatchedByLabel?: string | null
  banding?: BandingInfo
}

type Tone = 'info' | 'success' | 'warning' | 'danger' | 'secondary'

const bandingLine = (banding: BandingInfo | undefined) => {
  if (!banding?.status || banding.status === 'not_applicable') return null
  switch (banding.status) {
    case 'pending':
      return 'Canteado pendiente'
    case 'in_progress':
      return banding.startedByLabel ? `Canteando · ${banding.startedByLabel}` : 'Canteando'
    case 'done':
      return banding.finishedByLabel
        ? `Canteado listo · ${banding.finishedByLabel}`
        : 'Canteado listo'
  }
}

// `fmtDateTime` renders "09/08/2026, 09:20 a. m." — it already ends in a period, so a full stop
// appended after a date reads as "a. m..".
const endSentence = (s: string) => (s.endsWith('.') ? s : `${s}.`)

// The detail the one-liner leaves out, on hover.
const bandingTrail = (banding: BandingInfo | undefined) => {
  const parts: string[] = []
  if (banding?.startedAt) parts.push(`Inició ${fmtDateTime(banding.startedAt)}`)
  if (banding?.finishedAt) parts.push(`Terminó ${fmtDateTime(banding.finishedAt)}`)
  return parts.length > 0 ? parts.join(' · ') : undefined
}

const OrderStatusStrip = ({
  status,
  assignedToLabel,
  assignedAt,
  dispatchedByLabel,
  banding,
}: OrderStatusStripProps) => {
  let tone: Tone = 'info'
  // Empty means "the badge already said it": with no banding track either, the strip renders
  // nothing rather than restating the status in a full-width block.
  let sentence = ''

  switch (status) {
    case 'confirmed':
      // Nothing has happened to this order yet.
      break
    case 'queued':
      sentence = 'En cola. Esperando que el taller la tome.'
      break
    case 'cutting':
      tone = 'warning'
      // Who has it and since when. With neither recorded there is nothing here the badge does not
      // already say.
      sentence =
        assignedToLabel || assignedAt
          ? endSentence(
              `En corte${assignedToLabel ? ` por ${assignedToLabel}` : ''}` +
                `${assignedAt ? ` desde ${fmtDateTime(assignedAt)}` : ''}`,
            )
          : ''
      break
    case 'cut':
      sentence = assignedToLabel
        ? `Cortada por ${assignedToLabel}. Falta completarla.`
        : 'Cortada. Falta completarla.'
      break
    case 'completed':
      tone = 'success'
      sentence = 'Completada. Lista para despacho.'
      break
    case 'despachado':
      tone = 'success'
      // Only who: the identity block's date line already carries "Despachada {fecha}", and the two
      // sit one on top of the other.
      sentence = dispatchedByLabel ? `Despachada por ${dispatchedByLabel}.` : ''
      break
    case 'cancelled':
      tone = 'secondary'
      sentence = 'Orden cancelada.'
      break
  }

  const banded = bandingLine(banding)

  if (!sentence && !banded) return null

  return (
    <CAlert color={tone} className="py-2 small mb-3">
      <div className="d-flex flex-wrap align-items-center gap-2">
        {sentence && <span>{sentence}</span>}
        {banded && (
          // `ms-auto` only when there is a sentence to be pushed away from; on its own the banding
          // is the line, not a note in its margin.
          <span
            className={sentence ? 'ms-auto opacity-75' : undefined}
            title={bandingTrail(banding)}
          >
            {banded}
          </span>
        )}
      </div>
    </CAlert>
  )
}

export default OrderStatusStrip
