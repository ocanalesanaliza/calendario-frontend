import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { archiveAreaTemplate, getAreaTemplateDetail, getAreaTemplateVersionHistory, publishAreaTemplateVersion } from '../../calendarArea/services/areaTemplatesService'
import { getTareas } from '../../tareas/services/tareasService'
import './PlantillaAreaDetallePage.css'

const items = (data) => Array.isArray(data) ? data : data?.results || []
const idOf = (value) => value?.id_area_template ?? value?.id
const taskIdOf = (value) => value?.task_id ?? value?.id_tarea ?? value?.id
const taskName = (value) => value?.task_name ?? value?.tarea?.nombre ?? value?.nombre ?? value?.name ?? `Tarea ${taskIdOf(value)}`
const versionOf = (value) => value?.version ?? value?.numero
const taskList = (value) => value?.tasks ?? value?.tareas ?? []
const jornadaLabel = (task) => task?.aplica_ambas_jornadas ? 'Ambas jornadas' : task?.jornada === 'tarde' ? 'Tarde' : 'Mañana'

function message(error, fallback) {
  if (error?.status === 403) return 'No tienes permisos para gestionar plantillas de área.'
  if (error?.status === 409) return error.message || 'La plantilla no puede archivarse porque tiene asignaciones vigentes o futuras.'
  return error?.message || fallback
}

function Modal({ title, children, onClose }) {
  const dialogRef = useRef(null)
  const previousFocus = useRef(null)
  useEffect(() => {
    previousFocus.current = document.activeElement
    const dialog = dialogRef.current
    ;(dialog.querySelector('[data-autofocus]') || dialog.querySelector('button, input, select') || dialog).focus()
    return () => previousFocus.current?.focus()
  }, [])
  function keyDown(event) {
    if (event.key === 'Escape') { event.preventDefault(); onClose(); return }
    if (event.key !== 'Tab') return
    const focusable = [...dialogRef.current.querySelectorAll('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')]
    const first = focusable[0]; const last = focusable.at(-1)
    if (!first) return
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
  }
  return <div className="plantilla-area-detail-backdrop"><section ref={dialogRef} className="plantilla-area-detail-modal" role="dialog" aria-modal="true" aria-label={title} tabIndex="-1" onKeyDown={keyDown}><header><h2>{title}</h2><button type="button" aria-label="Cerrar" onClick={onClose}>×</button></header>{children}</section></div>
}

function PublishModal({ template, onClose, onPublished }) {
  const [catalog, setCatalog] = useState([])
  const [rows, setRows] = useState([{ task_id: '', jornada: 'manana', aplica_ambas_jornadas: false }])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    let alive = true
    getTareas('area').then((data) => alive && setCatalog(items(data))).catch((requestError) => alive && setError(message(requestError, 'No se pudo cargar el catálogo de tareas.'))).finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [])
  function update(index, key, value) {
    setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: value } : row))
  }
  async function submit(event) {
    event.preventDefault()
    if (!rows.length || rows.some((row) => !row.task_id)) return
    setSaving(true); setError('')
    try {
      await onPublished({ tasks: rows.map((row) => ({ task_id: Number(row.task_id), jornada: row.jornada, aplica_ambas_jornadas: row.aplica_ambas_jornadas })) })
    } catch (requestError) { setError(message(requestError, 'No se pudo publicar la nueva versión.')); setSaving(false) }
  }
  return <Modal title={`Publicar nueva versión de ${template.name ?? template.nombre}`} onClose={onClose}>
    <form onSubmit={submit} className="plantilla-area-detail-form">
      <p>La publicación crea una versión completa. Las tareas de versiones anteriores no se editan.</p>
      {loading ? <p role="status">Cargando tareas de área...</p> : <fieldset disabled={saving}><legend>Tareas de la nueva versión</legend>{rows.map((row, index) => <div className="version-task-row" key={index}>
        <label>Tarea<select aria-label={`Tarea ${index + 1}`} data-autofocus={index === 0 || undefined} value={row.task_id} onChange={(event) => update(index, 'task_id', event.target.value)} required><option value="">Seleccionar tarea</option>{catalog.map((task) => <option key={taskIdOf(task)} value={taskIdOf(task)}>{taskName(task)}</option>)}</select></label>
        <label>Jornada<select aria-label={`Jornada ${index + 1}`} value={row.aplica_ambas_jornadas ? 'ambas' : row.jornada} onChange={(event) => { const ambas = event.target.value === 'ambas'; update(index, 'aplica_ambas_jornadas', ambas); update(index, 'jornada', ambas ? 'manana' : event.target.value) }}><option value="manana">Mañana</option><option value="tarde">Tarde</option><option value="ambas">Ambas</option></select></label>
        {rows.length > 1 && <button type="button" className="link-danger" onClick={() => setRows((current) => current.filter((_, rowIndex) => rowIndex !== index))}>Quitar</button>}
      </div>)}<button type="button" className="btn-secondary" onClick={() => setRows((current) => [...current, { task_id: '', jornada: 'manana', aplica_ambas_jornadas: false }])}>Añadir tarea</button></fieldset>}
      {error && <p role="alert">{error}</p>}<footer><button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button><button disabled={loading || !catalog.length || saving}>{saving ? 'Publicando...' : 'Publicar nueva versión'}</button></footer>
    </form>
  </Modal>
}

function ArchiveModal({ template, onClose, onArchive }) {
  const [error, setError] = useState(''); const [saving, setSaving] = useState(false)
  async function confirm() { setSaving(true); setError(''); try { await onArchive() } catch (requestError) { setError(message(requestError, 'No se pudo archivar la plantilla.')); setSaving(false) } }
  return <Modal title="Archivar plantilla de área" onClose={onClose}><div className="plantilla-area-detail-form"><p>¿Deseas archivar {template.name ?? template.nombre}? Esta acción no modifica versiones publicadas.</p>{error && <p role="alert">{error}</p>}<footer><button data-autofocus type="button" className="btn-secondary" onClick={onClose}>Cancelar</button><button type="button" className="link-danger" disabled={saving} onClick={confirm}>{saving ? 'Archivando...' : 'Archivar'}</button></footer></div></Modal>
}

export default function PlantillaAreaDetallePage() {
  const { id } = useParams(); const [template, setTemplate] = useState(null); const [versions, setVersions] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [modal, setModal] = useState(null)
  async function load() { setLoading(true); setError(''); try { const [detail, history] = await Promise.all([getAreaTemplateDetail(id), getAreaTemplateVersionHistory(id)]); setTemplate(detail); setVersions(items(history)) } catch (requestError) { setError(message(requestError, 'No se pudo cargar el detalle de la plantilla.')) } finally { setLoading(false) } }
  useEffect(() => { void load() }, [id])
  async function published(body) { await publishAreaTemplateVersion(id, body); setModal(null); await load() }
  async function archived() { await archiveAreaTemplate(id); setModal(null); await load() }
  if (loading) return <div className="plantilla-area-detail-page"><p role="status">Cargando detalle de plantilla de área...</p></div>
  if (error) return <div className="plantilla-area-detail-page"><div role="alert"><p>{error}</p><button onClick={load}>Reintentar</button></div></div>
  const current = template.current_version ?? versions.find((version) => versionOf(version) === (template.current_version_number ?? template.version_actual))
  return <div className="plantilla-area-detail-page"><Link to="/plantillas-area">← Plantillas de área</Link><header><div><h1>{template.name ?? template.nombre}</h1><p>{(template.description ?? template.descripcion) || 'Sin descripción'}</p></div><div className="detail-actions">{(template.active ?? template.activa) !== false && <><button onClick={() => setModal('publish')}>Publicar nueva versión</button><button className="link-danger" onClick={() => setModal('archive')}>Archivar</button></>}</div></header><section><h2>Versión actual {versionOf(current) ?? '—'}</h2>{taskList(current).length ? <ul>{taskList(current).map((task, index) => <li key={`${taskIdOf(task)}-${index}`}><strong>{taskName(task)}</strong><span>{jornadaLabel(task)}</span></li>)}</ul> : <p>La versión actual no tiene tareas.</p>}</section><section><h2>Historial de versiones</h2>{versions.length ? <ol>{versions.map((version) => <li key={versionOf(version)}><strong>Versión {versionOf(version)}</strong><span>{taskList(version).length} tarea{taskList(version).length !== 1 ? 's' : ''}</span></li>)}</ol> : <p>No hay versiones publicadas.</p>}</section>{modal === 'publish' && <PublishModal template={template} onClose={() => setModal(null)} onPublished={published} />}{modal === 'archive' && <ArchiveModal template={template} onClose={() => setModal(null)} onArchive={archived} />}</div>
}
