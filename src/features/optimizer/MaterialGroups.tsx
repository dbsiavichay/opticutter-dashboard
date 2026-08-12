import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CButton,
  CButtonGroup,
  CCard,
  CCardBody,
  CCardHeader,
  CDropdown,
  CDropdownItem,
  CDropdownMenu,
  CDropdownToggle,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import {
  cilCloudDownload,
  cilCloudUpload,
  cilCopy,
  cilLayers,
  cilMove,
  cilPlus,
  cilTrash,
} from '@coreui/icons'

import type { BoardProduct, EdgeBandingProduct } from 'src/features/products/types'
import type { ModalContainer } from './types'
import type { MaterialForm, RequirementForm } from './optimizerForm'
import { materialLabel, piecesSummary, validMaterialUids } from './optimizerForm'
import type { PiecesEditor } from './usePiecesEditor'
import { accentFor } from './groupColors'
import MaterialGroupCard from './MaterialGroupCard'

interface MaterialGroupsProps {
  editor: PiecesEditor
  materials: MaterialForm[]
  boards: BoardProduct[]
  edgeBandings: EdgeBandingProduct[]
  // Fullscreen portal target for a group's portaled overlays (dropdown menus, modals).
  container?: ModalContainer
  onAddMaterial: () => void
  onUpdateMaterial: <K extends keyof MaterialForm>(
    uid: string,
    field: K,
    value: MaterialForm[K],
  ) => void
  onRequestDeleteMaterial: (m: MaterialForm) => void
  onDuplicateMaterial: (m: MaterialForm) => void
  onImportOpen: () => void
  onExport: () => void
  // When provided, "Limpiar" also drops the material groups, not just their pieces. Pre-orders omit
  // it: their materials come from the saved order, so wiping them is a different decision.
  onClearMaterials?: () => void
}

// Whether a keystroke is the user typing into a field, in which case editor-wide shortcuts must not
// fire. Checkboxes and radios are excluded on purpose: selecting a row leaves focus on its checkbox,
// and that is exactly when Delete should remove it.
const isTextEntry = (el: EventTarget | null): boolean => {
  if (!(el instanceof HTMLElement)) return false
  const tag = el.tagName
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (tag !== 'INPUT') return false
  const type = (el as HTMLInputElement).type
  return type !== 'checkbox' && type !== 'radio'
}

const areaFmt = new Intl.NumberFormat('es-EC', { maximumFractionDigits: 2 })

const MaterialGroups = ({
  editor,
  materials,
  boards,
  edgeBandings,
  container,
  onAddMaterial,
  onUpdateMaterial,
  onRequestDeleteMaterial,
  onDuplicateMaterial,
  onImportOpen,
  onExport,
  onClearMaterials,
}: MaterialGroupsProps) => {
  const {
    requirements,
    selected,
    undo,
    canUndo,
    duplicateSelected,
    removeSelected,
    moveSelectedTo,
    clear,
  } = editor

  // Collapsed pieces tables, keyed by material uid (expanded by default = not in the set).
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const hasSelection = selected.size > 0

  // Read through a ref so the listener can be mounted once. `removeSelected` is a fresh closure on
  // every render, and this component re-renders on every keystroke in the grid — putting it in the
  // dependency array would re-subscribe the window listener on each one.
  const shortcuts = useRef({ undo, removeSelected, hasSelection })
  useEffect(() => {
    shortcuts.current = { undo, removeSelected, hasSelection }
  })

  // Editor-wide shortcuts, inert while the user is typing into a field or a modal is open:
  //   Ctrl/Cmd+Z        undo the last structural operation
  //   Supr / Retroceso  delete the selected rows (undoable with the above)
  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      if (isTextEntry(e.target)) return
      // A modal covers the editor: the expanded-sheet view pages with the keyboard, and silently
      // dropping rows behind it would be invisible until the modal closes.
      if (document.body.classList.contains('modal-open')) return
      const { undo, removeSelected, hasSelection } = shortcuts.current
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault()
        undo()
        return
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && hasSelection) {
        e.preventDefault()
        removeSelected()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const validUids = validMaterialUids(materials)
  const summary = piecesSummary(requirements, materials)

  // Contiguous group slice for each material uid (requirements is kept clustered by material).
  const groups = useMemo(() => {
    const map = new Map<string, { rows: RequirementForm[]; start: number }>()
    requirements.forEach((r, idx) => {
      const g = map.get(r.materialUid)
      if (g) g.rows.push(r)
      else map.set(r.materialUid, { rows: [r], start: idx })
    })
    return map
  }, [requirements])

  const toggle = (uid: string) =>
    setCollapsed((s) => {
      const next = new Set(s)
      if (next.has(uid)) next.delete(uid)
      else next.add(uid)
      return next
    })

  const allCollapsed = materials.length > 0 && materials.every((m) => collapsed.has(m.uid))
  const toggleAll = () =>
    setCollapsed(allCollapsed ? new Set() : new Set(materials.map((m) => m.uid)))

  return (
    <CCard className="mb-3">
      <CCardHeader className="d-flex flex-wrap gap-2 justify-content-between align-items-center">
        <strong>
          Materiales y piezas <span className="text-danger">*</span>
        </strong>
        <div className="d-flex flex-wrap gap-2">
          {canUndo && (
            <CButton
              size="sm"
              color="secondary"
              variant="ghost"
              type="button"
              title="Deshacer (Ctrl+Z)"
              onClick={undo}
            >
              ↩ Deshacer
            </CButton>
          )}
          {hasSelection && (
            <>
              <CDropdown variant="btn-group">
                <CDropdownToggle size="sm" color="secondary" variant="outline">
                  <CIcon icon={cilMove} className="me-1" />
                  Mover a… ({selected.size})
                </CDropdownToggle>
                <CDropdownMenu>
                  {materials.length === 0 && (
                    <CDropdownItem disabled>No hay materiales</CDropdownItem>
                  )}
                  {materials.map((m) => (
                    <CDropdownItem
                      key={m.uid}
                      as="button"
                      type="button"
                      onClick={() => moveSelectedTo(m.uid)}
                    >
                      {materialLabel(m, boards)}
                    </CDropdownItem>
                  ))}
                </CDropdownMenu>
              </CDropdown>
              <CButtonGroup size="sm">
                <CButton
                  color="secondary"
                  variant="outline"
                  type="button"
                  onClick={duplicateSelected}
                >
                  <CIcon icon={cilCopy} className="me-1" />
                  Duplicar ({selected.size})
                </CButton>
                <CButton
                  color="danger"
                  variant="outline"
                  type="button"
                  title="Eliminar las piezas seleccionadas (Supr)"
                  onClick={removeSelected}
                >
                  <CIcon icon={cilTrash} className="me-1" />
                  Eliminar ({selected.size})
                </CButton>
              </CButtonGroup>
            </>
          )}
          <CButton
            size="sm"
            color="secondary"
            variant="ghost"
            type="button"
            onClick={toggleAll}
            disabled={materials.length === 0}
          >
            <CIcon icon={cilLayers} className="me-1" />
            {allCollapsed ? 'Expandir todos' : 'Plegar todos'}
          </CButton>
          <CButton
            size="sm"
            color="secondary"
            variant="outline"
            type="button"
            onClick={onImportOpen}
          >
            <CIcon icon={cilCloudUpload} className="me-1" />
            Importar / Pegar
          </CButton>
          <CButton
            size="sm"
            color="secondary"
            variant="outline"
            type="button"
            onClick={onExport}
            disabled={summary.pieces === 0}
          >
            <CIcon icon={cilCloudDownload} className="me-1" />
            Exportar CSV
          </CButton>
          <CButton
            size="sm"
            color="secondary"
            variant="outline"
            type="button"
            title={
              onClearMaterials
                ? 'Vaciar piezas y grupos de materiales'
                : 'Vaciar la lista de piezas'
            }
            onClick={() => {
              const message = onClearMaterials
                ? '¿Vaciar las piezas y los grupos de materiales?'
                : '¿Vaciar la lista de piezas?'
              if (!window.confirm(message)) return
              clear()
              onClearMaterials?.()
            }}
          >
            <CIcon icon={cilTrash} className="me-1" />
            Limpiar
          </CButton>
          <CButton
            size="sm"
            color="primary"
            variant="outline"
            type="button"
            onClick={onAddMaterial}
          >
            <CIcon icon={cilPlus} className="me-1" />
            Agregar material
          </CButton>
        </div>
      </CCardHeader>
      <CCardBody>
        {materials.length === 0 && (
          <div className="text-body-secondary small">Agrega al menos un material para empezar.</div>
        )}

        {materials.map((m, i) => {
          const g = groups.get(m.uid)
          return (
            <MaterialGroupCard
              key={m.uid}
              material={m}
              accent={accentFor(i)}
              rows={g?.rows ?? []}
              startIndex={g?.start ?? requirements.length}
              materialValid={validUids.has(m.uid)}
              collapsed={collapsed.has(m.uid)}
              editor={editor}
              boards={boards}
              edgeBandings={edgeBandings}
              container={container}
              onToggle={() => toggle(m.uid)}
              onUpdate={onUpdateMaterial}
              onRequestDelete={onRequestDeleteMaterial}
              onDuplicate={onDuplicateMaterial}
            />
          )
        })}

        <div className="d-flex flex-wrap gap-3 mt-2 small text-body-secondary">
          <span>
            <strong className="text-body">{summary.pieces}</strong> piezas
          </span>
          <span>
            <strong className="text-body">{summary.units}</strong> unidades
          </span>
          <span>
            área total <strong className="text-body">{areaFmt.format(summary.areaM2)} m²</strong>
          </span>
          {summary.invalid > 0 && (
            <span className="text-danger">{summary.invalid} con datos incompletos</span>
          )}
        </div>
      </CCardBody>
    </CCard>
  )
}

export default MaterialGroups
