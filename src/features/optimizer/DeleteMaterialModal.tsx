import { useState } from 'react'
import {
  CButton,
  CFormLabel,
  CFormSelect,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
} from '@coreui/react'

import type { BoardProduct } from 'src/features/products/types'
import type { MaterialForm } from './optimizerForm'
import { materialLabel } from './optimizerForm'
import type { ModalContainer } from './types'

interface DeleteMaterialModalProps {
  material: MaterialForm | null // target; the modal is visible while non-null
  pieceCount: number
  otherMaterials: MaterialForm[]
  boards: BoardProduct[]
  onMove: (destUid: string) => void
  onDeleteWithPieces: () => void
  container?: ModalContainer
  onClose: () => void
}

const DeleteMaterialModal = ({
  material,
  pieceCount,
  otherMaterials,
  boards,
  onMove,
  onDeleteWithPieces,
  container,
  onClose,
}: DeleteMaterialModalProps) => {
  const [destUid, setDestUid] = useState('')

  const hasPieces = pieceCount > 0
  const canMove = otherMaterials.length > 0
  const name = material ? materialLabel(material, boards) : ''
  // Effective destination: the user's pick if it is still a valid target, otherwise the first one.
  const effectiveDest = otherMaterials.some((m) => m.uid === destUid)
    ? destUid
    : (otherMaterials[0]?.uid ?? '')

  return (
    <CModal visible={!!material} onClose={onClose} alignment="center" container={container}>
      <CModalHeader>
        <CModalTitle>Eliminar material</CModalTitle>
      </CModalHeader>
      <CModalBody>
        <p className="mb-3">
          Vas a eliminar <strong>{name}</strong>.
        </p>

        {!hasPieces && <p className="text-body-secondary small mb-0">No tiene piezas asociadas.</p>}

        {hasPieces && canMove && (
          <>
            <p className="text-body-secondary small">
              Este material tiene <strong className="text-body">{pieceCount}</strong> pieza
              {pieceCount === 1 ? '' : 's'}. Puedes conservarlas moviéndolas a otro material, o
              eliminarlas junto con el material.
            </p>
            <CFormLabel className="small mb-1">Mover piezas a</CFormLabel>
            <CFormSelect value={effectiveDest} onChange={(e) => setDestUid(e.target.value)}>
              {otherMaterials.map((m) => (
                <option key={m.uid} value={m.uid}>
                  {materialLabel(m, boards)}
                </option>
              ))}
            </CFormSelect>

            <div className="mt-3">
              <CButton
                color="danger"
                variant="ghost"
                size="sm"
                type="button"
                className="px-0"
                onClick={onDeleteWithPieces}
              >
                Eliminar el material y sus {pieceCount} pieza{pieceCount === 1 ? '' : 's'}
              </CButton>
            </div>
          </>
        )}

        {hasPieces && !canMove && (
          <p className="text-body-secondary small mb-0">
            Es el único material. Al eliminarlo se borrarán sus{' '}
            <strong className="text-body">{pieceCount}</strong> pieza
            {pieceCount === 1 ? '' : 's'} y empezarás con un material nuevo.
          </p>
        )}
      </CModalBody>
      <CModalFooter>
        <CButton color="secondary" variant="ghost" type="button" onClick={onClose}>
          Cancelar
        </CButton>
        {hasPieces && canMove ? (
          <CButton
            color="primary"
            type="button"
            disabled={!effectiveDest}
            onClick={() => onMove(effectiveDest)}
          >
            Mover piezas y eliminar
          </CButton>
        ) : (
          <CButton color="danger" type="button" onClick={onDeleteWithPieces}>
            Eliminar
          </CButton>
        )}
      </CModalFooter>
    </CModal>
  )
}

export default DeleteMaterialModal
