import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import {
  CAlert,
  CButton,
  CFormLabel,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CSpinner,
} from '@coreui/react'

import { ApiError } from 'src/shared/api/types'
import type { ApiErrorItem } from 'src/shared/api/types'
import { productsApi } from './productsApi'
import type { ProductSyncResult } from './types'

interface SyncCatalogModalProps {
  visible: boolean
  onClose: () => void
  onSynced: () => void
}

type Stage = 'input' | 'syncing' | 'done' | 'error'

const SyncCatalogModal = ({ visible, onClose, onSynced }: SyncCatalogModalProps) => {
  const [stage, setStage] = useState<Stage>('input')
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<ProductSyncResult | null>(null)
  const [errors, setErrors] = useState<ApiErrorItem[]>([])
  const [genericError, setGenericError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const reset = () => {
    setStage('input')
    setFile(null)
    setResult(null)
    setErrors([])
    setGenericError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const close = () => {
    reset()
    onClose()
  }

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] ?? null)
  }

  const handleSync = async () => {
    if (!file) return
    setStage('syncing')
    try {
      const data = await productsApi.syncCatalog(file)
      setResult(data)
      setStage('done')
      if (data.created > 0 || data.updated > 0 || data.deactivated > 0 || data.deleted > 0)
        onSynced()
    } catch (err) {
      if (err instanceof ApiError && err.errors.length > 0) {
        setErrors(err.errors)
      } else {
        setGenericError(err instanceof Error ? err.message : 'Error al sincronizar el catálogo.')
      }
      setStage('error')
    }
  }

  const handleDone = () => {
    reset()
    onClose()
  }

  return (
    <CModal visible={visible} onClose={close} size="lg" alignment="center">
      <CModalHeader>
        <CModalTitle>Sincronizar catálogo</CModalTitle>
      </CModalHeader>
      <CModalBody>
        {stage === 'input' && (
          <>
            <p className="text-body-secondary small mb-3">
              Sube el CSV exportado por el sistema externo (tableros o tapacantos, tal cual se
              exporta). El archivo se valida completo antes de aplicar cualquier cambio: si una sola
              fila tiene un problema, no se crea ni actualiza nada y se muestra el detalle exacto
              para corregirlo. Los productos que ya vinieron de una sincronización anterior y no
              aparecen en este archivo se <strong>eliminan</strong> si nunca se usaron en un pedido,
              o quedan <strong>inactivos</strong> si sí se usaron; los productos creados a mano en
              el catálogo nunca se ven afectados.
            </p>
            <CFormLabel className="small mb-1 d-block">Archivo CSV</CFormLabel>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="form-control form-control-sm"
              onChange={handleFile}
            />
          </>
        )}

        {stage === 'syncing' && (
          <div className="py-4 text-center">
            <CSpinner size="sm" className="me-2" />
            Sincronizando…
          </div>
        )}

        {stage === 'done' && result && (
          <div className="text-center py-4">
            <p className="mb-0">
              <strong>{result.created}</strong> creado{result.created !== 1 ? 's' : ''},{' '}
              <strong>{result.updated}</strong> actualizado{result.updated !== 1 ? 's' : ''}
              {result.deactivated > 0 && (
                <>
                  , <strong>{result.deactivated}</strong> desactivado
                  {result.deactivated !== 1 ? 's' : ''}
                </>
              )}
              {result.deleted > 0 && (
                <>
                  , <strong>{result.deleted}</strong> eliminado{result.deleted !== 1 ? 's' : ''}
                </>
              )}
              {result.skippedMedio > 0 && (
                <>
                  , {result.skippedMedio} omitido{result.skippedMedio !== 1 ? 's' : ''} (medio
                  tablero)
                </>
              )}
              .
            </p>
          </div>
        )}

        {stage === 'error' && (
          <>
            <CAlert color="danger" className="mb-2 py-2 small">
              El archivo tiene errores de validación. No se creó ni actualizó ningún producto —
              corrígelo y vuelve a intentarlo.
            </CAlert>
            {genericError && <p className="text-danger small">{genericError}</p>}
            {errors.length > 0 && (
              <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                <ul className="small mb-0 ps-3">
                  {errors.map((e, i) => (
                    <li key={i}>{e.message}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </CModalBody>
      <CModalFooter className="justify-content-end gap-2">
        {stage === 'input' && (
          <>
            <CButton color="secondary" variant="outline" onClick={close}>
              Cancelar
            </CButton>
            <CButton color="primary" disabled={!file} onClick={() => void handleSync()}>
              Sincronizar
            </CButton>
          </>
        )}
        {stage === 'error' && (
          <>
            <CButton color="secondary" variant="outline" onClick={reset}>
              Elegir otro archivo
            </CButton>
            <CButton color="secondary" onClick={close}>
              Cerrar
            </CButton>
          </>
        )}
        {stage === 'done' && (
          <CButton color="primary" onClick={handleDone}>
            Cerrar
          </CButton>
        )}
      </CModalFooter>
    </CModal>
  )
}

export default SyncCatalogModal
