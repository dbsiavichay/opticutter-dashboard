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
import { useCatalogSyncPreview, useSyncCatalog } from './useProducts'
import type { ProductSyncIssue, ProductSyncResult } from './types'

interface SyncCatalogModalProps {
  visible: boolean
  onClose: () => void
  onSynced: () => void
}

const plural = (n: number, singular: string, pluralWord: string) =>
  `${n} ${n === 1 ? singular : pluralWord}`

/** The counters that matter, in the order the operator reads them. */
const summaryLines = (result: ProductSyncResult): string[] => {
  const lines = [
    plural(result.created, 'nuevo', 'nuevos'),
    plural(result.updated, 'actualizado', 'actualizados'),
  ]
  if (result.deleted > 0) lines.push(plural(result.deleted, 'eliminado', 'eliminados'))
  if (result.deactivated > 0)
    lines.push(`${plural(result.deactivated, 'desactivado', 'desactivados')} (usados en un pedido)`)
  if (result.skippedMedio > 0)
    lines.push(`${plural(result.skippedMedio, 'omitido', 'omitidos')} (medio tablero)`)
  if (result.skippedInactive > 0)
    lines.push(`${plural(result.skippedInactive, 'de baja', 'de baja')} en el inventario`)
  if (result.skippedInvalid > 0)
    lines.push(`${plural(result.skippedInvalid, 'omitido', 'omitidos')} con datos ilegibles`)
  return lines
}

// Both report lists are shown in full, not as a count: the whole point is that
// someone goes and fixes these rows in the inventory system, and for that they
// need the code and the article name.
//
// The key can't be the code alone — one article can collect two warnings (no
// alias *and* a familia nobody coordinates).
const RowList = ({ rows, headline }: { rows: ProductSyncIssue[]; headline: ReactNode }) => (
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

// Rows the sync couldn't read: they stay out of the catalog entirely.
const IssueList = ({ issues }: { issues: ProductSyncIssue[] }) => (
  <RowList
    rows={issues}
    headline={
      <>
        <strong>{issues.length}</strong>{' '}
        {issues.length === 1 ? 'artículo omitido' : 'artículos omitidos'}. Quedan fuera del catálogo
        y sus productos actuales no se modifican; corrígelos en el sistema de inventario para
        incluirlos.
      </>
    }
  />
)

// Rows that DID import — the distinction that earns this its own block. What
// they lost is the tablero<->tapacanto coordination, which fails silently: the
// tapacanto picker just comes back empty and nobody finds out until a seller
// can't quote it. The fix is the OBS. column of the inventory system, written
// `FAMILIA` or `FAMILIA - ALIAS`.
const WarningList = ({ warnings }: { warnings: ProductSyncIssue[] }) => (
  <RowList
    rows={warnings}
    headline={
      <>
        <strong>{warnings.length}</strong>{' '}
        {warnings.length === 1 ? 'artículo importado' : 'artículos importados'} con la coordinación
        incompleta. <strong>Sí entran al catálogo</strong>, pero el tapacanto no se va a ofrecer
        junto a su tablero. Se corrige en la columna OBS. del sistema de inventario, escrita{' '}
        <code>FAMILIA</code> o <code>FAMILIA - ALIAS</code>.
      </>
    }
  />
)

// Everything the pass has to say about individual rows, in severity order.
// Rendered in every non-error state — including "el catálogo ya está al día",
// where the counters are all zero but the rows still need fixing.
const ReportBlocks = ({ result }: { result: ProductSyncResult }) => {
  // Nothing at all rather than an empty spacer, so the states with nothing to
  // report keep the modal as tight as it was.
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

const hasChanges = (result: ProductSyncResult) =>
  result.created > 0 || result.updated > 0 || result.deactivated > 0 || result.deleted > 0

const errorItems = (error: Error): ApiErrorItem[] =>
  error instanceof ApiError && error.errors.length > 0
    ? error.errors
    : [{ message: error.message || 'Error al sincronizar el catálogo.' }]

// There's no file to pick any more: the server reads the inventory system
// itself. So the modal opens straight into a dry run and asks the operator to
// approve it — the reconciliation pass deletes whatever the read no longer
// brings, which is the one irreversible part of a sync.
const SyncCatalogModal = ({ visible, onClose, onSynced }: SyncCatalogModalProps) => {
  const preview = useCatalogSyncPreview(visible)
  const apply = useSyncCatalog()

  const result = apply.data ?? preview.data ?? null
  const error = apply.error ?? preview.error ?? null

  const close = () => {
    apply.reset()
    onClose()
  }

  const handleApply = () => {
    apply.mutate(undefined, {
      onSuccess: (data) => {
        if (hasChanges(data)) onSynced()
      },
    })
  }

  const handleRetry = () => {
    apply.reset()
    void preview.refetch()
  }

  // 503 means the inventory system didn't answer — nothing to fix in the data,
  // unlike the row-level 422 the validation raises.
  const unreachable = error instanceof ApiError && error.status === 503
  const applied = apply.isSuccess && result !== null
  const nothingToDo = !applied && result !== null && !hasChanges(result)
  const busy = apply.isPending || (visible && preview.isFetching)

  return (
    <CModal visible={visible} onClose={close} size="lg" alignment="center">
      <CModalHeader>
        <CModalTitle>Sincronizar catálogo</CModalTitle>
      </CModalHeader>
      <CModalBody>
        {busy && (
          <div className="py-4 text-center">
            <CSpinner size="sm" className="me-2" />
            {apply.isPending ? 'Sincronizando…' : 'Consultando el inventario…'}
          </div>
        )}

        {!busy && error && (
          <>
            <CAlert color="danger" className="mb-2 py-2 small">
              {unreachable
                ? 'No se pudo conectar con el sistema de inventario. No se modificó ningún producto — vuelve a intentarlo en un momento.'
                : 'El inventario tiene datos que no se pudieron procesar. No se creó ni actualizó ningún producto — corrígelos en el sistema de inventario y vuelve a intentarlo.'}
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
              <p className="mb-0 py-3 text-center">El catálogo ya está al día.</p>
            ) : (
              <>
                <p className="text-body-secondary small mb-2">
                  Se traerán los tableros y tapacantos del sistema de inventario. Todavía no se ha
                  aplicado nada — esto es lo que va a pasar:
                </p>
                <ul className="mb-3">
                  {summaryLines(result).map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
                <p className="text-body-secondary small mb-3">
                  Los productos que ya vinieron de una sincronización anterior y que el inventario
                  ya no trae se <strong>eliminan</strong> si nunca se usaron en un pedido, o quedan
                  <strong> inactivos</strong> si sí se usaron. Los productos creados a mano en el
                  catálogo nunca se ven afectados.
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

export default SyncCatalogModal
