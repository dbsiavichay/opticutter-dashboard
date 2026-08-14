import { useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
import { PREVIEW_LIMIT } from 'src/shared/constants'
import {
  CAlert,
  CBadge,
  CButton,
  CFormCheck,
  CFormLabel,
  CFormSelect,
  CFormTextarea,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'

import type { BoardProduct } from 'src/features/products/types'
import { normalizeText } from 'src/shared/utils/text'
import { BANDTYPE_LABEL, materialLabel } from './optimizerForm'
import type { MaterialForm, RequirementForm } from './optimizerForm'
import { CSV_COLUMNS, looksLikeMissingMaterialColumn, parsePieces } from './piecesCsv'
import {
  buildImport,
  resolveMaterialTargets,
  targetFromValue,
  targetLabel,
  targetToValue,
} from './piecesImport'
import type { ImportTarget, MaterialMapping } from './piecesImport'
import type { ModalContainer } from './types'

// Cap on the mapping rows we render: a CSV using the Material column as free text can produce
// hundreds of distinct values, and each row carries a select with the whole board catalog.
const MAPPING_LIMIT = 25

interface ImportPiecesModalProps {
  visible: boolean
  materials: MaterialForm[]
  boards: BoardProduct[]
  onImport: (rows: RequirementForm[], replace: boolean, newMaterials: MaterialForm[]) => void
  container?: ModalContainer
  onClose: () => void
}

const BADGES: Record<ImportTarget['kind'], { text: string; color: string }> = {
  material: { text: 'Grupo existente', color: 'secondary' },
  board: { text: 'Grupo nuevo', color: 'success' },
  new: { text: 'Nuevo — falta tablero', color: 'warning' },
  skip: { text: 'Omitir', color: 'dark' },
}

const ImportPiecesModal = ({
  visible,
  materials,
  boards,
  onImport,
  container,
  onClose,
}: ImportPiecesModalProps) => {
  const [text, setText] = useState('')
  const [replace, setReplace] = useState(false)
  // Only the destinations the user picked by hand, keyed by normalized material text. Keying by
  // text (not by position) is what makes them survive keystrokes in the textarea.
  const [overrides, setOverrides] = useState<Record<string, ImportTarget>>({})

  const parsed = useMemo(() => parsePieces(text), [text])

  // Auto-detection stays live: rows the user has not touched re-resolve by themselves when the
  // board catalog finishes loading. No effect involved, so there is no re-seed loop.
  const auto = useMemo(
    () => resolveMaterialTargets(parsed.materialTexts, materials, boards),
    [parsed.materialTexts, materials, boards],
  )

  const mappings = useMemo<MaterialMapping[]>(
    () => auto.map((m) => ({ ...m, target: overrides[m.key] ?? m.target })),
    [auto, overrides],
  )

  const labelByKey = useMemo(
    () => new Map(mappings.map((m) => [m.key, targetLabel(m.target, materials, boards)])),
    [mappings, materials, boards],
  )

  const newGroups = mappings.filter(
    (m) => m.target.kind === 'board' || m.target.kind === 'new',
  ).length
  const pendingBoard = mappings.filter((m) => m.target.kind === 'new').length
  const unresolved = mappings.filter((m) => m.match === 'none').length
  const toImport = mappings.reduce((n, m) => (m.target.kind === 'skip' ? n : n + m.count), 0)
  const missingColumn = looksLikeMissingMaterialColumn(parsed.materialTexts)

  const targetByKey = useMemo(() => new Map(mappings.map((m) => [m.key, m.target])), [mappings])

  // Rows the canto reader could not settle on its own: a family code names a tapacanto of another
  // design, and a label with two banding runs cannot fit one product. Both keep their original text.
  const cantoCaveats: string[] = []
  const familyPieces = parsed.canto.familyTokens.reduce((n, f) => n + f.pieces, 0)
  if (familyPieces > 0) {
    const tokens = parsed.canto.familyTokens.map((f) => f.token).join(', ')
    cantoCaveats.push(`${familyPieces} con código de familia (${tokens})`)
  }
  if (parsed.canto.mixed > 0) cantoCaveats.push(`${parsed.canto.mixed} con más de un canto`)

  const reset = () => {
    setText('')
    setReplace(false)
    setOverrides({})
  }

  const close = () => {
    reset()
    onClose()
  }

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setText(typeof reader.result === 'string' ? reader.result : '')
    reader.readAsText(file)
    e.target.value = '' // allows re-selecting the same file
  }

  const setTarget = (key: string, value: string) =>
    setOverrides((o) => ({ ...o, [key]: targetFromValue(value) }))

  const confirm = () => {
    const { requirements, newMaterials } = buildImport(parsed.rows, mappings)
    if (requirements.length === 0) return
    onImport(requirements, replace, newMaterials)
    close()
  }

  return (
    <CModal
      visible={visible}
      onClose={close}
      size="lg"
      alignment="center"
      scrollable
      container={container}
    >
      <CModalHeader>
        <CModalTitle>Importar piezas</CModalTitle>
      </CModalHeader>
      <CModalBody>
        <p className="text-body-secondary small mb-2">
          Pega un rango copiado de Excel/Google Sheets o sube un archivo <strong>CSV o XML</strong>{' '}
          del programa de corte. Columnas esperadas: <strong>{CSV_COLUMNS.join(' · ')}</strong>. La{' '}
          <strong>Etiqueta</strong> se lee como canto cuando trae la notación del taller (
          <code>1L CS</code>, <code>4L CD</code>, <code>NO</code>); el tapacanto se toma del tablero
          del grupo.
        </p>

        <CFormTextarea
          rows={6}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Melamina blanca\t720\t400\t4\nMelamina blanca\t300\t580\t2`}
          className="mb-2 font-monospace"
        />

        <div className="d-flex align-items-center gap-3 mb-3">
          <div>
            <CFormLabel className="small mb-1 d-block">…o desde archivo</CFormLabel>
            <input
              type="file"
              accept=".csv,.txt,.xml,text/csv,text/xml,application/xml"
              className="form-control form-control-sm"
              onChange={handleFile}
            />
          </div>
        </div>

        {missingColumn && (
          <CAlert color="danger" className="py-2 small">
            La primera columna debe ser el <strong>Material</strong>, pero parece contener medidas.
            Revisa el orden: <strong>{CSV_COLUMNS.join(' · ')}</strong>.
          </CAlert>
        )}

        {mappings.length > 0 && (
          <>
            <div className="d-flex justify-content-between align-items-center mb-1 gap-2 flex-wrap">
              <strong className="small">Materiales del CSV ({mappings.length})</strong>
              <span className="small text-body-secondary">
                {newGroups > 0 ? `Se crearán ${newGroups} grupos` : 'No se crearán grupos'}
              </span>
            </div>
            <CTable small bordered className="mb-2 align-middle">
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>Material en el CSV</CTableHeaderCell>
                  <CTableHeaderCell className="text-end">Filas</CTableHeaderCell>
                  <CTableHeaderCell>Destino</CTableHeaderCell>
                  <CTableHeaderCell>Estado</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {mappings.slice(0, MAPPING_LIMIT).map((m) => (
                  <CTableRow
                    key={m.key}
                    className={m.match === 'none' ? 'table-warning' : undefined}
                  >
                    <CTableDataCell>
                      {m.text || <em className="text-body-secondary">(sin material)</em>}
                      {m.ambiguous && (
                        <div className="text-body-secondary" style={{ fontSize: '0.75rem' }}>
                          varios tableros con ese nombre — usa el código
                        </div>
                      )}
                    </CTableDataCell>
                    <CTableDataCell className="text-end">{m.count}</CTableDataCell>
                    <CTableDataCell>
                      <CFormSelect
                        size="sm"
                        value={targetToValue(m.target)}
                        onChange={(e) => setTarget(m.key, e.target.value)}
                      >
                        <optgroup label="Grupos actuales">
                          {materials.map((x) => (
                            <option key={x.uid} value={`mat:${x.uid}`}>
                              {materialLabel(x, boards)}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="Crear grupo desde el catálogo">
                          {boards.map((b) => (
                            <option key={b.id} value={`board:${b.id}`}>
                              {`${b.name} (${b.code})`}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="Otros">
                          <option value="new">Crear grupo nuevo (sin tablero)</option>
                          <option value="skip">Omitir estas filas</option>
                        </optgroup>
                      </CFormSelect>
                    </CTableDataCell>
                    <CTableDataCell>
                      <CBadge color={BADGES[m.target.kind].color}>
                        {BADGES[m.target.kind].text}
                      </CBadge>
                    </CTableDataCell>
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>
            {mappings.length > MAPPING_LIMIT && (
              <p className="small text-body-secondary">
                …y {mappings.length - MAPPING_LIMIT} materiales más, con su destino automático.
              </p>
            )}
          </>
        )}

        {unresolved > 0 && (
          <CAlert color="warning" className="py-2 small">
            {unresolved === 1
              ? '1 material del CSV no coincide con ningún grupo ni con el catálogo.'
              : `${unresolved} materiales del CSV no coinciden con ningún grupo ni con el catálogo.`}{' '}
            {pendingBoard > 0 &&
              'Se crearán grupos sin tablero: deberás elegirlo antes de optimizar o cotizar.'}
          </CAlert>
        )}

        {parsed.canto.banded > 0 && (
          // The Etiqueta is the ONLY place the commercial program keeps the banding, so say plainly
          // what was read from it — and, since a family code names a tapacanto of another design
          // that only the user can confirm, point at the rows that still need a look.
          <CAlert
            color={parsed.canto.needsReview > 0 ? 'warning' : 'info'}
            className="py-2 small mb-2"
          >
            Se leyó el canto de la <strong>Etiqueta</strong> en {parsed.canto.banded} piezas; el
            tapacanto sale del coordinado con el tablero de cada grupo.
            {cantoCaveats.length > 0 && (
              <>
                {' '}
                {cantoCaveats.join(' y ')} conservan su etiqueta original: revisa su{' '}
                <strong>Tapacanto</strong>.
              </>
            )}
          </CAlert>
        )}

        {parsed.rows.length > 0 && (
          <>
            <div className="d-flex justify-content-between align-items-center mb-1">
              <strong className="small">{parsed.rows.length} piezas detectadas</strong>
              {parsed.rows.length > PREVIEW_LIMIT && (
                <span className="small text-body-secondary">
                  Mostrando las primeras {PREVIEW_LIMIT}
                </span>
              )}
            </div>
            <div style={{ maxHeight: 240, overflowY: 'auto' }}>
              <CTable small bordered className="mb-0">
                <CTableHead>
                  <CTableRow>
                    <CTableHeaderCell>Material</CTableHeaderCell>
                    <CTableHeaderCell>Largo</CTableHeaderCell>
                    <CTableHeaderCell>Ancho</CTableHeaderCell>
                    <CTableHeaderCell>Cant.</CTableHeaderCell>
                    <CTableHeaderCell>Canto</CTableHeaderCell>
                    <CTableHeaderCell>Tipo</CTableHeaderCell>
                    <CTableHeaderCell>Etiqueta</CTableHeaderCell>
                    <CTableHeaderCell>Rotar</CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {parsed.rows.slice(0, PREVIEW_LIMIT).map((r, i) => {
                    const key = normalizeText(r.materialText)
                    const skipped = targetByKey.get(key)?.kind === 'skip'
                    return (
                      <CTableRow key={i} className={skipped ? 'text-body-secondary' : undefined}>
                        <CTableDataCell>
                          {skipped ? (
                            <s>{r.materialText || '(sin material)'}</s>
                          ) : (
                            labelByKey.get(key) || '—'
                          )}
                        </CTableDataCell>
                        <CTableDataCell>{r.height || '—'}</CTableDataCell>
                        <CTableDataCell>{r.width || '—'}</CTableDataCell>
                        <CTableDataCell>{r.quantity}</CTableDataCell>
                        <CTableDataCell
                          className={r.canto?.needsReview ? 'text-warning-emphasis' : undefined}
                          title={r.canto?.needsReview ? 'Revisa el tapacanto de esta pieza' : ''}
                        >
                          {r.canto && r.canto.notation !== '—' ? r.canto.notation : '—'}
                          {r.canto?.needsReview ? ' ⚠' : ''}
                        </CTableDataCell>
                        <CTableDataCell>
                          {r.canto?.bandType ? BANDTYPE_LABEL[r.canto.bandType] : '—'}
                        </CTableDataCell>
                        <CTableDataCell>{r.label || '—'}</CTableDataCell>
                        <CTableDataCell>{r.canRotate ? 'sí' : 'no'}</CTableDataCell>
                      </CTableRow>
                    )
                  })}
                </CTableBody>
              </CTable>
            </div>
          </>
        )}

        {parsed.warnings.length > 0 && (
          <CAlert color="warning" className="mt-3 mb-0 py-2 small">
            <ul className="mb-0 ps-3">
              {parsed.warnings.slice(0, 6).map((w, i) => (
                <li key={i}>{w}</li>
              ))}
              {parsed.warnings.length > 6 && <li>…y {parsed.warnings.length - 6} más.</li>}
            </ul>
          </CAlert>
        )}
      </CModalBody>
      <CModalFooter className="justify-content-between">
        <CFormCheck
          id="replace-pieces"
          label="Reemplazar la lista actual"
          checked={replace}
          onChange={(e) => setReplace(e.target.checked)}
        />
        <div className="d-flex gap-2">
          <CButton color="secondary" variant="outline" onClick={close}>
            Cancelar
          </CButton>
          <CButton color="primary" disabled={toImport === 0} onClick={confirm}>
            Agregar {toImport || ''} piezas
          </CButton>
        </div>
      </CModalFooter>
    </CModal>
  )
}

export default ImportPiecesModal
