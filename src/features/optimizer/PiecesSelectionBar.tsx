import {
  CButton,
  CButtonGroup,
  CDropdown,
  CDropdownItem,
  CDropdownMenu,
  CDropdownToggle,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilActionUndo, cilCopy, cilMove, cilTrash } from '@coreui/icons'

import type { BoardProduct } from 'src/features/products/types'
import type { ModalContainer } from './types'
import type { MaterialForm } from './optimizerForm'
import { materialLabel } from './optimizerForm'
import type { PiecesEditor } from './usePiecesEditor'

// Everything that acts on the rows you just touched: undo, and the bulk actions for the current
// selection. Contextual by nature — it renders nothing until there is something to act on, which is
// what lets the optimizer keep it in the pinned footer instead of paying a toolbar for it. The
// selection can be made at the bottom of a 50-row list, and the actions are still one click away.

interface PiecesSelectionBarProps {
  editor: PiecesEditor
  materials: MaterialForm[]
  boards: BoardProduct[]
  // Fullscreen portal target for the "Mover a…" menu.
  container?: ModalContainer
}

const PiecesSelectionBar = ({ editor, materials, boards, container }: PiecesSelectionBarProps) => {
  const { selected, undo, canUndo, duplicateSelected, removeSelected, moveSelectedTo } = editor
  const hasSelection = selected.size > 0

  if (!canUndo && !hasSelection) return null

  return (
    <div className="d-flex flex-wrap align-items-center gap-2">
      {canUndo && (
        <CButton
          size="sm"
          color="secondary"
          variant="ghost"
          type="button"
          title="Deshacer (Ctrl+Z)"
          onClick={undo}
        >
          <CIcon icon={cilActionUndo} className="me-1" />
          Deshacer
        </CButton>
      )}
      {hasSelection && (
        <>
          <CDropdown variant="btn-group" portal container={container}>
            <CDropdownToggle size="sm" color="secondary" variant="outline">
              <CIcon icon={cilMove} className="me-1" />
              Mover a… ({selected.size})
            </CDropdownToggle>
            <CDropdownMenu>
              {materials.length === 0 && <CDropdownItem disabled>No hay materiales</CDropdownItem>}
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
            <CButton color="secondary" variant="outline" type="button" onClick={duplicateSelected}>
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
    </div>
  )
}

export default PiecesSelectionBar
