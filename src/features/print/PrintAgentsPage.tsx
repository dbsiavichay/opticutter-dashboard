import { useState } from 'react'
import {
  CAlert,
  CBadge,
  CButton,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CFormSwitch,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilCopy, cilLoopCircular, cilPlus } from '@coreui/icons'

import QueryState from 'src/shared/components/QueryState'
import { relativeTime } from 'src/shared/utils/date'
import { useActiveBranches } from 'src/features/branches/useBranches'
import type { PrintAgent } from './printAgentsApi'
import {
  useCreatePrintAgent,
  usePrintAgents,
  useRotatePrintAgentToken,
  useSetPrintAgentActive,
} from './usePrintAgents'

// An agent that has never polled has no presence to report yet; anything else is "how long ago".
const presence = (agent: PrintAgent) =>
  agent.lastSeenAt ? relativeTime(agent.lastSeenAt) : 'nunca'

interface TokenModalState {
  token: string
  agentName: string
  // A rotation invalidates the token already deployed on the shop PC, which is worth spelling out.
  rotated: boolean
}

// Shows the raw device token exactly once. It is not recoverable: only its sha256 is stored,
// so the admin has to copy it into the shop PC's config.ini before closing this.
const TokenModal = ({ state, onClose }: { state: TokenModalState; onClose: () => void }) => {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(state.token)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <CModal visible onClose={onClose} backdrop="static" size="lg">
      <CModalHeader>
        <CModalTitle>Token de {state.agentName}</CModalTitle>
      </CModalHeader>
      <CModalBody>
        <CAlert color="warning" className="py-2">
          Copia este token ahora: no se puede volver a consultar.
          {state.rotated && ' El token anterior quedó revocado y ese agente dejará de imprimir.'}
        </CAlert>
        <CFormLabel>
          Pegar en <code>agent_token</code> del <code>config.ini</code>
        </CFormLabel>
        <div className="d-flex gap-2">
          <CFormInput value={state.token} readOnly className="font-monospace" />
          <CButton color="primary" variant="outline" onClick={() => void copy()}>
            <CIcon icon={cilCopy} className="me-1" />
            {copied ? 'Copiado' : 'Copiar'}
          </CButton>
        </div>
      </CModalBody>
      <CModalFooter>
        <CButton color="secondary" onClick={onClose}>
          Cerrar
        </CButton>
      </CModalFooter>
    </CModal>
  )
}

// Admin surface for the print agents (one per shop PC). Registering one issues the device
// token the agent authenticates its long-poll with; the presence column is the first thing
// to check when the shop reports "no imprime".
const PrintAgentsPage = () => {
  const { data: agents = [], isLoading, isError, refetch } = usePrintAgents()
  const { data: branches = [] } = useActiveBranches()
  const createAgent = useCreatePrintAgent()
  const rotateToken = useRotatePrintAgentToken()
  const setActive = useSetPrintAgentActive()

  const [formModal, setFormModal] = useState(false)
  const [name, setName] = useState('')
  const [branchId, setBranchId] = useState('')
  const [tokenModal, setTokenModal] = useState<TokenModalState | null>(null)
  const [confirmRotate, setConfirmRotate] = useState<PrintAgent | null>(null)

  const branchName = (id: number) => branches.find((b) => b.id === id)?.name ?? `#${id}`

  const openCreate = () => {
    setName('')
    setBranchId('')
    createAgent.reset()
    setFormModal(true)
  }

  const submitCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!branchId) return
    createAgent.mutate(
      { branchId: Number(branchId), name },
      {
        onSuccess: (agent) => {
          setFormModal(false)
          setTokenModal({ token: agent.token, agentName: agent.name, rotated: false })
        },
      },
    )
  }

  const doRotate = () => {
    if (!confirmRotate) return
    const agent = confirmRotate
    setConfirmRotate(null)
    rotateToken.mutate(agent.id, {
      onSuccess: (rotated) =>
        setTokenModal({ token: rotated.token, agentName: rotated.name, rotated: true }),
    })
  }

  return (
    <>
      <div className="surface">
        <div className="d-flex flex-wrap align-items-start gap-2 mb-3">
          {/* No search box and no filter panel: this listing is one or two rows per branch, and
              `GET /print-jobs/agents` is not paginated. The explanation takes the room they would. */}
          <p className="text-body-secondary small mb-0 flex-grow-1" style={{ maxWidth: '60ch' }}>
            Cada agente es el PC del taller de una sucursal: mantiene la conexión con el sistema e
            imprime en sus impresoras locales o de red. Qué se imprime en cada sucursal se configura
            en <strong>Sucursales</strong>.
          </p>
          <CButton color="primary" className="ms-auto" onClick={openCreate}>
            <CIcon icon={cilPlus} className="me-1" />
            Nuevo agente
          </CButton>
        </div>

        <QueryState isLoading={isLoading} isError={isError} onRetry={() => void refetch()}>
          {/* Rows open nothing: an agent is edited through its own two actions, not a form. */}
          <CTable align="middle" hover responsive className="list-table rows-static">
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>Sucursal</CTableHeaderCell>
                <CTableHeaderCell>Nombre</CTableHeaderCell>
                <CTableHeaderCell>Última conexión</CTableHeaderCell>
                <CTableHeaderCell>Activo</CTableHeaderCell>
                <CTableHeaderCell />
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {agents.length === 0 ? (
                <CTableRow>
                  <CTableDataCell colSpan={5} className="text-center text-body-secondary py-5">
                    Sin agentes registrados
                  </CTableDataCell>
                </CTableRow>
              ) : (
                agents.map((a) => (
                  <CTableRow key={a.id}>
                    <CTableDataCell className="fw-semibold">
                      {branchName(a.branchId)}
                    </CTableDataCell>
                    <CTableDataCell>{a.name}</CTableDataCell>
                    <CTableDataCell>
                      <CBadge color={a.lastSeenAt ? 'success' : 'secondary'}>{presence(a)}</CBadge>
                    </CTableDataCell>
                    <CTableDataCell>
                      <CFormSwitch
                        checked={a.isActive}
                        disabled={setActive.isPending}
                        onChange={() => setActive.mutate({ id: a.id, isActive: !a.isActive })}
                        aria-label="Activo"
                      />
                    </CTableDataCell>
                    <CTableDataCell className="text-end text-nowrap">
                      <CButton
                        variant="ghost"
                        color="secondary"
                        size="sm"
                        disabled={rotateToken.isPending}
                        title="Emitir un token nuevo (revoca el anterior)"
                        onClick={() => setConfirmRotate(a)}
                      >
                        <CIcon icon={cilLoopCircular} className="me-1" />
                        Rotar token
                      </CButton>
                    </CTableDataCell>
                  </CTableRow>
                ))
              )}
            </CTableBody>
          </CTable>
        </QueryState>
      </div>

      <CModal visible={formModal} onClose={() => setFormModal(false)} backdrop="static">
        <CModalHeader>
          <CModalTitle>Nuevo agente</CModalTitle>
        </CModalHeader>
        <form onSubmit={submitCreate}>
          <CModalBody>
            <div className="mb-3">
              <CFormLabel htmlFor="pa-branch">Sucursal</CFormLabel>
              <CFormSelect
                id="pa-branch"
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                required
                disabled={createAgent.isPending}
              >
                <option value="">Selecciona una sucursal…</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </CFormSelect>
            </div>
            <div className="mb-3">
              <CFormLabel htmlFor="pa-name">Nombre</CFormLabel>
              <CFormInput
                id="pa-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="PC Taller"
                required
                disabled={createAgent.isPending}
              />
            </div>
          </CModalBody>
          <CModalFooter>
            <CButton
              color="secondary"
              onClick={() => setFormModal(false)}
              disabled={createAgent.isPending}
            >
              Cancelar
            </CButton>
            <CButton color="primary" type="submit" disabled={createAgent.isPending}>
              Crear
            </CButton>
          </CModalFooter>
        </form>
      </CModal>

      <CModal visible={confirmRotate !== null} onClose={() => setConfirmRotate(null)}>
        <CModalHeader>
          <CModalTitle>Rotar token</CModalTitle>
        </CModalHeader>
        <CModalBody>
          Se emitirá un token nuevo para <strong>{confirmRotate?.name}</strong> y el actual quedará
          revocado. Ese agente dejará de imprimir hasta que actualices su <code>config.ini</code>.
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" onClick={() => setConfirmRotate(null)}>
            Cancelar
          </CButton>
          <CButton color="primary" onClick={doRotate}>
            Rotar
          </CButton>
        </CModalFooter>
      </CModal>

      {tokenModal && <TokenModal state={tokenModal} onClose={() => setTokenModal(null)} />}
    </>
  )
}

export default PrintAgentsPage
