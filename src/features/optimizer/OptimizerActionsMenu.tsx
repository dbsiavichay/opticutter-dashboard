import {
  CDropdown,
  CDropdownDivider,
  CDropdownHeader,
  CDropdownItem,
  CDropdownMenu,
  CDropdownToggle,
  CSpinner,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import type { ReactNode } from 'react'
import {
  cilCalculator,
  cilCheckAlt,
  cilChevronDoubleDown,
  cilChevronDoubleUp,
  cilCloudDownload,
  cilCloudUpload,
  cilExternalLink,
  cilFolderOpen,
  cilFullscreen,
  cilFullscreenExit,
  cilLink,
  cilLoopCircular,
  cilOptions,
  cilPlus,
  cilSave,
  cilTrash,
} from '@coreui/icons'

import { KEY } from 'src/shared/utils/platform'
import type { ModalContainer, PackingStrategy } from './types'

// "Máxima eficiencia" first because it is the default: the list reads from the normal case to the
// special one. This menu is the only place the heuristic is chosen — it used to be a CButtonGroup
// declared twice, in OptimizeActionBar and in OptimizationPreview, with the options in opposite
// orders.
const STRATEGY_OPTIONS: { value: PackingStrategy; label: string }[] = [
  { value: 'default', label: 'Máxima eficiencia' },
  { value: 'longOffcuts', label: 'Retazos largos' },
]

const strategyHint = (s: PackingStrategy) =>
  s === 'longOffcuts'
    ? 'Agrupa el sobrante en una tira larga reutilizable'
    : 'Minimiza el desperdicio total'

// Every action that used to sit in a toolbar, in one menu. Two toolbars were removed for this: the
// page title's (fullscreen / drafts) and the pieces card header's (import / export / clear). What is
// left on screen is only what gets used constantly — "Agregar material" at the end of the list and
// the quick-entry input inside each group.
//
// Sections render only when their handlers are given, so the two pages that mount this share one
// menu without sharing an action: the optimizer gets "Trabajo" (drafts belong to its scratch
// workspace) and never "Documento"; the pre-order detail page gets "Documento" (proforma, review
// link, delete — a saved quote is a document) and never "Trabajo".

interface OptimizerActionsMenuProps {
  // --- Piezas ---
  onImport?: () => void
  onExport?: () => void
  exportDisabled?: boolean
  onClear?: () => void
  // Wording differs: the optimizer also drops the material groups, pre-orders only the pieces.
  clearsMaterials?: boolean
  // --- Optimización (only the Optimización step passes these) ---
  onOptimize?: () => void
  // A result is already on screen, so the run explores an alternative rather than being the first.
  hasResult?: boolean
  optimizeDisabled?: boolean
  isOptimizing?: boolean
  // Alternative-solution seed of the result on screen (0 = canonical).
  variant?: number
  strategy?: PackingStrategy
  onStrategyChange?: (s: PackingStrategy) => void
  // --- Vista ---
  onToggleCollapseAll?: () => void
  allCollapsed?: boolean
  collapseDisabled?: boolean
  onToggleFullscreen?: () => void
  isFullscreen?: boolean
  // --- Trabajo ---
  onNew?: () => void
  onOpenDrafts?: () => void
  onSaveDraft?: () => void
  isSavingDraft?: boolean
  savedFlash?: boolean
  // --- Documento (only a saved quote has these; the optimizer's workspace is not a document yet) ---
  onProforma?: () => void
  onReviewLink?: () => void
  // "Generar enlace" the first time, "Regenerar enlace" once one exists.
  reviewLinkLabel?: string
  isLinkPending?: boolean
  onViewOrder?: () => void
  onDelete?: () => void
  // Fullscreen portal target: document.body sits outside the fullscreen element, so a menu portaled
  // there mounts but is never painted.
  container?: ModalContainer
  // Placement class for the dropdown root, for call sites that need to push it within their own row.
  className?: string
}

// Muted shortcut hint pushed to the right of an item's label.
//
// Labels come from `KEY`, which names the modifiers for the keyboard in front of the user (Ctrl /
// Shift / Alt / Enter on Windows, ⌘ ⇧ ⌥ ↵ on a Mac). `text-nowrap` because the spelled-out Windows
// forms are wide enough to wrap onto a second line inside the menu.
const Hint = ({ children }: { children: ReactNode }) => (
  <span className="ms-auto ps-4 text-body-secondary small text-nowrap">{children}</span>
)

const OptimizerActionsMenu = ({
  onImport,
  onExport,
  exportDisabled,
  onClear,
  clearsMaterials,
  onOptimize,
  hasResult,
  optimizeDisabled,
  isOptimizing,
  variant = 0,
  strategy,
  onStrategyChange,
  onToggleCollapseAll,
  allCollapsed,
  collapseDisabled,
  onToggleFullscreen,
  isFullscreen,
  onNew,
  onOpenDrafts,
  onSaveDraft,
  isSavingDraft,
  savedFlash,
  onProforma,
  onReviewLink,
  reviewLinkLabel = 'Generar enlace',
  isLinkPending,
  onViewOrder,
  onDelete,
  container,
  className,
}: OptimizerActionsMenuProps) => {
  const hasPieces = !!(onImport || onExport || onClear)
  const hasRun = !!(onOptimize || onStrategyChange)
  const hasView = !!(onToggleCollapseAll || onToggleFullscreen)
  const hasJob = !!(onNew || onOpenDrafts || onSaveDraft)
  const hasDoc = !!(onProforma || onReviewLink || onViewOrder || onDelete)

  const handleClear = () => {
    const message = clearsMaterials
      ? '¿Vaciar las piezas y los grupos de materiales?'
      : '¿Vaciar la lista de piezas?'
    if (!window.confirm(message)) return
    onClear?.()
  }

  return (
    <CDropdown alignment="end" portal container={container} className={className}>
      <CDropdownToggle color="secondary" variant="outline" caret={false} title="Acciones">
        <CIcon icon={cilOptions} />
      </CDropdownToggle>
      <CDropdownMenu style={{ minWidth: 260 }}>
        {hasPieces && (
          <>
            <CDropdownHeader className="text-body-secondary small">Piezas</CDropdownHeader>
            {onImport && (
              <CDropdownItem
                as="button"
                type="button"
                className="d-flex align-items-center"
                onClick={onImport}
              >
                <CIcon icon={cilCloudUpload} className="me-2" />
                Importar / Pegar
                <Hint>{`${KEY.mod}+I`}</Hint>
              </CDropdownItem>
            )}
            {onExport && (
              <CDropdownItem
                as="button"
                type="button"
                className="d-flex align-items-center"
                disabled={exportDisabled}
                onClick={onExport}
              >
                <CIcon icon={cilCloudDownload} className="me-2" />
                Exportar CSV
                <Hint>{`${KEY.mod}+${KEY.shift}+S`}</Hint>
              </CDropdownItem>
            )}
            {onClear && (
              <CDropdownItem as="button" type="button" onClick={handleClear}>
                <CIcon icon={cilTrash} className="me-2" />
                Limpiar…
              </CDropdownItem>
            )}
          </>
        )}

        {hasPieces && hasRun && <CDropdownDivider />}

        {hasRun && (
          <>
            <CDropdownHeader className="text-body-secondary small">Optimización</CDropdownHeader>
            {onOptimize && (
              <CDropdownItem
                as="button"
                type="button"
                className="d-flex align-items-center"
                disabled={optimizeDisabled || isOptimizing}
                onClick={onOptimize}
                // Same reasoning the button carried: a plain re-run would return the identical
                // layout (the backend caches by input hash), so once a result exists this bumps
                // the alternative seed instead.
                title={
                  hasResult
                    ? 'Genera una distribución alternativa con las mismas piezas'
                    : 'Calcula la distribución de las piezas'
                }
              >
                {isOptimizing ? (
                  <CSpinner size="sm" className="me-2" />
                ) : (
                  <CIcon icon={hasResult ? cilLoopCircular : cilCalculator} className="me-2" />
                )}
                {hasResult ? 'Volver a optimizar' : 'Optimizar'}
                {variant > 0 && <span className="ms-1 text-body-secondary">#{variant}</span>}
                <Hint>{`${KEY.mod}+${KEY.enter}`}</Hint>
              </CDropdownItem>
            )}
            {onStrategyChange && (
              <>
                {/* Sub-header only when there is a run item above it to be distinguished from;
                    pre-orders pass the picker alone, and two stacked headings said nothing. */}
                {onOptimize && (
                  <CDropdownHeader className="text-body-secondary small fw-normal fst-italic">
                    Heurística
                  </CDropdownHeader>
                )}
                {STRATEGY_OPTIONS.map((o) => (
                  <CDropdownItem
                    key={o.value}
                    as="button"
                    type="button"
                    active={strategy === o.value}
                    disabled={isOptimizing}
                    title={strategyHint(o.value)}
                    onClick={() => onStrategyChange(o.value)}
                  >
                    {o.label}
                  </CDropdownItem>
                ))}
              </>
            )}
          </>
        )}

        {(hasPieces || hasRun) && hasView && <CDropdownDivider />}

        {hasView && (
          <>
            <CDropdownHeader className="text-body-secondary small">Vista</CDropdownHeader>
            {onToggleCollapseAll && (
              <CDropdownItem
                as="button"
                type="button"
                className="d-flex align-items-center"
                disabled={collapseDisabled}
                onClick={onToggleCollapseAll}
              >
                <CIcon
                  icon={allCollapsed ? cilChevronDoubleDown : cilChevronDoubleUp}
                  className="me-2"
                />
                {allCollapsed ? 'Expandir todos' : 'Plegar todos'}
                <Hint>{`${KEY.mod}+${KEY.shift}+E`}</Hint>
              </CDropdownItem>
            )}
            {onToggleFullscreen && (
              <CDropdownItem
                as="button"
                type="button"
                className="d-flex align-items-center"
                onClick={onToggleFullscreen}
              >
                <CIcon icon={isFullscreen ? cilFullscreenExit : cilFullscreen} className="me-2" />
                {isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
                <Hint>{`${KEY.mod}+${KEY.shift}+F`}</Hint>
              </CDropdownItem>
            )}
          </>
        )}

        {(hasPieces || hasRun || hasView) && hasJob && <CDropdownDivider />}

        {hasJob && (
          <>
            <CDropdownHeader className="text-body-secondary small">Trabajo</CDropdownHeader>
            {onNew && (
              <CDropdownItem
                as="button"
                type="button"
                className="d-flex align-items-center"
                onClick={onNew}
              >
                <CIcon icon={cilPlus} className="me-2" />
                Nuevo
                <Hint>{`${KEY.mod}+${KEY.alt}+N`}</Hint>
              </CDropdownItem>
            )}
            {onOpenDrafts && (
              <CDropdownItem
                as="button"
                type="button"
                className="d-flex align-items-center"
                onClick={onOpenDrafts}
              >
                <CIcon icon={cilFolderOpen} className="me-2" />
                Borradores…
                <Hint>{`${KEY.mod}+O`}</Hint>
              </CDropdownItem>
            )}
            {onSaveDraft && (
              <CDropdownItem
                as="button"
                type="button"
                className="d-flex align-items-center"
                disabled={isSavingDraft}
                onClick={onSaveDraft}
              >
                {isSavingDraft ? (
                  <CSpinner size="sm" className="me-2" />
                ) : (
                  <CIcon icon={savedFlash ? cilCheckAlt : cilSave} className="me-2" />
                )}
                {savedFlash ? 'Guardado' : 'Guardar borrador'}
                <Hint>{`${KEY.mod}+S`}</Hint>
              </CDropdownItem>
            )}
          </>
        )}

        {(hasPieces || hasRun || hasView || hasJob) && hasDoc && <CDropdownDivider />}

        {/* Actions on the quote as a document rather than on its contents. These were four buttons
            on the pre-order's header card; none of them is used often enough to hold a permanent
            row, and "Eliminar" in particular should not be one click away from the save button. */}
        {hasDoc && (
          <>
            <CDropdownHeader className="text-body-secondary small">Documento</CDropdownHeader>
            {onProforma && (
              <CDropdownItem
                as="button"
                type="button"
                className="d-flex align-items-center"
                onClick={onProforma}
              >
                <CIcon icon={cilCloudDownload} className="me-2" />
                Proforma PDF
              </CDropdownItem>
            )}
            {onReviewLink && (
              <CDropdownItem
                as="button"
                type="button"
                className="d-flex align-items-center"
                disabled={isLinkPending}
                onClick={onReviewLink}
                title="Enlace público para que el cliente revise y apruebe la cotización"
              >
                {isLinkPending ? (
                  <CSpinner size="sm" className="me-2" />
                ) : (
                  <CIcon icon={cilLink} className="me-2" />
                )}
                {reviewLinkLabel}
              </CDropdownItem>
            )}
            {onViewOrder && (
              <CDropdownItem
                as="button"
                type="button"
                className="d-flex align-items-center"
                onClick={onViewOrder}
              >
                <CIcon icon={cilExternalLink} className="me-2" />
                Ver orden
              </CDropdownItem>
            )}
            {onDelete && (
              <CDropdownItem
                as="button"
                type="button"
                className="d-flex align-items-center text-danger"
                onClick={onDelete}
              >
                <CIcon icon={cilTrash} className="me-2" />
                Eliminar…
              </CDropdownItem>
            )}
          </>
        )}
      </CDropdownMenu>
    </CDropdown>
  )
}

export default OptimizerActionsMenu
