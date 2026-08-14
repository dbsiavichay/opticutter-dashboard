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
  cilFolderOpen,
  cilFullscreen,
  cilFullscreenExit,
  cilLoopCircular,
  cilOptions,
  cilPlus,
  cilSave,
  cilTrash,
} from '@coreui/icons'

import type { ModalContainer, PackingStrategy } from './types'
import { STRATEGY_OPTIONS, strategyHint } from './OptimizationPreview'

// Every action that used to sit in a toolbar, in one menu. Two toolbars were removed for this: the
// page title's (fullscreen / drafts) and the pieces card header's (import / export / clear). What is
// left on screen is only what gets used constantly — "Agregar material" at the end of the list and
// the quick-entry input inside each group.
//
// Sections render only when their handlers are given, so pre-orders can reuse this without the
// "Trabajo" section (drafts belong to the optimizer's scratch workspace, not to a saved quote).

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
  // Fullscreen portal target: document.body sits outside the fullscreen element, so a menu portaled
  // there mounts but is never painted.
  container?: ModalContainer
}

// Muted shortcut hint pushed to the right of an item's label.
const Hint = ({ children }: { children: ReactNode }) => (
  <span className="ms-auto ps-4 text-body-secondary small">{children}</span>
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
  container,
}: OptimizerActionsMenuProps) => {
  const hasPieces = !!(onImport || onExport || onClear)
  const hasRun = !!(onOptimize || onStrategyChange)
  const hasView = !!(onToggleCollapseAll || onToggleFullscreen)
  const hasJob = !!(onNew || onOpenDrafts || onSaveDraft)

  const handleClear = () => {
    const message = clearsMaterials
      ? '¿Vaciar las piezas y los grupos de materiales?'
      : '¿Vaciar la lista de piezas?'
    if (!window.confirm(message)) return
    onClear?.()
  }

  return (
    <CDropdown alignment="end" portal container={container}>
      <CDropdownToggle color="secondary" variant="outline" caret={false} title="Acciones">
        <CIcon icon={cilOptions} />
      </CDropdownToggle>
      <CDropdownMenu style={{ minWidth: 260 }}>
        {hasPieces && (
          <>
            <CDropdownHeader className="text-body-secondary small">Piezas</CDropdownHeader>
            {onImport && (
              <CDropdownItem as="button" type="button" onClick={onImport}>
                <CIcon icon={cilCloudUpload} className="me-2" />
                Importar / Pegar
              </CDropdownItem>
            )}
            {onExport && (
              <CDropdownItem as="button" type="button" disabled={exportDisabled} onClick={onExport}>
                <CIcon icon={cilCloudDownload} className="me-2" />
                Exportar CSV
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
                <Hint>Ctrl+↵</Hint>
              </CDropdownItem>
            )}
            {onStrategyChange && (
              <>
                <CDropdownHeader className="text-body-secondary small fw-normal fst-italic">
                  Heurística
                </CDropdownHeader>
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
                <Hint>Ctrl+⇧+E</Hint>
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
                <Hint>Ctrl+⇧+F</Hint>
              </CDropdownItem>
            )}
          </>
        )}

        {hasView && hasJob && <CDropdownDivider />}

        {hasJob && (
          <>
            <CDropdownHeader className="text-body-secondary small">Trabajo</CDropdownHeader>
            {onNew && (
              <CDropdownItem as="button" type="button" onClick={onNew}>
                <CIcon icon={cilPlus} className="me-2" />
                Nuevo
              </CDropdownItem>
            )}
            {onOpenDrafts && (
              <CDropdownItem as="button" type="button" onClick={onOpenDrafts}>
                <CIcon icon={cilFolderOpen} className="me-2" />
                Borradores…
              </CDropdownItem>
            )}
            {onSaveDraft && (
              <CDropdownItem
                as="button"
                type="button"
                disabled={isSavingDraft}
                onClick={onSaveDraft}
              >
                {isSavingDraft ? (
                  <CSpinner size="sm" className="me-2" />
                ) : (
                  <CIcon icon={savedFlash ? cilCheckAlt : cilSave} className="me-2" />
                )}
                {savedFlash ? 'Guardado' : 'Guardar borrador'}
              </CDropdownItem>
            )}
          </>
        )}
      </CDropdownMenu>
    </CDropdown>
  )
}

export default OptimizerActionsMenu
