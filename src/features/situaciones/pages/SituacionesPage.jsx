import { useState, useEffect } from 'react'
import { getSituaciones, crearSituacion, desactivarSituacion, getTiposSituaciones, crearTipoSituacion, getUsuariosSituaciones } from '../services/situacionesService'
import { getGerentes } from '../../gerentes/services/gerentesService'
import { useAuth } from '../../auth/context/AuthContext'
import './SituacionesPage.css'

const PAGE_SIZE = 15

function porcentajeTipo(codigo) {
  return codigo === 'no_aprobada_ga' ? 0 : 100
}

function nombreTipoConPorcentaje(tipo) {
  return `${tipo.nombre} (${porcentajeTipo(tipo.codigo)}%)`
}

function formatFecha(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function formatFechaHora(iso) {
  if (!iso) return '—'
  const fecha = formatFecha(iso.slice(0, 10))
  const hora = new Date(iso).toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit' })
  return `${fecha} ${hora}`
}

function hoyISO() {
  return new Date().toISOString().slice(0, 10)
}

function haceNDiasISO(dias) {
  const d = new Date()
  d.setDate(d.getDate() - dias)
  return d.toISOString().slice(0, 10)
}

export default function SituacionesPage() {
  const { perfil } = useAuth()
  const esAdminMaestro = perfil?.es_admin_maestro === true
  const [cargaLista, setCargaLista] = useState({ clave: null, results: [], totalPages: 0, error: '' })
  const [revisionLista, setRevisionLista] = useState(0)
  const [tipos, setTipos] = useState([])
  const [puedeCrearTipo, setPuedeCrearTipo] = useState(false)
  const [cargaTipos, setCargaTipos] = useState({ revision: -1, error: '' })
  const [revisionTipos, setRevisionTipos] = useState(0)
  const [modal, setModal]             = useState(null)
  const [filtroActiva, setFiltroActiva] = useState('activas')
  const [apartado, setApartado]       = useState('todas')
  const [page, setPage]               = useState(1)
  const claveLista = `${filtroActiva}:${apartado}:${page}:${revisionLista}`
  const loading = cargaLista.clave !== claveLista
  const situaciones = loading ? [] : cargaLista.results
  const totalPages = loading ? 0 : cargaLista.totalPages
  const errorLista = loading ? '' : cargaLista.error
  const loadingTipos = cargaTipos.revision !== revisionTipos
  const errorTipos = loadingTipos ? '' : cargaTipos.error

  useEffect(() => {
    let vigente = true
    getTiposSituaciones()
      .then((data) => {
        if (!vigente) return
        setTipos(data.results ?? [])
        setPuedeCrearTipo(data.puede_crear === true)
        setCargaTipos({ revision: revisionTipos, error: '' })
      })
      .catch((err) => {
        if (vigente) setCargaTipos({ revision: revisionTipos, error: err.message })
      })
    return () => { vigente = false }
  }, [revisionTipos])

  useEffect(() => {
    let vigente = true
    const params = filtroActiva === 'todas' ? { activa: '' } : { activa: filtroActiva === 'activas' ? 'true' : 'false' }
    params.page = page
    params.page_size = PAGE_SIZE
    if (apartado === 'programadas') params.tipo = 'vacaciones_programadas'
    getSituaciones(params)
      .then((data) => {
        if (vigente) setCargaLista({ clave: claveLista, results: data.results ?? [], totalPages: data.total_pages ?? 0, error: '' })
      })
      .catch((err) => {
        if (vigente) setCargaLista({ clave: claveLista, results: [], totalPages: 0, error: err.message })
      })
    return () => { vigente = false }
  }, [filtroActiva, apartado, page, claveLista])

  function cargarTipos() {
    setRevisionTipos((value) => value + 1)
  }

  function loadData() {
    setRevisionLista((value) => value + 1)
  }

  function handleCreacionCompleta() {
    loadData()
    setModal(null)
  }

  async function handleDesactivar(id) {
    await desactivarSituacion(id)
    loadData()
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

      <div className="tab-bar">
        <button
          className={`tab-btn${apartado === 'todas' ? ' active' : ''}`}
          onClick={() => { setApartado('todas'); setPage(1) }}
        >
          Todas
        </button>
        <button
          className={`tab-btn${apartado === 'programadas' ? ' active' : ''}`}
          onClick={() => { setApartado('programadas'); setPage(1) }}
        >
          Vacaciones programadas
        </button>
      </div>

      <div className="toolbar">
        <select className="filtro-select" value={filtroActiva} onChange={(e) => { setFiltroActiva(e.target.value); setPage(1) }}>
          <option value="activas">Activas</option>
          <option value="inactivas">Inactivas</option>
          <option value="todas">Todas</option>
        </select>
      </div>

      {loading ? (
        <div className="loading-state">Cargando situaciones...</div>
      ) : errorLista ? (
        <div role="alert" className="modal-error">
          {errorLista}{' '}
          <button className="btn-secondary" onClick={loadData}>Reintentar situaciones</button>
        </div>
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
                <th>Fecha creación</th>
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
                    <span className="badge badge-tipo">
                      {nombreTipoConPorcentaje(tipos.find((tipo) => tipo.codigo === s.tipo) ?? { codigo: s.tipo, nombre: s.tipo })}
                    </span>
                  </td>
                  <td className="td-notas">{s.notas || <span className="td-empty">—</span>}</td>
                  <td>{s.creada_por?.nombre ?? '—'}</td>
                  <td>{formatFechaHora(s.created_at)}</td>
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

      {totalPages > 1 && (
        <div className="paginacion">
          <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Anterior
          </button>
          <span className="paginacion-info">Página {page} de {totalPages}</span>
          <button className="btn-secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Siguiente
          </button>
        </div>
      )}

      {errorTipos && modal?.type !== 'crear' && (
        <div role="alert" className="modal-error">
          {errorTipos}{' '}
          <button className="btn-secondary" onClick={cargarTipos}>Reintentar catálogo</button>
        </div>
      )}

      {modal?.type === 'crear' && (
        <CrearModal
          tipos={tipos}
          loadingTipos={loadingTipos}
          errorTipos={errorTipos}
          onRecargarTipos={cargarTipos}
          puedeCrearTipo={puedeCrearTipo}
          esAdminMaestro={esAdminMaestro}
          onCrearTipo={async (nombre) => {
            const tipoCreado = await crearTipoSituacion(nombre)
            setTipos((current) => [...current.filter((tipo) => tipo.codigo !== tipoCreado.codigo), tipoCreado])
            cargarTipos()
            return tipoCreado
          }}
          onSubmit={crearSituacion}
          onComplete={handleCreacionCompleta}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'desactivar' && (
        <DesactivarModal
          situacion={modal.situacion}
          nombreTipo={nombreTipoConPorcentaje(
            tipos.find((tipo) => tipo.codigo === modal.situacion.tipo)
              ?? { codigo: modal.situacion.tipo, nombre: modal.situacion.tipo },
          )}
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
    <div className="modal-overlay">
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close" aria-label="Cerrar" onClick={onClose}>
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

function CrearModal({ tipos, loadingTipos, errorTipos, onRecargarTipos, puedeCrearTipo, esAdminMaestro, onCrearTipo, onSubmit, onComplete, onClose }) {
  const [cargaUsuarios, setCargaUsuarios] = useState({ clave: null, results: [], error: '' })
  const [reintentoUsuarios, setReintentoUsuarios] = useState(0)
  const [gerentes, setGerentes] = useState([])
  const [errorGerentes, setErrorGerentes] = useState('')
  const [reintentoGerentes, setReintentoGerentes] = useState(0)
  const [idGerenteArea, setIdGerenteArea] = useState('')
  const [nuevoTipo, setNuevoTipo] = useState('')
  const [mostrandoNuevoTipo, setMostrandoNuevoTipo] = useState(false)
  const [form, setForm] = useState({
    id_usuario:   '',
    fecha_inicio: '',
    fecha_fin:    '',
    tipo:         '',
    notas:        '',
  })
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)
  const claveUsuarios = `${esAdminMaestro ? idGerenteArea : ''}:${reintentoUsuarios}`
  const loadingUsuarios = cargaUsuarios.clave !== claveUsuarios
  const usuarios = loadingUsuarios ? [] : cargaUsuarios.results
  const errorUsuarios = loadingUsuarios ? '' : cargaUsuarios.error
  const tipoSeleccionado = form.tipo || tipos[0]?.codigo || ''

  useEffect(() => {
    if (!esAdminMaestro) return
    let vigente = true
    getGerentes()
      .then((data) => { if (vigente) { setGerentes(data); setErrorGerentes('') } })
      .catch((err) => { if (vigente) setErrorGerentes(err.message) })
    return () => { vigente = false }
  }, [esAdminMaestro, reintentoGerentes])

  useEffect(() => {
    let vigente = true
    const params = esAdminMaestro && idGerenteArea ? { id_gerente_area: idGerenteArea } : {}
    getUsuariosSituaciones(params)
      .then((data) => {
        if (vigente) setCargaUsuarios({ clave: claveUsuarios, results: data.results ?? [], error: '' })
      })
      .catch((err) => {
        if (vigente) setCargaUsuarios({ clave: claveUsuarios, results: [], error: err.message })
      })
    return () => { vigente = false }
  }, [esAdminMaestro, idGerenteArea, claveUsuarios])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const diasSeleccionados = form.fecha_inicio && form.fecha_fin
    ? fechasEnRango(form.fecha_inicio, form.fecha_fin).length
    : form.fecha_inicio ? 1 : 0

  async function handleSubmit(e) {
    e.preventDefault()
    if (loading || loadingUsuarios || loadingTipos || errorTipos || errorUsuarios) return
    setError('')

    if (!form.id_usuario || !usuarios.some((usuario) => String(usuario.id_usuario) === form.id_usuario)) {
      setError('Debes seleccionar un usuario.')
      return
    }

    if (!tipos.some((tipo) => tipo.codigo === tipoSeleccionado)) {
      setError('Debes seleccionar un tipo de situación.')
      return
    }

    if (!form.fecha_inicio) {
      setError('Debes seleccionar una fecha.')
      return
    }

    if (form.fecha_inicio < haceNDiasISO(15)) {
      setError('No se puede registrar una situación con más de 15 días de antigüedad.')
      return
    }
    if (form.fecha_inicio > hoyISO()) {
      setError('No se puede aplicar rendimiento futuro.')
      return
    }

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
    let siguienteFecha = form.fecha_inicio
    try {
      for (const [index, fecha] of fechas.entries()) {
        await onSubmit({
          id_usuario: Number(form.id_usuario),
          fecha,
          tipo:  tipoSeleccionado,
          notas: form.notas.trim(),
        })
        siguienteFecha = fechas[index + 1]
      }
      await onComplete()
    } catch (err) {
      setError(err.message)
      if (siguienteFecha) setForm((current) => ({ ...current, fecha_inicio: siguienteFecha }))
    } finally {
      setLoading(false)
    }
  }

  async function handleCrearTipo(e) {
    e.preventDefault()
    if (loading || !puedeCrearTipo || !nuevoTipo.trim()) return
    setLoading(true)
    setError('')
    try {
      const tipoCreado = await onCrearTipo(nuevoTipo.trim())
      setNuevoTipo('')
      setMostrandoNuevoTipo(false)
      if (tipoCreado?.codigo) setForm((current) => ({ ...current, tipo: tipoCreado.codigo }))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <ModalWrapper title={mostrandoNuevoTipo && puedeCrearTipo ? 'Agregar tipo' : 'Nueva situación especial'} onClose={() => { if (!loading) onClose() }}>
      {mostrandoNuevoTipo && puedeCrearTipo ? (
        <form className="modal-form" onSubmit={handleCrearTipo}>
          <div className="form-group">
            <label htmlFor="nombre-tipo-situacion">Nombre del tipo</label>
            <input id="nombre-tipo-situacion" type="text" value={nuevoTipo} onChange={(e) => setNuevoTipo(e.target.value)} maxLength={100} required disabled={loading} />
          </div>
          {error && <p role="alert" className="modal-error">{error}</p>}
          <div className="modal-footer">
            <button type="button" className="btn-secondary" disabled={loading} onClick={() => { setMostrandoNuevoTipo(false); setError('') }}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={loading || !nuevoTipo.trim()}>{loading ? 'Guardando...' : 'Guardar tipo'}</button>
          </div>
        </form>
      ) : (
      <form className="modal-form" onSubmit={handleSubmit}>
        <div className="form-group">
          {esAdminMaestro && (
            <>
            <label htmlFor="situacion-gerente">Gerente de área</label>
            <select id="situacion-gerente" value={idGerenteArea} disabled={loading} onChange={(e) => {
              setIdGerenteArea(e.target.value)
              setForm((current) => ({ ...current, id_usuario: '' }))
              setError('')
            }}>
              <option value="">Todos los gerentes</option>
              {gerentes.filter((gerente) => gerente.activo).map((gerente) => (
                <option key={gerente.id_gerente_area} value={gerente.id_gerente_area}>{gerente.nombre}</option>
              ))}
            </select>
            {errorGerentes && (
              <div role="alert" className="modal-error">
                {errorGerentes}{' '}
                <button type="button" className="btn-secondary" onClick={() => setReintentoGerentes((value) => value + 1)}>Reintentar gerentes</button>
              </div>
            )}
            </>
          )}
          <label htmlFor="situacion-usuario">Usuario</label>
          <select id="situacion-usuario" value={form.id_usuario} onChange={set('id_usuario')} required disabled={loading || loadingUsuarios || !!errorUsuarios}>
            <option value="">{loadingUsuarios ? 'Cargando usuarios...' : 'Seleccionar usuario'}</option>
            {usuarios.map((u) => (
              <option key={u.id_usuario} value={u.id_usuario}>{u.nombre}</option>
            ))}
          </select>
          {errorUsuarios ? (
            <div role="alert" className="modal-error">
              {errorUsuarios}{' '}
              <button type="button" className="btn-secondary" onClick={() => setReintentoUsuarios((value) => value + 1)}>Reintentar usuarios</button>
            </div>
          ) : !loadingUsuarios && usuarios.length === 0 && <p>No hay GS activos disponibles.</p>}
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="situacion-fecha-inicio">Fecha inicio</label>
            <input
              id="situacion-fecha-inicio"
              type="date"
              value={form.fecha_inicio}
              min={haceNDiasISO(15)}
              max={hoyISO()}
              onChange={set('fecha_inicio')}
              required
              disabled={loading}
            />
          </div>
          <div className="form-group">
            <label htmlFor="situacion-fecha-fin">Fecha fin <span className="label-optional">(opcional)</span></label>
            <input
              id="situacion-fecha-fin"
              type="date"
              value={form.fecha_fin}
              min={form.fecha_inicio || undefined}
              onChange={set('fecha_fin')}
              disabled={loading}
            />
          </div>
        </div>

        {diasSeleccionados > 1 && (
          <p className="dias-rango-info">{diasSeleccionados} días seleccionados</p>
        )}

        <div className="form-group">
          <label htmlFor="situacion-tipo">Tipo</label>
          <select id="situacion-tipo" value={tipoSeleccionado} onChange={set('tipo')} required disabled={loading || loadingTipos || !!errorTipos}>
            {tipos.length === 0 && <option value="">{loadingTipos ? 'Cargando tipos...' : 'No hay tipos disponibles'}</option>}
            {tipos.map((tipo) => (
              <option key={tipo.codigo} value={tipo.codigo}>{nombreTipoConPorcentaje(tipo)}</option>
            ))}
          </select>
          {errorTipos && (
            <div role="alert" className="modal-error">
              {errorTipos}{' '}
              <button type="button" className="btn-secondary" onClick={onRecargarTipos}>Reintentar catálogo</button>
            </div>
          )}
          {puedeCrearTipo && (
            <button type="button" className="btn-secondary" disabled={loading || loadingTipos || !!errorTipos} onClick={() => { setMostrandoNuevoTipo(true); setError('') }}>Agregar tipo</button>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="situacion-notas">Notas <span className="label-optional">(opcional, máx. 200 caracteres)</span></label>
          <textarea
            id="situacion-notas"
            rows={3}
            maxLength={200}
            value={form.notas}
            onChange={set('notas')}
            disabled={loading}
            placeholder="Motivo o descripción adicional..."
          />
        </div>

        {error && <p role="alert" className="modal-error">{error}</p>}
        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={loading || loadingTipos || loadingUsuarios || !!errorTipos || !!errorUsuarios || tipos.length === 0 || usuarios.length === 0}>
            {loading
              ? `Aplicando${diasSeleccionados > 1 ? ` (${diasSeleccionados} días)` : ''}...`
              : 'Aplicar situación'}
          </button>
        </div>
      </form>
      )}
    </ModalWrapper>
  )
}

function DesactivarModal({ situacion, nombreTipo, onConfirm, onClose }) {
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
          ¿Deseas desactivar la situación <strong>{nombreTipo}</strong> de{' '}
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
