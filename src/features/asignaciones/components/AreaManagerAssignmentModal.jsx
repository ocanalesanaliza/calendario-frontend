import { useEffect, useRef, useState } from 'react'
import './AreaManagerAssignmentModal.css'

function itemsFrom(data) {
  return Array.isArray(data) ? data : data?.results || []
}

function isSystemsAccount(item) {
  return item?.es_cuenta_sistemas === true || item?.type === 'sistemas'
}

function itemId(item) {
  return item.id_gerente_area ?? item.id
}

function itemLabel(item) {
  const fullName = [item.nombre, item.apellido].filter(Boolean).join(' ')
  return item.codigo ? `${item.codigo} — ${item.nombre}` : fullName || item.email
}

function conflictMessage(error) {
  const detail = error?.fields?.detail
  const code = error?.fields?.code || (typeof detail === 'object' ? detail?.code : detail) || error?.code
  if (code === 'area_already_assigned') return 'Esta área ya está asignada a otro gerente de área.'
  if (code === 'area_manager_already_assigned') return 'Este gerente de área ya tiene un área asignada.'
  return error?.message || 'No se pudo completar la asignación.'
}

function isAreaAlreadyAssigned(error) {
  const detail = error?.fields?.detail
  const code = error?.fields?.code || (typeof detail === 'object' ? detail?.code : detail) || error?.code
  return code === 'area_already_assigned'
}

export default function AreaManagerAssignmentModal({ target, targetType, loadEligible, onAssign, onReassign, onClose }) {
  const [items, setItems] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmingReassignment, setConfirmingReassignment] = useState(false)
  const dialogRef = useRef(null)
  const previousFocusRef = useRef(null)
  const selectingManager = targetType === 'area'
  const itemName = selectingManager ? 'gerentes de área' : 'áreas'
  const title = selectingManager ? `Asignar gerente de área a ${target.nombre}` : `Asignar área a ${target.nombre}`

  useEffect(() => {
    let active = true
    previousFocusRef.current = document.activeElement
    dialogRef.current?.focus()

    loadEligible()
      .then((data) => {
        if (active) setItems(itemsFrom(data).filter((item) => !isSystemsAccount(item)))
      })
      .catch((requestError) => {
        if (active) setError(requestError.message || `No se pudieron cargar las ${itemName} elegibles.`)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
      previousFocusRef.current?.focus()
    }
    // Eligible data is loaded only when this modal opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function submit(event) {
    event.preventDefault()
    if (!selectedId) return
    setError('')
    setSaving(true)

    try {
      await onAssign(Number(selectedId))
    } catch (requestError) {
      if (onReassign && isAreaAlreadyAssigned(requestError)) {
        setConfirmingReassignment(true)
        setSaving(false)
        return
      }
      setError(conflictMessage(requestError))
      setSaving(false)
    }
  }

  async function confirmReassignment() {
    setError('')
    setSaving(true)

    try {
      await onReassign(Number(selectedId))
    } catch (requestError) {
      setError(conflictMessage(requestError))
      setSaving(false)
    }
  }

  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }
    if (event.key !== 'Tab') return

    const focusable = [...dialogRef.current.querySelectorAll('button:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')]
    const first = focusable[0]
    const last = focusable.at(-1)
    if (!first) return
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <div className="assignment-modal-backdrop">
      <section ref={dialogRef} className="assignment-modal" role="dialog" aria-modal="true" aria-labelledby="assignment-modal-title" tabIndex="-1" onKeyDown={handleKeyDown}>
        <header>
          <h2 id="assignment-modal-title">{title}</h2>
          <button type="button" className="assignment-modal-close" onClick={onClose} aria-label="Cerrar">×</button>
        </header>
        {confirmingReassignment ? (
          <div>
            <p>Esta área ya está asignada. ¿Deseas programar la reasignación desde mañana?</p>
            {error && <p role="alert">{error}</p>}
            <footer>
              <button type="button" onClick={onClose}>Cancelar</button>
              <button type="button" onClick={confirmReassignment} disabled={saving}>
                {saving ? 'Reasignando...' : 'Reasignar desde mañana'}
              </button>
            </footer>
          </div>
        ) : (
          <form onSubmit={submit}>
            {loading ? (
              <p role="status">Cargando {itemName} elegibles...</p>
            ) : error && !items.length ? (
              <p role="alert">{error}</p>
            ) : !items.length ? (
              <p>No hay {itemName} elegibles disponibles.</p>
            ) : (
              <label>
                {selectingManager ? 'Gerente de área' : 'Área'}
                <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)} disabled={saving} autoFocus>
                  <option value="">Seleccionar</option>
                  {items.map((item) => <option key={itemId(item)} value={itemId(item)}>{itemLabel(item)}</option>)}
                </select>
              </label>
            )}
            {error && items.length > 0 && <p role="alert">{error}</p>}
            <footer>
              <button type="button" onClick={onClose}>Cancelar</button>
              <button type="submit" disabled={loading || !items.length || !selectedId || saving}>
                {saving ? 'Asignando...' : 'Asignar'}
              </button>
            </footer>
          </form>
        )}
      </section>
    </div>
  )
}
