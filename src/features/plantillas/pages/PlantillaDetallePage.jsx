import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getPlantilla, updatePlantilla, desactivarPlantilla, addTarea, updateTarea, desactivarTarea, asignarSucursales } from '../services/plantillasService'
import { getTareas } from '../../tareas/services/tareasService'
import { getSucursales } from '../../sucursales/services/sucursalesService'
import './PlantillaDetallePage.css'

const JORNADA_LABEL = { manana: 'Mañana', tarde: 'Tarde' }

export default function PlantillaDetallePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [plantilla, setPlantilla] = useState(null)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)

  useEffect(() => { loadData() }, [id])

  async function loadData() {
    setLoading(true)
    try {
      const data = await getPlantilla(id)
      setPlantilla(data)
    } finally {
      setLoading(false)
    }
  }

  async function handleUpdatePlantilla(form) {
    await updatePlantilla(id, form)
    await loadData()
    setModal(null)
  }

  async function handleDesactivarPlantilla() {
    await desactivarPlantilla(id)
    navigate('/plantillas')
  }

  async function handleAddTarea(form) {
    for (const id_tarea of form.ids_tareas) {
      if (form.aplica_ambas_jornadas) {
        await addTarea(id, { id_tarea, jornada: 'manana', hora_sugerida: form.hora_manana || null, aplica_ambas_jornadas: false })
        await addTarea(id, { id_tarea, jornada: 'tarde', hora_sugerida: form.hora_tarde || null, aplica_ambas_jornadas: false })
      } else {
        await addTarea(id, { id_tarea, jornada: form.jornada, hora_sugerida: form.hora_sugerida || null, aplica_ambas_jornadas: false })
      }
    }
    await loadData()
    setModal(null)
  }

  async function handleUpdateTarea(idPT, form) {
    await updateTarea(id, idPT, form)
    await loadData()
    setModal(null)
  }

  async function handleDesactivarTarea(idPT) {
    await desactivarTarea(id, idPT)
    await loadData()
    setModal(null)
  }

  async function handleAsignar(form) {
    await asignarSucursales(id, form)
    setModal(null)
  }

  if (loading) return <div className="loading-state">Cargando plantilla...</div>
  if (!plantilla) return <div className="loading-state">Plantilla no encontrada.</div>

  const tareasActivas = plantilla.tareas?.filter((t) => t.activa) ?? []
  const tareasInactivas = plantilla.tareas?.filter((t) => !t.activa) ?? []

  return (
    <div className="detalle-page">
      {/* Header */}
      <div className="detalle-header">
        <button className="btn-back" onClick={() => navigate('/plantillas')}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Plantillas
        </button>

        <div className="detalle-title-row">
          <div>
            <div className="detalle-title-group">
              <h1>{plantilla.nombre}</h1>
              <span className={`badge ${plantilla.activa ? 'badge-green' : 'badge-red'}`}>
                {plantilla.activa ? 'Activa' : 'Inactiva'}
              </span>
            </div>
            {plantilla.descripcion && <p className="detalle-desc">{plantilla.descripcion}</p>}
          </div>
          <div className="detalle-actions">
            {plantilla.activa && (
              <button className="btn-outline" onClick={() => setModal({ type: 'asignar' })}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
                </svg>
                Asignar sucursales
              </button>
            )}
            <button className="btn-outline" onClick={() => setModal({ type: 'editar' })}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Editar
            </button>
            {plantilla.activa && (
              <button className="btn-outline btn-outline-danger" onClick={() => setModal({ type: 'desactivar' })}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                </svg>
                Desactivar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tareas section */}
      <div className="section-header">
        <div>
          <h2>Tareas</h2>
          <p>{tareasActivas.length} activa{tareasActivas.length !== 1 ? 's' : ''}</p>
        </div>
        {plantilla.activa && (
          <button className="btn-primary" onClick={() => setModal({ type: 'agregar-tarea' })}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Agregar tarea
          </button>
        )}
      </div>

      {plantilla.tareas?.length === 0 ? (
        <div className="empty-state">Esta plantilla no tiene tareas aún.</div>
      ) : (
        <div className="table-card">
          <table className="tareas-table">
            <thead>
              <tr>
                <th>Tarea</th>
                <th>Recurrencia</th>
                <th>Jornada</th>
                <th>Hora sugerida</th>
                <th>Peso</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {[...tareasActivas, ...tareasInactivas].map((pt) => (
                <tr key={pt.id_plantilla_tarea} className={!pt.activa ? 'row-inactive' : ''}>
                  <td className="td-nombre">{pt.tarea?.nombre ?? '—'}</td>
                  <td><span className="badge badge-tipo">{pt.tarea?.recurrencia_label ?? '—'}</span></td>
                  <td>
                    <span className={`badge ${pt.jornada === 'manana' ? 'badge-blue' : 'badge-orange'}`}>
                      {JORNADA_LABEL[pt.jornada] ?? pt.jornada}
                    </span>
                  </td>
                  <td>{pt.hora_sugerida ?? <span className="td-empty">—</span>}</td>
                  <td>{pt.tarea?.peso ?? <span className="td-empty">—</span>}</td>
                  <td>
                    <span className={`badge ${pt.activa ? 'badge-green' : 'badge-red'}`}>
                      {pt.activa ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  <td>
                    {pt.activa && (
                      <div className="row-actions">
                        <button
                          className="action-btn"
                          title="Editar"
                          onClick={() => setModal({ type: 'editar-tarea', tarea: pt })}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        <button
                          className="action-btn action-btn-danger"
                          title="Desactivar"
                          onClick={() => setModal({ type: 'desactivar-tarea', tarea: pt })}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modales */}
      {modal?.type === 'editar' && (
        <EditarPlantillaModal
          plantilla={plantilla}
          onSubmit={handleUpdatePlantilla}
          onClose={() => setModal(null)}
        />
      )}

      {modal?.type === 'desactivar' && (
        <ConfirmModal
          title="Desactivar plantilla"
          message={<>¿Deseas desactivar <strong>{plantilla.nombre}</strong>?</>}
          onConfirm={handleDesactivarPlantilla}
          onClose={() => setModal(null)}
        />
      )}

      {modal?.type === 'agregar-tarea' && (
        <TareaModal
          tareasActivas={tareasActivas}
          onSubmit={handleAddTarea}
          onClose={() => setModal(null)}
        />
      )}

      {modal?.type === 'editar-tarea' && (
        <TareaModal
          inicial={modal.tarea}
          onSubmit={(form) => handleUpdateTarea(modal.tarea.id_plantilla_tarea, form)}
          onClose={() => setModal(null)}
        />
      )}

      {modal?.type === 'desactivar-tarea' && (
        <ConfirmModal
          title="Desactivar tarea"
          message={<>¿Deseas desactivar <strong>{modal.tarea.tarea?.nombre}</strong> de esta plantilla?</>}
          onConfirm={() => handleDesactivarTarea(modal.tarea.id_plantilla_tarea)}
          onClose={() => setModal(null)}
        />
      )}

      {modal?.type === 'asignar' && (
        <AsignarModal
          onSubmit={handleAsignar}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}

/* ── Modales ── */

function ModalWrapper({ title, onClose, children }) {
  return (
    <div className="modal-overlay">
      <div className="detalle-modal" onClick={(e) => e.stopPropagation()}>
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

function EditarPlantillaModal({ plantilla, onSubmit, onClose }) {
  const [form, setForm] = useState({ nombre: plantilla.nombre, descripcion: plantilla.descripcion ?? '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try { await onSubmit(form) }
    catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  return (
    <ModalWrapper title="Editar plantilla" onClose={onClose}>
      <form className="modal-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Nombre</label>
          <input type="text" value={form.nombre} onChange={set('nombre')} required />
        </div>
        <div className="form-group">
          <label>Descripción <span className="label-optional">(opcional)</span></label>
          <textarea rows={3} value={form.descripcion} onChange={set('descripcion')} />
        </div>
        {error && <p className="modal-error">{error}</p>}
        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </form>
    </ModalWrapper>
  )
}

// Mañana: 06:00–11:00 | Tarde: 12:00–19:00 (rangos separados, sin solapamiento)
const HORAS_MANANA = ['06:00','07:00','08:00','09:00','10:00','11:00']
const HORAS_TARDE  = ['12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00']

function normalizarHora(hora) {
  if (!hora) return ''
  return hora.slice(0, 2) + ':00'
}

function TareaModal({ inicial, tareasActivas = [], onSubmit, onClose }) {
  const [catalogoTareas, setCatalogoTareas] = useState([])
  const [seleccionadas, setSeleccionadas] = useState([])
  const [buscar, setBuscar] = useState('')
  const [form, setForm] = useState({
    jornada: inicial?.jornada ?? 'manana',
    hora_sugerida: normalizarHora(inicial?.hora_sugerida) || (inicial?.jornada === 'tarde' ? HORAS_TARDE[0] : HORAS_MANANA[0]),
    hora_manana: HORAS_MANANA[0],
    hora_tarde: HORAS_TARDE[0],
    aplica_ambas_jornadas: inicial?.aplica_ambas_jornadas ?? false,
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    getTareas().then(setCatalogoTareas).catch(() => {})
  }, [])

  useEffect(() => {
    if (inicial) return
    setSeleccionadas((prev) =>
      prev.filter((idTarea) => !calcDuplicada(idTarea, form.aplica_ambas_jornadas, form.jornada))
    )
  }, [form.aplica_ambas_jornadas, form.jornada])

  function calcDuplicada(idTarea, ambas, jornada) {
    if (ambas) {
      return (
        tareasActivas.some((pt) => pt.tarea?.id_tarea === idTarea && (pt.jornada === 'manana' || pt.aplica_ambas_jornadas)) ||
        tareasActivas.some((pt) => pt.tarea?.id_tarea === idTarea && (pt.jornada === 'tarde'  || pt.aplica_ambas_jornadas))
      )
    }
    return tareasActivas.some((pt) => pt.tarea?.id_tarea === idTarea && (pt.aplica_ambas_jornadas || pt.jornada === jornada))
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const setCheck = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.checked }))

  function handleJornadaChange(e) {
    const jornada = e.target.value
    setForm((f) => ({ ...f, jornada, hora_sugerida: jornada === 'tarde' ? HORAS_TARDE[0] : HORAS_MANANA[0] }))
  }

  function toggleTarea(idTarea) {
    setSeleccionadas((prev) =>
      prev.includes(idTarea) ? prev.filter((id) => id !== idTarea) : [...prev, idTarea]
    )
  }

  const tareasFiltradas = catalogoTareas.filter((t) =>
    t.nombre.toLowerCase().includes(buscar.toLowerCase())
  )

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!inicial && seleccionadas.length === 0) {
      setError('Selecciona al menos una tarea.')
      return
    }
    setLoading(true)
    try {
      if (inicial) {
        await onSubmit({
          id_tarea: inicial.tarea.id_tarea,
          jornada: form.jornada,
          hora_sugerida: form.hora_sugerida || null,
          hora_manana: form.hora_manana || null,
          hora_tarde: form.hora_tarde || null,
          aplica_ambas_jornadas: form.aplica_ambas_jornadas,
        })
      } else {
        await onSubmit({
          ids_tareas: seleccionadas,
          jornada: form.jornada,
          hora_sugerida: form.hora_sugerida || null,
          hora_manana: form.hora_manana || null,
          hora_tarde: form.hora_tarde || null,
          aplica_ambas_jornadas: form.aplica_ambas_jornadas,
        })
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const horasSingle = form.jornada === 'tarde' ? HORAS_TARDE : HORAS_MANANA

  return (
    <ModalWrapper title={inicial ? 'Editar tarea' : 'Agregar tareas'} onClose={onClose}>
      <form className="modal-form" onSubmit={handleSubmit}>
        {inicial ? (
          <div className="form-group">
            <label>Tarea</label>
            <div className="tarea-nombre-static">{inicial.tarea?.nombre}</div>
          </div>
        ) : (
          <div className="form-group">
            <label>Tareas</label>
            <input
              type="text"
              className="tareas-search-input"
              placeholder="Buscar tarea..."
              value={buscar}
              onChange={(e) => setBuscar(e.target.value)}
            />
            <div className="tareas-check-list">
              {catalogoTareas.length === 0 ? (
                <span className="td-empty">Cargando...</span>
              ) : tareasFiltradas.length === 0 ? (
                <span className="td-empty">Sin resultados.</span>
              ) : tareasFiltradas.map((t) => {
                const duplicada = calcDuplicada(t.id_tarea, form.aplica_ambas_jornadas, form.jornada)
                const checked = seleccionadas.includes(t.id_tarea)
                return (
                  <label key={t.id_tarea} className={`check-label${duplicada ? ' check-label-disabled' : ''}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={duplicada}
                      onChange={() => toggleTarea(t.id_tarea)}
                    />
                    <span className="tarea-check-nombre">
                      {t.nombre}
                      {t.recurrencia_label && (
                        <span className="tarea-check-meta"> — {t.recurrencia_label}</span>
                      )}
                    </span>
                    {duplicada && <span className="tarea-check-dup">ya agregada</span>}
                  </label>
                )
              })}
            </div>
            {seleccionadas.length > 0 && (
              <p className="tareas-seleccionadas-hint">
                {seleccionadas.length} seleccionada{seleccionadas.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        )}

        <label className="check-label" style={{ marginTop: '0.25rem' }}>
          <input type="checkbox" checked={form.aplica_ambas_jornadas} onChange={setCheck('aplica_ambas_jornadas')} disabled={!!inicial} />
          Aplica ambas jornadas
        </label>

        {form.aplica_ambas_jornadas ? (
          <div className="form-row" style={{ marginTop: '0.75rem' }}>
            <div className="form-group">
              <label>Hora mañana</label>
              <select value={form.hora_manana} onChange={set('hora_manana')} required>
                {HORAS_MANANA.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Hora tarde</label>
              <select value={form.hora_tarde} onChange={set('hora_tarde')} required>
                {HORAS_TARDE.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          </div>
        ) : (
          <div className="form-row" style={{ marginTop: '0.75rem' }}>
            <div className="form-group">
              <label>Jornada</label>
              <select value={form.jornada} onChange={handleJornadaChange} required>
                <option value="manana">Mañana</option>
                <option value="tarde">Tarde</option>
              </select>
            </div>
            <div className="form-group">
              <label>Hora sugerida</label>
              <select value={form.hora_sugerida} onChange={set('hora_sugerida')} required>
                {horasSingle.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          </div>
        )}

        {error && <p className="modal-error">{error}</p>}
        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading
              ? 'Guardando...'
              : inicial
                ? 'Guardar cambios'
                : seleccionadas.length > 0
                  ? `Agregar ${seleccionadas.length} tarea${seleccionadas.length !== 1 ? 's' : ''}`
                  : 'Agregar tareas'}
          </button>
        </div>
      </form>
    </ModalWrapper>
  )
}

function AsignarModal({ onSubmit, onClose }) {
  const [sucursales, setSucursales] = useState([])
  const [seleccionadas, setSeleccionadas] = useState([])
  const [form, setForm] = useState({
    fecha_inicio: '',
    aplicar: true,
    desactivar_no_incluidas: false,
    sobrescribir_reglas: false,
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    getSucursales().then(setSucursales).catch(() => {})
  }, [])

  function toggleSucursal(id) {
    setSeleccionadas((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    )
  }

  const setCheck = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.checked }))

  async function handleSubmit(e) {
    e.preventDefault()
    if (seleccionadas.length === 0) { setError('Selecciona al menos una sucursal.'); return }
    setError('')
    setLoading(true)
    try {
      const body = { ids_sucursales: seleccionadas, ...form }
      if (!form.fecha_inicio) delete body.fecha_inicio
      await onSubmit(body)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <ModalWrapper title="Asignar a sucursales" onClose={onClose}>
      <form className="modal-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Sucursales</label>
          <div className="sucursales-check-list">
            {sucursales.length === 0 ? (
              <span className="td-empty">Cargando...</span>
            ) : sucursales.filter((s) => s.activa).map((s) => (
              <label key={s.id_sucursal} className="check-label">
                <input
                  type="checkbox"
                  checked={seleccionadas.includes(s.id_sucursal)}
                  onChange={() => toggleSucursal(s.id_sucursal)}
                />
                {s.nombre}
              </label>
            ))}
          </div>
        </div>
        <div className="form-group">
          <label>Fecha de inicio <span className="label-optional">(opcional)</span></label>
          <input type="date" value={form.fecha_inicio} onChange={(e) => setForm((f) => ({ ...f, fecha_inicio: e.target.value }))} />
        </div>
        <div className="form-checks">
          <label className="check-label">
            <input type="checkbox" checked={form.aplicar} onChange={setCheck('aplicar')} />
            Aplicar tareas en sucursales
          </label>
          <label className="check-label">
            <input type="checkbox" checked={form.desactivar_no_incluidas} onChange={setCheck('desactivar_no_incluidas')} />
            Desactivar tareas no incluidas
          </label>
          <label className="check-label">
            <input type="checkbox" checked={form.sobrescribir_reglas} onChange={setCheck('sobrescribir_reglas')} />
            Sobrescribir reglas existentes
          </label>
        </div>
        {error && <p className="modal-error">{error}</p>}
        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Asignando...' : 'Asignar'}
          </button>
        </div>
      </form>
    </ModalWrapper>
  )
}

function ConfirmModal({ title, message, onConfirm, onClose }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleConfirm() {
    setLoading(true)
    try { await onConfirm() }
    catch (err) { setError(err.message); setLoading(false) }
  }

  return (
    <ModalWrapper title={title} onClose={onClose}>
      <div className="modal-form">
        <p className="modal-confirm-text">{message}</p>
        {error && <p className="modal-error">{error}</p>}
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-danger" onClick={handleConfirm} disabled={loading}>
            {loading ? 'Procesando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </ModalWrapper>
  )
}
