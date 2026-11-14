import { Fragment, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/context/AuthContext'
import { getDashboardOperativo } from '../services/dashboardService'
import { getGerentes } from '../../gerentes/services/gerentesService'
import {
  clasificarEstado,
  formatearFecha,
  formatearPorcentaje,
  formatearRango,
  hoyLocal,
  ordenarTarjetas,
  textoExcepcion,
  textoPie,
} from '../utils/statusDia'
import '../../tuvet/tuvet.css'
import './DashboardPage.css'

const META_VACIA = { requiere_filtro: false, mensaje: '', resumen_areas: [] }
const TEXTO_REQUIERE_FILTRO = 'Selecciona un gerente de área o marca «Ver todos» para ver el status del día.'

const ICONOS = {
  alerta: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5M12 16.5v.5" />
    </>
  ),
  reloj: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  bandera: (
    <>
      <path d="M4 15l16-7-3 7H4z" />
      <path d="M4 15l-1 4" />
    </>
  ),
  campo: <path d="M3 12h4l3-7 4 14 3-7h4" />,
  almuerzo: (
    <>
      <path d="M6 3v8a2 2 0 0 0 4 0V3M8 11v10" />
      <path d="M17 3c-1.6 1.2-2.5 3-2.5 6s.9 4.8 2.5 6v6" />
    </>
  ),
  calendario: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 11h18" />
    </>
  ),
}

function Icono({ nombre, size = 13 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONOS[nombre]}
    </svg>
  )
}

function iconoChip(estado) {
  if (estado.motivo === 'dia_especial') return 'bandera'
  if (estado.chip === 'sin_marcas') return 'alerta'
  return 'reloj'
}

function iconoPie(estado) {
  if (estado.motivo === 'sin_marcas') return 'alerta'
  if (estado.motivo === 'normal') return 'reloj'
  return 'calendario'
}

export default function DashboardPage() {
  const { perfil } = useAuth()
  const navigate = useNavigate()
  const esAdmin = perfil?.es_admin_maestro === true

  const [carga, setCarga]           = useState({ clave: null, results: [], count: 0, meta: META_VACIA, error: '' })
  const [revision, setRevision]     = useState(0)
  const [fecha, setFecha]           = useState(hoyLocal)
  const [buscar, setBuscar]         = useState('')
  const [buscarDebounced, setBuscarDebounced] = useState('')
  const [filtroOp, setFiltroOp]     = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [idGerenteArea, setIdGerenteArea] = useState('')
  const [verTodos, setVerTodos]     = useState(false)
  const [gerentes, setGerentes]     = useState([])
  const claveCarga = [fecha, buscarDebounced, filtroOp, filtroEstado, esAdmin, idGerenteArea, verTodos, revision].join(':')
  const loading = carga.clave !== claveCarga
  const results = loading ? [] : carga.results
  const count = loading ? 0 : carga.count
  const meta = loading ? META_VACIA : carga.meta
  const error = loading ? '' : carga.error
  const tarjetas = ordenarTarjetas(results)

  useEffect(() => {
    if (esAdmin) getGerentes().then(setGerentes).catch(() => {})
  }, [esAdmin])

  // Debounce de 300 ms: una petición por pausa de tecleo, no por tecla.
  useEffect(() => {
    const temporizador = setTimeout(() => setBuscarDebounced(buscar), 300)
    return () => clearTimeout(temporizador)
  }, [buscar])

  useEffect(() => {
    let vigente = true
    const params = {}
    if (fecha)        params.fecha            = fecha
    if (buscarDebounced) params.buscar        = buscarDebounced
    if (filtroOp)     params.estado_operativo = filtroOp
    if (filtroEstado) params.estado           = filtroEstado
    if (esAdmin) {
      if (verTodos) params.todos = 'true'
      else if (idGerenteArea) params.id_gerente_area = idGerenteArea
    }
    getDashboardOperativo(params)
      .then((data) => {
        if (vigente) setCarga({
          clave: claveCarga,
          results: data.results ?? [],
          count: data.count ?? 0,
          meta: data.meta ?? META_VACIA,
          error: '',
        })
      })
      .catch((err) => {
        if (vigente) setCarga({ clave: claveCarga, results: [], count: 0, meta: META_VACIA, error: err.message })
      })
    return () => { vigente = false }
  }, [fecha, buscarDebounced, filtroOp, filtroEstado, esAdmin, idGerenteArea, verTodos, claveCarga])

  function loadData() {
    setRevision((value) => value + 1)
  }

  function limpiarFiltros() {
    // Resetear buscar y buscarDebounced juntos evita una segunda carga 300 ms después.
    setBuscar('')
    setBuscarDebounced('')
    setFecha(hoyLocal())
    setFiltroOp('')
    setFiltroEstado('')
    setIdGerenteArea('')
    setVerTodos(false)
    setRevision((value) => value + 1)
  }

  const nombresAreas = meta.resumen_areas
    .map((r) => r.gerente_area?.nombre)
    .filter(Boolean)
  const fechaTexto = formatearFecha(fecha)
  const subPartes = []
  if (fechaTexto) subPartes.push({ texto: fechaTexto, fuerte: true })
  if (!loading) subPartes.push({ texto: `${count} gerente${count === 1 ? '' : 's'} de sucursal` })
  if (!loading && nombresAreas.length > 0) subPartes.push({ texto: `áreas de ${nombresAreas.join(', ')}` })

  return (
    <div className="dashboard-page tema-analiza">
      <div className="page-header">
        <div>
          <h1>Status del día</h1>
          <p className="page-sub">
            {subPartes.map((parte, indice) => (
              <Fragment key={parte.texto}>
                {indice > 0 ? ' · ' : null}
                {parte.fuerte ? <strong>{parte.texto}</strong> : parte.texto}
              </Fragment>
            ))}
          </p>
        </div>
        <button className="btn-refresh" onClick={loadData} title="Actualizar">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10"/>
            <polyline points="1 20 1 14 7 14"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
          Actualizar
        </button>
      </div>

      <section className="filters" aria-label="Filtros">
        <div className="filters-grid">
          <div className="field field-search">
            <label htmlFor="f-buscar">Buscar</label>
            <div className="search-wrapper">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                id="f-buscar"
                type="search"
                placeholder="Nombre, email o sucursal"
                value={buscar}
                onChange={(e) => setBuscar(e.target.value)}
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="f-fecha">Fecha</label>
            <input
              id="f-fecha"
              type="date"
              className="fecha-picker"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="f-jornada">Jornada</label>
            <select id="f-jornada" className="filtro-select" value={filtroOp} onChange={(e) => setFiltroOp(e.target.value)}>
              <option value="">Todas</option>
              <option value="manana">Jornada mañana</option>
              <option value="tarde">Jornada tarde</option>
              <option value="cambio_jornada">Cambio jornada</option>
              <option value="dia_completo">Día completo</option>
              <option value="antes_apertura">Antes apertura</option>
              <option value="cerrado">Cerrado</option>
              <option value="sucursal_cerrada">Sucursal cerrada</option>
              <option value="sin_sucursal">Sin sucursal</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="f-disponibilidad">Disponibilidad</label>
            <select id="f-disponibilidad" className="filtro-select" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
              <option value="">Todas</option>
              <option value="activo">Activo</option>
              <option value="en_almuerzo">En almuerzo</option>
            </select>
          </div>
          {esAdmin && (
            <>
              <div className="field">
                <label htmlFor="f-gerente">Gerente de área</label>
                <select
                  id="f-gerente"
                  className="filtro-select"
                  value={idGerenteArea}
                  disabled={verTodos}
                  onChange={(e) => setIdGerenteArea(e.target.value)}
                >
                  <option value="">Selecciona un área...</option>
                  {gerentes.map((g) => (
                    <option key={g.id_gerente_area} value={g.id_gerente_area}>{g.nombre}</option>
                  ))}
                </select>
              </div>
              <label className="filtro-check">
                <input type="checkbox" checked={verTodos} onChange={(e) => setVerTodos(e.target.checked)} />
                Ver todos los GS
              </label>
            </>
          )}
        </div>
        <div className="filters-foot">
          <button type="button" className="link-btn" onClick={limpiarFiltros}>Limpiar filtros</button>
          {!loading && (
            <span className="count">{count} resultado{count === 1 ? '' : 's'}</span>
          )}
        </div>
      </section>

      {meta.resumen_areas.length > 0 && (
        <div className="resumen-areas">
          {meta.resumen_areas.map((r, indice) => {
            const rango = formatearRango(r.fecha_inicio, r.fecha_fin)
            return (
              <div key={r.gerente_area?.id_gerente_area ?? indice} className="area-summary">
                <span className="area-summary-avatar" aria-hidden="true">
                  {r.gerente_area?.nombre?.charAt(0).toUpperCase() ?? '?'}
                </span>
                <div className="area-summary-who">
                  <span className="area-summary-nombre">{r.gerente_area?.nombre}</span>
                  <small>Resumen del área{rango ? ` · ${rango}` : ''}</small>
                </div>
                <div className="area-summary-metrics">
                  <div>
                    Rendimiento del mes
                    <strong>{formatearPorcentaje(r.rendimiento_mes)}</strong>
                  </div>
                  <div>
                    GS en el área
                    <strong>{r.usuarios_count}</strong>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {loading ? (
        <div className="dashboard-grid" aria-busy="true">
          <span className="visually-hidden" role="status">Cargando status del día...</span>
          {Array.from({ length: 6 }, (_, indice) => (
            <div key={indice} className="status-card status-card--skeleton" aria-hidden="true">
              <div className="status-card-head">
                <span className="status-avatar" />
                <div className="status-who">
                  <span className="skeleton-line skeleton-line--nombre" />
                  <span className="skeleton-line skeleton-line--sucursal" />
                </div>
              </div>
              <span className="skeleton-line skeleton-line--numero" />
              <span className="skeleton-line skeleton-line--barra" />
              <span className="skeleton-line skeleton-line--pie" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div role="alert" className="empty-state">
          <p>{error}</p>
          <button type="button" className="btn-refresh" onClick={loadData}>Reintentar</button>
        </div>
      ) : meta.requiere_filtro ? (
        <div className="empty-state">{TEXTO_REQUIERE_FILTRO}</div>
      ) : results.length === 0 ? (
        <div className="empty-state">Sin resultados para los filtros aplicados.</div>
      ) : (
        <div className="dashboard-grid">
          {tarjetas.map((u, i) => (
            <UserCard
              key={u.id_usuario ?? i}
              user={u}
              onVerRendimiento={(idUsuario) => navigate(`/rendimiento?id_usuario=${idUsuario}`)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function UserCard({ user, onVerRendimiento }) {
  const estado = clasificarEstado(user)
  const pie = textoPie(user)
  const excepcion = textoExcepcion(user)
  const idRendimiento = user.detalle_rendimiento?.id_usuario ?? user.id_usuario
  const puedeVerRendimiento = user.detalle_rendimiento?.disponible === true
    && idRendimiento !== undefined
    && idRendimiento !== null
  const Card = puedeVerRendimiento ? 'button' : 'div'
  const sucursalTexto = user.sucursal || '—'
  const clases = [
    'status-card',
    estado.chip === 'sin_marcas' ? 'status-card--critical' : '',
    puedeVerRendimiento ? 'status-card--clickable' : '',
  ].filter(Boolean).join(' ')

  return (
    <Card
      className={clases}
      {...(puedeVerRendimiento
        ? {
            type: 'button',
            onClick: () => onVerRendimiento(idRendimiento),
            'aria-label': `Ver rendimiento de ${user.nombre_usuario}`,
          }
        : {})}
    >
      <div className="status-card-head">
        <span className="status-avatar" aria-hidden="true">
          {user.nombre_usuario?.charAt(0).toUpperCase() ?? '?'}
        </span>
        <div className="status-who">
          <h3 className="status-nombre" title={user.nombre_usuario}>{user.nombre_usuario}</h3>
          <p className="status-sucursal" title={sucursalTexto}>{sucursalTexto}</p>
        </div>
        {estado.chip && (
          <span
            className={`status-chip status-chip--${estado.tonoChip}`}
            title={estado.tituloChip}
          >
            <Icono nombre={iconoChip(estado)} size={11} />
            {estado.etiquetaChip}
          </span>
        )}
      </div>

      <div className="status-pace">
        {estado.numeroVisible ? (
          <>
            <strong className="status-pace-num">{estado.porcentaje}</strong>
            <span className="status-pace-sign">%</span>
          </>
        ) : (
          <strong className="status-pace-num status-pace-vacio">—</strong>
        )}
      </div>

      <div
        className="status-bar"
        role="img"
        aria-label={estado.ariaBarra}
        title={estado.rayada ? 'Situación especial aprobada: el día puntúa por regla' : 'Avance del día: porcentaje ponderado sobre el peso total programado'}
      >
        <div
          className={`status-bar-fill${estado.rayada ? ' status-bar-fill--especial' : ''}`}
          style={{ width: `${estado.anchoBarra}%` }}
        />
      </div>

      {excepcion && (
        <p className={`status-exception status-exception--${excepcion.tono}`}>
          <Icono nombre={excepcion.icono} />
          {excepcion.texto}
        </p>
      )}

      <p className={`status-foot${pie.tono === 'alerta' ? ' status-foot--alert' : ''}`}>
        <Icono nombre={iconoPie(estado)} />
        <span>{pie.izquierda}</span>
        <span className="status-foot-right">{pie.derecha}</span>
      </p>
    </Card>
  )
}
