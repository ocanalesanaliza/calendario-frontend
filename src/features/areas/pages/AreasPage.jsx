import { useEffect, useRef, useState } from 'react'
import { createArea, deactivateArea, getArea, getAreas, updateArea } from '../services/areasService'
import { useAuth } from '../../auth/context/AuthContext'
import Toast from '../../../components/Toast/Toast'
import AreaManagerAssignmentModal from '../../asignaciones/components/AreaManagerAssignmentModal'
import AreaTemplateAssignmentModal from '../components/AreaTemplateAssignmentModal'
import { assignAreaToManager, getEligibleAreaManagers, reassignAreaToManager } from '../../asignaciones/services/areaManagerAssignmentService'
import { getProfileCapabilities } from '../../auth/profilePolicies'
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
          <button className="areas-modal-close" onClick={onClose} aria-label="Cerrar">×</button>
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
            <div className="area-form-group" key={field}>
              <label>
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
            </div>
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
  const { perfil } = useAuth()
  const [areas, setAreas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modal, setModal] = useState(null)
  const [toast, setToast] = useState(null)
  const { canManageOperationsManagers: canManageAreas, canManageAreaManagers: canManageAssignments, canManageAreaTemplateAssignments, isSystemsAccount } = getProfileCapabilities(perfil)

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
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  async function assignManager(area, gerenteAreaId) {
    await assignAreaToManager(gerenteAreaId, area.id)
    await load()
    close()
    setToast({ message: 'Gerente de área asignado correctamente.', type: 'success' })
  }

  async function reassignManager(area, gerenteAreaId) {
    await reassignAreaToManager(gerenteAreaId, area.id)
    await load()
    close()
    setToast({ message: 'Reasignación programada correctamente.', type: 'success' })
  }

  return (
    <div className="areas-page">
      <header className="areas-page-header">
        <div>
          <h1>Áreas</h1>
          <p>{areas.length} área{areas.length !== 1 ? 's' : ''} registrada{areas.length !== 1 ? 's' : ''}</p>
        </div>
        {canManageAreas && <button onClick={() => setModal({ type: 'create' })}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nueva área
        </button>}
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
        <div className="areas-table-card areas-table-wrap">
          <table className="areas-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {areas.map((area) => (
                <tr key={area.id}>
                  <td><span className="areas-code">{area.codigo}</span></td>
                  <td className="areas-name">{area.nombre}</td>
                  <td>
                    <span className={`areas-badge ${area.activa === false ? 'areas-badge-red' : 'areas-badge-green'}`}>
                      {area.activa === false ? 'Inactiva' : 'Activa'}
                    </span>
                  </td>
                  <td className="areas-actions-cell">
                    <div className="row-actions">
                      {canManageAreas && <button className="action-btn" title="Editar" aria-label="Editar" onClick={() => void openDetail(area)}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>}
                      {canManageAssignments && area.activa !== false && (
                        <button className="action-btn" title="Asignar gerente de área" aria-label={`Asignar gerente de área a ${area.nombre}`} onClick={() => setModal({ type: 'assign-manager', area })}>
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="7" r="4" /><path d="M5.5 21a6.5 6.5 0 0 1 13 0" /><path d="M19 8v6M16 11h6" />
                          </svg>
                        </button>
                      )}
                      {canManageAreaTemplateAssignments && area.activa !== false && (
                        <button className="action-btn" title="Asignar plantilla de área" aria-label={`Asignar plantilla de área a ${area.nombre}`} onClick={() => setModal({ type: 'assign-template', area })}>
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="5" y="3" width="14" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" />
                          </svg>
                        </button>
                      )}
                      {canManageAreas && area.activa !== false && (
                        <button className="action-btn action-btn-danger" title="Desactivar" aria-label="Desactivar" onClick={() => setModal({ type: 'deactivate', area })}>
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                          </svg>
                        </button>
                      )}
                    </div>
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
      {modal?.type === 'assign-manager' && (
        <AreaManagerAssignmentModal
          target={modal.area}
          targetType="area"
           loadEligible={() => getEligibleAreaManagers(modal.area.id)}
           onAssign={(gerenteAreaId) => assignManager(modal.area, gerenteAreaId)}
           onReassign={isSystemsAccount ? (gerenteAreaId) => reassignManager(modal.area, gerenteAreaId) : undefined}
           onClose={close}
        />
      )}
      {modal?.type === 'assign-template' && <AreaTemplateAssignmentModal area={modal.area} onClose={close} />}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
