import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

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
import type { OptimizeResponse, OptimizerDraftPayload, PackingStrategy } from './types'
import { clearAutosave, loadAutosave, saveAutosave } from './optimizerStorage'
import {
  buildServiceLines,
  serviceLineFromApi,
  useServiceLines,
} from 'src/features/preorders/useServiceLines'
import { downloadCsv, requirementsToCsv } from './piecesCsv'
import { usePiecesEditor } from './usePiecesEditor'
import { useCollapsedGroups } from './useCollapsedGroups'
import { useEditorShortcuts } from './useEditorShortcuts'
import { signatureOf, useOptimizerWizard } from './useOptimizerWizard'
import type { StepId } from './useOptimizerWizard'
import WizardSteps, { WizardFooter } from './WizardSteps'
import OptimizerActionsMenu from './OptimizerActionsMenu'
import PiecesSelectionBar from './PiecesSelectionBar'
import PiecesSummary from './PiecesSummary'
import PiecesStep from './steps/PiecesStep'
import LayoutStep from './steps/LayoutStep'
import CostsStep from './steps/CostsStep'
import QuoteStep from './steps/QuoteStep'
import DeleteMaterialModal from './DeleteMaterialModal'
import ImportPiecesModal from './ImportPiecesModal'
import DraftsModal from './DraftsModal'
import SaveDraftModal from './SaveDraftModal'

// One-line summary of the blocked rows, for the toast. The per-row reasons stay in the alert.
const issuesSummary = (issues: RequirementIssue[]): string => {
  const rows = issues.map((i) => `#${i.index + 1}`).join(', ')
  return issues.length === 1
    ? `No se optimizó: la fila ${rows} está incompleta (${issues[0]?.reasons.join(', ')}).`
    : `No se optimizó: ${issues.length} piezas incompletas (filas ${rows}).`
}

// Shell of the cut wizard: it owns every piece of workspace state and hands it to whichever step is
// active. The steps themselves are presentational. Nothing lives in a store because the step lives
// in a search param, which never changes `location.pathname` — so this component is never remounted
// and plain `useState` survives the whole flow.
const OptimizerPage = () => {
  // Safety net: read the previous session's autosave ONCE (lazy initializer) and use it
  // to hydrate the initial state, instead of a mount effect with setState.
  const [bootstrap] = useState(loadAutosave)

  const [materials, setMaterials] = useState<MaterialForm[]>(
    () => bootstrap?.materials ?? [emptyCatalogMaterial()],
  )
  const [showImport, setShowImport] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<MaterialForm | null>(null)

  // --- Draft persistence ---
  const [draftId, setDraftId] = useState<number | null>(bootstrap?.draftId ?? null)
  const [draftName, setDraftName] = useState(bootstrap?.draftName ?? '')
  const [showDrafts, setShowDrafts] = useState(false)
  const [showSaveDraft, setShowSaveDraft] = useState(false)
  const [priceTierCode, setPriceTierCode] = useState('consumidor')
  const [strategy, setStrategy] = useState<PackingStrategy>('default')
  // Alternative-solution seed: bumped by "Otra alternativa" to explore different layouts.
  const [variant, setVariant] = useState(0)
  const [loadingDraftId, setLoadingDraftId] = useState<number | null>(null)
  const [savedFlash, setSavedFlash] = useState(false)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // The per-board discount re-prices on the server (same cached cut plan, only the `pricing`
  // block moves), so a burst of checkbox clicks is collapsed into one request. `recalcScheduled`
  // turns the "Recalculando…" hint on from the CLICK: during the debounce window
  // `optimize.isPending` is still false, and the total on screen is one the user is about to
  // stop believing.
  const [recalcScheduled, setRecalcScheduled] = useState(false)
  const recalcTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Half-filled rows found on the last attempt to leave the Despiece step; blocks the advance.
  const [issues, setIssues] = useState<RequirementIssue[]>([])

  const {
    containerRef,
    isFullscreen,
    isSupported: canFullscreen,
    toggle,
  } = useFullscreen<HTMLDivElement>()
  // Modals and dropdown menus must portal INSIDE the fullscreen host: document.body sits outside
  // the fullscreen element, so anything portaled there mounts but is never painted.
  const modalContainer = useCallback(() => containerRef.current, [containerRef])
  const addToast = useToastStore((s) => s.addToast)

  const { data: boards = [] } = useBoards()
  const { data: edgeBandings = [] } = useEdgeBandings()
  const optimize = useOptimize()
  const pieces = usePiecesEditor(materials, bootstrap?.requirements)
  // Billed additional services (Costos step). Workspace state like the pieces: it has to survive
  // stepping between Costos and Cotización, land in the autosave, and ride in a saved draft.
  const services = useServiceLines(() => (bootstrap?.services ?? []).map(serviceLineFromApi))
  const saveDraft = useSaveDraft()
  const groups = useCollapsedGroups(materials)

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

  // Memoized because it also feeds the staleness signature, and it used to be rebuilt on every
  // render — including every keystroke in the pieces grid.
  const built = useMemo(
    () => buildPayload(materials, pieces.requirements),
    [materials, pieces.requirements],
  )
  const canOptimize = built.validCount > 0
  // Pieces with banding sides but no tapacanto: fine to optimize (geometry), but block quoting.
  const missingBanding = piecesMissingBandingProduct(pieces.requirements)

  const hasPieceData = pieces.requirements.some((r) => !isRequirementEmpty(r))
  // Optimizing stays available as soon as any row has data, even when none is valid yet: gating it
  // on `canOptimize` would leave a sheet of half-filled rows with a dead button and no explanation
  // of what is missing. The click reports the issues instead.
  const canRunOptimize = hasPieceData

  // `optimize.data` is wiped the moment a new run starts (query-core sets `data: undefined` on
  // 'pending'), so the last good result is kept here. Without it every recompute would momentarily
  // look like "no result": the wizard would drop its reachable step and bounce the user out of
  // Costos mid-recalculation, and the board would blank under the overlay instead of dimming.
  const [lastResult, setLastResult] = useState<OptimizeResponse | undefined>(undefined)
  const result = optimize.data ?? lastResult
  const hasResult = !!result

  // Signature of the current inputs, against the one that produced the result on screen. Both are
  // built from the payload actually SENT (post-prune), never from this render: pruning empty rows
  // changes the signature, and seeding it from here would make the auto-run loop.
  const signature = useMemo(
    () => signatureOf(built.materials, built.requirements, strategy, variant, priceTierCode),
    [built, strategy, variant, priceTierCode],
  )
  // Set on SUCCESS: it claims "the result on screen was computed from these inputs", which a failed
  // run has not earned.
  const [resultSignature, setResultSignature] = useState<string | null>(null)
  const isStale = hasResult && resultSignature !== signature
  // Set on SETTLE, and read only by the auto-run effect: a run that failed must not be retried
  // forever just because it left the result stale. Separate from the above because "we tried this"
  // and "this is what we are showing" stop being the same thing as soon as a run can fail.
  const attemptedSignature = useRef<string | null>(null)

  const wizard = useOptimizerWizard({
    hasPieceData,
    hasResult,
    canQuote: hasResult && missingBanding.length === 0,
  })
  const onPieces = wizard.step === 'pieces'
  const onLayout = wizard.step === 'layout'

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
          services: buildServiceLines(services.lines),
        })
      } else {
        clearAutosave()
      }
    }, 800)
    return () => clearTimeout(t)
  }, [materials, pieces.requirements, services.lines, draftId, draftName, hasWork])

  // Clean up the "Guardado" flash and pending-recompute timers on unmount.
  useEffect(
    () => () => {
      if (flashTimer.current) clearTimeout(flashTimer.current)
      if (recalcTimer.current) clearTimeout(recalcTimer.current)
    },
    [],
  )

  // The restored-session notice is a toast, not a banner: it is read once and never acted on, so a
  // permanent strip above the editor was paying page height for it forever. Discarding the restored
  // work is what "Nuevo" already does, so the notice needs no action of its own.
  useEffect(() => {
    if (!bootstrap) return
    addToast(
      bootstrap.draftName
        ? `Restauramos tu trabajo de la sesión anterior. Borrador: ${bootstrap.draftName}.`
        : 'Restauramos tu trabajo de la sesión anterior.',
      'info',
    )
  }, [bootstrap, addToast])

  const flashSaved = () => {
    setSavedFlash(true)
    if (flashTimer.current) clearTimeout(flashTimer.current)
    flashTimer.current = setTimeout(() => setSavedFlash(false), 2000)
  }

  const draftPayload = (): OptimizerDraftPayload => ({
    version: 1,
    materials,
    requirements: pieces.requirements,
    additionalServices: buildServiceLines(services.lines),
  })

  const resetWorkspace = () => {
    setMaterials([emptyCatalogMaterial()])
    pieces.clear()
    services.set([])
    setDraftId(null)
    setDraftName('')
    setVariant(0)
    setIssues([])
    optimize.reset()
    setLastResult(undefined)
    setResultSignature(null)
    attemptedSignature.current = null
    clearAutosave()
    wizard.goTo('pieces')
  }

  const handleNew = () => {
    if (
      hasWork &&
      !window.confirm('¿Empezar un trabajo nuevo? Se descartará lo que no hayas guardado.')
    )
      return
    resetWorkspace()
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
      // Optional: drafts saved before services existed have no such key.
      services.set((d.payload.additionalServices ?? []).map(serviceLineFromApi))
      setDraftId(d.id)
      setDraftName(d.name)
      setShowDrafts(false)
      // A loaded draft describes a different job: the result on screen is not its.
      optimize.reset()
      setLastResult(undefined)
      setResultSignature(null)
      attemptedSignature.current = null
      wizard.goTo('pieces')
    } finally {
      setLoadingDraftId(null)
    }
  }

  // Runs the search. Every override exists for the same reason: the control that triggers the run
  // also calls its own setState, which has not landed yet on this tick — so the new value has to
  // travel with the call rather than be read back from state.
  const runOptimize = useCallback(
    (
      overrides: {
        variant?: number
        strategy?: PackingStrategy
        priceTierCode?: string
        materials?: MaterialForm[]
      } = {},
    ) => {
      const nextVariant = overrides.variant ?? variant
      const nextStrategy = overrides.strategy ?? strategy
      const nextTier = overrides.priceTierCode ?? priceTierCode

      const payload = buildPayload(overrides.materials ?? materials, pieces.requirements)
      if (payload.validCount === 0) {
        addToast('No hay piezas válidas para optimizar. Revisa materiales y medidas.', 'warning')
        // Nothing was sent, so no `onSettled` will fire: a scheduled recompute that lands here
        // would otherwise leave "Recalculando…" on screen forever.
        setRecalcScheduled(false)
        return
      }
      const sent = signatureOf(
        payload.materials,
        payload.requirements,
        nextStrategy,
        nextVariant,
        nextTier,
      )
      optimize.mutate(
        {
          materials: payload.materials,
          requirements: payload.requirements,
          priceTierCode: nextTier,
          strategy: nextStrategy,
          variant: nextVariant,
        },
        {
          onSuccess: (data) => {
            setLastResult(data)
            setResultSignature(sent)
          },
          onSettled: () => {
            attemptedSignature.current = sent
            setRecalcScheduled(false)
          },
        },
      )
    },
    [materials, pieces.requirements, variant, strategy, priceTierCode, optimize, addToast],
  )

  // Leaving the Despiece step cleans up after the editor and then refuses ambiguous input: blank
  // rows (one is left behind by every "Agregar pieza" and every Enter on the last row) are dropped
  // silently, while rows the user started but left half-filled block the advance — carrying them
  // forward would quietly cut a different job than the one on screen.
  const handleLeavePieces = (): boolean => {
    const rows = pieces.pruneEmpty()
    const found = requirementIssues(rows, materials)
    setIssues(found)
    // A refusal must announce itself: the alert sits at the top of a list that may be scrolled away
    // from the button that was just pressed.
    if (found.length > 0) {
      addToast(issuesSummary(found), 'danger')
      return false
    }
    return true
  }

  const handleNext = () => {
    if (wizard.step === 'pieces' && !handleLeavePieces()) return
    wizard.next()
  }

  const handleSelectStep = (id: StepId) => {
    // Moving forward past Despiece goes through the same validation as "Siguiente".
    if (wizard.step === 'pieces' && id !== 'pieces' && !handleLeavePieces()) return
    wizard.goTo(id)
  }

  // Entering the Optimización step computes what is missing: a first run, or a re-run because the
  // pieces changed. The Despiece step already validated, so there is nothing to report here.
  useEffect(() => {
    if (wizard.step !== 'layout') return
    if (optimize.isPending || !canOptimize) return
    if (hasResult && !isStale) return
    // Already attempted and it did not succeed: leave the error on screen rather than retrying the
    // same payload on every render.
    if (attemptedSignature.current === signature) return
    runOptimize()
  }, [wizard.step, optimize.isPending, canOptimize, hasResult, isStale, signature, runOptimize])

  const handleOptimize = () => runOptimize()

  const handleStrategyChange = (newStrategy: PackingStrategy) => {
    setStrategy(newStrategy)
    if (canOptimize) runOptimize({ strategy: newStrategy })
  }

  // Changing the price tier recomputes on the spot rather than waiting for a trip back to the
  // Optimización step: only the money in the response changes and `/optimize` is cached by input
  // hash, so the cut search is not redone — the cost tables just catch up with the tier on screen.
  const handlePriceTierChange = (code: string) => {
    setPriceTierCode(code)
    if (canOptimize) runOptimize({ priceTierCode: code })
  }

  // Which boards the tier's discount applies to. Nothing is discounted until the seller says so,
  // board by board — a client negotiates the melamina and not the MDF.
  const discountedKeys = useMemo(
    () => new Set(materials.filter((m) => m.applyDiscount).map((m) => m.uid)),
    [materials],
  )

  // The materialKey of a summary row IS the uid of the material block that produced it
  // (`buildPayload` uses `key: m.uid`), so the mark goes straight back onto the form state.
  //
  // The total is recomputed by the SERVER rather than here: the flag travels inside the request,
  // so `/optimize` can answer it exactly, and `/optimize` is cached by input hash — the cut search
  // is not redone, only the money. Doing the arithmetic locally would be a second implementation
  // of the discount rule, and Python's round() is half-to-even while JS's Math.round is half-up:
  // the two disagree by a cent on bases like $62.50 at 5%, which is precisely the kind of round
  // number a per-board selection produces.
  // Both per-board marks recompute the same way: debounced, so ticking three boards in a row
  // costs one round trip instead of three.
  const scheduleRecalc = (next: MaterialForm[]) => {
    if (recalcTimer.current) clearTimeout(recalcTimer.current)
    if (!canOptimize) return
    setRecalcScheduled(true)
    recalcTimer.current = setTimeout(() => runOptimize({ materials: next }), 300)
  }

  const handleToggleDiscount = (materialKey: string) => {
    const next = materials.map((m) =>
      m.uid === materialKey ? { ...m, applyDiscount: !m.applyDiscount } : m,
    )
    setMaterials(next)
    scheduleRecalc(next)
  }

  // Boards the client takes whole even where the optimizer billed a half. Same shape as the
  // discount mark, and the same round trip: `wholeBoard` is not in the optimize hash either, so
  // `/optimize` reshapes the CACHED plan (the pieces do not move, the uncut half becomes one
  // leftover) instead of searching again. Doing it here would mean re-deriving the promotion —
  // and the merged billing line — in the browser.
  const wholeBoardKeys = useMemo(
    () => new Set(materials.filter((m) => m.wholeBoard).map((m) => m.uid)),
    [materials],
  )

  const handleToggleWholeBoard = (materialKey: string) => {
    const next = materials.map((m) =>
      m.uid === materialKey ? { ...m, wholeBoard: !m.wholeBoard } : m,
    )
    setMaterials(next)
    scheduleRecalc(next)
  }

  // Bump the seed and recompute — each seed yields a deterministic, cached layout, genuinely
  // different when alternatives exist. This is what "Volver a optimizar" does once a result exists.
  const handleAlternative = () => {
    if (!canOptimize) return
    const next = variant + 1
    setVariant(next)
    runOptimize({ variant: next })
  }

  // What the menu's "Optimizar / Volver a optimizar" and Ctrl+Enter both do: with a result on screen a
  // plain re-run would return the identical layout (the backend caches by input hash), so it becomes
  // "explore another alternative" instead.
  const handleRun = hasResult ? handleAlternative : handleOptimize

  // With the toolbars gone these shortcuts ARE the affordance; the actions menu only documents them.
  // Each one is scoped to the step that owns it — the same reach its menu entry has, so a hint the
  // menu shows is always a hint that works. The "Trabajo" ones are unscoped for the same reason:
  // that section of the menu is on every step.
  //
  // `onExport` is wrapped rather than passed: `handleExport` is declared further down, and a bare
  // reference here would read it before its initialiser. The thunk defers that to keypress time
  // while the conditional keeps the scoping.
  useEditorShortcuts({
    onUndo: onPieces && pieces.canUndo ? pieces.undo : undefined,
    onDeleteSelection: onPieces && pieces.selected.size > 0 ? pieces.removeSelected : undefined,
    onToggleCollapseAll: onPieces ? groups.toggleAll : undefined,
    onToggleFullscreen: canFullscreen ? toggle : undefined,
    onOptimize: onLayout && canRunOptimize && !optimize.isPending ? handleRun : undefined,
    onImport: onPieces ? () => setShowImport(true) : undefined,
    onExport: onPieces && hasPieceData ? () => handleExport() : undefined,
    onNew: handleNew,
    onOpenDrafts: () => setShowDrafts(true),
    onSaveDraft: saveDraft.isPending ? undefined : handleSaveDraft,
    onPrevStep: wizard.index > 0 ? wizard.back : undefined,
    // Through `handleNext`, never `wizard.next`: leaving Despiece has to run the same half-filled-row
    // validation the "Siguiente" button runs.
    onNextStep: wizard.canGoNext && !optimize.isPending ? handleNext : undefined,
  })

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

  // No page title and no toolbar: the breadcrumb in the app header names the page, and everything the
  // four buttons used to do is a keyboard shortcut or an entry in the actions menu. What is left above
  // the pieces is the step trail — one row instead of three.
  return (
    <div ref={containerRef} className="optimizer-workspace">
      <WizardSteps
        index={wizard.index}
        maxIndex={wizard.maxIndex}
        onSelect={handleSelectStep}
        actions={
          <OptimizerActionsMenu
            onImport={onPieces ? () => setShowImport(true) : undefined}
            onExport={onPieces ? handleExport : undefined}
            exportDisabled={!hasPieceData}
            onClear={
              onPieces
                ? () => {
                    pieces.clear()
                    setMaterials([emptyCatalogMaterial()])
                  }
                : undefined
            }
            clearsMaterials
            onOptimize={onLayout ? handleRun : undefined}
            hasResult={hasResult}
            optimizeDisabled={!canRunOptimize}
            isOptimizing={optimize.isPending}
            variant={variant}
            strategy={onLayout ? strategy : undefined}
            onStrategyChange={onLayout ? handleStrategyChange : undefined}
            onToggleCollapseAll={onPieces ? groups.toggleAll : undefined}
            allCollapsed={groups.allCollapsed}
            collapseDisabled={materials.length === 0}
            onToggleFullscreen={canFullscreen ? toggle : undefined}
            isFullscreen={isFullscreen}
            onNew={handleNew}
            onOpenDrafts={() => setShowDrafts(true)}
            onSaveDraft={handleSaveDraft}
            isSavingDraft={saveDraft.isPending}
            savedFlash={savedFlash}
            container={modalContainer}
          />
        }
      />

      {/* One surface for whichever step is active. The trail above it and the footer below stay on
          the page background — that contrast is what separates them from the work. */}
      <div className="surface">
        {wizard.step === 'pieces' && (
          <PiecesStep
            editor={pieces}
            materials={materials}
            boards={boards}
            edgeBandings={edgeBandings}
            container={modalContainer}
            issues={issues}
            onDismissIssues={() => setIssues([])}
            missingBanding={missingBanding}
            collapsed={groups.collapsed}
            onToggleGroup={groups.toggle}
            onAddMaterial={addMaterial}
            onUpdateMaterial={updateMaterial}
            onRequestDeleteMaterial={requestDeleteMaterial}
            onDuplicateMaterial={duplicateMaterial}
          />
        )}

        {wizard.step === 'layout' && (
          <LayoutStep
            result={result}
            isPending={optimize.isPending}
            error={optimize.error}
            variant={variant}
            isStale={isStale}
          />
        )}

        {wizard.step === 'costs' && result && (
          <CostsStep
            result={result}
            missingBanding={missingBanding}
            priceTierCode={priceTierCode}
            onPriceTierChange={handlePriceTierChange}
            isPending={optimize.isPending || recalcScheduled}
            discountedKeys={discountedKeys}
            onToggleDiscount={handleToggleDiscount}
            wholeBoardKeys={wholeBoardKeys}
            onToggleWholeBoard={handleToggleWholeBoard}
            services={services.lines}
            onAddService={services.add}
            onUpdateService={services.update}
            onRemoveService={services.remove}
            container={modalContainer}
          />
        )}

        {wizard.step === 'quote' && (
          <QuoteStep
            result={result}
            materials={built.materials}
            requirements={built.requirements}
            priceTierCode={priceTierCode}
            strategy={strategy}
            variant={variant}
            services={services.lines}
            container={modalContainer}
            onCreated={clearAutosave}
          />
        )}
      </div>

      <WizardFooter
        onBack={wizard.index > 0 ? wizard.back : undefined}
        onNext={wizard.isLast ? undefined : handleNext}
        nextDisabled={!wizard.canGoNext || optimize.isPending}
        nextHint={wizard.nextBlockedReason}
        left={
          onPieces ? (
            <>
              <PiecesSelectionBar
                editor={pieces}
                materials={materials}
                boards={boards}
                container={modalContainer}
              />
              {/* The totals step aside while rows are marked: the bar is one line and the actions
                  are what the user is looking at right then. */}
              {pieces.selected.size === 0 && (
                <PiecesSummary requirements={pieces.requirements} materials={materials} />
              )}
            </>
          ) : undefined
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
