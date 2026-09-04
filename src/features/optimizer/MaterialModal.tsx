import { useMemo, useState } from 'react'
import {
  CButton,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilPlus, cilTrash } from '@coreui/icons'

import MultiSelectFilter from 'src/shared/components/MultiSelectFilter'
import SearchableSelect from 'src/shared/components/SearchableSelect'
import type { BoardProduct } from 'src/features/products/types'
import type { MaterialForm, OffcutForm, OffcutSource } from './optimizerForm'
import { emptyOffcut } from './optimizerForm'
import type { MultiSelectOption } from 'src/shared/components/MultiSelectFilter'
import type { ModalContainer, PoolFillOrder } from './types'

// Everything about WHERE a group's material comes from, in one place: the catalog
// board (optional), the retazos, and the order they are filled in.
//
// It is a modal and not a section of the card because this is stock configuration
// competing with the cut list for the same screen. The card used to inline it —
// up to 23 controls between the material's name and the piece table — and the
// exception ended up more prominent than the rule. Here the retazo rows also get
// the width they need: seven fields wrap badly inside a card.
//
// There is no "source" for the group. A board makes it a catalog quote, retazos
// alone make it a job on the client's own material, and both together are the
// mixed pool. Which retazo the API uses as the pool's anchor is decided by
// `buildPayload`; the seller never sees that word.

const FILL_ORDER_OPTIONS: { value: PoolFillOrder; label: string }[] = [
  { value: 'auto', label: 'Automático (menos desperdicio)' },
  { value: 'offcutsFirst', label: 'Retazo primero' },
  { value: 'catalogFirst', label: 'Tablero primero' },
]

const OFFCUT_SOURCES: { value: OffcutSource; label: string }[] = [
  { value: 'clientOffcut', label: 'Retazo cliente' },
  { value: 'companyOffcut', label: 'Retazo empresa' },
]

// The board subtypes present in the catalog, most common first — MDP is 134 of
// the 210 live boards, so frequency order puts the answer at the top without
// spending a column on counts. Derived from the boards actually loaded, so a
// catalog that grows a subtype needs no change here.
const subtypeOptions = (boards: BoardProduct[]): MultiSelectOption[] => {
  const counts = new Map<string, number>()
  for (const b of boards) {
    const raw = b.attributes.subtype
    if (raw === undefined || raw === null || raw === '') continue
    counts.set(String(raw), (counts.get(String(raw)) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([value]) => ({ value, label: value }))
}

interface MaterialModalProps {
  // Target group; the modal is visible while non-null.
  material: MaterialForm | null
  boards: BoardProduct[]
  onUpdate: (
    uid: string,
    field: keyof MaterialForm,
    value: MaterialForm[keyof MaterialForm],
  ) => void
  container?: ModalContainer
  onClose: () => void
}

const MaterialModal = ({ material, boards, onUpdate, container, onClose }: MaterialModalProps) => {
  const offcuts = material?.offcuts ?? []

  // Catalog filter. It lives here and not in the picker because this is where
  // there is room for it: the card's inline select still sits above the piece
  // table. Multi-value because the axis is not exclusive — "MDP o MDF" is a
  // normal way to narrow 210 boards, and the dropdown's own text search then
  // handles the last step.
  const [subtypes, setSubtypes] = useState<string[]>([])

  const subtypeChoices = useMemo(() => subtypeOptions(boards), [boards])

  const filteredBoards = useMemo(
    () =>
      subtypes.length === 0
        ? boards
        : boards.filter((b) => subtypes.includes(String(b.attributes.subtype ?? ''))),
    [boards, subtypes],
  )

  // A filter that hides the board already chosen would leave the picker showing a
  // name absent from its own list; keep it reachable.
  const boardId = material?.boardId ?? ''
  const pickerBoards = useMemo(() => {
    if (!boardId) return filteredBoards
    const chosen = boards.find((b) => String(b.id) === String(boardId))
    if (!chosen || filteredBoards.some((b) => b.id === chosen.id)) return filteredBoards
    return [chosen, ...filteredBoards]
  }, [boards, filteredBoards, boardId])

  const setOffcuts = (next: OffcutForm[]) => {
    if (material) onUpdate(material.uid, 'offcuts', next)
  }
  const updateOffcut = (uid: string, field: keyof OffcutForm, value: string) =>
    setOffcuts(offcuts.map((o) => (o.uid === uid ? { ...o, [field]: value } : o)))

  return (
    <CModal
      visible={!!material}
      onClose={onClose}
      alignment="center"
      size="lg"
      container={container}
    >
      <CModalHeader>
        <CModalTitle>Material del grupo</CModalTitle>
      </CModalHeader>
      <CModalBody>
        {material && (
          <>
            <CFormLabel className="small mb-1">Tablero de catálogo</CFormLabel>
            <div className="d-flex gap-2 align-items-center flex-wrap mb-2">
              {/* Placeholder is the field's NAME, not "Todos los tipos": with
                  three or more picked the toggle reads `placeholder (3)`, and
                  "Todos los tipos (3)" says the opposite of what is selected.
                  Empty and muted it reads as "no filter" the way any select
                  placeholder does, and the counter beside it confirms as much. */}
              <MultiSelectFilter
                size="sm"
                style={{ width: 240 }}
                placeholder="Tipo de tablero"
                values={subtypes}
                options={subtypeChoices}
                onChange={setSubtypes}
                container={container}
              />
              {/* The aggregate, not a count per option: what the seller needs to
                  know is whether the filter actually cut the list. "Limpiar
                  selección" lives inside the dropdown. */}
              <span className="small text-body-secondary">
                {filteredBoards.length === boards.length
                  ? `${boards.length} tableros`
                  : `${filteredBoards.length} de ${boards.length}`}
              </span>
            </div>
            <div className="d-flex gap-2 align-items-start mb-1">
              <div className="flex-grow-1">
                <SearchableSelect
                  value={String(material.boardId)}
                  placeholder="Sin tablero"
                  searchPlaceholder="Buscar por nombre o código…"
                  emptyText="Sin tableros que coincidan"
                  options={pickerBoards.map((b) => ({
                    value: String(b.id),
                    label: b.name,
                    sublabel: b.code,
                  }))}
                  onChange={(v) => onUpdate(material.uid, 'boardId', v)}
                  container={container}
                />
              </div>
              {material.boardId && (
                <CButton
                  color="secondary"
                  variant="ghost"
                  type="button"
                  title="Quitar el tablero: las piezas se cortarán solo sobre los retazos"
                  onClick={() => onUpdate(material.uid, 'boardId', '')}
                >
                  Quitar
                </CButton>
              )}
            </div>
            <div className="small text-body-secondary mb-3">
              {material.boardId
                ? 'Las piezas se reparten entre este tablero y los retazos de abajo.'
                : 'Sin tablero, las piezas se cortan solo sobre los retazos. Si no entran todas, el optimizador dice cuáles quedan fuera.'}
            </div>

            <div className="d-flex align-items-center gap-2 mb-2 flex-wrap">
              <span className="fw-semibold">Retazos</span>
              <span className="small text-body-secondary">del mismo material</span>
              {/* Board-vs-retazo priority only means something when there IS a
                  board: a group of retazos alone has nothing to order. */}
              {material.boardId && offcuts.length > 0 && (
                <>
                  <CFormLabel className="small mb-0 ms-auto text-nowrap">
                    Orden de llenado
                  </CFormLabel>
                  <CFormSelect
                    size="sm"
                    style={{ width: 230 }}
                    value={material.fillOrder ?? 'auto'}
                    onChange={(e) => onUpdate(material.uid, 'fillOrder', e.target.value)}
                  >
                    {FILL_ORDER_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </CFormSelect>
                </>
              )}
            </div>

            {offcuts.length === 0 && (
              <p className="small text-body-secondary">
                Sin retazos. Agrega los que el cliente traiga o los que salgan de bodega, y el
                optimizador reparte las piezas de este grupo entre todos.
              </p>
            )}

            {offcuts.map((o) => (
              <div key={o.uid} className="d-flex flex-wrap gap-2 align-items-end mb-2">
                <div style={{ width: 150 }}>
                  <CFormLabel className="small mb-1">Tipo</CFormLabel>
                  <CFormSelect
                    size="sm"
                    value={o.source}
                    onChange={(e) => updateOffcut(o.uid, 'source', e.target.value)}
                  >
                    {OFFCUT_SOURCES.map((src) => (
                      <option key={src.value} value={src.value}>
                        {src.label}
                      </option>
                    ))}
                  </CFormSelect>
                </div>
                <div style={{ flex: '1 1 140px', minWidth: 120 }}>
                  <CFormLabel className="small mb-1">Etiqueta</CFormLabel>
                  <CFormInput
                    size="sm"
                    value={o.label}
                    placeholder="Retazo bodega 3"
                    onChange={(e) => updateOffcut(o.uid, 'label', e.target.value)}
                  />
                </div>
                <div style={{ width: 84 }}>
                  <CFormLabel className="small mb-1">Largo</CFormLabel>
                  <CFormInput
                    size="sm"
                    type="number"
                    min={1}
                    value={o.height}
                    onChange={(e) => updateOffcut(o.uid, 'height', e.target.value)}
                  />
                </div>
                <div style={{ width: 84 }}>
                  <CFormLabel className="small mb-1">Ancho</CFormLabel>
                  <CFormInput
                    size="sm"
                    type="number"
                    min={1}
                    value={o.width}
                    onChange={(e) => updateOffcut(o.uid, 'width', e.target.value)}
                  />
                </div>
                <div style={{ width: 84 }}>
                  <CFormLabel className="small mb-1">Grosor</CFormLabel>
                  <CFormInput
                    size="sm"
                    type="number"
                    min={1}
                    value={o.thickness}
                    onChange={(e) => updateOffcut(o.uid, 'thickness', e.target.value)}
                  />
                </div>
                {/* The client's own material has no price: the shop charges the
                    cutting and the banding as additional services. */}
                {o.source !== 'clientOffcut' && (
                  <div style={{ width: 96 }}>
                    <CFormLabel className="small mb-1">Costo</CFormLabel>
                    <CFormInput
                      size="sm"
                      type="number"
                      min={0}
                      step="0.01"
                      value={o.costPerUnit}
                      onChange={(e) => updateOffcut(o.uid, 'costPerUnit', e.target.value)}
                    />
                  </div>
                )}
                <div style={{ width: 74 }}>
                  <CFormLabel className="small mb-1">Cant.</CFormLabel>
                  <CFormInput
                    size="sm"
                    type="number"
                    min={1}
                    value={o.quantity}
                    onChange={(e) => updateOffcut(o.uid, 'quantity', e.target.value)}
                  />
                </div>
                <CButton
                  size="sm"
                  variant="ghost"
                  color="danger"
                  type="button"
                  title="Quitar retazo"
                  onClick={() => setOffcuts(offcuts.filter((x) => x.uid !== o.uid))}
                >
                  <CIcon icon={cilTrash} />
                </CButton>
              </div>
            ))}

            <CButton
              size="sm"
              color="secondary"
              variant="outline"
              type="button"
              onClick={() => setOffcuts([...offcuts, emptyOffcut()])}
            >
              <CIcon icon={cilPlus} className="me-1" />
              Agregar retazo
            </CButton>
          </>
        )}
      </CModalBody>
      <CModalFooter>
        {/* No "save": every edit already wrote through `onUpdate`, the same way
            the inline fields did. A Cancelar here would have to undo them. */}
        <CButton color="primary" type="button" onClick={onClose}>
          Listo
        </CButton>
      </CModalFooter>
    </CModal>
  )
}

export default MaterialModal
