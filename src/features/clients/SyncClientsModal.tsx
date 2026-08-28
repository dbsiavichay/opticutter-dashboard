import type { ReactNode } from 'react'
import {
  CAlert,
  CButton,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CSpinner,
} from '@coreui/react'

import { ApiError } from 'src/shared/api/types'
import type { ApiErrorItem } from 'src/shared/api/types'
import { useClientsSyncPreview, useSyncClients } from './useClients'
import type { ClientSyncIssue, ClientSyncResult } from './types'

interface SyncClientsModalProps {
  visible: boolean
  onClose: () => void
  onSynced: () => void
}

const plural = (n: number, singular: string, pluralWord: string) =>
  `${n} ${n === 1 ? singular : pluralWord}`

/** The counters that matter, in the order the operator reads them. */
const summaryLines = (result: ClientSyncResult): string[] => {
  const lines = [
    plural(result.created, 'nuevo', 'nuevos'),
    plural(result.updated, 'actualizado', 'actualizados'),
  ]
  if (result.skippedInactive > 0)
    lines.push(`${plural(result.skippedInactive, 'de baja', 'de baja')} en el sistema externo`)
  if (result.skippedInvalid > 0)
    lines.push(`${plural(result.skippedInvalid, 'omitido', 'omitidos')} con datos ilegibles`)
  return lines
}

// Both report lists are shown in full, not as a count: the whole point is that someone goes and
// fixes these rows in the external system, and for that they need the cédula and the name.
//
// The key can't be the cédula alone — one client can collect two warnings (a bad phone *and* a
// malformed e-mail).
const RowList = ({ rows, headline }: { rows: ClientSyncIssue[]; headline: ReactNode }) => (
  <>
    <p className="small mb-1">{headline}</p>
    <div style={{ maxHeight: 220, overflowY: 'auto' }}>
      <ul className="small mb-0 ps-3">
        {rows.map((row, i) => (
          <li key={`${row.code}-${i}`}>
            <code>{row.code}</code> {row.name} — {row.message}
          </li>
        ))}
      </ul>
    </div>
  </>
)

// Rows the sync couldn't use: they stay out of the list entirely.
const IssueList = ({ issues }: { issues: ClientSyncIssue[] }) => (
  <RowList
    rows={issues}
    headline={
      <>
        <strong>{issues.length}</strong>{' '}
        {issues.length === 1 ? 'cliente omitido' : 'clientes omitidos'}. Quedan fuera y sus fichas
        actuales no se modifican; corrige la cédula/RUC en el sistema externo para incluirlos.
      </>
    }
  />
)

// Rows that DID import — the distinction that earns this its own block. What they lost is a field,
// and a client with no phone can't be quoted at all (the proforma requires one), which nobody would
// find out until a seller tries.
const WarningList = ({ warnings }: { warnings: ClientSyncIssue[] }) => (
  <RowList
    rows={warnings}
    headline={
      <>
        <strong>{warnings.length}</strong>{' '}
        {warnings.length === 1 ? 'cliente importado' : 'clientes importados'} con un dato
        incompleto. <strong>Sí entran al listado</strong>, pero sin ese campo — y sin teléfono no se
        puede generar la proforma. Se corrige en el sistema externo.
      </>
    }
  />
)

// Everything the pass has to say about individual rows, in severity order. Rendered in every
// non-error state — including "el listado ya está al día", where the counters are all zero but the
// rows still need fixing.
const ReportBlocks = ({ result }: { result: ClientSyncResult }) => {
  if (result.issues.length === 0 && result.warnings.length === 0) return null
  return (
    <div className="mt-3">
      {result.issues.length > 0 && (
        <CAlert color="warning" className="mb-2 py-2">
          <IssueList issues={result.issues} />
        </CAlert>
      )}
      {result.warnings.length > 0 && (
        <CAlert color="info" className="mb-0 py-2">
          <WarningList warnings={result.warnings} />
        </CAlert>
      )}
    </div>
  )
}

const hasChanges = (result: ClientSyncResult) => result.created > 0 || result.updated > 0

const issueKey = (issue: ClientSyncIssue) => `${issue.code}|${issue.message}`

// The preview and the apply are two separate reads of the same live table, so in the common case
// they report the exact same rows — the operator already read and accepted them by clicking
// "Aplicar". Only a row that WASN'T in the preview (the source changed between the two reads) is
// new information worth keeping the modal open for.
const hasReportsNotInPreview = (result: ClientSyncResult, preview: ClientSyncResult | null) => {
  const previouslyShown = new Set(
    [...(preview?.issues ?? []), ...(preview?.warnings ?? [])].map(issueKey),
  )
  return [...result.issues, ...result.warnings].some((i) => !previouslyShown.has(issueKey(i)))
}

const errorItems = (error: Error): ApiErrorItem[] =>
  error instanceof ApiError && error.errors.length > 0
    ? error.errors
    : [{ message: error.message || 'Error al sincronizar los clientes.' }]

// Same shape as the catalog's sync modal: opens straight into a dry run and asks the operator to
// approve it. Nothing here deletes — a client the external system stopped bringing keeps their
// ficha, because orders and pre-orders point at it — so the approval is about the volume of
// changes, not about an irreversible step.
const SyncClientsModal = ({ visible, onClose, onSynced }: SyncClientsModalProps) => {
  const preview = useClientsSyncPreview(visible)
  const apply = useSyncClients()

  const result = apply.data ?? preview.data ?? null
  const error = apply.error ?? preview.error ?? null

  const close = () => {
    apply.reset()
    onClose()
  }

  const handleApply = () => {
    const previewedResult = preview.data ?? null
    apply.mutate(undefined, {
      onSuccess: (data) => {
        if (hasChanges(data)) onSynced()
        if (!hasReportsNotInPreview(data, previewedResult)) close()
      },
    })
  }

  const handleRetry = () => {
    apply.reset()
    void preview.refetch()
  }

  // 503 means the external system didn't answer — nothing to fix in the data, unlike the row-level
  // 422 the validation raises.
  const unreachable = error instanceof ApiError && error.status === 503
  const applied = apply.isSuccess && result !== null
  const nothingToDo = !applied && result !== null && !hasChanges(result)
  const busy = apply.isPending || (visible && preview.isFetching)

  return (
    <CModal visible={visible} onClose={close} size="lg" alignment="center">
      <CModalHeader>
        <CModalTitle>Sincronizar clientes</CModalTitle>
      </CModalHeader>
      <CModalBody>
        {busy && (
          <div className="py-4 text-center">
            <CSpinner size="sm" className="me-2" />
            {apply.isPending ? 'Sincronizando…' : 'Consultando el sistema externo…'}
          </div>
        )}

        {!busy && error && (
          <>
            <CAlert color="danger" className="mb-2 py-2 small">
              {unreachable
                ? 'No se pudo conectar con el sistema externo. No se modificó ningún cliente — vuelve a intentarlo en un momento.'
                : 'El sistema externo devolvió datos que no se pudieron procesar. No se creó ni actualizó ningún cliente.'}
            </CAlert>
            <div style={{ maxHeight: 260, overflowY: 'auto' }}>
              <ul className="small mb-0 ps-3">
                {errorItems(error).map((e, i) => (
                  <li key={i}>{e.message}</li>
                ))}
              </ul>
            </div>
          </>
        )}

        {!busy && !error && applied && result && (
          <>
            <p className="mb-0 py-3 text-center">{summaryLines(result).join(', ')}.</p>
            <ReportBlocks result={result} />
          </>
        )}

        {!busy && !error && !applied && result && (
          <>
            {nothingToDo ? (
              <p className="mb-0 py-3 text-center">El listado ya está al día.</p>
            ) : (
              <>
                <p className="text-body-secondary small mb-2">
                  Se traerán los clientes del sistema externo, emparejados por cédula/RUC. Todavía
                  no se ha aplicado nada — esto es lo que va a pasar:
                </p>
                <ul className="mb-3">
                  {summaryLines(result).map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
                <p className="text-body-secondary small mb-3">
                  Un cliente que el sistema externo ya no trae <strong>no se elimina</strong>: su
                  ficha queda como está. Al actualizar, el sistema externo solo pisa los campos que
                  trae con dato — un teléfono o correo cargado a mano aquí no se pierde.
                </p>
              </>
            )}
            <ReportBlocks result={result} />
          </>
        )}
      </CModalBody>
      <CModalFooter className="justify-content-end gap-2">
        {!busy && error && (
          <>
            <CButton color="secondary" variant="outline" onClick={handleRetry}>
              Reintentar
            </CButton>
            <CButton color="secondary" onClick={close}>
              Cerrar
            </CButton>
          </>
        )}
        {!busy && !error && applied && (
          <CButton color="primary" onClick={close}>
            Cerrar
          </CButton>
        )}
        {!busy && !error && !applied && result && (
          <>
            <CButton color="secondary" variant="outline" onClick={close}>
              Cancelar
            </CButton>
            <CButton color="primary" disabled={nothingToDo} onClick={handleApply}>
              Aplicar
            </CButton>
          </>
        )}
      </CModalFooter>
    </CModal>
  )
}

export default SyncClientsModal
