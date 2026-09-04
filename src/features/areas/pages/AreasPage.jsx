import { useEffect, useRef, useState } from 'react'
import { createArea, deactivateArea, getArea, getAreas, updateArea } from '../services/areasService'
import './AreasPage.css'

const fields = ['nombre', 'codigo']

function apiMessage(error, fallback) {
  if (error.status === 403) return 'No tienes permisos para gestionar áreas.'
  if (error.status === 404) return 'El área solicitada ya no existe.'
  if (error.status === 409) return 'No se puede desactivar el área porque tiene asignaciones GO actuales o futuras.'

  return error.message || fallback
}

function Modal({ title, onClose, children }) {
  const dialogRef = useRef(null)
  const previousFocusRef = useRef(null)

  useEffect(() => {
    previousFocusRef.current = document.activeElement
    const dialog = dialogRef.current
    const initialFocus = dialog.querySelector('[data-autofocus]')
      || dialog.querySelector('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')

    ;(initialFocus || dialog).focus()

    return () => previousFocusRef.current?.focus()
  }, [])

  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }

    if (event.key !== 'Tab') return

    const focusable = [...dialogRef.current.querySelectorAll(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )]
    const first = focusable[0]
    const last = focusable.at(-1)

    if (!first) {
      event.preventDefault()
      dialogRef.current.focus()
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <div className="areas-modal-backdrop">
      <section ref={dialogRef} className="areas-modal" role="dialog" aria-modal="true" aria-label={title} tabIndex="-1" onKeyDown={handleKeyDown}>
        <header>
          <h2>{title}</h2>
          <button onClick={onClose} aria-label="Cerrar">×</button>
        </header>
        {children}
      </section>
    </div>
  )
}

function FormModal({ area, onClose, onSubmit }) {
  const [form, setForm] = useState({ nombre: area?.nombre || '', codigo: area?.codigo || '' })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  function fieldError(field) {
    return Array.isArray(errors[field]) ? errors[field].join(' ') : errors[field]
  }

  async function submit(event) {
    event.preventDefault()
    setSaving(true)
    setErrors({})

    try {
      const body = Object.fromEntries(
        Object.entries(form).filter(([key, value]) => !area || value !== (area[key] || '')),
      )
      await onSubmit(body)
    } catch (error) {
      setErrors(typeof error.fields === 'object' ? error.fields : {
        detail: apiMessage(error, 'No se pudo guardar el área.'),
      })
      setSaving(false)
    }
  }

  return (
    <Modal title={area ? 'Editar área' : 'Nueva área'} onClose={onClose}>
      <form onSubmit={submit}>
        {fields.map((field) => {
          const error = fieldError(field)

          return (
            <label key={field}>
              {field[0].toUpperCase() + field.slice(1)}
              <input
                value={form[field]}
                onChange={(event) => setForm({ ...form, [field]: event.target.value })}
                required
                data-autofocus={field === fields[0] || undefined}
                aria-describedby={error ? `${field}-error` : undefined}
              />
              {error && <span id={`${field}-error`} role="alert">{error}</span>}
            </label>
          )
        })}

        {errors.detail && (
          <p role="alert">
            {typeof errors.detail === 'string'
              ? errors.detail
              : apiMessage({ message: '' }, 'No se pudo guardar el área.')}
          </p>
        )}

        <footer>
          <button type="button" onClick={onClose}>Cancelar</button>
          <button disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
        </footer>
      </form>
    </Modal>
  )
}

function ConfirmModal({ area, onClose, onConfirm }) {
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit() {
    setSaving(true)

    try {
      await onConfirm()
    } catch (requestError) {
      setError(apiMessage(requestError, 'No se pudo desactivar el área.'))
      setSaving(false)
    }
  }

  return (
    <Modal title="Desactivar área" onClose={onClose}>
      <div className="areas-modal-content">
        <p>¿Deseas desactivar el área {area.nombre}?</p>
        {error && <p role="alert">{error}</p>}
        <footer>
          <button data-autofocus onClick={onClose}>Cancelar</button>
          <button className="areas-danger" onClick={submit} disabled={saving}>{saving ? 'Desactivando...' : 'Desactivar'}</button>
        </footer>
      </div>
    </Modal>
  )
}

export default function AreasPage() {
  const [areas, setAreas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modal, setModal] = useState(null)

  async function load() {
    setLoading(true)
    setError('')

    try {
      const data = await getAreas()
      setAreas(data.results || data)
    } catch (requestError) {
      setError(apiMessage(requestError, 'No se pudieron cargar las áreas.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const close = () => setModal(null)
  const mutation = async (action) => {
    await action()
    await load()
    close()
  }

  async function openDetail(area) {
    try {
      setModal({ type: 'loading' })
      setModal({ type: 'edit', area: await getArea(area.id) })
    } catch (requestError) {
      setError(apiMessage(requestError, 'No se pudo cargar el detalle del área.'))
      close()
    }
  }

  return (
    <div className="areas-page">
      <header className="areas-page-header">
        <div>
          <h1>Áreas</h1>
          <p>{areas.length} área{areas.length !== 1 ? 's' : ''} registrada{areas.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setModal({ type: 'create' })}>Nueva área</button>
      </header>

      {loading ? (
        <p role="status">Cargando áreas...</p>
      ) : error ? (
        <div role="alert">
          <p>{error}</p>
          <button onClick={load}>Reintentar</button>
        </div>
      ) : !areas.length ? (
        <p className="areas-empty">No hay áreas registradas.</p>
      ) : (
        <div className="areas-table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Código</th>
                <th>Nombre</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {areas.map((area) => (
                <tr key={area.id}>
                  <td>{area.id}</td>
                  <td>{area.codigo}</td>
                  <td>{area.nombre}</td>
                  <td>{area.activa === false ? 'Inactiva' : 'Activa'}</td>
                  <td>
                    <button onClick={() => void openDetail(area)}>Editar</button>
                    {area.activa !== false && (
                      <button onClick={() => setModal({ type: 'deactivate', area })}>Desactivar</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal?.type === 'create' && (
        <FormModal onClose={close} onSubmit={(body) => mutation(() => createArea(body))} />
      )}
      {modal?.type === 'edit' && (
        <FormModal
          area={modal.area}
          onClose={close}
          onSubmit={(body) => mutation(() => updateArea(modal.area.id, body))}
        />
      )}
      {modal?.type === 'deactivate' && (
        <ConfirmModal
          area={modal.area}
          onClose={close}
          onConfirm={() => mutation(() => deactivateArea(modal.area.id))}
        />
      )}
    </div>
  )
}
