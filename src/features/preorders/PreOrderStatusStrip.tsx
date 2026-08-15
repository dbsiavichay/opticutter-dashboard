import { CAlert } from '@coreui/react'

import { fmtDate, fmtDateTime } from 'src/shared/utils/format'
import type { PreOrderStatus, ReviewLinkInfo } from './types'

// One line for "where is this quote". It replaces four mutually exclusive full-width alerts plus a
// card that held a single sentence about the review link — five blocks of which at most two were
// ever true at once, each costing a heading and a frame to say something shorter than its own title.
//
// The link is reported here rather than on its own because it is not a separate subject: "enviada al
// cliente" and "el enlace vence el 20" are one fact about one moment in the quote's life.

const LINK_STATUS_LABELS: Record<string, string> = {
  active: 'activo',
  used: 'usado por el cliente',
  revoked: 'reemplazado',
}

// Only these states can still be reviewed, so only they carry a link.
const LINKABLE: PreOrderStatus[] = ['draft', 'sent', 'changes_requested']

interface PreOrderStatusStripProps {
  status: PreOrderStatus
  clientNote?: string | null
  orderId?: number | null
  expiresAt?: string | null
  link?: ReviewLinkInfo | null
}

type Tone = 'info' | 'success' | 'warning' | 'danger' | 'secondary'

const PreOrderStatusStrip = ({
  status,
  clientNote,
  orderId,
  expiresAt,
  link,
}: PreOrderStatusStripProps) => {
  let tone: Tone = 'info'
  let sentence = ''

  switch (status) {
    case 'draft':
      // A quote nobody has seen yet has nothing to report. Without a link this renders nothing at
      // all, which is the state a freshly created quote is in.
      sentence = 'Borrador. Genera el enlace de revisión para enviarla al cliente.'
      break
    case 'sent':
      sentence = 'Enviada al cliente. Esperando su respuesta.'
      break
    case 'changes_requested':
      tone = 'warning'
      sentence = 'El cliente solicitó cambios. Edita la cotización y vuelve a generar el enlace.'
      break
    case 'confirmed':
      tone = 'success'
      sentence = orderId
        ? 'Cotización confirmada. Se generó la orden de producción.'
        : 'Cotización confirmada.'
      break
    case 'rejected':
      tone = 'danger'
      sentence = 'Cotización rechazada por el cliente.'
      break
    case 'expired':
      tone = 'warning'
      sentence = `Esta cotización venció${expiresAt ? ` el ${fmtDate(expiresAt)}` : ''}.`
      break
    case 'cancelled':
      tone = 'secondary'
      sentence = 'Cotización cancelada.'
      break
  }

  const showLink = link && LINKABLE.includes(status)
  const linkText = showLink
    ? `Enlace ${LINK_STATUS_LABELS[link.status] ?? link.status}` +
      (link.usedAt
        ? ` el ${fmtDateTime(link.usedAt)}`
        : link.expiresAt
          ? ` · vence ${fmtDate(link.expiresAt)}`
          : '')
    : null

  // Nothing has happened yet and there is no link: say nothing rather than state the obvious.
  if (status === 'draft' && !showLink) return null

  return (
    <CAlert color={tone} className="py-2 small mb-3">
      <div className="d-flex flex-wrap align-items-center gap-2">
        <span>{sentence}</span>
        {linkText && <span className="ms-auto opacity-75">{linkText}</span>}
      </div>
      {/* The client's own words: the one part of a status that is worth reading rather than
          scanning, so it keeps a block of its own. Marked with a rule instead of a fill — a fill
          light enough to read against a warning alert is unreadable in dark mode. */}
      {status === 'changes_requested' && clientNote && (
        <div className="mt-2 ps-2 border-start border-2">
          <strong>Nota del cliente:</strong> {clientNote}
        </div>
      )}
    </CAlert>
  )
}

export default PreOrderStatusStrip
