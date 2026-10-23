import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import OcurrenciaCard from '../components/OcurrenciaCard'
import { BarraMeta, NivelBadge, VistaTabla, VistaTablero, VistaTarjetas } from '../components/SeguimientoVistas'
import { EstadoCarga, Icono, MesSelector, Modal, PageHeader } from '../components/TuvetUi'
import { getRevisiones, listItems } from '../services/tuvetService'
import { formatPorcentaje, mesActual, nombrePersona } from '../utils/formato'
import {
  FILTROS_GERENTES,
  META_CUMPLIMIENTO,
  columnasTablero,
  resumenGeneral,
  resumenPorGerente,
} from '../utils/seguimiento'

const VISTAS = [
  { clave: 'tabla', etiqueta: 'Tabla' },
  { clave: 'tarjetas', etiqueta: 'Tarjetas' },
  { clave: 'tablero', etiqueta: 'Tablero' },
]

// Estados que forman el mes; las canceladas no cuentan en el cumplimiento.
const ESTADOS_DEL_MES = ['pendiente', 'en_revision', 'aprobada']

const normalizar = (texto) => String(texto ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

function Kpi({ titulo, valor, detalle, tono = 'neutro' }) {
  return (
    <div className={`tv-kpi tv-kpi-${tono}`}>
      <span className="tv-kpi-titulo">{titulo}</span>
      <span className="tv-kpi-valor">{valor}</span>
      {detalle && <span className="tv-kpi-detalle">{detalle}</span>}
    </div>
  )
}

function TareasGerenteModal({ fila, ocurrencias, onClose }) {
  const propias = ocurrencias
    .filter((ocurrencia) => ocurrencia.gerente_sucursal?.id === fila.gerente.id)
    .sort((a, b) => new Date(a.fecha_limite) - new Date(b.fecha_limite))
  return (
    <Modal
      title="Tareas del mes"
      subtitle={`${fila.nombre} · ${fila.porcentaje === null ? 'sin datos' : `${formatPorcentaje(fila.porcentaje)} de cumplimiento`}`}
      icon="tarea"
      wide
      onClose={onClose}
      footer={<button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={onClose}>Cerrar</button>}
    >
      <div className="tuvet-ocurrencias">
        {propias.map((ocurrencia) => <OcurrenciaCard key={ocurrencia.id} ocurrencia={ocurrencia} />)}
      </div>
    </Modal>
  )
}

export default function TuvetSeguimientoPage() {
  const [params, setParams] = useSearchParams()
  const vista = VISTAS.some((item) => item.clave === params.get('vista')) ? params.get('vista') : 'tabla'
  const [mes, setMes] = useState(mesActual)
  const [ocurrencias, setOcurrencias] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filtro, setFiltro] = useState('todos')
  const [busqueda, setBusqueda] = useState('')
  const [viendo, setViendo] = useState(null)
  const peticion = useRef(0)

  const cargar = useCallback(async () => {
    const actual = ++peticion.current
    setLoading(true)
    setError('')
    try {
      const respuestas = await Promise.all(ESTADOS_DEL_MES.map((estado) => getRevisiones(mes.year, mes.month, estado)))
      if (actual === peticion.current) setOcurrencias(respuestas.flatMap(listItems))
    } catch (err) {
      if (actual === peticion.current) setError(err.message)
    } finally {
      if (actual === peticion.current) setLoading(false)
    }
  }, [mes])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargar()
  }, [cargar])

  const filas = useMemo(() => resumenPorGerente(ocurrencias), [ocurrencias])
  const general = useMemo(() => resumenGeneral(filas), [filas])
  const columnas = useMemo(() => columnasTablero(ocurrencias), [ocurrencias])

  const termino = normalizar(busqueda.trim())
  const filasVisibles = filas.filter((fila) => (
    FILTROS_GERENTES[filtro].aplica(fila) && (!termino || normalizar(`${fila.nombre} ${fila.gerente.email ?? ''}`).includes(termino))
  ))

  function cambiarVista(clave) {
    const siguientes = new URLSearchParams(params)
    siguientes.set('vista', clave)
    setParams(siguientes, { replace: true })
  }

  const departamento = ocurrencias[0]?.departamento?.nombre

  return (
    <div className="tuvet-page">
      <PageHeader
        title="Seguimiento de tareas"
        description={`${departamento ? `${departamento} · ` : ''}Cumplimiento de los gerentes de sucursal con las plantillas que asignaste.`}
      >
        <div className="tv-vistas" role="group" aria-label="Vista">
          {VISTAS.map((item) => (
            <button
              key={item.clave}
              type="button"
              className={`tv-vista ${vista === item.clave ? 'is-active' : ''}`}
              aria-pressed={vista === item.clave}
              onClick={() => cambiarVista(item.clave)}
            >
              {item.etiqueta}
            </button>
          ))}
        </div>
        <MesSelector value={mes} onChange={setMes} />
        <Link className="tuvet-btn" to="/tuvet/asignar">+ Asignar plantilla</Link>
      </PageHeader>

      <EstadoCarga
        loading={loading}
        error={error}
        onRetry={cargar}
        empty={!filas.length}
        emptyText="Todavía no hay tareas asignadas este mes. Asigna una plantilla a tus gerentes de sucursal para empezar el seguimiento."
        emptyAction={<Link className="tuvet-btn" to="/tuvet/asignar">Asignar plantilla</Link>}
      >
        <section className="tv-kpis" aria-label="Resumen del mes">
          <div className="tv-kpi tv-kpi-principal">
            <div className="tv-kpi-fila">
              <span className="tv-kpi-titulo">Cumplimiento general</span>
              <span className="tuvet-hint">Meta {META_CUMPLIMIENTO} %</span>
            </div>
            <div className="tv-kpi-fila tv-kpi-fila-base">
              <span className="tv-kpi-valor">{general.porcentaje === null ? '—' : formatPorcentaje(general.porcentaje)}</span>
              <span className="tuvet-hint">{general.aprobadas} de {general.total} aprobadas</span>
              <NivelBadge nivel={general.nivel} largo />
            </div>
            <BarraMeta porcentaje={general.porcentaje} nivel={general.nivel} grande />
            {general.faltaParaMeta > 0 && <span className="tv-kpi-detalle tv-texto-acento">Faltan {general.faltaParaMeta} puntos para la meta</span>}
          </div>
          <Kpi titulo="Pendientes" valor={general.pendientes} detalle="en plazo" />
          <Kpi titulo="Vencen pronto" valor={general.vencenPronto} detalle={`${general.vencenHoy} vencen hoy`} tono="acento" />
          <Kpi titulo="Vencidas" valor={general.vencidas} detalle="sin marcar" tono="peligro" />
          <Kpi titulo="Por revisar" valor={general.revision} detalle={<Link to="/tuvet/revisiones">Ir a revisiones</Link>} tono="marca" />
        </section>

        {vista !== 'tablero' && (
          <section className="tv-filtros" aria-label="Filtros">
            <label className="tv-buscador">
              <Icono nombre="buscar" />
              <input type="search" value={busqueda} onChange={(event) => setBusqueda(event.target.value)} placeholder="Buscar gerente de sucursal" aria-label="Buscar gerente de sucursal" />
            </label>
            <div className="tuvet-filtros" role="group" aria-label="Filtrar gerentes">
              {Object.entries(FILTROS_GERENTES).map(([clave, definicion]) => (
                <button
                  key={clave}
                  type="button"
                  className={`tuvet-chip ${filtro === clave ? 'active' : ''}`}
                  aria-pressed={filtro === clave}
                  onClick={() => setFiltro(clave)}
                >
                  {definicion.etiqueta} ({filas.filter(definicion.aplica).length})
                </button>
              ))}
            </div>
          </section>
        )}

        {vista === 'tablero' ? (
          <VistaTablero columnas={columnas} />
        ) : filasVisibles.length ? (
          vista === 'tarjetas'
            ? <VistaTarjetas filas={filasVisibles} onVerGerente={setViendo} />
            : <VistaTabla filas={filasVisibles} onVerGerente={setViendo} />
        ) : (
          <p className="tuvet-state tuvet-state-empty">Ningún gerente coincide con el filtro.</p>
        )}
      </EstadoCarga>

      {viendo && <TareasGerenteModal fila={viendo} ocurrencias={ocurrencias} onClose={() => setViendo(null)} />}
      <span className="tuvet-visually-hidden" aria-live="polite">
        {loading ? '' : `${filasVisibles.length} gerentes de sucursal mostrados${viendo ? `, viendo las tareas de ${nombrePersona(viendo.gerente)}` : ''}`}
      </span>
    </div>
  )
}
