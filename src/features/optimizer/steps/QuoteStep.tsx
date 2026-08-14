import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CAlert,
  CButton,
  CCol,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CFormTextarea,
  CRow,
  CSpinner,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilCart } from '@coreui/icons'

import type { Client } from 'src/features/clients/types'
import { useClientsMin } from 'src/features/orders/useOrders'
import { useCreatePreOrder } from 'src/features/preorders/usePreOrders'
import { useCurrentUser, useHasRole, useIsGlobalBranchRole } from 'src/features/auth/useAuth'
import { useActiveBranches } from 'src/features/branches/useBranches'
import { useDebounce } from 'src/shared/hooks/useDebounce'
import { ApiError } from 'src/shared/api/types'
import { fmtMoney } from 'src/features/review/format'
import type { MaterialInput, OptimizeResponse, PackingStrategy, RequirementInput } from '../types'

// Step 4. What used to be CreateQuoteModal, in a full-width step: the same four inputs the optimizer
// cannot infer (client, branch, price tier, reference) plus the confirmation summary that never fit
// inside the modal. Creates a PRE-ORDER; the backend recomputes the plan from these same inputs.

const fullClientLabel = (c: Client) => {
  const name = [c.firstName, c.lastName].filter(Boolean).join(' ')
  return name ? `${name} — @${c.identifier}` : `@${c.identifier}`
}

interface QuoteStepProps {
  result?: OptimizeResponse
  materials: MaterialInput[]
  requirements: RequirementInput[]
  // Chosen back in the Costos step, where its effect on the numbers is visible; carried here only
  // to be sent with the pre-order and shown in the summary.
  priceTierCode: string
  strategy: PackingStrategy
  // Alternative-solution seed of the layout on screen; persisted with the pre-order so every
  // recompute reproduces the chosen alternative.
  variant: number
  // Called after the pre-order is created (the page clears its autosave).
  onCreated?: () => void
}

const QuoteStep = ({
  result,
  materials,
  requirements,
  priceTierCode,
  strategy,
  variant,
  onCreated,
}: QuoteStepProps) => {
  const navigate = useNavigate()

  const [clientSearch, setClientSearch] = useState('')
  const debouncedSearch = useDebounce(clientSearch)
  const [selectedClientId, setSelectedClientId] = useState('')
  const [notes, setNotes] = useState('')

  const user = useCurrentUser()
  const isAdmin = useHasRole('administrador')
  const isGlobalBranch = useIsGlobalBranchRole()
  const { data: branches = [] } = useActiveBranches()

  // Admin: no pre-selection (required field). Sales rep: pre-selects their home branch.
  const [branchId, setBranchId] = useState(() => (isAdmin ? '' : String(user?.branchId ?? '')))

  const { data: clientsData } = useClientsMin(debouncedSearch)
  const clients = clientsData?.items ?? []
  const selectedClient = clients.find((c) => String(c.id) === String(selectedClientId))
  const missingPhone = !!selectedClient && selectedClient.phone == null

  const createPreOrder = useCreatePreOrder()
  const isPending = createPreOrder.isPending
  const blocked = !selectedClientId || missingPhone || (isAdmin && !branchId)

  const handleCreate = () => {
    if (blocked) return
    createPreOrder.mutate(
      {
        clientId: Number(selectedClientId),
        source: 'dashboard',
        notes: notes || undefined,
        priceTierCode,
        strategy,
        variant,
        materials,
        requirements,
        branchId: isGlobalBranch && branchId ? Number(branchId) : undefined,
      },
      {
        onSuccess: (preOrder) => {
          onCreated?.()
          void navigate(`/preorders/${preOrder.id}`)
        },
      },
    )
  }

  const mutationError = createPreOrder.error
  const branchError =
    mutationError instanceof ApiError
      ? mutationError.errors.find((e) => e.field === 'branchId')?.message
      : undefined

  // The form needs no card — its own labels say what each field is, and "Datos de la cotización"
  // only repeated the step's name. The summary keeps a frame because it is a different KIND of
  // thing next to the form: a read-only receipt of what is about to be created.
  return (
    <CRow className="g-3">
      <CCol xs={12} lg={7}>
        <CFormLabel>
          Buscar cliente <span className="text-danger">*</span>
        </CFormLabel>
        <CFormInput
          placeholder="Nombre o identificador…"
          value={clientSearch}
          onChange={(e) => setClientSearch(e.target.value)}
          className="mb-1"
        />
        {/* Server-searched list, so this stays a plain listbox rather than SearchableSelect,
            which filters what it already has in memory. */}
        <CFormSelect
          htmlSize={6}
          value={selectedClientId}
          onChange={(e) => setSelectedClientId(e.target.value)}
        >
          <option value="">— Seleccionar cliente —</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {fullClientLabel(c)}
            </option>
          ))}
        </CFormSelect>
        {missingPhone && (
          <CAlert color="warning" className="mt-2 mb-0 py-2 small">
            Este cliente no tiene celular registrado. La cotización no podrá crearse hasta que se
            registre un número.
          </CAlert>
        )}

        {isGlobalBranch && (
          <>
            <CFormLabel className="mt-3">
              Sucursal {isAdmin && <span className="text-danger">*</span>}
            </CFormLabel>
            <CFormSelect
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              invalid={!!branchError}
            >
              <option value="">— Seleccionar sucursal —</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </CFormSelect>
            {branchError && <div className="invalid-feedback d-block">{branchError}</div>}
          </>
        )}

        <CFormLabel className="mt-3">Referencia</CFormLabel>
        <CFormTextarea
          rows={2}
          maxLength={512}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Ej.: Proyecto Casa Pérez — cocina y closet"
        />
        <div className="form-text">
          Nombre del proyecto u obra para distinguir este pedido de otros del mismo cliente. Se
          imprime en todos los documentos y la ve el cliente.
        </div>

        {mutationError && (
          <CAlert color="danger" className="mt-3 mb-0 py-2 small">
            {mutationError.message || 'Error al crear la cotización. Intente nuevamente.'}
          </CAlert>
        )}
      </CCol>

      <CCol xs={12} lg={5}>
        {/* Same frame as the KPI tiles in the other steps (`Kpi` in summaryTables). */}
        <div className="border rounded-3 p-3">
          <div className="text-body-secondary small text-uppercase fw-semibold mb-2">Resumen</div>
          <div className="d-flex justify-content-between gap-3 py-1 border-bottom">
            <span className="text-body-secondary small">Cliente</span>
            <span className="small fw-semibold text-end">
              {selectedClient ? fullClientLabel(selectedClient) : 'Sin seleccionar'}
            </span>
          </div>
          <div className="d-flex justify-content-between gap-3 py-1 border-bottom">
            <span className="text-body-secondary small">Piezas</span>
            <span className="small fw-semibold text-end">
              {requirements.reduce((n, r) => n + r.quantity, 0)}
            </span>
          </div>
          <div className="d-flex justify-content-between gap-3 py-1 border-bottom">
            <span className="text-body-secondary small">Tableros</span>
            <span className="small fw-semibold text-end">{result?.totalBoardsUsed ?? '—'}</span>
          </div>
          <div className="d-flex justify-content-between gap-3 py-1 border-bottom">
            <span className="text-body-secondary small">Nivel de precio</span>
            <span className="small fw-semibold text-end">
              {result?.pricing?.priceTierName ?? priceTierCode}
            </span>
          </div>
          <div className="d-flex justify-content-between gap-3 py-2">
            <span className="fw-semibold">Total</span>
            <span className="fw-semibold text-end">
              {result?.pricing ? fmtMoney(result.pricing.total) : '—'}
            </span>
          </div>

          <div className="text-body-secondary small mb-3">
            El total se recalcula en el servidor al crear la cotización, con el nivel de precio
            elegido arriba.
          </div>

          <CButton
            color="primary"
            className="w-100"
            type="button"
            disabled={blocked || isPending}
            onClick={handleCreate}
          >
            {isPending ? (
              <CSpinner size="sm" className="me-1" />
            ) : (
              <CIcon icon={cilCart} className="me-1" />
            )}
            Crear cotización
          </CButton>
        </div>
      </CCol>
    </CRow>
  )
}

export default QuoteStep
