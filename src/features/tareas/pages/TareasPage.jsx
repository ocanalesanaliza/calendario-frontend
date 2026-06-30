import { useState, useEffect } from 'react'
import { getTareas, createTarea, updateTarea, desactivarTarea, getSubtareas, createSubtarea, updateSubtarea, desactivarSubtarea } from '../services/tareasService'
import './TareasPage.css'

const RECURRENCIA_LABEL = {
  'diario':         'Diario',
  'semanal':        'Semanal',
  'quincenal':      'Quincenal',
  'mensual-dias':   'Mensual',
  'solo-sabado':    'Solo sábado',
  'lunes-a-sabado': 'Lunes a sábado',
  'variable':       'Variable',
}

export default function TareasPage() {
  const [tareas, setTareas] = useState([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [modal, setModal] = useState(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    try {
      const data = await getTareas()
      setTareas(data)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate(form) {
    await createTarea(form)
    await loadData()
    setModal(null)
  }

  async function handleEdit(id, form) {
    await updateTarea(id, form)
    await loadData()
    setModal(null)
  }

  async function handleDesactivar(id) {
    await desactivarTarea(id)
    await loadData()
    setModal(null)
  }

  const filtradas = tareas.filter((t) => {
    const matchBusqueda = t.nombre.toLowerCase().includes(busqueda.toLowerCase())
    const matchTipo = filtroTipo === 'todos' || t.tipo_recurrencia === filtroTipo
    const matchEstado =
      filtroEstado === 'todos' ||
      (filtroEstado === 'activa' && t.activa) ||
      (filtroEstado === 'inactiva' && !t.activa)
    return matchBusqueda && matchTipo && matchEstado
  })

  return (
    <div className="tareas-page">
      <div className="page-header">
        <div>
          <h1>Catálogo de tareas</h1>
          <p>{tareas.filter((t) => t.activa).length} activa{tareas.filter((t) => t.activa).length !== 1 ? 's' : ''} de {tareas.length} en total</p>
        </div>
        <button className="btn-primary" onClick={() => setModal({ type: 'crear' })}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nueva tarea
        </button>
      </div>

      <div className="toolbar">
        <div className="search-wrapper">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Buscar por nombre..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        <select className="filtro-select" value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
          <option value="todos">Todos los tipos</option>
          {Object.entries(RECURRENCIA_LABEL).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
        <select className="filtro-select" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
          <option value="todos">Todos los estados</option>
          <option value="activa">Activas</option>
          <option value="inactiva">Inactivas</option>
        </select>
      </div>

      {loading ? (
        <div className="loading-state">Cargando tareas...</div>
      ) : filtradas.length === 0 ? (
        <div className="empty-state">
          {busqueda || filtroTipo !== 'todos' || filtroEstado !== 'todos'
            ? 'Sin resultados para los filtros aplicados.'
            : 'No hay tareas registradas.'}
        </div>
      ) : (
        <div className="table-card">
          <table className="tareas-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Recurrencia</th>
                <th>Peso</th>
                <th>Recordatorio</th>
                <th>Bloquea jornada</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((t) => (
                <tr key={t.id_tarea}>
                  <td className="td-nombre">{t.nombre}</td>
                  <td><span className="badge badge-tipo">{t.recurrencia_label ?? RECURRENCIA_LABEL[t.tipo_recurrencia] ?? t.tipo_recurrencia}</span></td>
                  <td><span className="peso-val">{t.peso}</span></td>
                  <td>{t.es_recordatorio ? <span className="badge badge-blue">Sí</span> : <span className="td-no">No</span>}</td>
                  <td>{t.bloquea_jornada_posterior ? <span className="badge badge-yellow">Sí</span> : <span className="td-no">No</span>}</td>
                  <td>
                    <span className={`badge ${t.activa ? 'badge-green' : 'badge-red'}`}>
                      {t.activa ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button className="action-btn" title="Subtareas" onClick={() => setModal({ type: 'subtareas', tarea: t })}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
                          <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
                        </svg>
                      </button>
                      <button className="action-btn" title="Editar" onClick={() => setModal({ type: 'editar', tarea: t })}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      {t.activa && (
                        <button className="action-btn action-btn-danger" title="Desactivar" onClick={() => setModal({ type: 'desactivar', tarea: t })}>
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="table-footer">Mostrando {filtradas.length} de {tareas.length} tareas</div>
        </div>
      )}

      {modal?.type === 'crear' && (
        <TareaModal onSubmit={handleCreate} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'editar' && (
        <TareaModal inicial={modal.tarea} onSubmit={(form) => handleEdit(modal.tarea.id_tarea, form)} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'desactivar' && (
        <DesactivarModal nombre={modal.tarea.nombre} onConfirm={() => handleDesactivar(modal.tarea.id_tarea)} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'subtareas' && (
        <SubtareasModal tarea={modal.tarea} onClose={() => setModal(null)} />
      )}
    </div>
  )
}

/* ── Modales ── */

function ModalWrapper({ title, onClose, children, wide }) {
  return (
    <div className="modal-overlay">
      <div className={`modal${wide ? ' modal-wide' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close" onClick={onClose}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function TareaModal({ inicial, onSubmit, onClose }) {
  const [form, setForm] = useState({
    nombre:                   inicial?.nombre ?? '',
    tipo_recurrencia:         inicial?.tipo_recurrencia ?? 'diario',
    valor_recurrencia:        inicial?.valor_recurrencia ?? '',
    peso:                     inicial?.peso ?? '1.00',
    es_recordatorio:          inicial?.es_recordatorio ?? false,
    bloquea_jornada_posterior: inicial?.bloquea_jornada_posterior ?? false,
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const setCheck = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.checked }))

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const body = { ...form, valor_recurrencia: form.valor_recurrencia || null }
      await onSubmit(body)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <ModalWrapper title={inicial ? 'Editar tarea' : 'Nueva tarea'} onClose={onClose}>
      <form className="modal-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Nombre</label>
          <input type="text" value={form.nombre} onChange={set('nombre')} required />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Tipo de recurrencia</label>
            <select value={form.tipo_recurrencia} onChange={set('tipo_recurrencia')} required>
              {Object.entries(RECURRENCIA_LABEL).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Valor recurrencia <span className="label-optional">(opcional)</span></label>
            <input type="text" placeholder="ej. lunes" value={form.valor_recurrencia} onChange={set('valor_recurrencia')} />
          </div>
        </div>
        <div className="form-group">
          <label>Peso</label>
          <input type="number" step="0.01" min="0" value={form.peso} onChange={set('peso')} required />
        </div>
        <div className="form-checks">
          <label className="check-label">
            <input type="checkbox" checked={form.es_recordatorio} onChange={setCheck('es_recordatorio')} />
            Es recordatorio
          </label>
          <label className="check-label">
            <input type="checkbox" checked={form.bloquea_jornada_posterior} onChange={setCheck('bloquea_jornada_posterior')} />
            Bloquea jornada posterior
          </label>
        </div>
        {error && <p className="modal-error">{error}</p>}
        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Guardando...' : inicial ? 'Guardar cambios' : 'Crear tarea'}
          </button>
        </div>
      </form>
    </ModalWrapper>
  )
}

function DesactivarModal({ nombre, onConfirm, onClose }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleConfirm() {
    setLoading(true)
    try { await onConfirm() }
    catch (err) { setError(err.message); setLoading(false) }
  }

  return (
    <ModalWrapper title="Desactivar tarea" onClose={onClose}>
      <div className="modal-form">
        <p className="modal-confirm-text">¿Deseas desactivar la tarea <strong>{nombre}</strong>?</p>
        {error && <p className="modal-error">{error}</p>}
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-danger" onClick={handleConfirm} disabled={loading}>
            {loading ? 'Desactivando...' : 'Desactivar'}
          </button>
        </div>
      </div>
    </ModalWrapper>
  )
}

function SubtareasModal({ tarea, onClose }) {
  const [subtareas, setSubtareas] = useState([])
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState(null)
  const [nuevaNombre, setNuevaNombre] = useState('')
  const [nuevoOrden, setNuevoOrden] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadSubtareas() }, [])

  async function loadSubtareas() {
    setLoading(true)
    try {
      const data = await getSubtareas(tarea.id_tarea, { incluir_inactivas: true })
      setSubtareas(data)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!nuevaNombre.trim()) return
    setSaving(true)
    setError('')
    try {
      const body = { nombre: nuevaNombre.trim() }
      if (nuevoOrden) body.orden = parseInt(nuevoOrden)
      await createSubtarea(tarea.id_tarea, body)
      setNuevaNombre('')
      setNuevoOrden('')
      await loadSubtareas()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleEdit(id) {
    setSaving(true)
    setError('')
    try {
      const body = { nombre: editando.nombre }
      if (editando.orden !== '') body.orden = parseInt(editando.orden)
      await updateSubtarea(tarea.id_tarea, id, body)
      setEditando(null)
      await loadSubtareas()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDesactivar(id) {
    setSaving(true)
    setError('')
    try {
      await desactivarSubtarea(tarea.id_tarea, id)
      await loadSubtareas()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalWrapper title={`Subtareas — ${tarea.nombre}`} onClose={onClose} wide>
      <div className="modal-form">
        {loading ? (
          <p className="empty-state-sm">Cargando subtareas...</p>
        ) : subtareas.length === 0 ? (
          <p className="empty-state-sm">Sin subtareas aún.</p>
        ) : (
          <div className="subtareas-list">
            {subtareas.map((st) => (
              <div key={st.id_subtarea} className={`subtarea-row${!st.activa ? ' subtarea-inactiva' : ''}`}>
                {editando?.id === st.id_subtarea ? (
                  <div className="subtarea-edit-inline">
                    <input
                      className="subtarea-input"
                      value={editando.nombre}
                      onChange={(e) => setEditando((x) => ({ ...x, nombre: e.target.value }))}
                      autoFocus
                    />
                    <input
                      className="subtarea-input-sm"
                      type="number"
                      min="1"
                      placeholder="Orden"
                      value={editando.orden}
                      onChange={(e) => setEditando((x) => ({ ...x, orden: e.target.value }))}
                    />
                    <button className="action-btn action-btn-success" title="Guardar" onClick={() => handleEdit(st.id_subtarea)} disabled={saving}>
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </button>
                    <button className="action-btn" title="Cancelar" onClick={() => setEditando(null)}>
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="subtarea-orden">{st.orden}.</span>
                    <span className="subtarea-nombre">{st.nombre}</span>
                    {!st.activa && <span className="badge badge-red">Inactiva</span>}
                    <div className="row-actions">
                      {st.activa && (
                        <button className="action-btn" title="Editar" onClick={() => setEditando({ id: st.id_subtarea, nombre: st.nombre, orden: st.orden ?? '' })}>
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                      )}
                      {st.activa && (
                        <button className="action-btn action-btn-danger" title="Desactivar" onClick={() => handleDesactivar(st.id_subtarea)} disabled={saving}>
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                          </svg>
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
        <form onSubmit={handleCreate} className="subtarea-nueva-form">
          <div className="form-row">
            <div className="form-group">
              <label>Nueva subtarea</label>
              <input type="text" placeholder="Nombre" value={nuevaNombre} onChange={(e) => setNuevaNombre(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Orden <span className="label-optional">(opcional)</span></label>
              <input type="number" min="1" placeholder="auto" value={nuevoOrden} onChange={(e) => setNuevoOrden(e.target.value)} />
            </div>
          </div>
          {error && <p className="modal-error">{error}</p>}
          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>Cerrar</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : 'Agregar subtarea'}
            </button>
          </div>
        </form>
      </div>
    </ModalWrapper>
  )
}
