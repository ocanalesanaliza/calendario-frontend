import { useEffect, useRef, useState } from 'react'
import { createAreaTemplate, getAreaTemplates } from '../../calendarArea/services/areaTemplatesService'
import { getTareas } from '../../tareas/services/tareasService'
import './PlantillasAreaPage.css'

function itemsFrom(data) {
  return Array.isArray(data) ? data : data?.results || []
}

function templateId(template) {
  return template.id_area_template ?? template.id
}

function templateName(template) {
  return template.name ?? template.nombre
}

function templateDescription(template) {
  return template.description ?? template.descripcion
}

function templateActive(template) {
  return template.active ?? template.activa
}

function templateVersion(template) {
  return template.current_version?.version ?? template.version_actual ?? template.current_version_number
}

function templateTaskCount(template) {
  return template.task_count ?? template.total_tareas ?? template.current_version?.tasks?.length ?? template.tasks?.length
}

export default function PlantillasAreaPage() {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => { loadTemplates() }, [])

  async function loadTemplates() {
    setLoading(true)
    setError('')
    try {
      setTemplates(itemsFrom(await getAreaTemplates()))
    } catch (requestError) {
      setError(requestError.message || 'No se pudieron cargar las plantillas de área.')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate(form) {
    await createAreaTemplate(form)
    await loadTemplates()
    setCreating(false)
  }

  return (
    <div className="plantillas-area-page">
      <div className="page-header">
        <div>
          <h1>Plantillas de área</h1>
          <p>{templates.length} plantilla{templates.length !== 1 ? 's' : ''} registrada{templates.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn-primary" onClick={() => setCreating(true)}>Nueva plantilla de área</button>
      </div>

      {loading ? (
        <div className="loading-state" role="status">Cargando plantillas de área...</div>
      ) : error ? (
        <div className="empty-state" role="alert">{error} <button className="btn-secondary" onClick={loadTemplates}>Reintentar</button></div>
      ) : templates.length === 0 ? (
        <div className="empty-state">No hay plantillas de área registradas.</div>
      ) : (
        <div className="table-card">
          <table className="plantillas-area-table">
            <caption className="sr-only">Plantillas de área registradas</caption>
            <thead>
              <tr><th scope="col">Nombre</th><th scope="col">Descripción</th><th scope="col">Estado</th><th scope="col">Versión actual</th><th scope="col">Tareas</th></tr>
            </thead>
            <tbody>
              {templates.map((template) => (
                <tr key={templateId(template)}>
                  <td className="td-nombre">{templateName(template)}</td>
                  <td className="td-desc">{templateDescription(template) || <span className="td-empty">—</span>}</td>
                  <td><span className={`badge ${templateActive(template) ? 'badge-green' : 'badge-red'}`}>{templateActive(template) ? 'Activa' : 'Inactiva'}</span></td>
                  <td>{templateVersion(template) ?? <span className="td-empty">—</span>}</td>
                  <td>{templateTaskCount(template) ?? <span className="td-empty">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {creating && <CrearPlantillaAreaModal onClose={() => setCreating(false)} onSubmit={handleCreate} />}
    </div>
  )
}

function CrearPlantillaAreaModal({ onClose, onSubmit }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [tasks, setTasks] = useState([])
  const [taskId, setTaskId] = useState('')
  const [jornada, setJornada] = useState('manana')
  const [loadingTasks, setLoadingTasks] = useState(true)
  const [tasksError, setTasksError] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const dialogRef = useRef(null)
  const previousFocusRef = useRef(null)

  useEffect(() => {
    let active = true
    previousFocusRef.current = document.activeElement
    dialogRef.current?.focus()
    getTareas('area')
      .then((data) => { if (active) setTasks(itemsFrom(data)) })
      .catch((requestError) => { if (active) setTasksError(requestError.message || 'No se pudieron cargar las tareas de área.') })
      .finally(() => { if (active) setLoadingTasks(false) })
    return () => {
      active = false
      previousFocusRef.current?.focus()
    }
  }, [])

  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }
    if (event.key !== 'Tab') return
    const focusable = [...dialogRef.current.querySelectorAll('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')]
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

  async function submit(event) {
    event.preventDefault()
    if (!name.trim() || !taskId) return
    setSaving(true)
    setError('')
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim(),
        tasks: [{ task_id: Number(taskId), jornada: jornada === 'tarde' ? 'tarde' : 'manana', aplica_ambas_jornadas: jornada === 'ambas' }],
      })
    } catch (requestError) {
      setError(requestError.message || 'No se pudo crear la plantilla de área.')
      setSaving(false)
    }
  }

  return (
    <div className="plantillas-area-modal-backdrop">
      <section ref={dialogRef} className="plantillas-area-modal" role="dialog" aria-modal="true" aria-labelledby="plantillas-area-modal-title" tabIndex="-1" onKeyDown={handleKeyDown}>
        <header><h2 id="plantillas-area-modal-title">Nueva plantilla de área</h2><button type="button" className="modal-close" onClick={onClose} aria-label="Cerrar">×</button></header>
        <form className="modal-form" onSubmit={submit}>
          <div className="form-group"><label htmlFor="area-template-name">Nombre</label><input id="area-template-name" value={name} onChange={(event) => setName(event.target.value)} disabled={saving} required autoFocus /></div>
          <div className="form-group"><label htmlFor="area-template-description">Descripción <span className="label-optional">(opcional)</span></label><textarea id="area-template-description" value={description} onChange={(event) => setDescription(event.target.value)} disabled={saving} /></div>
          <div className="form-group">
            <label htmlFor="area-template-task">Tarea inicial</label>
            {loadingTasks ? <p role="status">Cargando tareas de área...</p> : tasksError ? <p className="modal-error" role="alert">{tasksError}</p> : <select id="area-template-task" value={taskId} onChange={(event) => setTaskId(event.target.value)} disabled={saving} required><option value="">Seleccionar tarea</option>{tasks.map((task) => <option key={task.id_tarea ?? task.id} value={task.id_tarea ?? task.id}>{task.nombre ?? task.name}</option>)}</select>}
          </div>
          <div className="form-group"><label htmlFor="area-template-jornada">Jornada</label><select id="area-template-jornada" value={jornada} onChange={(event) => setJornada(event.target.value)} disabled={saving}><option value="manana">Mañana</option><option value="tarde">Tarde</option><option value="ambas">Ambas</option></select></div>
          {error && <p className="modal-error" role="alert">{error}</p>}
          <footer className="modal-footer"><button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button><button type="submit" className="btn-primary" disabled={loadingTasks || Boolean(tasksError) || !tasks.length || !name.trim() || !taskId || saving}>{saving ? 'Creando...' : 'Crear plantilla'}</button></footer>
        </form>
      </section>
    </div>
  )
}
