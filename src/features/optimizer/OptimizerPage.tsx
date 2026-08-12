import { useCallback, useEffect, useRef, useState } from 'react'
import { CAlert, CButton, CSpinner } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import {
  cilCart,
  cilCheckAlt,
  cilFolderOpen,
  cilFullscreen,
  cilFullscreenExit,
  cilPlus,
  cilSave,
} from '@coreui/icons'

import useFullscreen from 'src/shared/hooks/useFullscreen'
import AppToaster from 'src/shared/components/AppToaster'
import { useToastStore } from 'src/shared/store/toastStore'
import { useBoards, useEdgeBandings, useOptimize } from './useOptimizer'
import { useSaveDraft } from './useDrafts'
import { draftsApi } from './draftsApi'
import {
  buildPayload,
  cloneMaterial,
  emptyCatalogMaterial,
  isPristineMaterial,
  isRequirementEmpty,
  piecesMissingBandingProduct,
  requirementIssues,
} from './optimizerForm'
import type { MaterialForm, RequirementForm, RequirementIssue } from './optimizerForm'
import type { OptimizerDraftPayload, PackingStrategy } from './types'
import { clearAutosave, loadAutosave, saveAutosave } from './optimizerStorage'
import { downloadCsv, requirementsToCsv } from './piecesCsv'
import { usePiecesEditor } from './usePiecesEditor'
import MaterialGroups from './MaterialGroups'
import OptimizationPreview from './OptimizationPreview'
import SplitPane from './SplitPane'
import DeleteMaterialModal from './DeleteMaterialModal'
import ImportPiecesModal from './ImportPiecesModal'
import CreateQuoteModal from './CreateQuoteModal'
import DraftsModal from './DraftsModal'
import SaveDraftModal from './SaveDraftModal'

const SPLIT_KEY = 'cutter:optimizer:split:v1'

// One-line summary of the blocked rows, for the toast. The per-row reasons stay in the alert.
const issuesSummary = (issues: RequirementIssue[]): string => {
  const rows = issues.map((i) => `#${i.index + 1}`).join(', ')
  return issues.length === 1
    ? `No se optimizó: la fila ${rows} está incompleta (${issues[0]?.reasons.join(', ')}).`
    : `No se optimizó: ${issues.length} piezas incompletas (filas ${rows}).`
}

const OptimizerPage = () => {
  // Safety net: read the previous session's autosave ONCE (lazy initializer) and use it
  // to hydrate the initial state, instead of a mount effect with setState.
  const [bootstrap] = useState(loadAutosave)

  const [materials, setMaterials] = useState<MaterialForm[]>(
    () => bootstrap?.materials ?? [emptyCatalogMaterial()],
  )
  const [showQuote, setShowQuote] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<MaterialForm | null>(null)

  // --- Draft persistence ---
  const [draftId, setDraftId] = useState<number | null>(bootstrap?.draftId ?? null)
  const [draftName, setDraftName] = useState(bootstrap?.draftName ?? '')
  const [showDrafts, setShowDrafts] = useState(false)
  const [showSaveDraft, setShowSaveDraft] = useState(false)
  const [priceTierCode, setPriceTierCode] = useState('consumidor')
  const [strategy, setStrategy] = useState<PackingStrategy>('longOffcuts')
  // Alternative-solution seed: bumped by "Otra alternativa" to explore different layouts.
  const [variant, setVariant] = useState(0)
  const [restored, setRestored] = useState(!!bootstrap)
  const [loadingDraftId, setLoadingDraftId] = useState<number | null>(null)
  const [savedFlash, setSavedFlash] = useState(false)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Half-filled rows found on the last Optimizar attempt; blocks the run until they are fixed.
  const [issues, setIssues] = useState<RequirementIssue[]>([])

  const {
    containerRef,
    isFullscreen,
    isSupported: canFullscreen,
    toggle,
  } = useFullscreen<HTMLDivElement>()
  // Modals must portal INSIDE the fullscreen host, not into document.body which sits outside it.
  const modalContainer = useCallback(() => containerRef.current, [containerRef])
  const addToast = useToastStore((s) => s.addToast)

  const { data: boards = [] } = useBoards()
  const { data: edgeBandings = [] } = useEdgeBandings()
  const optimize = useOptimize()
  const pieces = usePiecesEditor(materials, bootstrap?.requirements)
  const saveDraft = useSaveDraft()

  const addMaterial = () => setMaterials((ms) => [...ms, emptyCatalogMaterial()])
  const updateMaterial = <K extends keyof MaterialForm>(
    uid: string,
    field: K,
    value: MaterialForm[K],
  ) => setMaterials((ms) => ms.map((m) => (m.uid === uid ? { ...m, [field]: value } : m)))

  // Duplicates a material section together with all of its pieces: a fresh-uid material clone is
  // inserted right after the source, and its pieces are cloned and re-pointed to the new uid.
  const duplicateMaterial = (m: MaterialForm) => {
    const clone = cloneMaterial(m)
    setMaterials((ms) => {
      const i = ms.findIndex((x) => x.uid === m.uid)
      return [...ms.slice(0, i + 1), clone, ...ms.slice(i + 1)]
    })
    pieces.duplicateGroup(m.uid, clone.uid)
  }

  // Material removal is confirmed through DeleteMaterialModal: pieces are either moved to another
  // material or deleted along with it.
  const requestDeleteMaterial = (m: MaterialForm) => setDeleteTarget(m)

  const handleMovePieces = (destUid: string) => {
    if (!deleteTarget) return
    pieces.movePiecesTo(deleteTarget.uid, destUid)
    setMaterials((ms) => ms.filter((m) => m.uid !== deleteTarget.uid))
    setDeleteTarget(null)
  }

  const handleDeleteMaterialWithPieces = () => {
    if (!deleteTarget) return
    pieces.removePiecesOf(deleteTarget.uid)
    setMaterials((ms) => {
      const remaining = ms.filter((m) => m.uid !== deleteTarget.uid)
      return remaining.length ? remaining : [emptyCatalogMaterial()]
    })
    setDeleteTarget(null)
  }

  const built = buildPayload(materials, pieces.requirements)
  const canOptimize = built.validCount > 0
  // Pieces with banding sides but no tapacanto: fine to optimize (geometry), but block quoting.
  const missingBanding = piecesMissingBandingProduct(pieces.requirements)
  const canCreateQuote = canOptimize && missingBanding.length === 0

  const hasPieceData = pieces.requirements.some((r) => !isRequirementEmpty(r))
  // "Optimizar" stays clickable as soon as any row has data, even when none is valid yet: gating it
  // on `canOptimize` would leave a sheet of half-filled rows with a dead button and no explanation
  // of what is missing. The click reports the issues instead.
  const canRunOptimize = hasPieceData

  // Is there work that would be lost on reset? (more than one material, any with data, or non-empty pieces)
  const hasWork =
    materials.length > 1 ||
    materials.some((m) => m.boardId || m.label || m.height !== '' || m.width !== '') ||
    hasPieceData

  // Debounced autosave: persists the form state as-is (including incomplete rows).
  // If the form is empty (e.g. after "New"/"Discard"), clears instead of writing an empty state,
  // so a later refresh does not show the "restored" notice with no content.
  useEffect(() => {
    const t = setTimeout(() => {
      if (hasWork) {
        saveAutosave({
          version: 1,
          savedAt: Date.now(),
          draftId,
          draftName,
          materials,
          requirements: pieces.requirements,
        })
      } else {
        clearAutosave()
      }
    }, 800)
    return () => clearTimeout(t)
  }, [materials, pieces.requirements, draftId, draftName, hasWork])

  // Clean up the "Guardado" flash timer on unmount.
  useEffect(
    () => () => {
      if (flashTimer.current) clearTimeout(flashTimer.current)
    },
    [],
  )

  const flashSaved = () => {
    setSavedFlash(true)
    if (flashTimer.current) clearTimeout(flashTimer.current)
    flashTimer.current = setTimeout(() => setSavedFlash(false), 2000)
  }

  const draftPayload = (): OptimizerDraftPayload => ({
    version: 1,
    materials,
    requirements: pieces.requirements,
  })

  const resetWorkspace = () => {
    setMaterials([emptyCatalogMaterial()])
    pieces.clear()
    setDraftId(null)
    setDraftName('')
    setVariant(0)
    setIssues([])
    clearAutosave()
  }

  const handleNew = () => {
    if (
      hasWork &&
      !window.confirm('¿Empezar un trabajo nuevo? Se descartará lo que no hayas guardado.')
    )
      return
    resetWorkspace()
    setRestored(false)
  }

  const handleDiscardRestore = () => {
    resetWorkspace()
    setRestored(false)
  }

  // "Save draft": PUT if a draftId exists; otherwise prompt for a name and create (POST).
  const handleSaveDraft = () => {
    if (draftId) {
      saveDraft.mutate(
        { id: draftId, name: draftName, payload: draftPayload() },
        { onSuccess: flashSaved },
      )
    } else {
      setShowSaveDraft(true)
    }
  }

  const handleSaveNewDraft = (name: string, branchId: number | null) => {
    saveDraft.mutate(
      { name, payload: draftPayload(), branchId: branchId ?? undefined },
      {
        onSuccess: (d) => {
          setDraftId(d.id)
          setDraftName(d.name)
          setShowSaveDraft(false)
          flashSaved()
        },
      },
    )
  }

  // Load a draft from the server: fetches its detail and rebuilds the form exactly.
  const handleLoadDraft = async (id: number) => {
    setLoadingDraftId(id)
    try {
      const d = await draftsApi.get(id)
      setMaterials(d.payload.materials)
      pieces.addMany(d.payload.requirements, true)
      setDraftId(d.id)
      setDraftName(d.name)
      setRestored(false)
      setShowDrafts(false)
    } finally {
      setLoadingDraftId(null)
    }
  }

  const handleStrategyChange = (newStrategy: PackingStrategy) => {
    setStrategy(newStrategy)
    if (optimize.data && canOptimize) {
      optimize.mutate({
        materials: built.materials,
        requirements: built.requirements,
        priceTierCode,
        strategy: newStrategy,
        variant,
      })
    }
  }

  // Optimizing first cleans up after the editor and then refuses ambiguous input: blank rows (one is
  // left behind by every "Agregar pieza" and every Enter on the last row) are dropped silently, while
  // rows the user started but left half-filled block the run — sending them would quietly cut a
  // different job than the one on screen. `pruneEmpty` returns the new list so the payload can be
  // built in this same tick.
  const runOptimize = (nextVariant: number) => {
    const rows = pieces.pruneEmpty()
    const found = requirementIssues(rows, materials)
    setIssues(found)
    // A refusal must announce itself: the alert alone sits in the pieces pane, which may be scrolled
    // away from the button that was just pressed.
    if (found.length > 0) {
      addToast(issuesSummary(found), 'danger')
      return
    }
    const payload = buildPayload(materials, rows)
    if (payload.validCount === 0) {
      addToast('No hay piezas válidas para optimizar. Revisa materiales y medidas.', 'warning')
      return
    }
    optimize.mutate({
      materials: payload.materials,
      requirements: payload.requirements,
      priceTierCode,
      strategy,
      variant: nextVariant,
    })
  }

  const handleOptimize = () => runOptimize(variant)

  // "Otra alternativa": bump the seed and recompute — each seed yields a
  // deterministic, cached layout, genuinely different when alternatives exist.
  const handleAlternative = () => {
    if (!canOptimize) return
    const next = variant + 1
    setVariant(next)
    runOptimize(next)
  }

  // Import: pieces plus the material groups the CSV declared. "Replace" makes the workspace mirror
  // the file, so groups that received no piece are dropped; when appending, only the untouched
  // starter card is — otherwise every import would leave an empty "Tablero sin elegir" group behind.
  const handleImport = (
    rows: RequirementForm[],
    replace: boolean,
    newMaterials: MaterialForm[],
  ) => {
    const used = new Set(pieces.addMany(rows, replace).map((r) => r.materialUid))
    setMaterials((ms) => {
      const merged = [...ms, ...newMaterials]
      const kept = merged.filter((m) => used.has(m.uid) || (!replace && !isPristineMaterial(m)))
      return kept.length ? kept : [emptyCatalogMaterial()]
    })
  }

  const handleExport = () =>
    downloadCsv('piezas.csv', requirementsToCsv(pieces.requirements, materials, boards))

  return (
    <div ref={containerRef} className="optimizer-workspace">
      <div className="d-flex align-items-center justify-content-between mb-3 gap-2 flex-wrap">
        <h5 className="mb-0">Optimizador de corte</h5>
        <div className="d-flex gap-2 flex-wrap">
          {canFullscreen && (
            <CButton
              color="secondary"
              variant="outline"
              title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
              onClick={toggle}
            >
              <CIcon icon={isFullscreen ? cilFullscreenExit : cilFullscreen} className="me-1" />
              {isFullscreen ? 'Salir' : 'Pantalla completa'}
            </CButton>
          )}
          <CButton color="secondary" variant="outline" onClick={handleNew}>
            <CIcon icon={cilPlus} className="me-1" />
            Nuevo
          </CButton>
          <CButton color="secondary" variant="outline" onClick={() => setShowDrafts(true)}>
            <CIcon icon={cilFolderOpen} className="me-1" />
            Borradores
          </CButton>
          <CButton
            color="secondary"
            variant="outline"
            disabled={saveDraft.isPending}
            onClick={handleSaveDraft}
          >
            {saveDraft.isPending ? (
              <CSpinner size="sm" className="me-1" />
            ) : (
              <CIcon icon={savedFlash ? cilCheckAlt : cilSave} className="me-1" />
            )}
            {savedFlash ? 'Guardado' : 'Guardar borrador'}
          </CButton>
          <CButton color="primary" disabled={!canCreateQuote} onClick={() => setShowQuote(true)}>
            <CIcon icon={cilCart} className="me-1" />
            Crear cotización
          </CButton>
        </div>
      </div>

      {restored && (
        <CAlert
          color="info"
          className="d-flex align-items-center justify-content-between py-2"
          dismissible
          onClose={() => setRestored(false)}
        >
          <span className="small">
            Restauramos tu trabajo de la sesión anterior.
            {draftName && <strong> Borrador: {draftName}.</strong>}
          </span>
          <CButton color="info" variant="ghost" size="sm" onClick={handleDiscardRestore}>
            Descartar
          </CButton>
        </CAlert>
      )}

      {/* Pieces on the left, results on the right: editing a measurement and seeing what it does to
          the layout is the core loop, and stacking them meant never seeing both. */}
      <SplitPane
        storageKey={SPLIT_KEY}
        left={
          <>
            {/* Above the pieces, not below them: a list long enough to need this warning is long
                enough to bury it. The toast raised on the same click carries the summary. */}
            {issues.length > 0 && (
              <CAlert
                color="danger"
                className="py-2 small"
                dismissible
                onClose={() => setIssues([])}
              >
                <div className="fw-semibold mb-1">
                  {issues.length === 1
                    ? 'Hay una pieza incompleta:'
                    : `Hay ${issues.length} piezas incompletas:`}
                </div>
                <ul className="mb-0 ps-3">
                  {issues.map((it) => (
                    <li key={it.index}>
                      Fila #{it.index + 1}: {it.reasons.join(', ')}.
                    </li>
                  ))}
                </ul>
              </CAlert>
            )}

            <MaterialGroups
              editor={pieces}
              materials={materials}
              boards={boards}
              edgeBandings={edgeBandings}
              container={modalContainer}
              onAddMaterial={addMaterial}
              onUpdateMaterial={updateMaterial}
              onRequestDeleteMaterial={requestDeleteMaterial}
              onDuplicateMaterial={duplicateMaterial}
              onImportOpen={() => setShowImport(true)}
              onExport={handleExport}
              onClearMaterials={() => setMaterials([emptyCatalogMaterial()])}
            />

            {missingBanding.length > 0 && (
              <CAlert color="warning" className="py-2 small">
                {missingBanding.length === 1
                  ? `La pieza #${missingBanding.map((i) => i + 1).join('')} tiene canto definido pero no seleccionaste el tapacanto.`
                  : `Hay ${missingBanding.length} piezas con canto definido pero sin tapacanto (#${missingBanding
                      .map((i) => i + 1)
                      .join(', #')}).`}{' '}
                Selecciona el tapacanto para poder crear la cotización.
              </CAlert>
            )}
          </>
        }
        right={
          <div className="optimizer-rail">
            <OptimizationPreview
              result={optimize.data}
              isPending={optimize.isPending}
              error={optimize.error}
              canOptimize={canRunOptimize}
              onOptimize={handleOptimize}
              strategy={strategy}
              onStrategyChange={handleStrategyChange}
              onAlternative={handleAlternative}
              variant={variant}
              modalContainer={modalContainer}
            />
          </div>
        }
      />

      <DeleteMaterialModal
        material={deleteTarget}
        pieceCount={
          deleteTarget
            ? pieces.requirements.filter((r) => r.materialUid === deleteTarget.uid).length
            : 0
        }
        otherMaterials={deleteTarget ? materials.filter((m) => m.uid !== deleteTarget.uid) : []}
        boards={boards}
        onMove={handleMovePieces}
        onDeleteWithPieces={handleDeleteMaterialWithPieces}
        container={modalContainer}
        onClose={() => setDeleteTarget(null)}
      />

      <ImportPiecesModal
        visible={showImport}
        materials={materials}
        boards={boards}
        onImport={handleImport}
        container={modalContainer}
        onClose={() => setShowImport(false)}
      />

      <CreateQuoteModal
        visible={showQuote}
        onClose={() => setShowQuote(false)}
        materials={built.materials}
        requirements={built.requirements}
        priceTierCode={priceTierCode}
        onPriceTierChange={setPriceTierCode}
        strategy={strategy}
        variant={variant}
        onCreated={clearAutosave}
        container={modalContainer}
      />

      <DraftsModal
        visible={showDrafts}
        loadingId={loadingDraftId}
        onLoad={(id) => void handleLoadDraft(id)}
        container={modalContainer}
        onClose={() => setShowDrafts(false)}
      />

      <SaveDraftModal
        visible={showSaveDraft}
        isSaving={saveDraft.isPending}
        onSave={handleSaveNewDraft}
        container={modalContainer}
        onClose={() => setShowSaveDraft(false)}
        error={saveDraft.error}
      />

      {/* The layout's toaster sits outside this element, and fullscreen renders only this subtree —
          so a second renderer is mounted here to keep toasts visible. Both read the same store;
          rendering it twice is harmless because only one of them is painted at a time. */}
      {isFullscreen && <AppToaster />}
    </div>
  )
}

export default OptimizerPage
