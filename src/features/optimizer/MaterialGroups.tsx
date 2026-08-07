import { useEffect, useMemo, useState } from 'react'
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
import type { MaterialForm, RequirementForm } from './optimizerForm'
import { materialLabel, piecesSummary, validMaterialUids } from './optimizerForm'
import type { PiecesEditor } from './usePiecesEditor'
import MaterialGroupCard from './MaterialGroupCard'

interface MaterialGroupsProps {
  editor: PiecesEditor
  materials: MaterialForm[]
  boards: BoardProduct[]
  edgeBandings: EdgeBandingProduct[]
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
}

const areaFmt = new Intl.NumberFormat('es-EC', { maximumFractionDigits: 2 })

const MaterialGroups = ({
  editor,
  materials,
  boards,
  edgeBandings,
  onAddMaterial,
  onUpdateMaterial,
  onRequestDeleteMaterial,
  onDuplicateMaterial,
  onImportOpen,
  onExport,
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

  // Ctrl+Z / Cmd+Z: undoes the last structural operation (no-op when a field is focused).
  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key !== 'z') return
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      e.preventDefault()
      undo()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [undo])

  const validUids = validMaterialUids(materials)
  const summary = piecesSummary(requirements, materials)
  const hasSelection = selected.size > 0

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
                <CButton color="danger" variant="outline" type="button" onClick={removeSelected}>
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
            onClick={() => {
              if (window.confirm('¿Vaciar la lista de piezas?')) clear()
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

        {materials.map((m) => {
          const g = groups.get(m.uid)
          return (
            <MaterialGroupCard
              key={m.uid}
              material={m}
              rows={g?.rows ?? []}
              startIndex={g?.start ?? requirements.length}
              materialValid={validUids.has(m.uid)}
              collapsed={collapsed.has(m.uid)}
              editor={editor}
              boards={boards}
              edgeBandings={edgeBandings}
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
