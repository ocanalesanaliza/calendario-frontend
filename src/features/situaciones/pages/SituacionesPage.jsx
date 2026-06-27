import { useState, useEffect } from 'react'
import { getSituaciones, crearSituacion, desactivarSituacion } from '../services/situacionesService'
import { getUsuarios } from '../../usuarios/services/usuariosService'
import './SituacionesPage.css'

const TIPO_LABEL = {
  incapacidad:      'Incapacidad',
  vacaciones:       'Vacaciones',
  permiso_aprobado: 'Permiso aprobado',
  otro_aprobado:    'Otro aprobado',
  no_aprobada_ga:   'No aprobada por GA',
}

const TIPO_BADGE = {
  incapacidad:      'badge-blue',
  vacaciones:       'badge-green',
  permiso_aprobado: 'badge-yellow',
  otro_aprobado:    'badge-orange',
  no_aprobada_ga:   'badge-red',
}

function formatFecha(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export default function SituacionesPage() {
  const [situaciones, setSituaciones] = useState([])
  const [loading, setLoading]         = useState(true)
  const [modal, setModal]             = useState(null)
  const [filtroActiva, setFiltroActiva] = useState('activas')

  useEffect(() => { loadData() }, [filtroActiva])

  async function loadData() {
    setLoading(true)
    try {
      const params = filtroActiva === 'todas' ? { activa: '' } : { activa: filtroActiva === 'activas' ? 'true' : 'false' }
      const data = await getSituaciones(params)
      setSituaciones(data)
    } finally {
      setLoading(false)
    }
  }

  async function handleCrear(form) {
    await crearSituacion(form)
    await loadData()
    setModal(null)
  }

  async function handleDesactivar(id) {
    await desactivarSituacion(id)
    await loadData()
    setModal(null)
  }

  return (
    <div className="situaciones-page">
      <div className="page-header">
        <div>
          <h1>Situaciones especiales</h1>
          <p>Ausencias, permisos e incapacidades que afectan el rendimiento del día</p>
        </div>
        <button className="btn-primary" onClick={() => setModal({ type: 'crear' })}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nueva situación
        </button>
      </div>

      <div className="toolbar">
        <select className="filtro-select" value={filtroActiva} onChange={(e) => setFiltroActiva(e.target.value)}>
          <option value="activas">Activas</option>
          <option value="inactivas">Inactivas</option>
          <option value="todas">Todas</option>
        </select>
      </div>

      {loading ? (
        <div className="loading-state">Cargando situaciones...</div>
      ) : situaciones.length === 0 ? (
        <div className="empty-state">No hay situaciones especiales registradas.</div>
      ) : (
        <div className="table-card">
          <table className="situaciones-table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Notas</th>
                <th>Creada por</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {situaciones.map((s) => (
                <tr key={s.id_situacion_especial} className={!s.activa ? 'row-inactive' : ''}>
                  <td className="td-nombre">{s.usuario?.nombre ?? '—'}</td>
                  <td>{formatFecha(s.fecha)}</td>
                  <td>
                    <span className={`badge ${TIPO_BADGE[s.tipo] ?? 'badge-tipo'}`}>
                      {TIPO_LABEL[s.tipo] ?? s.tipo}
                    </span>
                  </td>
                  <td className="td-notas">{s.notas || <span className="td-empty">—</span>}</td>
                  <td>{s.creada_por?.nombre ?? '—'}</td>
                  <td>
                    <span className={`badge ${s.activa ? 'badge-green' : 'badge-red'}`}>
                      {s.activa ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  <td>
                    {s.activa && (
                      <div className="row-actions">
                        <button
                          className="action-btn action-btn-danger"
                          title="Desactivar"
                          onClick={() => setModal({ type: 'desactivar', situacion: s })}
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
          <div className="table-footer">
            {situaciones.length} situación{situaciones.length !== 1 ? 'es' : ''}
          </div>
        </div>
      )}

      {modal?.type === 'crear' && (
        <CrearModal onSubmit={handleCrear} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'desactivar' && (
        <DesactivarModal
          situacion={modal.situacion}
          onConfirm={() => handleDesactivar(modal.situacion.id_situacion_especial)}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}

/* ── Modales ── */

function ModalWrapper({ title, onClose, children }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
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

function fechasEnRango(fechaInicio, fechaFin) {
  const fechas = []
  const cur = new Date(fechaInicio + 'T00:00:00')
  const fin = new Date(fechaFin + 'T00:00:00')
  while (cur <= fin) {
    fechas.push(cur.toISOString().slice(0, 10))
    cur.setDate(cur.getDate() + 1)
  }
  return fechas
}

function CrearModal({ onSubmit, onClose }) {
  const [usuarios, setUsuarios] = useState([])
  const [form, setForm] = useState({
    id_usuario:   '',
    fecha_inicio: '',
    fecha_fin:    '',
    tipo:         'incapacidad',
    notas:        '',
  })
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    getUsuarios({ habilitado: 'true' })
      .then((lista) => setUsuarios(lista))
      .catch(() => {})
  }, [])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const diasSeleccionados = form.fecha_inicio && form.fecha_fin
    ? fechasEnRango(form.fecha_inicio, form.fecha_fin).length
    : form.fecha_inicio ? 1 : 0

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    const fechaFin = form.fecha_fin || form.fecha_inicio
    if (form.fecha_fin && form.fecha_fin < form.fecha_inicio) {
      setError('La fecha de fin no puede ser anterior a la fecha de inicio.')
      return
    }

    const fechas = fechasEnRango(form.fecha_inicio, fechaFin)
    if (fechas.length > 31) {
      setError('El rango no puede superar 31 días.')
      return
    }

    setLoading(true)
    try {
      for (const fecha of fechas) {
        await onSubmit({
          id_usuario: Number(form.id_usuario),
          fecha,
          tipo:  form.tipo,
          notas: form.notas.trim(),
        })
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <ModalWrapper title="Nueva situación especial" onClose={onClose}>
      <form className="modal-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Usuario</label>
          <select value={form.id_usuario} onChange={set('id_usuario')} required>
            <option value="">Seleccionar usuario</option>
            {usuarios.map((u) => (
              <option key={u.id_usuario} value={u.id_usuario}>{u.nombre}</option>
            ))}
          </select>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Fecha inicio</label>
            <input type="date" value={form.fecha_inicio} onChange={set('fecha_inicio')} required />
          </div>
          <div className="form-group">
            <label>Fecha fin <span className="label-optional">(opcional)</span></label>
            <input
              type="date"
              value={form.fecha_fin}
              min={form.fecha_inicio || undefined}
              onChange={set('fecha_fin')}
            />
          </div>
        </div>

        {diasSeleccionados > 1 && (
          <p className="dias-rango-info">{diasSeleccionados} días seleccionados</p>
        )}

        <div className="form-group">
          <label>Tipo</label>
          <select value={form.tipo} onChange={set('tipo')} required>
            {Object.entries(TIPO_LABEL).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Notas <span className="label-optional">(opcional, máx. 200 caracteres)</span></label>
          <textarea
            rows={3}
            maxLength={200}
            value={form.notas}
            onChange={set('notas')}
            placeholder="Motivo o descripción adicional..."
          />
        </div>

        {error && <p className="modal-error">{error}</p>}
        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading
              ? `Aplicando${diasSeleccionados > 1 ? ` (${diasSeleccionados} días)` : ''}...`
              : 'Aplicar situación'}
          </button>
        </div>
      </form>
    </ModalWrapper>
  )
}

function DesactivarModal({ situacion, onConfirm, onClose }) {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  async function handleConfirm() {
    setLoading(true)
    try { await onConfirm() }
    catch (err) { setError(err.message); setLoading(false) }
  }

  return (
    <ModalWrapper title="Desactivar situación especial" onClose={onClose}>
      <div className="modal-form">
        <p className="modal-confirm-text">
          ¿Deseas desactivar la situación <strong>{TIPO_LABEL[situacion.tipo]}</strong> de{' '}
          <strong>{situacion.usuario?.nombre}</strong> del día <strong>{formatFecha(situacion.fecha)}</strong>?
        </p>
        <p className="modal-warn-text">
          Esto recalculará el rendimiento de ese día sin la situación especial.
        </p>
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
