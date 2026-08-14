import { CAlert } from '@coreui/react'

import type { BoardProduct, EdgeBandingProduct } from 'src/features/products/types'
import type { MaterialForm, RequirementIssue } from '../optimizerForm'
import type { ModalContainer } from '../types'
import type { PiecesEditor } from '../usePiecesEditor'
import MaterialGroups from '../MaterialGroups'

// Step 1. The pieces editor at full page width — the whole point of the wizard: PieceRowsTable is a
// 12-column grid and used to live in 58% of the viewport next to the diagrams.

interface PiecesStepProps {
  editor: PiecesEditor
  materials: MaterialForm[]
  boards: BoardProduct[]
  edgeBandings: EdgeBandingProduct[]
  container?: ModalContainer
  // Half-filled rows found on the last attempt to advance; blocks the step until fixed.
  issues: RequirementIssue[]
  onDismissIssues: () => void
  // Indexes of pieces with banding sides but no tapacanto product. Only a warning here — it blocks
  // the Cotización step, not this one, because the geometry optimizes fine without it.
  missingBanding: number[]
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
  onClearMaterials: () => void
}

const PiecesStep = ({
  editor,
  materials,
  boards,
  edgeBandings,
  container,
  issues,
  onDismissIssues,
  missingBanding,
  onAddMaterial,
  onUpdateMaterial,
  onRequestDeleteMaterial,
  onDuplicateMaterial,
  onImportOpen,
  onExport,
  onClearMaterials,
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
              Fila #{it.index + 1}: {it.reasons.join(', ')}.
            </li>
          ))}
        </ul>
      </CAlert>
    )}

    <MaterialGroups
      editor={editor}
      materials={materials}
      boards={boards}
      edgeBandings={edgeBandings}
      container={container}
      onAddMaterial={onAddMaterial}
      onUpdateMaterial={onUpdateMaterial}
      onRequestDeleteMaterial={onRequestDeleteMaterial}
      onDuplicateMaterial={onDuplicateMaterial}
      onImportOpen={onImportOpen}
      onExport={onExport}
      onClearMaterials={onClearMaterials}
    />

    {missingBanding.length > 0 && (
      <CAlert color="warning" className="py-2 small">
        {missingBanding.length === 1
          ? `La pieza #${missingBanding.map((i) => i + 1).join('')} tiene canto definido pero no seleccionaste el tapacanto.`
          : `Hay ${missingBanding.length} piezas con canto definido pero sin tapacanto (#${missingBanding
              .map((i) => i + 1)
              .join(', #')}).`}{' '}
        Puedes optimizar igual, pero hará falta para crear la cotización.
      </CAlert>
    )}
  </>
)

export default PiecesStep
