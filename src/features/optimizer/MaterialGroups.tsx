import { useMemo } from 'react'
import { CButton } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilPlus } from '@coreui/icons'

import type { BoardProduct, EdgeBandingProduct } from 'src/features/products/types'
import type { ModalContainer } from './types'
import type { MaterialForm, RequirementForm } from './optimizerForm'
import { validMaterialUids } from './optimizerForm'
import type { PiecesEditor } from './usePiecesEditor'
import type { PiecesNavigation } from './usePiecesNavigation'
import { accentFor } from './groupColors'
import MaterialGroupCard from './MaterialGroupCard'

// The pieces list, and nothing else. It used to be a CCard whose header carried nine buttons and
// whose body held bordered group cards — a box inside a box inside a box before the first table row.
// The toolbar moved out (OptimizerActionsMenu / PiecesSelectionBar), the totals moved out
// (PiecesSummary), and the collapse state moved up (useCollapsedGroups), so a page can place each
// piece where it belongs. The only control left in the flow is "Agregar material", at the end.

interface MaterialGroupsProps {
  editor: PiecesEditor
  materials: MaterialForm[]
  boards: BoardProduct[]
  edgeBandings: EdgeBandingProduct[]
  // Fullscreen portal target for a group's portaled overlays (dropdown menus, modals).
  container?: ModalContainer
  // Height of the ONE scroll box the whole list shares. Each group used to own a 55vh box of its
  // own, so three open materials meant four nested scroll contexts and a wheel that behaved
  // differently depending on where the cursor was. Now there is one, and both sticky headers (the
  // material's, then the table's) stick to it. Omitted ⇒ the list grows with the page.
  paneHeight?: string
  // Search and jump. Optional: a call site with no navigation renders the plain list.
  nav?: PiecesNavigation
  // Folded groups, owned by the page (see useCollapsedGroups) because the menu toggles them all.
  collapsed: Set<string>
  onToggleGroup: (uid: string) => void
  onAddMaterial: () => void
  onUpdateMaterial: <K extends keyof MaterialForm>(
    uid: string,
    field: K,
    value: MaterialForm[K],
  ) => void
  onRequestDeleteMaterial: (m: MaterialForm) => void
  onDuplicateMaterial: (m: MaterialForm) => void
}

const MaterialGroups = ({
  editor,
  materials,
  boards,
  edgeBandings,
  container,
  paneHeight,
  nav,
  collapsed,
  onToggleGroup,
  onAddMaterial,
  onUpdateMaterial,
  onRequestDeleteMaterial,
  onDuplicateMaterial,
}: MaterialGroupsProps) => {
  const { requirements } = editor

  const validUids = validMaterialUids(materials)

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

  // A Set so the table can test a row in O(1) while it renders; the list itself is never filtered.
  const matches = useMemo(() => new Set(nav?.matches ?? []), [nav?.matches])

  return (
    <div className="mb-3 pieces-pane" style={paneHeight ? { height: paneHeight } : undefined}>
      {materials.length === 0 && (
        <div className="text-body-secondary small mb-2">
          Agrega al menos un material para empezar.
        </div>
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
            matches={matches}
            activeMatch={nav?.activeMatch}
            onRegister={nav?.registerMaterial(m.uid)}
            onGoToIssue={nav ? () => nav.goToNextIssue(m.uid) : undefined}
            onToggle={() => onToggleGroup(m.uid)}
            onUpdate={onUpdateMaterial}
            onRequestDelete={onRequestDeleteMaterial}
            onDuplicate={onDuplicateMaterial}
          />
        )
      })}

      {/* Full width and dashed: the one action that stays in the flow, reading as the next slot in
          the list rather than as another button competing with the group's own controls. It keeps
          the slot shape but not the ghost treatment — transparent fill plus muted text made it a
          grey outline the eye skipped over. */}
      <CButton
        color="primary"
        variant="ghost"
        type="button"
        className="add-slot w-100"
        onClick={onAddMaterial}
      >
        <CIcon icon={cilPlus} className="me-1" />
        Agregar material
      </CButton>
    </div>
  )
}

export default MaterialGroups
