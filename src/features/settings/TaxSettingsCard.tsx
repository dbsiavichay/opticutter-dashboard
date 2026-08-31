import { useState } from 'react'
import type { ChangeEvent } from 'react'
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CFormInput,
  CFormLabel,
  CInputGroup,
  CInputGroupText,
  CRow,
  CSpinner,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilCheckAlt, cilSave } from '@coreui/icons'

import FieldError from 'src/shared/components/FieldError'
import { fieldErrorsFromApiError, hasGenericError } from 'src/shared/api/errors'
import { useTaxSettings, useUpdateTaxSettings } from './useSettings'
import { useSavedFlash } from './useSavedFlash'
import type { TaxSettings } from './types'

// Stored as a fraction (0.15), edited as a percentage (15). Rounding the trip
// back keeps 0.15 from becoming 0.15000000000000002.
const clean = (n: number) => Math.round(n * 1e6) / 1e6
const toInput = (rate: number) => String(clean(rate * 100))

const TaxSettingsCard = () => {
  const { data, isLoading, isError, refetch } = useTaxSettings()
  const update = useUpdateTaxSettings()
  const [savedFlash, flashSaved] = useSavedFlash()

  const [input, setInput] = useState<string | null>(null)
  const [clientError, setClientError] = useState<string | null>(null)

  // Sync to server truth on load and after each PATCH ("adjust state during
  // render", the pattern the other settings cards use).
  const [seenData, setSeenData] = useState<TaxSettings | null>(null)
  if (data && data !== seenData) {
    setSeenData(data)
    setInput(toInput(data.taxRate))
  }

  const parsed = input === null || input.trim() === '' ? null : Number(input)
  const isDirty =
    !!data && (parsed === null || !Number.isFinite(parsed) || clean(parsed / 100) !== data.taxRate)

  const handleSave = () => {
    if (!data || parsed === null || !Number.isFinite(parsed)) {
      setClientError('Ingresa un porcentaje válido.')
      return
    }
    if (parsed < 0 || parsed > 100) {
      setClientError('Debe estar entre 0 y 100.')
      return
    }
    setClientError(null)
    update.mutate({ taxRate: clean(parsed / 100) }, { onSuccess: () => flashSaved() })
  }

  const handleDiscard = () => {
    if (data) setInput(toInput(data.taxRate))
    setClientError(null)
    update.reset()
  }

  const serverErrors = fieldErrorsFromApiError(update.error)
  const fieldErrors = { ...serverErrors, ...(clientError ? { taxRate: clientError } : {}) }
  const genericError = hasGenericError(update.error, serverErrors)

  return (
    <CCard className="mb-4">
      <CCardHeader className="d-flex flex-wrap gap-2 justify-content-between align-items-center">
        <strong>Impuestos</strong>
        <div className="d-flex gap-2">
          <CButton
            color="secondary"
            variant="outline"
            size="sm"
            type="button"
            disabled={!isDirty || update.isPending}
            onClick={handleDiscard}
          >
            Descartar
          </CButton>
          <CButton
            color="primary"
            size="sm"
            type="button"
            disabled={!isDirty || update.isPending}
            onClick={handleSave}
          >
            {update.isPending ? (
              <CSpinner size="sm" className="me-1" />
            ) : (
              <CIcon icon={savedFlash ? cilCheckAlt : cilSave} className="me-1" />
            )}
            {savedFlash ? 'Guardado' : 'Guardar'}
          </CButton>
        </div>
      </CCardHeader>
      <CCardBody>
        {isLoading || input === null ? (
          <div className="text-center py-5">
            {isError ? (
              <div className="text-body-secondary">
                No se pudo cargar la configuración de impuestos.{' '}
                <CButton size="sm" color="link" onClick={() => void refetch()}>
                  Reintentar
                </CButton>
              </div>
            ) : (
              <CSpinner color="primary" />
            )}
          </div>
        ) : (
          <>
            <p className="text-body-secondary small mb-3">
              Los precios del catálogo se guardan <strong>sin IVA</strong>, así que esta tasa es la
              que produce todos los totales: cotizaciones, proformas y órdenes de pedido muestran
              Subtotal, IVA y Total. Cambiarla solo afecta lo que se calcule de aquí en adelante —{' '}
              <strong>cada orden congela la tasa con la que se facturó</strong>.
            </p>

            {savedFlash && (
              <CAlert color="success" className="py-2">
                Configuración de impuestos guardada correctamente.
              </CAlert>
            )}
            {genericError && (
              <CAlert color="danger" className="py-2">
                {update.error?.message || 'Error al guardar. Intenta nuevamente.'}
              </CAlert>
            )}

            <CRow className="g-3">
              <CCol xs={12} md={4}>
                <CFormLabel htmlFor="tax-rate">IVA</CFormLabel>
                <CInputGroup>
                  <CFormInput
                    id="tax-rate"
                    type="number"
                    min={0}
                    max={100}
                    step="any"
                    value={input}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                      setInput(e.target.value)
                      setClientError(null)
                    }}
                    invalid={!!fieldErrors.taxRate}
                  />
                  <CInputGroupText>%</CInputGroupText>
                </CInputGroup>
                <FieldError name="taxRate" errors={fieldErrors} />
              </CCol>
            </CRow>
          </>
        )}
      </CCardBody>
    </CCard>
  )
}

export default TaxSettingsCard
