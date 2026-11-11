import { useCallback, useRef, useState, useEffect } from 'react'
import { getCoberturas, createCobertura, activarCobertura, cancelarCobertura, completarCobertura } from '../services/coberturasService'
import { getUsuarios } from '../../usuarios/services/usuariosService'
import { getSucursales, getHorarios, getTitularSucursal } from '../../sucursales/services/sucursalesService'
import Toast from '../../../components/Toast/Toast'
import './CoberturasPage.css'

const ESTADO_BADGE = {
  pendiente:   'badge-yellow',
  programada:  'badge-blue',
  activa:      'badge-green',
  completada:  'badge-blue',
  cancelada:   'badge-red',
  rechazada:   'badge-red',
}

const JORNADA_LABEL = {
  manana:      'Mañana',
  tarde:       'Tarde',
  dia_completo:'Día completo',
}

function dayOfWeek(date) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!match) return null
  const [, year, month, day] = match.map(Number)
  const localDate = new Date(year, month - 1, day)
  if (localDate.getFullYear() !== year
    || localDate.getMonth() !== month - 1
    || localDate.getDate() !== day) return null
  return localDate.getDay()
}

function isSunday(date) {
  return dayOfWeek(date) === 0
}

function isWeekend(date) {
  const day = dayOfWeek(date)
  return day === 0 || day === 6
}

export default function CoberturasPage() {
  const [coberturas, setCoberturas] = useState([])
  const [total, setTotal]           = useState(0)
  const [loading, setLoading]       = useState(true)
  const [filtroEstado, setFiltroEstado] = useState('')
  const [modal, setModal]           = useState(null)
  const [toast, setToast]           = useState(null)

  const showToast = (message, type = 'error') => setToast({ message, type })

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (filtroEstado) params.estado = filtroEstado
      const data = await getCoberturas(params)
      setCoberturas(data.results ?? [])
      setTotal(data.count ?? 0)
    } finally {
      setLoading(false)
    }
  }, [filtroEstado])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData()
  }, [loadData])

  async function handleAccion(id, accion) {
    try {
      if (accion === 'activar')   await activarCobertura(id)
      if (accion === 'cancelar')  await cancelarCobertura(id)
      if (accion === 'completar') await completarCobertura(id)
      await loadData()
    } catch (err) {
      showToast(err.message)
    }
  }

  async function handleCreate(form) {
    await createCobertura(form)
    await loadData()
    setModal(null)
    showToast('Cobertura creada correctamente', 'success')
  }

  return (
    <div className="coberturas-page">
      <div className="page-header">
        <div>
          <h1>Coberturas temporales</h1>
          <p>{total} cobertura{total !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn-primary" onClick={() => setModal({ type: 'crear' })}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Nueva cobertura
        </button>
      </div>

      <div className="toolbar">
        <select className="filtro-select" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendientes</option>
          <option value="programada">Programadas</option>
          <option value="activa">Activas</option>
          <option value="completada">Completadas</option>
          <option value="cancelada">Canceladas</option>
          <option value="rechazada">Rechazadas</option>
        </select>
      </div>

      {loading ? (
        <div className="loading-state">Cargando coberturas...</div>
      ) : coberturas.length === 0 ? (
        <div className="empty-state">
          {filtroEstado ? 'Sin coberturas con ese estado.' : 'No hay coberturas registradas.'}
        </div>
      ) : (
        <div className="table-card">
          <table className="coberturas-table">
            <thead>
              <tr>
                <th>Reemplazo</th>
                <th>Titular</th>
                <th>Sucursal</th>
                <th>Fecha</th>
                <th>Jornada</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {coberturas.map((c) => (
                <tr key={c.id_cobertura}>
                  <td className="td-nombre">{c.usuario_reemplazo?.nombre ?? '—'}</td>
                  <td>{c.usuario_titular?.nombre ?? <span className="td-empty">—</span>}</td>
                  <td>{c.sucursal_destino?.nombre ?? '—'}</td>
                  <td>{c.fecha}</td>
                  <td><span className="badge badge-tipo">{c.jornada_label ?? JORNADA_LABEL[c.jornada] ?? c.jornada}</span></td>
                  <td>
                    <span className={`badge ${ESTADO_BADGE[c.estado] ?? 'badge-tipo'}`}>
                      {c.estado_label ?? c.estado}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      {c.estado === 'programada' && (
                        <button className="action-btn action-btn-green" title="Activar" onClick={() => handleAccion(c.id_cobertura, 'activar')}>
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        </button>
                      )}
                      {c.estado === 'activa' && (
                        <button className="action-btn action-btn-blue" title="Completar" onClick={() => handleAccion(c.id_cobertura, 'completar')}>
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                          </svg>
                        </button>
                      )}
                      {(c.estado === 'pendiente' || c.estado === 'programada' || c.estado === 'activa') && (
                        <button className="action-btn action-btn-danger" title="Cancelar" onClick={() => handleAccion(c.id_cobertura, 'cancelar')}>
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
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
        <CoberturaModal
          onSubmit={handleCreate}
          onClose={() => setModal(null)}
          showToast={showToast}
        />
      )}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  )
}

/* ── Modal crear cobertura ── */

function ModalWrapper({ title, onClose, children }) {
  return (
    <div className="modal-overlay">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close" onClick={onClose}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function CoberturaModal({ onSubmit, onClose, showToast }) {
  const [usuarios, setUsuarios]     = useState([])
  const [sucursales, setSucursales] = useState([])
  const [titular, setTitular]       = useState(null)
  const [buscandoTitular, setBuscandoTitular] = useState(false)
  const [form, setForm] = useState({
    id_usuario_reemplazo: '',
    id_sucursal_destino:  '',
    fecha:    '',
    jornada:  'dia_completo',
    motivo:   '',
  })
  const [loading, setLoading] = useState(false)
  const [horarioSucursal, setHorarioSucursal] = useState({ id: '', rows: null, loading: false, error: '' })
  const [sundayValidationError, setSundayValidationError] = useState('')
  const horarioRequestRef = useRef(0)

  useEffect(() => {
    Promise.all([getUsuarios(), getSucursales()])
      .then(([u, s]) => { setUsuarios(u); setSucursales(s) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!form.id_sucursal_destino) {
      // Sin sucursal de destino no hay titular que consultar.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTitular(null)
      return
    }
    let cancelado = false
    setBuscandoTitular(true)
    getTitularSucursal(form.id_sucursal_destino, form.fecha || undefined)
      .then((u) => { if (!cancelado) setTitular(u) })
      .catch(() => { if (!cancelado) setTitular(null) })
      .finally(() => { if (!cancelado) setBuscandoTitular(false) })
    return () => { cancelado = true }
  }, [form.id_sucursal_destino, form.fecha])

  const set = (k) => (e) => {
    const value = e.target.value
    setSundayValidationError('')
    setForm((f) => ({ ...f, [k]: value }))
  }

  function handleDateChange(e) {
    const fecha = e.target.value
    setSundayValidationError('')
    setForm((f) => ({ ...f, fecha, jornada: isWeekend(fecha) ? 'dia_completo' : f.jornada }))
  }

  function handleJornadaChange(e) {
    const jornada = e.target.value
    if (isWeekend(form.fecha) && jornada !== 'dia_completo') {
      setSundayValidationError('Los fines de semana la cobertura debe ser de día completo.')
      setForm((f) => ({ ...f, jornada: 'dia_completo' }))
      return
    }
    setSundayValidationError('')
    setForm((f) => ({ ...f, jornada }))
  }

  async function handleSucursalChange(e) {
    const idSucursal = e.target.value
    const requestId = ++horarioRequestRef.current
    setSundayValidationError('')
    setForm((f) => ({ ...f, id_sucursal_destino: idSucursal }))
    setHorarioSucursal({ id: idSucursal, rows: null, loading: Boolean(idSucursal), error: '' })
    if (!idSucursal) return

    try {
      const rows = await getHorarios(idSucursal)
      if (requestId === horarioRequestRef.current) {
        setHorarioSucursal({ id: idSucursal, rows, loading: false, error: '' })
      }
    } catch {
      if (requestId === horarioRequestRef.current) {
        setHorarioSucursal({ id: idSucursal, rows: null, loading: false, error: 'No se pudo verificar el horario de la sucursal.' })
      }
    }
  }

  const esDomingo = isSunday(form.fecha)
  const esFinDeSemana = isWeekend(form.fecha)
  const domingoAbierto = horarioSucursal.id === form.id_sucursal_destino
    && Array.isArray(horarioSucursal.rows)
    && horarioSucursal.rows.some((horario) => Number(horario.dia_semana) === 7 && horario.abre === true)

  async function handleSubmit(e) {
    e.preventDefault()
    if (esFinDeSemana) {
      if (form.jornada !== 'dia_completo') {
        setSundayValidationError('Los fines de semana la cobertura debe ser de día completo.')
        return
      }
      if (esDomingo) {
        if (horarioSucursal.loading || horarioSucursal.error || !Array.isArray(horarioSucursal.rows)) {
          setSundayValidationError(horarioSucursal.error || 'Espera a que se verifique el horario de la sucursal para el domingo.')
          return
        }
        if (!domingoAbierto) {
          setSundayValidationError('La sucursal seleccionada no abre los domingos.')
          return
        }
      }
    }
    setLoading(true)
    try {
      const body = {
        id_usuario_reemplazo: Number(form.id_usuario_reemplazo),
        id_sucursal_destino:  Number(form.id_sucursal_destino),
        fecha:   form.fecha,
        jornada: form.jornada,
        motivo:  form.motivo,
      }
      if (titular) body.id_usuario_titular = titular.id_usuario
      await onSubmit(body)
    } catch (err) {
      showToast(err.message)
    } finally {
      setLoading(false)
    }
  }

  const usuariosActivos = (Array.isArray(usuarios) ? usuarios : []).filter((u) => u.habilitado)

  return (
    <ModalWrapper title="Nueva cobertura" onClose={onClose}>
      <form className="modal-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="cobertura-usuario-reemplazo">Usuario reemplazo <span className="label-required">*</span></label>
          <select id="cobertura-usuario-reemplazo" value={form.id_usuario_reemplazo} onChange={set('id_usuario_reemplazo')} required>
            <option value="">Seleccionar usuario</option>
            {usuariosActivos.map((u) => (
              <option key={u.id_usuario} value={u.id_usuario}>{u.nombre}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="cobertura-sucursal-destino">Sucursal destino <span className="label-required">*</span></label>
          <select id="cobertura-sucursal-destino" value={form.id_sucursal_destino} onChange={handleSucursalChange} required>
            <option value="">Seleccionar sucursal</option>
            {sucursales.filter((s) => s.activa).map((s) => (
              <option key={s.id_sucursal} value={s.id_sucursal}>{s.nombre}</option>
            ))}
          </select>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="cobertura-fecha">Fecha <span className="label-required">*</span></label>
            <input id="cobertura-fecha" type="date" value={form.fecha} onChange={handleDateChange} required />
          </div>
          <div className="form-group">
            <label htmlFor="cobertura-jornada">Jornada</label>
            <select id="cobertura-jornada" value={form.jornada} onChange={handleJornadaChange}>
              <option value="dia_completo">Día completo</option>
              <option value="manana" disabled={esFinDeSemana}>Mañana</option>
              <option value="tarde" disabled={esFinDeSemana}>Tarde</option>
            </select>
          </div>
        </div>
        {esFinDeSemana && <p role="status">Los fines de semana la cobertura debe ser de día completo.</p>}
        {sundayValidationError && <p role="alert">{sundayValidationError}</p>}
        <div className="form-group">
          <label>Usuario titular</label>
          <input
            type="text"
            value={buscandoTitular ? 'Buscando...' : (titular?.nombre ?? (form.id_sucursal_destino ? 'Sin titular asignado' : ''))}
            disabled
            placeholder="Selecciona una sucursal destino"
          />
        </div>
        <div className="form-group">
          <label>Motivo <span className="label-optional">(opcional)</span></label>
          <input type="text" value={form.motivo} onChange={set('motivo')} placeholder="ej. descanso dominical" />
        </div>
        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Guardando...' : 'Crear cobertura'}
          </button>
        </div>
      </form>
    </ModalWrapper>
  )
}
