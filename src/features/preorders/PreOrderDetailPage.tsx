import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CFormInput,
  CFormTextarea,
  CInputGroup,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CRow,
  CSpinner,
} from '@coreui/react'
import type {
  MaterialForm,
  OffcutForm,
  OffcutSource,
  RequirementForm,
} from 'src/features/optimizer/optimizerForm'
import type {
  InlineMaterialInput,
  MaterialInput,
  OptimizeResponse,
  PackingStrategy,
  RequirementInput,
} from 'src/features/optimizer/types'
import type { PreOrder, PreOrderStatus } from './types'
import {
  buildPayload,
  cloneMaterial,
  emptyCatalogMaterial,
  emptyEdgeBanding,
  nextUid,
  piecesMissingBandingProduct,
  piecesSummary,
} from 'src/features/optimizer/optimizerForm'
import { cilArrowLeft, cilCloudDownload, cilCopy, cilExternalLink, cilTrash } from '@coreui/icons'
import { downloadCsv, requirementsToCsv } from 'src/features/optimizer/piecesCsv'
import { useBoards, useEdgeBandings } from 'src/features/optimizer/useOptimizer'
import {
  useCreatePreOrderReviewLink,
  useDeletePreOrder,
  usePreOrder,
  usePreOrderReviewLinkInfo,
  useUpdatePreOrder,
} from './usePreOrders'
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { ApiError } from 'src/shared/api/types'
import { clientName, fmtDate, fmtDateTime } from 'src/shared/utils/format'
import CIcon from '@coreui/icons-react'
import DeleteMaterialModal from 'src/features/optimizer/DeleteMaterialModal'
import ImportPiecesModal from 'src/features/optimizer/ImportPiecesModal'
import MaterialGroups from 'src/features/optimizer/MaterialGroups'
import ServiceLines, {
  buildServiceLines,
  emptyServiceLine,
  serviceLineFromApi,
  type ServiceLineForm,
} from './ServiceLines'
import { useServices } from 'src/features/services/useServices'
import OptimizationPreview from 'src/features/optimizer/OptimizationPreview'
import OptimizeActionBar from 'src/features/optimizer/OptimizeActionBar'
import PreOrderStatusBadge from './PreOrderStatusBadge'
import PriceTierSelect from 'src/features/settings/PriceTierSelect'
import StatusHistoryCard from 'src/shared/components/StatusHistoryCard'
import ReferenceNote from 'src/shared/components/ReferenceNote'
import { preordersApi } from './preordersApi'
import { useIsGlobalBranchRole } from 'src/features/auth/useAuth'
import { usePiecesEditor } from 'src/features/optimizer/usePiecesEditor'

// Convert stored API format back to editable form state
function formFromPreOrderData(
  materials: MaterialInput[],
  requirements: RequirementInput[],
): { materials: MaterialForm[]; requirements: RequirementForm[] } {
  const keyToUid = new Map<string, string>()
  // Catalog forms indexed by material key so pooled offcuts can re-attach to them.
  const catalogByKey = new Map<string, MaterialForm>()
  const matForms: MaterialForm[] = []
  const pooledOffcuts: InlineMaterialInput[] = []

  for (const m of materials) {
    // A pooled offcut is not its own group: it re-attaches to its parent board.
    if (m.source !== 'catalog' && m.poolKey) {
      pooledOffcuts.push(m)
      continue
    }
    const uid = nextUid()
    keyToUid.set(m.key, uid)
    if (m.source === 'catalog') {
      const form: MaterialForm = {
        uid,
        source: 'catalog',
        boardId: String(m.productId),
        label: '',
        height: '',
        width: '',
        thickness: '',
        costPerUnit: '',
        offcuts: [],
        fillOrder: m.fillOrder ?? 'auto',
      }
      catalogByKey.set(m.key, form)
      matForms.push(form)
    } else {
      matForms.push({
        uid,
        source: m.source,
        boardId: '',
        label: m.label ?? '',
        height: m.height,
        width: m.width,
        thickness: m.thickness,
        costPerUnit: m.costPerUnit ?? 0,
      })
    }
  }

  // Re-attach each pooled offcut to its parent catalog board (orphans ignored).
  for (const o of pooledOffcuts) {
    const parent = o.poolKey ? catalogByKey.get(o.poolKey) : undefined
    if (!parent) continue
    const source: OffcutSource = o.source === 'companyOffcut' ? 'companyOffcut' : 'clientOffcut'
    const offcut: OffcutForm = {
      uid: nextUid(),
      source,
      label: o.label ?? '',
      height: o.height,
      width: o.width,
      thickness: o.thickness,
      costPerUnit: o.costPerUnit ?? 0,
      quantity: o.quantity ?? 1,
    }
    parent.offcuts = [...(parent.offcuts ?? []), offcut]
  }
  const reqForms: RequirementForm[] = requirements.map((r) => ({
    materialUid: keyToUid.get(r.materialKey) ?? '',
    height: r.height,
    width: r.width,
    quantity: r.quantity,
    priority: r.priority,
    label: r.label ?? '',
    canRotate: r.canRotate,
    edgeBanding: r.edgeBanding
      ? {
          productId: String(r.edgeBanding.productId),
          sides: {
            top: r.edgeBanding.sides.includes('top'),
            bottom: r.edgeBanding.sides.includes('bottom'),
            left: r.edgeBanding.sides.includes('left'),
            right: r.edgeBanding.sides.includes('right'),
          },
        }
      : emptyEdgeBanding(),
  }))
  return { materials: matForms, requirements: reqForms }
}

const LINK_STATUS_LABELS: Record<string, string> = {
  active: 'Activo',
  used: 'Usado por el cliente',
  revoked: 'Reemplazado',
}

// Stable signature of everything `handleSave` persists. Used to keep "Actualizar" disabled until the
// user actually changes something. Built from the normalized payload (via buildPayload/buildServiceLines)
// so cosmetic edits (an empty row, internal reclustering) don't register as real changes.
function editSignature(
  materials: MaterialForm[],
  requirements: RequirementForm[],
  services: ServiceLineForm[],
  notes: string,
  priceTierCode: string,
  strategy: PackingStrategy,
  variant: number,
): string {
  const { materials: mInputs, requirements: rInputs } = buildPayload(materials, requirements)
  return JSON.stringify({
    materials: mInputs,
    requirements: rInputs,
    additionalServices: buildServiceLines(services),
    notes: notes || '',
    priceTierCode,
    strategy,
    variant,
  })
}

// Inner component: receives an already-loaded pre-order
const PreOrderView = ({ preOrder }: { preOrder: PreOrder }) => {
  const navigate = useNavigate()
  const isGlobalBranch = useIsGlobalBranchRole()
  const canEdit = ['draft', 'sent', 'changes_requested'].includes(preOrder.status)

  // Compute initial form state only once at mount from API-provided fields.
  const initialFormData = useMemo(() => {
    if (preOrder.materials?.length && preOrder.requirements) {
      return formFromPreOrderData(preOrder.materials, preOrder.requirements)
    }
    return null
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const [materials, setMaterials] = useState<MaterialForm[]>(
    () => initialFormData?.materials ?? [emptyCatalogMaterial()],
  )
  const [services, setServices] = useState<ServiceLineForm[]>(() =>
    (preOrder.additionalServices ?? []).map(serviceLineFromApi),
  )
  const [notes, setNotes] = useState(preOrder.notes ?? '')
  const [priceTierCode, setPriceTierCode] = useState(preOrder.priceTierCode ?? 'consumidor')
  const [strategy, setStrategy] = useState<PackingStrategy>(
    preOrder.optimization.strategy ?? 'default',
  )
  // Alternative-solution seed: persisted with the pre-order so every recompute
  // reproduces the chosen layout; bumped by "Otra alternativa".
  const [variant, setVariant] = useState(preOrder.variant ?? preOrder.optimization.variant ?? 0)
  const [showImport, setShowImport] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<MaterialForm | null>(null)
  const [optimization, setOptimization] = useState<OptimizeResponse>(preOrder.optimization)
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null)
  const [showRegenModal, setShowRegenModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [copied, setCopied] = useState(false)

  const editor = usePiecesEditor(materials, initialFormData?.requirements)

  // "Dirty" tracking: keep "Actualizar" disabled until the editable state differs from the loaded
  // baseline. The baseline is seeded once (from the same normalized path as `currentSignature`, so it
  // always matches at mount) and re-synced after a successful save.
  const currentSignature = editSignature(
    materials,
    editor.requirements,
    services,
    notes,
    priceTierCode,
    strategy,
    variant,
  )
  const [baselineSignature, setBaselineSignature] = useState(() => currentSignature)
  const isDirty = currentSignature !== baselineSignature

  const { data: boards = [] } = useBoards()
  const { data: edgeBandings = [] } = useEdgeBandings()
  const { data: servicesCatalog } = useServices({ isActive: true, limit: 100 })
  const serviceCatalog = servicesCatalog?.items ?? []
  const updatePreOrder = useUpdatePreOrder()
  const deletePreOrder = useDeletePreOrder()
  const createReviewLink = useCreatePreOrderReviewLink()
  const reviewLinkInfo = usePreOrderReviewLinkInfo(preOrder.id, preOrder.status)

  const doSave = (variantValue: number) => {
    const { materials: mInputs, requirements: rInputs } = buildPayload(
      materials,
      editor.requirements,
    )
    updatePreOrder.mutate(
      {
        id: preOrder.id,
        data: {
          materials: mInputs,
          requirements: rInputs,
          additionalServices: buildServiceLines(services),
          notes: notes || undefined,
          priceTierCode,
          strategy,
          variant: variantValue,
        },
      },
      {
        onSuccess: (updated) => {
          setOptimization(updated.optimization)
          // The saved state is the new baseline, so "Actualizar" disables again until further edits.
          setBaselineSignature(
            editSignature(
              materials,
              editor.requirements,
              services,
              notes,
              priceTierCode,
              strategy,
              variantValue,
            ),
          )
        },
      },
    )
  }

  const handleSave = () => doSave(variant)

  // "Otra alternativa": bump the seed and save+recompute immediately — the
  // pre-order persists the seed so the alternative survives every recompute.
  const handleAlternative = () => {
    const next = variant + 1
    setVariant(next)
    doSave(next)
  }

  const addMaterial = () => setMaterials((ms) => [...ms, emptyCatalogMaterial()])

  const updateMaterial = <K extends keyof MaterialForm>(
    uid: string,
    field: K,
    value: MaterialForm[K],
  ) => setMaterials((ms) => ms.map((m) => (m.uid === uid ? { ...m, [field]: value } : m)))

  const addService = () => setServices((ss) => [...ss, emptyServiceLine()])
  const updateService = <K extends keyof ServiceLineForm>(
    uid: string,
    field: K,
    value: ServiceLineForm[K],
  ) => setServices((ss) => ss.map((s) => (s.uid === uid ? { ...s, [field]: value } : s)))
  const removeService = (uid: string) => setServices((ss) => ss.filter((s) => s.uid !== uid))

  // Duplicates a material section together with all of its pieces (same behavior as the optimizer).
  const duplicateMaterial = (m: MaterialForm) => {
    const clone = cloneMaterial(m)
    setMaterials((ms) => {
      const i = ms.findIndex((x) => x.uid === m.uid)
      return [...ms.slice(0, i + 1), clone, ...ms.slice(i + 1)]
    })
    editor.duplicateGroup(m.uid, clone.uid)
  }

  // Material removal is confirmed through DeleteMaterialModal: pieces are either moved to another
  // material or deleted along with it.
  const requestDeleteMaterial = (m: MaterialForm) => setDeleteTarget(m)

  const handleMovePieces = (destUid: string) => {
    if (!deleteTarget) return
    editor.movePiecesTo(deleteTarget.uid, destUid)
    setMaterials((ms) => ms.filter((m) => m.uid !== deleteTarget.uid))
    setDeleteTarget(null)
  }

  const handleDeleteMaterialWithPieces = () => {
    if (!deleteTarget) return
    editor.removePiecesOf(deleteTarget.uid)
    setMaterials((ms) => {
      const remaining = ms.filter((m) => m.uid !== deleteTarget.uid)
      return remaining.length ? remaining : [emptyCatalogMaterial()]
    })
    setDeleteTarget(null)
  }

  const handleGenerateLink = () => {
    createReviewLink.mutate(preOrder.id, {
      onSuccess: (link) => {
        setCopied(false)
        setGeneratedUrl(link.url)
        setShowRegenModal(false)
      },
    })
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generatedUrl ?? '')
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  const handleDelete = () => {
    deletePreOrder.mutate(preOrder.id, {
      onSuccess: () => void navigate('/preorders'),
    })
  }

  const summary = piecesSummary(editor.requirements, materials)
  const canSave = summary.pieces > 0
  // Pieces with banding sides but no tapacanto: block updating the quote until resolved.
  const missingBanding = piecesMissingBandingProduct(editor.requirements)
  const saveDisabledHint =
    missingBanding.length > 0
      ? 'Falta seleccionar el tapacanto'
      : canSave && !isDirty
        ? 'Sin cambios por guardar'
        : undefined

  const isMissingPhone =
    createReviewLink.error instanceof ApiError &&
    (createReviewLink.error.message?.toLowerCase().includes('celular') ||
      createReviewLink.error.errors?.some((e) => e.message?.toLowerCase().includes('celular')))

  const clientLabel = clientName(preOrder.client)

  return (
    <>
      <div className="d-flex align-items-center gap-2 mb-3">
        <CButton
          variant="ghost"
          color="secondary"
          size="sm"
          onClick={() => void navigate('/preorders')}
        >
          <CIcon icon={cilArrowLeft} className="me-1" />
          Volver
        </CButton>
      </div>

      {/* Header card */}
      <CCard className="mb-3">
        <CCardBody>
          <CRow className="g-2 align-items-start">
            <CCol xs={12} md={6}>
              <div className="d-flex align-items-center gap-2 mb-1">
                <h5 className="mb-0">{preOrder.code}</h5>
                <PreOrderStatusBadge status={preOrder.status} />
              </div>
              <div className="text-body-secondary small">
                Cliente: <strong>{clientLabel}</strong>
              </div>
              {isGlobalBranch && (
                <div className="text-body-secondary small">
                  Sucursal: <strong>{preOrder.branch.name}</strong>
                  {preOrder.branch.code && <span> ({preOrder.branch.code})</span>}
                </div>
              )}
              {preOrder.source && (
                <div className="text-body-secondary small">Fuente: {preOrder.source}</div>
              )}
              {/* Reference: shown here even when the quote is closed (the editable card below
                  only renders while it can still be edited). Reflects the saved value. */}
              <ReferenceNote notes={preOrder.notes} variant="header" />
            </CCol>
            <CCol xs={12} md={6}>
              <div className="small">
                <div>
                  <span className="text-body-secondary">Creada:</span>{' '}
                  {fmtDateTime(preOrder.createdAt)}
                </div>
                {preOrder.sentAt && (
                  <div>
                    <span className="text-body-secondary">Enviada:</span>{' '}
                    {fmtDateTime(preOrder.sentAt)}
                  </div>
                )}
                {preOrder.confirmedAt && (
                  <div>
                    <span className="text-body-secondary">Confirmada:</span>{' '}
                    {fmtDateTime(preOrder.confirmedAt)}
                  </div>
                )}
                {preOrder.expiresAt && (
                  <div>
                    <span className="text-body-secondary">Vence:</span>{' '}
                    {fmtDate(preOrder.expiresAt)}
                  </div>
                )}
              </div>
            </CCol>
            <CCol xs={12}>
              <div className="d-flex gap-2 flex-wrap mt-1">
                {/* Saving lives in the sticky "Actualizar cotización" action bar below, so there is
                    no redundant save button up here. */}
                {canEdit && (
                  <CButton
                    color="secondary"
                    variant="outline"
                    size="sm"
                    onClick={
                      reviewLinkInfo.data ? () => setShowRegenModal(true) : handleGenerateLink
                    }
                    disabled={createReviewLink.isPending}
                  >
                    {createReviewLink.isPending ? (
                      <CSpinner size="sm" />
                    ) : reviewLinkInfo.data ? (
                      'Regenerar enlace'
                    ) : (
                      'Generar enlace'
                    )}
                  </CButton>
                )}
                <CButton
                  color="secondary"
                  variant="outline"
                  size="sm"
                  onClick={() => void preordersApi.downloadProforma(preOrder.id)}
                >
                  <CIcon icon={cilCloudDownload} className="me-1" />
                  Proforma PDF
                </CButton>
                {preOrder.status === 'confirmed' && preOrder.orderId && (
                  <CButton
                    color="success"
                    variant="outline"
                    size="sm"
                    onClick={() => void navigate(`/orders/${preOrder.orderId}`)}
                  >
                    <CIcon icon={cilExternalLink} className="me-1" />
                    Ver orden
                  </CButton>
                )}
                {canEdit && (
                  <CButton
                    color="danger"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowDeleteModal(true)}
                  >
                    <CIcon icon={cilTrash} />
                  </CButton>
                )}
              </div>
              {updatePreOrder.error && (
                <CAlert color="danger" className="mt-2 mb-0 py-2 small">
                  {updatePreOrder.error.message || 'Error al guardar la cotización.'}
                </CAlert>
              )}
              {createReviewLink.error && (
                <CAlert
                  color={isMissingPhone ? 'warning' : 'danger'}
                  className="mt-2 mb-0 py-2 small"
                >
                  {isMissingPhone
                    ? 'El cliente no tiene celular registrado. Registra un número antes de generar el enlace.'
                    : createReviewLink.error.message || 'Error al generar el enlace.'}
                </CAlert>
              )}
            </CCol>
          </CRow>
        </CCardBody>
      </CCard>

      {/* Status alerts */}
      {preOrder.status === 'changes_requested' && (
        <CAlert color="warning" className="mb-3">
          <strong>El cliente solicitó cambios.</strong> Edita la cotización y vuelve a generar el
          enlace para que el cliente la revise.
          {preOrder.clientNote && (
            <div className="mt-2 p-2 bg-white bg-opacity-50 rounded small">
              <strong>Nota del cliente:</strong> {preOrder.clientNote}
            </div>
          )}
        </CAlert>
      )}
      {preOrder.status === 'confirmed' && (
        <CAlert color="success" className="mb-3">
          Cotización confirmada.
          {preOrder.orderId && ` Se generó la orden de producción.`}
        </CAlert>
      )}
      {preOrder.status === 'rejected' && (
        <CAlert color="danger" className="mb-3">
          Cotización rechazada por el cliente.
        </CAlert>
      )}
      {preOrder.status === 'expired' && (
        <CAlert color="warning" className="mb-3">
          Esta cotización venció{preOrder.expiresAt ? ` el ${fmtDate(preOrder.expiresAt)}` : ''}.
        </CAlert>
      )}

      {/* Existing review link info */}
      {['draft', 'sent', 'changes_requested'].includes(preOrder.status) && reviewLinkInfo.data && (
        <CCard className="mb-3">
          <CCardHeader>
            <strong>Enlace de revisión</strong>
          </CCardHeader>
          <CCardBody className="small">
            <div>
              Estado:{' '}
              <strong>
                {LINK_STATUS_LABELS[reviewLinkInfo.data.status] ?? reviewLinkInfo.data.status}
              </strong>
            </div>
            <div className="text-body-secondary">
              Creado: {fmtDateTime(reviewLinkInfo.data.createdAt)} · Vence:{' '}
              {fmtDate(reviewLinkInfo.data.expiresAt)}
              {reviewLinkInfo.data.usedAt && ` · Usado: ${fmtDateTime(reviewLinkInfo.data.usedAt)}`}
            </div>
          </CCardBody>
        </CCard>
      )}

      {/* Status history — actor label + actor type badge; see StatusHistoryCard. */}
      <StatusHistoryCard
        entries={preOrder.history ?? []}
        renderStatus={(s) => <PreOrderStatusBadge status={s as PreOrderStatus} />}
      />

      {/* Notes + price tier (editable) */}
      {canEdit && (
        <CCard className="mb-3">
          <CCardHeader>
            <strong>Referencia y precio</strong>
          </CCardHeader>
          <CCardBody>
            <div className="mb-3">
              <label className="form-label">Nivel de precio</label>
              <PriceTierSelect value={priceTierCode} onChange={setPriceTierCode} />
            </div>
            <label className="form-label">Referencia</label>
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
          </CCardBody>
        </CCard>
      )}

      {/* Edit form: grouped materials + pieces (same experience as the optimizer) */}
      {canEdit && (
        <MaterialGroups
          editor={editor}
          materials={materials}
          boards={boards}
          edgeBandings={edgeBandings}
          onAddMaterial={addMaterial}
          onUpdateMaterial={updateMaterial}
          onRequestDeleteMaterial={requestDeleteMaterial}
          onDuplicateMaterial={duplicateMaterial}
          onImportOpen={() => setShowImport(true)}
          onExport={() =>
            downloadCsv('piezas.csv', requirementsToCsv(editor.requirements, materials, boards))
          }
        />
      )}

      {canEdit && missingBanding.length > 0 && (
        <CAlert color="warning" className="py-2 small">
          {missingBanding.length === 1
            ? `La pieza #${missingBanding.map((i) => i + 1).join('')} tiene canto definido pero no seleccionaste el tapacanto.`
            : `Hay ${missingBanding.length} piezas con canto definido pero sin tapacanto (#${missingBanding
                .map((i) => i + 1)
                .join(', #')}).`}{' '}
          Selecciona el tapacanto para poder actualizar la cotización.
        </CAlert>
      )}

      {/* Additional services (perforación, armado, …): billed on top of the cut,
          default price from the catalog but editable per line. */}
      {canEdit && (
        <ServiceLines
          services={services}
          catalog={serviceCatalog}
          onAdd={addService}
          onUpdate={updateService}
          onRemove={removeService}
        />
      )}

      {/* Optimization result — the sticky action bar below drives "Optimizar" (Save+Recalculate) */}
      <OptimizationPreview
        result={optimization}
        isPending={updatePreOrder.isPending}
        error={updatePreOrder.error}
      />

      {/* Sticky action bar: cut heuristic + "Optimizar". In pre-orders this saves and recomputes
          server-side; there is no separate "Crear cotización" (this view already is the quote). */}
      {canEdit && (
        <OptimizeActionBar
          strategy={strategy}
          onStrategyChange={setStrategy}
          canOptimize={canSave && isDirty && missingBanding.length === 0}
          isPending={updatePreOrder.isPending}
          hasResult={!!optimization}
          onOptimize={handleSave}
          optimizeLabel="Actualizar cotización"
          disabledHint={saveDisabledHint}
          onAlternative={handleAlternative}
          variant={variant}
          canAlternative={canSave && missingBanding.length === 0}
        />
      )}

      {/* Delete material modal: move its pieces to another material or delete them together */}
      <DeleteMaterialModal
        material={deleteTarget}
        pieceCount={
          deleteTarget
            ? editor.requirements.filter((r) => r.materialUid === deleteTarget.uid).length
            : 0
        }
        otherMaterials={deleteTarget ? materials.filter((m) => m.uid !== deleteTarget.uid) : []}
        boards={boards}
        onMove={handleMovePieces}
        onDeleteWithPieces={handleDeleteMaterialWithPieces}
        onClose={() => setDeleteTarget(null)}
      />

      {/* Import pieces modal */}
      <ImportPiecesModal
        visible={showImport}
        materials={materials}
        boards={boards}
        onClose={() => setShowImport(false)}
        onImport={(rows, replace) => {
          editor.addMany(rows, replace)
          setShowImport(false)
        }}
      />

      {/* Generated link modal (shown once; token is not recoverable) */}
      <CModal visible={!!generatedUrl} onClose={() => setGeneratedUrl(null)}>
        <CModalHeader>
          <CModalTitle>Enlace de revisión generado</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <CAlert color="warning" className="py-2 small">
            Copia este enlace ahora. Por seguridad, no se puede recuperar después de cerrar.
          </CAlert>
          <CInputGroup>
            <CFormInput value={generatedUrl ?? ''} readOnly />
            <CButton color="primary" onClick={() => void handleCopy()}>
              <CIcon icon={cilCopy} className="me-1" />
              {copied ? '¡Copiado!' : 'Copiar'}
            </CButton>
          </CInputGroup>
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" onClick={() => setGeneratedUrl(null)}>
            Cerrar
          </CButton>
        </CModalFooter>
      </CModal>

      {/* Regenerate confirmation modal */}
      <CModal visible={showRegenModal} onClose={() => setShowRegenModal(false)}>
        <CModalHeader>
          <CModalTitle>Regenerar enlace</CModalTitle>
        </CModalHeader>
        <CModalBody>
          El enlace anterior dejará de funcionar de inmediato. ¿Generar uno nuevo?
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" onClick={() => setShowRegenModal(false)}>
            Cancelar
          </CButton>
          <CButton
            color="primary"
            onClick={handleGenerateLink}
            disabled={createReviewLink.isPending}
          >
            {createReviewLink.isPending ? <CSpinner size="sm" /> : 'Regenerar'}
          </CButton>
        </CModalFooter>
      </CModal>

      {/* Delete confirmation modal */}
      <CModal visible={showDeleteModal} onClose={() => setShowDeleteModal(false)}>
        <CModalHeader>
          <CModalTitle>Eliminar cotización</CModalTitle>
        </CModalHeader>
        <CModalBody>
          ¿Eliminar <strong>{preOrder.code}</strong>? Esta acción no puede deshacerse.
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" onClick={() => setShowDeleteModal(false)}>
            Cancelar
          </CButton>
          <CButton color="danger" onClick={handleDelete} disabled={deletePreOrder.isPending}>
            {deletePreOrder.isPending ? <CSpinner size="sm" /> : 'Eliminar'}
          </CButton>
        </CModalFooter>
      </CModal>
    </>
  )
}

// Page shell: handles loading/error, then delegates to PreOrderView
const PreOrderDetailPage = () => {
  const { id } = useParams<{ id: string }>()
  const numId = id ? Number(id) : undefined
  const { data: preOrder, isLoading, error } = usePreOrder(numId)

  if (isLoading) {
    return (
      <div className="text-center py-5">
        <CSpinner color="primary" />
      </div>
    )
  }

  if (error || !preOrder) {
    return <CAlert color="danger">No se pudo cargar la cotización.</CAlert>
  }

  return <PreOrderView preOrder={preOrder} />
}

export default PreOrderDetailPage
