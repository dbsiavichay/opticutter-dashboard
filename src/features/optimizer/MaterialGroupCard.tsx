import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent } from 'react'
import { CBadge, CButton, CFormInput } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import {
  cilChevronBottom,
  cilChevronRight,
  cilCopy,
  cilLayers,
  cilPlus,
  cilTrash,
} from '@coreui/icons'

import type { BoardProduct, EdgeBandingProduct } from 'src/features/products/types'
import type { ModalContainer, PoolFillOrder } from './types'
import type { BandType, MaterialForm, RequirementForm } from './optimizerForm'
import {
  BAND_TYPE_TOKEN_RE,
  CANTO_NOTATION_RE,
  CS_CD_TO_BANDTYPE,
  emptyRequirement,
  hasEdgeBanding,
  inferBandingProductId,
  isRequirementEmpty,
  materialLabel,
  sidesFromNotation,
  validOffcuts,
} from './optimizerForm'
import type { PiecesEditor } from './usePiecesEditor'
import { useBoardEdgeBandings } from './useOptimizer'
import PieceRowsTable from './PieceRowsTable'

// Short forms for the summary line; the modal spells them out in full.
const FILL_ORDER_LABELS: Record<PoolFillOrder, string> = {
  auto: 'automático',
  offcutsFirst: 'retazo primero',
  catalogFirst: 'tablero primero',
}

interface MaterialGroupCardProps {
  material: MaterialForm
  // Color identifying this group at a glance: a bar down the card's left edge plus a matching dot in
  // its header. With several groups stacked, the border alone doesn't say where one ends.
  accent: string
  rows: RequirementForm[]
  startIndex: number
  materialValid: boolean
  collapsed: boolean
  editor: PiecesEditor
  boards: BoardProduct[]
  edgeBandings: EdgeBandingProduct[]
  // Fullscreen portal target for the portaled overlays in this card: the board / tapacanto dropdown
  // menus and the modals opened from inside the pieces table.
  container?: ModalContainer
  // Flat indices matching the search, and the one currently revealed; passed straight to the table.
  matches?: Set<number>
  activeMatch?: number | null
  // Ref callback handing this group to the navigation, which measures it to decide which material
  // the chip strip should mark as current.
  onRegister?: (el: HTMLElement | null) => void
  // Jump to the first half-filled piece of THIS material. Omitted where there is no navigation.
  onGoToIssue?: () => void
  onToggle: () => void
  onRequestDelete: (m: MaterialForm) => void
  onDuplicate: (m: MaterialForm) => void
  // Opens `MaterialModal` on this group: board, retazos and fill order.
  onConfigure: () => void
}

const boardDims = (b?: BoardProduct): string | null => {
  if (!b) return null
  const { height, width, thickness } = b.attributes
  if (!height || !width) return null
  return `${width}×${height}${thickness ? `×${thickness}` : ''} mm`
}

// Quick-entry format: "720x400", "720x400x4", "720x400x4 Label", "720x400x4 Label 1L2C CS".
// Separator: x, X, ×, *. Decimal: dot or comma. Edge notation and optional CS/CD (canto
// suave/duro) go LAST, after the label — CS/CD after the notation (e.g. "…2L1C CS").
const QUICK_REGEX =
  /^(\d+(?:[.,]\d+)?)\s*[xX×*]\s*(\d+(?:[.,]\d+)?)(?:\s*[xX×*]\s*(\d+(?:[.,]\d+)?))?(?:\s+(.+))?$/

const parseQuickEntry = (
  text: string,
): {
  height: number
  width: number
  quantity: number
  label: string
  notation: string | null
  bandType: BandType | null
} | null => {
  const m = text.trim().match(QUICK_REGEX)
  if (!m) return null
  const toNum = (s?: string) => (s ? Number(s.replace(',', '.')) : 0)
  const remaining = (m[4] ?? '').trim()
  let notation: string | null = null
  let bandType: BandType | null = null
  let label = remaining
  if (remaining) {
    const parts = remaining.split(/\s+/)
    // Pop from the end: an optional CS/CD band-type token, then an optional canto notation.
    let last = parts[parts.length - 1]
    if (last && BAND_TYPE_TOKEN_RE.test(last)) {
      bandType = CS_CD_TO_BANDTYPE[last.toUpperCase()] ?? null
      parts.pop()
      last = parts[parts.length - 1]
    }
    if (last && CANTO_NOTATION_RE.test(last)) {
      notation = last.toUpperCase()
      parts.pop()
    }
    // A band type without banded sides is meaningless — drop it.
    if (!notation) bandType = null
    label = parts.join(' ')
  }
  return {
    height: toNum(m[1]),
    width: toNum(m[2]),
    quantity: m[3] ? Math.max(1, Math.round(toNum(m[3]))) : 1,
    label: label.trim(),
    notation,
    bandType,
  }
}

const MaterialGroupCard = ({
  material: m,
  accent,
  rows,
  startIndex,
  materialValid,
  collapsed,
  editor,
  boards,
  edgeBandings,
  container,
  matches,
  activeMatch,
  onRegister,
  onGoToIssue,
  onToggle,
  onRequestDelete,
  onDuplicate,
  onConfigure,
}: MaterialGroupCardProps) => {
  const [quickText, setQuickText] = useState('')
  const [quickError, setQuickError] = useState('')

  // Tapacantos coordinated with this group's board (same family + width rule). Empty for
  // non-catalog sources or catalog gaps — the table falls back to the global list.
  const boardId = m.boardId ? String(m.boardId) : undefined
  const { data: boardEdgeBandings = [] } = useBoardEdgeBandings(boardId)

  const invalidCount = rows.filter(
    (r) =>
      !(materialValid && Number(r.height) > 0 && Number(r.width) > 0) && !isRequirementEmpty(r),
  ).length

  const board = m.boardId ? boards.find((b) => String(b.id) === String(m.boardId)) : undefined
  const dims = boardDims(board)

  // Two rules, both waiting on the board's coordinated list, which loads asynchronously:
  //
  // 1. When the board CHANGES, re-infer the tapacanto for EVERY banded piece from its band type: a
  //    new board invalidates prior tapacanto choices (manual picks included). The change is detected
  //    here and applied once the new list arrives. Crucially it does NOT fire on initial mount, so
  //    loading an existing quote never clobbers its saved tapacantos.
  // 2. Otherwise, only fill the GAPS — pieces that know their sides and type but carry no product.
  //    That is what an import or a paste produces (the file has the canto, not the catalog), and it
  //    is what keeps "Crear cotización" unblocked without touching an assigned tapacanto.
  //    Deliberate trade: picking "— Sin tapacanto —" on a banded row does not stick, it gets the
  //    coordinated one back. That state is already an error the app refuses to quote
  //    (needsBandingProduct paints the row red), so the rule only ever replaces an error with the
  //    sane default — to really drop the banding, clear the Canto column instead.
  const coordinatedKey = boardEdgeBandings.map((p) => p.id).join(',')
  // Counts the gaps rule 2 has to close. As a dependency it goes N→0 and then holds, so the effect
  // settles instead of looping.
  const missingProduct = rows.filter(
    (r) => hasEdgeBanding(r.edgeBanding) && !r.edgeBanding.productId,
  ).length
  const prevBoardId = useRef(boardId)
  const pendingReinfer = useRef(false)
  useEffect(() => {
    if (prevBoardId.current !== boardId) {
      prevBoardId.current = boardId
      pendingReinfer.current = true
    }
    if (!boardId || boardEdgeBandings.length === 0) return
    const reinferAll = pendingReinfer.current
    if (!reinferAll && missingProduct === 0) return
    pendingReinfer.current = false
    editor.updateGroup(m.uid, (r) => {
      if (!hasEdgeBanding(r.edgeBanding)) return r
      if (!reinferAll && r.edgeBanding.productId) return r
      const productId = inferBandingProductId(boardEdgeBandings, r.edgeBanding.bandType)
      if (!productId || productId === r.edgeBanding.productId) return r
      return { ...r, edgeBanding: { ...r.edgeBanding, productId } }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m.uid, boardId, coordinatedKey, missingProduct])

  // Retazos of this same material. Editing them lives in `MaterialModal`; the
  // card only reports them, in one line, so the cut list keeps the screen.
  //
  // The chip counts EVERY row and the summary lists only the usable ones: a
  // retazo missing its thickness would otherwise vanish from both and read as
  // "it didn't save", the same reason the piece table badges incomplete rows
  // instead of hiding them.
  const allOffcuts = m.offcuts ?? []
  const offcuts = validOffcuts(m)
  const incompleteOffcuts = allOffcuts.length - offcuts.length
  const offcutSummary = offcuts
    .map((o) => `${o.height}×${o.width}${Number(o.quantity) > 1 ? ` ×${o.quantity}` : ''}`)
    .join(', ')
  const fillOrderLabel = FILL_ORDER_LABELS[m.fillOrder ?? 'auto']

  const handleQuickEntry = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    if (!quickText.trim()) return
    const parsed = parseQuickEntry(quickText)
    if (!parsed) {
      setQuickError('Formato: 720×400 o 720×400×4 Etiqueta 1L2C CS')
      return
    }
    const req = emptyRequirement(m.uid)
    req.height = parsed.height
    req.width = parsed.width
    req.quantity = parsed.quantity
    req.label = parsed.label
    if (parsed.notation) {
      const lastEb = rows[rows.length - 1]?.edgeBanding
      const bandType: '' | BandType = parsed.bandType ?? lastEb?.bandType ?? ''
      const productId =
        inferBandingProductId(boardEdgeBandings, bandType) || lastEb?.productId || ''
      req.edgeBanding = {
        productId,
        sides: sidesFromNotation(parsed.notation),
        bandType,
      }
    }
    editor.addMany([req], false)
    setQuickText('')
    setQuickError('')
  }

  const title = materialLabel(m, boards)

  return (
    // `data-material-uid` marks the GROUP, not the header below: the header is sticky, so once the
    // pane is scrolled past this material it has un-stuck and is resting on the group's bottom edge.
    // Scrolling to it from below therefore landed on the material's LAST row instead of its first.
    <div
      ref={onRegister}
      className="material-group mb-3"
      data-material-uid={m.uid}
      style={{ '--group-accent': accent } as CSSProperties}
    >
      {/* The one line that stays pinned while the group scrolls. The accent spine down the left is
          the parent's border and scrolls away with it, which is why the identity is repeated here as
          a dot — and why the name is text at last, instead of the label of a select. Its height is
          fixed (`--pieces-group-header-h`) because the table's own sticky header parks right under
          it and needs a constant offset. */}
      <div className="material-group__head d-flex align-items-center gap-2">
        <CButton
          size="sm"
          color="secondary"
          variant="ghost"
          type="button"
          className="px-1"
          title={collapsed ? 'Expandir piezas' : 'Plegar piezas'}
          onClick={onToggle}
        >
          <CIcon icon={collapsed ? cilChevronRight : cilChevronBottom} />
        </CButton>

        <span className="material-dot" />
        <span className="fw-semibold text-truncate" title={title}>
          {title}
        </span>
        {dims && (
          <span className="small text-body-secondary text-nowrap d-none d-md-inline">{dims}</span>
        )}

        <div className="ms-auto d-flex align-items-center gap-2">
          <span className="small text-body-secondary text-nowrap">
            <strong className="text-body">{rows.length}</strong> piezas
          </span>
          {invalidCount > 0 &&
            (onGoToIssue ? (
              <CBadge
                as="button"
                type="button"
                color="danger"
                className="border-0"
                title="Ir a la primera pieza incompleta de este material"
                onClick={onGoToIssue}
              >
                {invalidCount === 1 ? '1 incompleta' : `${invalidCount} incompletas`}
              </CBadge>
            ) : (
              <CBadge color="danger" title="Piezas con datos incompletos">
                {invalidCount === 1 ? '1 incompleta' : `${invalidCount} incompletas`}
              </CBadge>
            ))}
          {/* ONE way in, always in the same place. It replaced a pencil (board)
              plus a "Retazos" chip (everything else) that opened two halves of
              the same idea — and the chip only carried a count, which the line
              under the header now states in words.

              Solid while the material is undefined: with no inline form left,
              this button is the only exit from an empty card, so it has to look
              like the next step rather than like a settings icon. */}
          <CButton
            size="sm"
            variant={materialValid ? 'ghost' : undefined}
            color="primary"
            type="button"
            title="Tablero y retazos de este grupo"
            onClick={onConfigure}
          >
            <CIcon icon={cilLayers} className="d-md-none" />
            <span className="d-none d-md-inline">
              {materialValid ? 'Configurar' : 'Configurar material'}
            </span>
          </CButton>
          <CButton
            size="sm"
            variant="ghost"
            color="secondary"
            type="button"
            title="Duplicar material y sus piezas"
            onClick={() => onDuplicate(m)}
          >
            <CIcon icon={cilCopy} />
          </CButton>
          <CButton
            size="sm"
            variant="ghost"
            color="danger"
            type="button"
            title="Eliminar material"
            onClick={() => onRequestDelete(m)}
          >
            <CIcon icon={cilTrash} />
          </CButton>
        </div>
      </div>

      {!collapsed && (
        <div>
          {/* The retazos, in one line instead of the ~140px of inputs they used
              to occupy here. Reading is the common act; editing is not — and
              editing has exactly one door, the header's button, rather than a
              second one that appears and disappears with the retazos. */}
          {allOffcuts.length > 0 && (
            <div className="d-flex align-items-center gap-2 flex-wrap small text-body-secondary mb-2">
              <span className="fw-semibold text-body">
                {allOffcuts.length === 1 ? '1 retazo' : `${allOffcuts.length} retazos`}
              </span>
              <span>{offcutSummary}</span>
              {m.boardId && <span>· llenado {fillOrderLabel}</span>}
              {!m.boardId && <span>· sin tablero de catálogo</span>}
              {incompleteOffcuts > 0 && (
                <CBadge color="danger">
                  {incompleteOffcuts === 1
                    ? '1 sin completar'
                    : `${incompleteOffcuts} sin completar`}
                </CBadge>
              )}
            </div>
          )}
          <PieceRowsTable
            materialUid={m.uid}
            rows={rows}
            startIndex={startIndex}
            materialValid={materialValid}
            editor={editor}
            edgeBandings={edgeBandings}
            boardEdgeBandings={boardEdgeBandings}
            boardThickness={board?.attributes.thickness}
            container={container}
            matches={matches}
            activeMatch={activeMatch}
          />
          <div className="d-flex align-items-center gap-2 mt-2 flex-wrap">
            {/* Icon-only: the input beside it already says how to add a piece, and Enter on the last
                row of the table does the same. This is the explicit affordance, not the main path. */}
            <CButton
              size="sm"
              color="primary"
              variant="outline"
              type="button"
              title="Agregar pieza"
              onClick={() => editor.addTo(m.uid)}
            >
              <CIcon icon={cilPlus} />
            </CButton>
            <CFormInput
              size="sm"
              value={quickText}
              onChange={(e) => {
                setQuickText(e.target.value)
                setQuickError('')
              }}
              onKeyDown={handleQuickEntry}
              placeholder="720×400×4  Etiqueta  1L2C  CS  (Enter para agregar)"
              invalid={!!quickError}
              style={{ maxWidth: 380 }}
            />
            {quickError && <small className="text-danger">{quickError}</small>}
          </div>
        </div>
      )}
    </div>
  )
}

export default MaterialGroupCard
