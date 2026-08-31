import { CAlert, CButton } from '@coreui/react'

import type { BoardProduct, EdgeBandingProduct } from 'src/features/products/types'
import type { MaterialForm, RequirementIssue } from '../optimizerForm'
import type { ModalContainer } from '../types'
import type { PiecesEditor } from '../usePiecesEditor'
import type { PiecesNavigation } from '../usePiecesNavigation'
import MaterialGroups from '../MaterialGroups'
import PiecesNav from '../PiecesNav'

// Step 1. The pieces editor at full page width — the whole point of the wizard: PieceRowsTable is a
// 12-column grid and used to live in 58% of the viewport next to the diagrams.
//
// Height of the scroll pane: the app header, the step trail, the nav bar above it and the pinned
// footer are what it has to leave room for. Everything on this step is then reachable without the
// page itself scrolling at all.
const PANE_HEIGHT = 'calc(100dvh - 21rem)'

// A row number the alerts name is only useful if it goes somewhere. `#47` is a flat index across
// every material, which is exactly the number a user cannot locate by eye.
const PieceLink = ({ index, onGo }: { index: number; onGo: (flat: number) => void }) => (
  <CButton
    color="link"
    size="sm"
    type="button"
    className="p-0 align-baseline"
    onClick={() => onGo(index)}
  >
    #{index + 1}
  </CButton>
)

interface PiecesStepProps {
  editor: PiecesEditor
  materials: MaterialForm[]
  boards: BoardProduct[]
  edgeBandings: EdgeBandingProduct[]
  container?: ModalContainer
  // Search, jump-to-piece and the material index strip.
  nav: PiecesNavigation
  // Half-filled rows found on the last attempt to advance; blocks the step until fixed.
  issues: RequirementIssue[]
  onDismissIssues: () => void
  // Indexes of pieces with banding sides but no tapacanto product. Only a warning here — it blocks
  // the Cotización step, not this one, because the geometry optimizes fine without it.
  missingBanding: number[]
  // Folded groups: owned by the page, because the actions menu toggles them all at once.
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

const PiecesStep = ({
  editor,
  materials,
  boards,
  edgeBandings,
  container,
  nav,
  issues,
  onDismissIssues,
  missingBanding,
  collapsed,
  onToggleGroup,
  onAddMaterial,
  onUpdateMaterial,
  onRequestDeleteMaterial,
  onDuplicateMaterial,
}: PiecesStepProps) => (
  <>
    {/* Above the pieces, not below them: a list long enough to need this warning is long enough to
        bury it. The toast raised on the same click carries the summary. */}
    {issues.length > 0 && (
      <CAlert color="danger" className="py-2 small" dismissible onClose={onDismissIssues}>
        <div className="fw-semibold mb-1">
          {issues.length === 1
            ? 'Hay una pieza incompleta:'
            : `Hay ${issues.length} piezas incompletas:`}
        </div>
        <ul className="mb-0 ps-3">
          {issues.map((it) => (
            <li key={it.index}>
              Fila <PieceLink index={it.index} onGo={nav.revealPiece} />: {it.reasons.join(', ')}.
            </li>
          ))}
        </ul>
      </CAlert>
    )}

    <PiecesNav nav={nav} materials={materials} requirements={editor.requirements} boards={boards} />

    <MaterialGroups
      editor={editor}
      materials={materials}
      boards={boards}
      edgeBandings={edgeBandings}
      container={container}
      paneHeight={PANE_HEIGHT}
      nav={nav}
      collapsed={collapsed}
      onToggleGroup={onToggleGroup}
      onAddMaterial={onAddMaterial}
      onUpdateMaterial={onUpdateMaterial}
      onRequestDeleteMaterial={onRequestDeleteMaterial}
      onDuplicateMaterial={onDuplicateMaterial}
    />

    {missingBanding.length > 0 && (
      <CAlert color="warning" className="py-2 small">
        {missingBanding.length === 1 ? (
          <>
            La pieza <PieceLink index={missingBanding[0] ?? 0} onGo={nav.revealPiece} /> tiene canto
            definido pero no seleccionaste el tapacanto.
          </>
        ) : (
          <>
            Hay {missingBanding.length} piezas con canto definido pero sin tapacanto:{' '}
            {missingBanding.map((i, n) => (
              <span key={i}>
                {n > 0 && ', '}
                <PieceLink index={i} onGo={nav.revealPiece} />
              </span>
            ))}
            .
          </>
        )}{' '}
        Puedes optimizar igual, pero hará falta para crear la cotización.
      </CAlert>
    )}
  </>
)

export default PiecesStep
