import { useState, useEffect } from 'react'
import {
  getSucursales, createSucursal, updateSucursal, desactivarSucursal,
  getHorarios, saveHorarios, updateHorario,
  getTareasSucursal,
} from '../services/sucursalesService'
import { getGerentes } from '../../gerentes/services/gerentesService'
import { getPlantillas, asignarSucursales } from '../../plantillas/services/plantillasService'
import { useAuth } from '../../auth/context/AuthContext'
import './SucursalesPage.css'

const DIAS = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const JORNADA_LABEL = { manana: 'Mañana', tarde: 'Tarde' }

export default function SucursalesPage() {
  const { perfil } = useAuth()
  const esAdmin = perfil?.es_admin_maestro === true
  const [sucursales, setSucursales] = useState([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [modal, setModal] = useState(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    try {
      const data = await getSucursales()
      setSucursales(data)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate(form, idPlantilla, fechaPlantilla) {
    const resp = await createSucursal(form)
    await loadData()
    if (idPlantilla) {
      const idSucursal = resp?.sucursal?.id_sucursal ?? resp?.id_sucursal
      if (idSucursal) {
        try {
          const body = { id_sucursal: idSucursal }
          if (fechaPlantilla) body.fecha_inicio = fechaPlantilla
          await asignarSucursales(idPlantilla, body)
        } catch {
          // sucursal creada; asignación de plantilla falló silenciosamente
        }
      }
    }
    setModal(null)
  }

  async function handleEdit(id, form) {
    await updateSucursal(id, form)
    await loadData()
    setModal(null)
  }

  async function handleDesactivar(id) {
    await desactivarSucursal(id)
    await loadData()
    setModal(null)
  }

  const filtradas = sucursales.filter((s) =>
    s.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    s.codigo.toLowerCase().includes(busqueda.toLowerCase())
  )

  const activas = sucursales.filter((s) => s.activa).length

  return (
    <div className="sucursales-page">
      <div className="page-header">
        <div>
          <h1>Sucursales</h1>
          <p>{activas} activa{activas !== 1 ? 's' : ''} de {sucursales.length} en total</p>
        </div>
        <button className="btn-primary" onClick={() => setModal({ type: 'crear' })}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nueva sucursal
        </button>
      </div>

      <div className="toolbar">
        <div className="search-wrapper">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Buscar por nombre o código..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="loading-state">Cargando sucursales...</div>
      ) : filtradas.length === 0 ? (
        <div className="empty-state">
          {busqueda ? 'Sin resultados para tu búsqueda.' : 'No hay sucursales registradas.'}
        </div>
      ) : (
        <div className="table-card">
          <table className="sucursales-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Código</th>
                <th>Gerente de área</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((s) => (
                <tr key={s.id_sucursal}>
                  <td className="td-nombre">{s.nombre}</td>
                  <td><span className="codigo">{s.codigo}</span></td>
                  <td>
                    {s.gerente_area ? (
                      <div className="gerente-cell">
                        <div className="gerente-avatar">{s.gerente_area.nombre.charAt(0).toUpperCase()}</div>
                        <span>{s.gerente_area.nombre}</span>
                      </div>
                    ) : <span className="td-empty">—</span>}
                  </td>
                  <td>
                    <span className={`badge ${s.activa ? 'badge-green' : 'badge-red'}`}>
                      {s.activa ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button className="action-btn" title="Horarios" onClick={() => setModal({ type: 'horarios', sucursal: s })}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                        </svg>
                      </button>
                      <button className="action-btn" title="Asignar plantilla" onClick={() => setModal({ type: 'plantilla', sucursal: s })}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
                          <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
                        </svg>
                      </button>
                      <button className="action-btn" title="Editar" onClick={() => setModal({ type: 'editar', sucursal: s })}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      {s.activa && (
                        <button className="action-btn action-btn-danger" title="Desactivar" onClick={() => setModal({ type: 'desactivar', sucursal: s })}>
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
        </div>
      )}

      {modal?.type === 'crear' && (
        <SucursalModal esAdmin={esAdmin} conPlantilla onSubmit={handleCreate} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'editar' && (
        <SucursalModal
          esAdmin={esAdmin}
          inicial={modal.sucursal}
          onSubmit={(form) => handleEdit(modal.sucursal.id_sucursal, form)}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'desactivar' && (
        <DesactivarModal
          nombre={modal.sucursal.nombre}
          onConfirm={() => handleDesactivar(modal.sucursal.id_sucursal)}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'horarios' && (
        <HorariosModal sucursal={modal.sucursal} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'plantilla' && (
        <PlantillaModal sucursal={modal.sucursal} onClose={() => setModal(null)} />
      )}
    </div>
  )
}

/* ── Modales ── */

function ModalWrapper({ title, onClose, children, wide, xl }) {
  return (
    <div className="modal-overlay">
      <div className={`modal${wide ? ' modal-wide' : ''}${xl ? ' modal-xl' : ''}`} onClick={(e) => e.stopPropagation()}>
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

function SucursalModal({ esAdmin, inicial, conPlantilla, onSubmit, onClose }) {
  const [gerentes, setGerentes] = useState([])
  const [plantillas, setPlantillas] = useState([])
  const [form, setForm] = useState({
    nombre:          inicial?.nombre ?? '',
    codigo:          inicial?.codigo ?? '',
    id_gerente_area: inicial?.gerente_area?.id_gerente_area ?? '',
  })
  const [idPlantilla, setIdPlantilla]   = useState('')
  const [fechaPlantilla, setFechaPlantilla] = useState('')
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (esAdmin) getGerentes().then(setGerentes).catch(() => {})
    if (conPlantilla) getPlantillas().then((p) => setPlantillas(p.filter((x) => x.activa))).catch(() => {})
  }, [esAdmin, conPlantilla])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const body = { nombre: form.nombre, codigo: form.codigo }
      if (esAdmin && form.id_gerente_area) body.id_gerente_area = Number(form.id_gerente_area)
      await onSubmit(body, idPlantilla ? Number(idPlantilla) : null, fechaPlantilla || null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <ModalWrapper title={inicial ? 'Editar sucursal' : 'Nueva sucursal'} onClose={onClose}>
      <form className="modal-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Nombre</label>
          <input type="text" value={form.nombre} onChange={set('nombre')} required />
        </div>
        <div className="form-group">
          <label>Código</label>
          <input type="text" value={form.codigo} onChange={set('codigo')} required placeholder="ej. CENTRO-001" />
        </div>
        {esAdmin && (
          <div className="form-group">
            <label>Gerente de área {!inicial && <span className="label-required">*</span>}</label>
            <select value={form.id_gerente_area} onChange={set('id_gerente_area')} required={!inicial}>
              <option value="">Seleccionar gerente</option>
              {gerentes.filter((g) => g.activo).map((g) => (
                <option key={g.id_gerente_area} value={g.id_gerente_area}>{g.nombre}</option>
              ))}
            </select>
          </div>
        )}
        {conPlantilla && plantillas.length > 0 && (
          <>
            <hr className="modal-divider" />
            <p className="form-section-label">Plantilla inicial <span className="label-optional">(opc.)</span></p>
            <div className="form-row">
              <div className="form-group" style={{ flex: 2 }}>
                <label>Plantilla</label>
                <select value={idPlantilla} onChange={(e) => setIdPlantilla(e.target.value)}>
                  <option value="">Sin plantilla</option>
                  {plantillas.map((p) => (
                    <option key={p.id_plantilla} value={p.id_plantilla}>{p.nombre}</option>
                  ))}
                </select>
              </div>
              {idPlantilla && (
                <div className="form-group">
                  <label>Fecha inicio</label>
                  <input type="date" value={fechaPlantilla} onChange={(e) => setFechaPlantilla(e.target.value)} />
                </div>
              )}
            </div>
          </>
        )}
        {error && <p className="modal-error">{error}</p>}
        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Guardando...' : inicial ? 'Guardar cambios' : 'Crear sucursal'}
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
    <ModalWrapper title="Desactivar sucursal" onClose={onClose}>
      <div className="modal-form">
        <p className="modal-confirm-text">¿Deseas desactivar la sucursal <strong>{nombre}</strong>?</p>
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

function HorariosModal({ sucursal, onClose }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingIdx, setSavingIdx] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => { loadHorarios() }, [])

  async function loadHorarios() {
    setLoading(true)
    try {
      const data = await getHorarios(sucursal.id_sucursal)
      setRows(data.map((h) => ({
        id_horario:    h.id_horario,
        dia_semana:    h.dia_semana,
        dia_nombre:    h.dia_nombre,
        abre:          h.abre,
        hora_apertura: h.hora_apertura ?? '',
        hora_cierre:   h.hora_cierre ?? '',
      })))
    } finally {
      setLoading(false)
    }
  }

  function updateRow(idx, key, value) {
    setRows((prev) => prev.map((r, i) => i === idx ? { ...r, [key]: value } : r))
  }

  async function handleSave(idx) {
    const row = rows[idx]
    setSavingIdx(idx)
    setError('')
    try {
      const body = { dia_semana: row.dia_semana, abre: row.abre }
      if (row.abre) {
        body.hora_apertura = row.hora_apertura
        body.hora_cierre   = row.hora_cierre
      }
      if (row.id_horario) {
        await updateHorario(sucursal.id_sucursal, row.id_horario, body)
      } else {
        await saveHorarios(sucursal.id_sucursal, body)
      }
      await loadHorarios()
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingIdx(null)
    }
  }

  return (
    <ModalWrapper title={`Horarios — ${sucursal.nombre}`} onClose={onClose} xl>
      <div className="modal-form">
        {loading ? (
          <p className="empty-state-sm">Cargando horarios...</p>
        ) : (
          <>
            <div className="horarios-table-wrap">
              <table className="horarios-table">
                <thead>
                  <tr>
                    <th>Día</th>
                    <th>¿Abre?</th>
                    <th>Apertura</th>
                    <th>Cierre</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr key={row.dia_semana}>
                      <td className="td-dia">{DIAS[row.dia_semana]}</td>
                      <td>
                        <label className="toggle-label">
                          <input
                            type="checkbox"
                            checked={row.abre}
                            onChange={(e) => updateRow(idx, 'abre', e.target.checked)}
                          />
                          <span className={`badge ${row.abre ? 'badge-green' : 'badge-red'}`}>
                            {row.abre ? 'Abre' : 'Cierra'}
                          </span>
                        </label>
                      </td>
                      <td>
                        <input
                          type="time"
                          className="time-input"
                          value={row.hora_apertura}
                          disabled={!row.abre}
                          onChange={(e) => updateRow(idx, 'hora_apertura', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="time"
                          className="time-input"
                          value={row.hora_cierre}
                          disabled={!row.abre}
                          onChange={(e) => updateRow(idx, 'hora_cierre', e.target.value)}
                        />
                      </td>
                      <td>
                        <button
                          className="btn-save-horario"
                          onClick={() => handleSave(idx)}
                          disabled={savingIdx === idx}
                        >
                          {savingIdx === idx ? '...' : 'Guardar'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {error && <p className="modal-error">{error}</p>}
          </>
        )}
        <div className="modal-footer">
          <button className="btn-primary" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </ModalWrapper>
  )
}

function PlantillaModal({ sucursal, onClose }) {
  const [plantillas, setPlantillas]     = useState([])
  const [tareas, setTareas]             = useState([])
  const [loading, setLoading]           = useState(true)
  const [idPlantilla, setIdPlantilla]   = useState('')
  const [fechaInicio, setFechaInicio]   = useState('')
  const [saving, setSaving]             = useState(false)
  const [error, setError]               = useState('')
  const [success, setSuccess]           = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [p, t] = await Promise.all([
        getPlantillas(),
        getTareasSucursal(sucursal.id_sucursal),
      ])
      setPlantillas(p.filter((p) => p.activa))
      setTareas(t)
    } finally {
      setLoading(false)
    }
  }

  async function handleAsignar(e) {
    e.preventDefault()
    if (!idPlantilla) return
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const body = { id_sucursal: sucursal.id_sucursal }
      if (fechaInicio) body.fecha_inicio = fechaInicio
      await asignarSucursales(idPlantilla, body)
      setSuccess('Plantilla asignada correctamente.')
      setIdPlantilla('')
      setFechaInicio('')
      await loadData()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const tareasActivas = tareas.filter((t) => t.activa)

  return (
    <ModalWrapper title={`Plantilla — ${sucursal.nombre}`} onClose={onClose} wide>
      <div className="modal-form">

        <form onSubmit={handleAsignar}>
          <p className="form-section-title">Asignar plantilla</p>
          <div className="form-row">
            <div className="form-group" style={{ flex: 2 }}>
              <label>Plantilla</label>
              <select value={idPlantilla} onChange={(e) => setIdPlantilla(e.target.value)} required>
                <option value="">Seleccionar plantilla</option>
                {plantillas.map((p) => (
                  <option key={p.id_plantilla} value={p.id_plantilla}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Fecha inicio <span className="label-optional">(opc.)</span></label>
              <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
            </div>
          </div>
          {error   && <p className="modal-error">{error}</p>}
          {success && <p className="modal-success">{success}</p>}
          <div className="modal-footer" style={{ paddingTop: 0 }}>
            <button type="button" className="btn-secondary" onClick={onClose}>Cerrar</button>
            <button type="submit" className="btn-primary" disabled={saving || !idPlantilla}>
              {saving ? 'Asignando...' : 'Asignar plantilla'}
            </button>
          </div>
        </form>

        {loading ? (
          <p className="empty-state-sm">Cargando tareas...</p>
        ) : tareasActivas.length > 0 && (
          <>
            <p className="form-section-title">Tareas activas ({tareasActivas.length})</p>
            <div className="tareas-suc-list">
              {tareasActivas.map((ts) => (
                <div key={ts.id_sucursal_tarea} className="tareas-suc-row">
                  <div className="tareas-suc-info">
                    <span className="tareas-suc-nombre">{ts.tarea?.nombre}</span>
                    <div className="tareas-suc-meta">
                      <span className="badge badge-tipo">{JORNADA_LABEL[ts.jornada] ?? ts.jornada}</span>
                      <span className="tareas-suc-hora">{ts.hora}</span>
                      <span className="tareas-suc-peso">Peso: {ts.tarea?.peso ?? '—'}</span>
                      {ts.tarea?.recurrencia_label && (
                        <span className="badge badge-tipo">{ts.tarea.recurrencia_label}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </ModalWrapper>
  )
}
