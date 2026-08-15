import {
  CAlert,
  CBadge,
  CButton,
  CFormInput,
  CFormTextarea,
  CInputGroup,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
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
  isPristineMaterial,
  nextUid,
  piecesMissingBandingProduct,
  piecesSummary,
} from 'src/features/optimizer/optimizerForm'
import { cilCopy, cilLoopCircular, cilPencil } from '@coreui/icons'
import { downloadCsv, requirementsToCsv } from 'src/features/optimizer/piecesCsv'
import { useBoards, useEdgeBandings } from 'src/features/optimizer/useOptimizer'
import {
  useCreatePreOrderReviewLink,
  useDeletePreOrder,
  usePreOrder,
  usePreOrderReviewLinkInfo,
  useUpdatePreOrder,
} from './usePreOrders'
import { useCallback, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { ApiError } from 'src/shared/api/types'
import { clientName, fmtDate, fmtDateTime } from 'src/shared/utils/format'
import CIcon from '@coreui/icons-react'
import DeleteMaterialModal from 'src/features/optimizer/DeleteMaterialModal'
import ImportPiecesModal from 'src/features/optimizer/ImportPiecesModal'
import MaterialGroups from 'src/features/optimizer/MaterialGroups'
import ServiceLines from './ServiceLines'
import {
  buildServiceLines,
  serviceLineFromApi,
  useServiceLines,
  type ServiceLineForm,
} from './useServiceLines'
import { useServices } from 'src/features/services/useServices'
import OptimizationPreview from 'src/features/optimizer/OptimizationPreview'
import { WizardFooter } from 'src/features/optimizer/WizardSteps'
import PreOrderStatusBadge from './PreOrderStatusBadge'
import PreOrderStatusStrip from './PreOrderStatusStrip'
import PriceTierToggle from 'src/features/settings/PriceTierToggle'
import StatusHistoryTable from 'src/shared/components/StatusHistoryTable'
import ReferenceNote from 'src/shared/components/ReferenceNote'
import { isExpiringSoon, isOpen } from './status'
import { preordersApi } from './preordersApi'
import { useIsGlobalBranchRole } from 'src/features/auth/useAuth'
import { usePiecesEditor } from 'src/features/optimizer/usePiecesEditor'
import { useCollapsedGroups } from 'src/features/optimizer/useCollapsedGroups'
import { useEditorShortcuts } from 'src/features/optimizer/useEditorShortcuts'
import OptimizerActionsMenu from 'src/features/optimizer/OptimizerActionsMenu'
import PiecesSelectionBar from 'src/features/optimizer/PiecesSelectionBar'
import PiecesSummary from 'src/features/optimizer/PiecesSummary'

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

const areaFmt = new Intl.NumberFormat('es-EC', { maximumFractionDigits: 2 })

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
  const canEdit = isOpen(preOrder.status)

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
  const serviceLines = useServiceLines(() =>
    (preOrder.additionalServices ?? []).map(serviceLineFromApi),
  )
  const services = serviceLines.lines
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
  const [showHistory, setShowHistory] = useState(false)
  // Reference is edited through a modal on a draft, so "Cancelar" is just a close: `notes` (which
  // feeds the dirty signature) only moves when the user confirms.
  const [showReference, setShowReference] = useState(false)
  const [referenceDraft, setReferenceDraft] = useState('')
  const [copied, setCopied] = useState(false)

  // The despiece panel lives in a search param, not in component state: `AppContent` keys its
  // ErrorBoundary on `location.pathname`, so a sub-route would remount this page and destroy the
  // undo history, the selection and the loaded optimization. A search param leaves `pathname` alone,
  // which also makes the browser's Back button close the panel.
  const [searchParams, setSearchParams] = useSearchParams()
  const piecesOpen = canEdit && searchParams.get('panel') === 'piezas'
  const openPieces = () =>
    setSearchParams((p) => {
      p.set('panel', 'piezas')
      return p
    })
  // `replace` so "Listo" does not stack a second history entry on top of the one that opened it.
  const closePieces = () =>
    setSearchParams(
      (p) => {
        p.delete('panel')
        return p
      },
      { replace: true },
    )

  // Portal target for everything mounted inside the despiece panel. CoreUI appends portals to this
  // element, so it has to be inside the dialog's stacking context — the `.modal` root, reached from
  // an element in the body since CModal exposes no ref of its own.
  const piecesHostRef = useRef<HTMLDivElement>(null)
  const piecesContainer = useCallback(() => piecesHostRef.current?.closest('.modal') ?? null, [])

  const editor = usePiecesEditor(materials, initialFormData?.requirements)
  const groups = useCollapsedGroups(materials)
  // The pieces editor's shortcuts used to ride along inside `MaterialGroups`; that component is now
  // just the list, so each page that mounts it registers them itself. No fullscreen here.
  // All of these act on the pieces list, so all of them are scoped to the panel that shows it —
  // same rule the wizard follows: a shortcut reaches exactly as far as the menu entry that documents
  // it, and that menu now lives inside the panel. Off-panel they would edit a list nobody can see.
  // The "Trabajo" shortcuts stay unbound: drafts belong to the optimizer's scratch workspace.
  useEditorShortcuts({
    onUndo: piecesOpen && editor.canUndo ? editor.undo : undefined,
    onDeleteSelection: piecesOpen && editor.selected.size > 0 ? editor.removeSelected : undefined,
    onToggleCollapseAll: piecesOpen ? groups.toggleAll : undefined,
    onImport: piecesOpen ? () => setShowImport(true) : undefined,
    onExport: piecesOpen && editor.requirements.length > 0 ? () => exportPiecesCsv() : undefined,
  })

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

  // Named because both the menu entry and its Ctrl+Shift+S shortcut point at it.
  const exportPiecesCsv = () =>
    downloadCsv('piezas.csv', requirementsToCsv(editor.requirements, materials, boards))

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

  // Import: pieces plus the material groups the CSV declared. "Replace" makes the workspace mirror
  // the file, so groups that received no piece are dropped; when appending, only the untouched
  // starter card is — otherwise every import would leave an empty "Tablero sin elegir" group behind.
  const handleImport = (
    rows: RequirementForm[],
    replace: boolean,
    newMaterials: MaterialForm[],
  ) => {
    const used = new Set(editor.addMany(rows, replace).map((r) => r.materialUid))
    setMaterials((ms) => {
      const merged = [...ms, ...newMaterials]
      const kept = merged.filter((m) => used.has(m.uid) || (!replace && !isPristineMaterial(m)))
      return kept.length ? kept : [emptyCatalogMaterial()]
    })
    setShowImport(false)
  }

  const updateMaterial = <K extends keyof MaterialForm>(
    uid: string,
    field: K,
    value: MaterialForm[K],
  ) => setMaterials((ms) => ms.map((m) => (m.uid === uid ? { ...m, [field]: value } : m)))

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

  const expiringSoon = isExpiringSoon(preOrder.expiresAt, preOrder.status)
  const hasHistory = !!preOrder.history && preOrder.history.length > 0

  const openReference = () => {
    setReferenceDraft(notes)
    setShowReference(true)
  }
  const applyReference = () => {
    setNotes(referenceDraft)
    setShowReference(false)
  }

  return (
    <>
      {/* Identity. No card: the app header's breadcrumb says "Cotizaciones" and this says which one.
          Everything that was a button on the old header card is in the ⋮ menu — none of those four
          actions is used often enough to hold a permanent row, and none of them belongs one click
          away from the save button. */}
      <div className="d-flex align-items-start gap-2 mb-3">
        <div className="min-w-0">
          <div className="d-flex align-items-center gap-2">
            <h5 className="mb-0">{preOrder.code}</h5>
            {/* The badge opens the history. It is the natural handle for it: the history is the list
                of how this quote reached the status the badge is showing. */}
            {hasHistory ? (
              <button
                type="button"
                className="status-trigger"
                title="Ver historial de estados"
                onClick={() => setShowHistory(true)}
              >
                <PreOrderStatusBadge status={preOrder.status} />
              </button>
            ) : (
              <PreOrderStatusBadge status={preOrder.status} />
            )}
          </div>
          <div className="text-body-secondary small">
            {clientLabel}
            {preOrder.client.identifier && <span> @{preOrder.client.identifier}</span>}
            {isGlobalBranch && (
              <span>
                {' · '}
                {preOrder.branch.name}
                {preOrder.branch.code && ` (${preOrder.branch.code})`}
              </span>
            )}
            {preOrder.source && <span>{` · ${preOrder.source}`}</span>}
          </div>
          {/* The four stacked date lines of the old header, on one. */}
          <div className="text-body-secondary small">
            Creada {fmtDateTime(preOrder.createdAt)}
            {preOrder.sentAt && ` · Enviada ${fmtDateTime(preOrder.sentAt)}`}
            {preOrder.confirmedAt && ` · Confirmada ${fmtDateTime(preOrder.confirmedAt)}`}
            {preOrder.expiresAt && (
              <>
                {' · '}
                <span className={expiringSoon ? 'text-danger fw-semibold' : undefined}>
                  Vence {fmtDate(preOrder.expiresAt)}
                  {expiringSoon && ' ⚠'}
                </span>
              </>
            )}
          </div>
          {/* Always here, open or closed. The reference is a name for the job, not working content:
              as a permanent two-row textarea at the top of the surface it took the place a user
              looks at first to say something that changes maybe once. Now it reads as a line, and
              editing it is a modal — which also keeps this three-line header from jumping. */}
          <div className="d-flex align-items-baseline gap-2">
            {notes.trim() ? (
              <ReferenceNote notes={notes} variant="header" />
            ) : (
              <span className="text-body-secondary small fst-italic">Sin referencia</span>
            )}
            {canEdit && (
              <CButton
                color="link"
                size="sm"
                className="p-0 align-baseline text-nowrap"
                onClick={openReference}
              >
                {notes.trim() ? 'Editar' : 'Agregar'}
              </CButton>
            )}
          </div>
        </div>
        <div className="ms-auto">
          <OptimizerActionsMenu
            // Piezas and Vista are not here: they act on the despiece, and the despiece has its own
            // menu inside its panel. This one keeps what applies to the quote as a whole.
            //
            // The picker only; the run itself is the footer's primary button, and "Otra alternativa"
            // sits next to it. Passing `onOptimize` here would put a Ctrl+Enter hint on an item this
            // page binds no shortcut for.
            strategy={strategy}
            onStrategyChange={canEdit ? setStrategy : undefined}
            onProforma={() => void preordersApi.downloadProforma(preOrder.id)}
            onReviewLink={
              canEdit
                ? reviewLinkInfo.data
                  ? () => setShowRegenModal(true)
                  : handleGenerateLink
                : undefined
            }
            reviewLinkLabel={reviewLinkInfo.data ? 'Regenerar enlace' : 'Generar enlace'}
            isLinkPending={createReviewLink.isPending}
            onViewOrder={
              preOrder.status === 'confirmed' && preOrder.orderId
                ? () => void navigate(`/orders/${preOrder.orderId}`)
                : undefined
            }
            onDelete={canEdit ? () => setShowDeleteModal(true) : undefined}
          />
        </div>
      </div>

      {updatePreOrder.error && (
        <CAlert color="danger" className="py-2 small">
          {updatePreOrder.error.message || 'Error al guardar la cotización.'}
        </CAlert>
      )}
      {createReviewLink.error && (
        <CAlert color={isMissingPhone ? 'warning' : 'danger'} className="py-2 small">
          {isMissingPhone
            ? 'El cliente no tiene celular registrado. Registra un número antes de generar el enlace.'
            : createReviewLink.error.message || 'Error al generar el enlace.'}
        </CAlert>
      )}

      {/* Where the quote stands, plus its review link — one line instead of five blocks. */}
      <PreOrderStatusStrip
        status={preOrder.status}
        clientNote={preOrder.clientNote}
        orderId={preOrder.orderId}
        expiresAt={preOrder.expiresAt}
        link={reviewLinkInfo.data}
      />

      {/* One surface for the whole document. Each section carries a plain muted label instead of a
          card header: seven stacked cards said their own names seven times and framed content that
          already draws its own borders. */}
      <div className="surface">
        {/* The cut list as one line, the same shape as the diagram's. It renders for a closed quote
            too — the editor never did, so what was cut simply could not be seen once the quote was
            confirmed. The two counts that can block the update are badges rather than prose: from
            here you have to be able to tell the quote is stuck without opening anything. */}
        <div className="d-flex flex-wrap align-items-center gap-2 border rounded-3 p-2 mb-3">
          <span className="small text-body-secondary text-uppercase fw-semibold">Despiece</span>
          <span className="small">
            <strong>{materials.length}</strong> {materials.length === 1 ? 'material' : 'materiales'}{' '}
            · <strong>{summary.pieces}</strong> {summary.pieces === 1 ? 'pieza' : 'piezas'} ·{' '}
            <strong>{summary.units}</strong> {summary.units === 1 ? 'unidad' : 'unidades'} ·{' '}
            <strong>{areaFmt.format(summary.areaM2)} m²</strong>
          </span>
          {summary.invalid > 0 && <CBadge color="danger">{summary.invalid} incompletas</CBadge>}
          {missingBanding.length > 0 && (
            <CBadge color="warning">{missingBanding.length} sin tapacanto</CBadge>
          )}
          {canEdit && (
            <CButton
              size="sm"
              color="primary"
              variant="outline"
              className="ms-auto"
              onClick={openPieces}
            >
              <CIcon icon={cilPencil} className="me-1" />
              Editar despiece
            </CButton>
          )}
        </div>
        {canEdit && (
          <>
            {/* Additional services (perforación, armado, …): billed on top of the cut, default price
                from the catalog but editable per line. They stay on the summary rather than moving
                into the despiece panel: they are one or two rows and they belong with the costs. */}
            <div className="text-body-secondary small text-uppercase fw-semibold mb-2">
              Servicios adicionales
            </div>
            <ServiceLines
              services={services}
              catalog={serviceCatalog}
              onAdd={serviceLines.add}
              onUpdate={serviceLines.update}
              onRemove={serviceLines.remove}
            />
            <hr className="my-4" />
          </>
        )}

        {/* The result, with the price tier down on its totals row. The footer's primary button is
            what recomputes it: this page's "optimize" is Save+Recalculate, server-side. */}
        <OptimizationPreview
          result={optimization}
          isPending={updatePreOrder.isPending}
          error={updatePreOrder.error}
          priceTier={
            canEdit ? (
              <div className="d-flex flex-wrap align-items-center gap-2">
                <span className="text-body-secondary small text-uppercase fw-semibold">
                  Nivel de precio
                </span>
                <PriceTierToggle
                  value={priceTierCode}
                  onChange={setPriceTierCode}
                  disabled={updatePreOrder.isPending}
                />
              </div>
            ) : undefined
          }
        />
      </div>

      {/* Pinned footer: leaving, the running totals, the bulk actions, and the one primary action.
          It replaces OptimizeActionBar, a near-copy that sat at the sticky z-tier (1020) and so
          painted over the very dropdowns — "Mover a…" — that open upward out of it. */}
      {canEdit && (
        <WizardFooter
          onBack={() => void navigate('/preorders')}
          backLabel="Volver a cotizaciones"
          onNext={handleSave}
          nextLabel="Actualizar cotización"
          nextDisabled={
            !canSave || !isDirty || missingBanding.length > 0 || updatePreOrder.isPending
          }
          nextHint={saveDisabledHint}
          // No running totals and no selection bar here any more: both belong to the pieces list,
          // which now lives in its panel, and the Despiece row above already carries the counts.
        >
          {optimization && (
            <CButton
              color="secondary"
              variant="outline"
              type="button"
              disabled={!canSave || missingBanding.length > 0 || updatePreOrder.isPending}
              onClick={handleAlternative}
              title="Genera una distribución alternativa con las mismas piezas"
            >
              <CIcon icon={cilLoopCircular} className="me-1" />
              Otra alternativa
              {variant > 0 && <span className="ms-1 badge text-bg-secondary">#{variant}</span>}
            </CButton>
          )}
        </WizardFooter>
      )}

      {/* The despiece, full screen. Everything it needs travels with it — its own actions menu, its
          own running totals and selection bar — because the page's are behind the backdrop.
          `piecesContainer` is not optional: `SearchableSelect` always portals, and a dropdown left
          on document.body sits at z-index 1000, under this dialog's 1055. Every board picker and
          every tapacanto select would open behind the panel. */}
      <CModal visible={piecesOpen} onClose={closePieces} fullscreen scrollable>
        {/* The title grows to fill the bar rather than the ⋮ carrying `ms-auto`: Bootstrap's
            `.btn-close` inside a `.modal-header` already has `margin-left: auto`, so a second auto
            margin split the free space evenly and parked the menu in the middle of the header. */}
        <CModalHeader className="d-flex align-items-center gap-2">
          <CModalTitle className="flex-grow-1">Despiece · {preOrder.code}</CModalTitle>
          <OptimizerActionsMenu
            onImport={() => setShowImport(true)}
            onExport={exportPiecesCsv}
            exportDisabled={editor.requirements.length === 0}
            onClear={editor.clear}
            onToggleCollapseAll={groups.toggleAll}
            allCollapsed={groups.allCollapsed}
            collapseDisabled={materials.length === 0}
            container={piecesContainer}
          />
        </CModalHeader>
        <CModalBody ref={piecesHostRef}>
          {/* Above the list, not below it: a list long enough to need this warning is long enough
              to bury it. */}
          {missingBanding.length > 0 && (
            <CAlert color="warning" className="py-2 small">
              {missingBanding.length === 1
                ? `La pieza #${missingBanding.map((i) => i + 1).join('')} tiene canto definido pero no seleccionaste el tapacanto.`
                : `Hay ${missingBanding.length} piezas con canto definido pero sin tapacanto (#${missingBanding
                    .map((i) => i + 1)
                    .join(', #')}).`}{' '}
              Selecciona el tapacanto para poder actualizar la cotización.
            </CAlert>
          )}
          <MaterialGroups
            editor={editor}
            materials={materials}
            boards={boards}
            edgeBandings={edgeBandings}
            collapsed={groups.collapsed}
            onToggleGroup={groups.toggle}
            onAddMaterial={addMaterial}
            onUpdateMaterial={updateMaterial}
            onRequestDeleteMaterial={requestDeleteMaterial}
            onDuplicateMaterial={duplicateMaterial}
            container={piecesContainer}
            // The panel is the whole screen, so the rows may use it. At the default 55vh a long
            // material scrolled inside its own box with a third of the dialog empty underneath.
            tableMaxHeight="calc(100dvh - 20rem)"
          />
        </CModalBody>
        <CModalFooter className="d-flex flex-wrap align-items-center gap-2">
          <PiecesSelectionBar editor={editor} materials={materials} boards={boards} />
          <PiecesSummary requirements={editor.requirements} materials={materials} />
          <div className="ms-auto d-flex align-items-center gap-2">
            {/* Closing is not saving, and it never was: editing the list inline never persisted
                either. Said out loud here because a full-screen panel with a button reads more like
                a form than an inline list did. */}
            {isDirty && (
              <span className="text-body-secondary small d-none d-md-inline">
                Los cambios se guardan con «Actualizar cotización»
              </span>
            )}
            <CButton color="primary" onClick={closePieces}>
              Listo
            </CButton>
          </div>
        </CModalFooter>
      </CModal>

      {/* Status history, opened from the badge. It was a section at the foot of the surface, but a
          history is something you go and check, not something you read on the way to the totals. */}
      <CModal visible={showHistory} onClose={() => setShowHistory(false)} size="lg" scrollable>
        <CModalHeader>
          <CModalTitle>Historial de {preOrder.code}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <StatusHistoryTable
            entries={preOrder.history ?? []}
            renderStatus={(s) => <PreOrderStatusBadge status={s as PreOrderStatus} />}
          />
        </CModalBody>
      </CModal>

      {/* Reference */}
      <CModal visible={showReference} onClose={() => setShowReference(false)}>
        <CModalHeader>
          <CModalTitle>Referencia</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <CFormTextarea
            rows={2}
            maxLength={512}
            autoFocus
            value={referenceDraft}
            onChange={(e) => setReferenceDraft(e.target.value)}
            placeholder="Ej.: Proyecto Casa Pérez — cocina y closet"
          />
          <div className="form-text">
            Nombre del proyecto u obra. Se imprime en todos los documentos y la ve el cliente.
          </div>
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" onClick={() => setShowReference(false)}>
            Cancelar
          </CButton>
          <CButton color="primary" onClick={applyReference}>
            Listo
          </CButton>
        </CModalFooter>
      </CModal>

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
        container={piecesContainer}
      />

      {/* Import pieces modal */}
      <ImportPiecesModal
        visible={showImport}
        materials={materials}
        boards={boards}
        onClose={() => setShowImport(false)}
        onImport={handleImport}
        container={piecesContainer}
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
