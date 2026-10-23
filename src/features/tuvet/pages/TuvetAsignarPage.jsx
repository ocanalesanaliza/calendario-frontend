import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Avatar, Aviso, EstadoCarga, Icono, PageHeader } from '../components/TuvetUi'
import { useConfirmacion } from '../components/useConfirmacion'
import {
  asignarPlantilla,
  desasignar,
  getAsignacionesPlantilla,
  getGerentesSucursal,
  getGerentesSucursalDisponibles,
  getPlantillas,
  listItems,
} from '../services/tuvetService'
import { describirProgramacion, formatFecha, nombrePersona } from '../utils/formato'

const normalizar = (texto) => String(texto ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

function Pasos({ actual }) {
  const pasos = ['Plantilla', 'Gerentes', 'Confirmar']
  return (
    <ol className="tv-pasos" aria-label="Pasos">
      {pasos.map((paso, indice) => {
        const numero = indice + 1
        const estado = numero < actual ? 'hecho' : numero === actual ? 'actual' : 'pendiente'
        return (
          <li key={paso} className={`tv-paso tv-paso-${estado}`} aria-current={estado === 'actual' ? 'step' : undefined}>
            <span className="tv-paso-numero">{estado === 'hecho' ? <Icono nombre="check" /> : numero}</span>
            {paso}
          </li>
        )
      })}
    </ol>
  )
}

export default function TuvetAsignarPage() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const [plantillas, setPlantillas] = useState([])
  const [disponibles, setDisponibles] = useState([])
  const [dependientes, setDependientes] = useState([])
  const [asignaciones, setAsignaciones] = useState([])
  const [seleccion, setSeleccion] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [soloDependientes, setSoloDependientes] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingAsignaciones, setLoadingAsignaciones] = useState(false)
  const [error, setError] = useState('')
  const [errorAccion, setErrorAccion] = useState('')
  const [aviso, setAviso] = useState('')
  const [asignando, setAsignando] = useState(false)
  const [confirmar, dialogo] = useConfirmacion()

  const plantillaId = Number(params.get('plantilla')) || null
  const plantilla = plantillas.find((item) => item.id === plantillaId) ?? null

  const cargar = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [listaPlantillas, listaDisponibles, listaDependientes] = await Promise.all([
        getPlantillas(),
        getGerentesSucursalDisponibles(),
        getGerentesSucursal().catch(() => []),
      ])
      setPlantillas(listItems(listaPlantillas).filter((item) => item.activa))
      setDisponibles(listItems(listaDisponibles))
      setDependientes(listItems(listaDependientes))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const cargarAsignaciones = useCallback(async () => {
    if (!plantillaId) {
      setAsignaciones([])
      return
    }
    setLoadingAsignaciones(true)
    try {
      setAsignaciones(listItems(await getAsignacionesPlantilla(plantillaId)))
    } catch (err) {
      setErrorAccion(err.message)
    } finally {
      setLoadingAsignaciones(false)
    }
  }, [plantillaId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargar()
  }, [cargar])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargarAsignaciones()
  }, [cargarAsignaciones])

  const activasPorGerente = useMemo(
    () => new Map(asignaciones.filter((item) => item.activa).map((item) => [item.gerente_sucursal?.id, item])),
    [asignaciones],
  )
  const idsDependientes = useMemo(() => new Set(dependientes.map((gerente) => gerente.id)), [dependientes])

  const termino = normalizar(busqueda.trim())
  const gerentesVisibles = disponibles.filter((gerente) => (
    (!soloDependientes || idsDependientes.has(gerente.id))
    && (!termino || normalizar(`${nombrePersona(gerente)} ${gerente.email ?? ''}`).includes(termino))
  ))
  const seleccionables = gerentesVisibles.filter((gerente) => !activasPorGerente.has(gerente.id))

  function elegirPlantilla(id) {
    setSeleccion([])
    setAviso('')
    setErrorAccion('')
    setParams({ plantilla: String(id) }, { replace: true })
  }

  function alternar(id) {
    setSeleccion((actual) => (actual.includes(id) ? actual.filter((item) => item !== id) : [...actual, id]))
  }

  async function asignar() {
    if (!plantilla || !seleccion.length) return
    setAsignando(true)
    setAviso('')
    setErrorAccion('')
    try {
      const resultado = await asignarPlantilla(plantilla.id, seleccion)
      setSeleccion([])
      setAviso(resultado?.created_count
        ? `“${plantilla.nombre}” asignada a ${resultado.created_count} gerente(s) de sucursal. Sus tareas del mes ya están generadas.`
        : 'Los gerentes seleccionados ya tenían esta plantilla asignada.')
      await cargarAsignaciones()
    } catch (err) {
      setErrorAccion(err.message)
    } finally {
      setAsignando(false)
    }
  }

  async function quitar(gerente, asignacion) {
    setAviso('')
    setErrorAccion('')
    const confirmado = await confirmar({
      title: 'Quitar asignación',
      message: `¿Quitar “${plantilla.nombre}” a ${nombrePersona(gerente)}?`,
      detail: 'Se cancelarán sus ocurrencias futuras pendientes. Las tareas ya realizadas se conservan.',
      confirmLabel: 'Quitar',
      accion: () => desasignar(asignacion.id),
    })
    if (!confirmado) return
    setAviso(`Se retiró “${plantilla.nombre}” a ${nombrePersona(gerente)}.`)
    await cargarAsignaciones()
  }

  const yaLaTienen = activasPorGerente.size
  const paso = !plantilla ? 1 : seleccion.length ? 3 : 2

  return (
    <div className="tuvet-page">
      <PageHeader title="Asignar tareas" description="Elige una plantilla y los gerentes de sucursal que deben realizarla.">
        <Pasos actual={paso} />
      </PageHeader>
      <Link className="tv-volver" to="/tuvet/seguimiento">‹ Volver al seguimiento</Link>

      <Aviso tipo="success">{aviso}</Aviso>
      <Aviso tipo="error">{errorAccion}</Aviso>

      <EstadoCarga
        loading={loading}
        error={error}
        onRetry={cargar}
        empty={!plantillas.length}
        emptyText="No tienes plantillas activas. Crea una plantilla con tus tareas para poder asignarla."
        emptyAction={<Link className="tuvet-btn" to="/tuvet/plantillas">Ir a plantillas</Link>}
      >
        <div className="tv-asignar">
          <section className="tv-panel" aria-labelledby="tv-paso-plantilla">
            <h2 id="tv-paso-plantilla">1. Plantilla</h2>
            <div className="tv-plantillas" role="radiogroup" aria-label="Plantilla">
              {plantillas.map((item) => (
                <label key={item.id} className={`tv-plantilla ${item.id === plantillaId ? 'is-selected' : ''}`}>
                  <input type="radio" name="plantilla" checked={item.id === plantillaId} onChange={() => elegirPlantilla(item.id)} />
                  <span className="tv-persona">
                    <strong>{item.nombre}</strong>
                    <span className="tuvet-hint">{item.tareas?.length ?? 0} tarea(s){item.departamento?.nombre ? ` · ${item.departamento.nombre}` : ''}</span>
                  </span>
                </label>
              ))}
            </div>
            {plantilla && (
              <div className="tv-incluye">
                <h3>Incluye</h3>
                {plantilla.tareas?.length ? (
                  <ul>
                    {plantilla.tareas.map((tarea) => (
                      <li key={tarea.id}>{tarea.nombre} <span className="tuvet-hint">· {describirProgramacion(tarea)}</span></li>
                    ))}
                  </ul>
                ) : <p className="tuvet-hint">Esta plantilla no tiene tareas. Agrégalas en Plantillas antes de asignarla.</p>}
              </div>
            )}
          </section>

          <section className="tv-panel tv-panel-ancho" aria-labelledby="tv-paso-gerentes">
            <div className="tv-panel-cabecera">
              <h2 id="tv-paso-gerentes">2. Gerentes de sucursal</h2>
              <span className="tuvet-select-count" aria-live="polite">{seleccion.length} seleccionado(s)</span>
            </div>
            {!plantilla ? (
              <p className="tuvet-state tuvet-state-empty">Elige primero una plantilla.</p>
            ) : (
              <>
                <div className="tv-filtros">
                  <label className="tv-buscador">
                    <Icono nombre="buscar" />
                    <input type="search" value={busqueda} onChange={(event) => setBusqueda(event.target.value)} placeholder="Buscar por nombre o correo" aria-label="Buscar gerente de sucursal" />
                  </label>
                  <button
                    type="button"
                    className="tuvet-btn tuvet-btn-secondary"
                    onClick={() => setSeleccion((actual) => [...new Set([...actual, ...seleccionables.map((gerente) => gerente.id)])])}
                    disabled={!seleccionables.length}
                  >
                    Seleccionar todos
                  </button>
                  {dependientes.length > 0 && (
                    <button
                      type="button"
                      className={`tuvet-chip ${soloDependientes ? 'active' : ''}`}
                      aria-pressed={soloDependientes}
                      onClick={() => setSoloDependientes((valor) => !valor)}
                    >
                      Solo los que dependen de mí ({dependientes.length})
                    </button>
                  )}
                </div>
                <div className="tv-gerentes">
                  {gerentesVisibles.map((gerente) => {
                    const asignacion = activasPorGerente.get(gerente.id)
                    const marcado = seleccion.includes(gerente.id)
                    return (
                      <div key={gerente.id} className={`tv-gerente ${marcado ? 'is-selected' : ''} ${asignacion ? 'is-asignado' : ''}`}>
                        <label className="tv-gerente-label">
                          <input
                            type="checkbox"
                            checked={Boolean(asignacion) || marcado}
                            disabled={Boolean(asignacion) || asignando}
                            onChange={() => alternar(gerente.id)}
                          />
                          <Avatar persona={gerente} size="sm" />
                          <span className="tv-persona">
                            <strong>{nombrePersona(gerente)}</strong>
                            <span className="tuvet-hint">{gerente.email}</span>
                          </span>
                        </label>
                        {asignacion ? (
                          <>
                            <span className="tuvet-tag">Ya la tiene · desde {formatFecha(asignacion.fecha_inicio)}</span>
                            <button type="button" className="tuvet-btn tuvet-btn-danger" onClick={() => quitar(gerente, asignacion)}>Quitar</button>
                          </>
                        ) : marcado && <span className="tuvet-badge tuvet-badge-en_revision">Se asignará</span>}
                      </div>
                    )
                  })}
                  {!gerentesVisibles.length && <p className="tuvet-state">Ningún gerente coincide con la búsqueda.</p>}
                </div>
              </>
            )}
          </section>

          <aside className="tv-panel tv-resumen" aria-labelledby="tv-paso-resumen">
            <h2 id="tv-paso-resumen">3. Resumen</h2>
            <dl>
              <div><dt>Plantilla</dt><dd>{plantilla?.nombre ?? '—'}</dd></div>
              <div><dt>Tareas</dt><dd>{plantilla?.tareas?.length ?? 0}</dd></div>
              <div><dt>Gerentes nuevos</dt><dd>{seleccion.length}</dd></div>
              <div><dt>Ya la tenían</dt><dd>{loadingAsignaciones ? '…' : yaLaTienen}</dd></div>
            </dl>
            <p className="tv-resumen-nota">
              Se generarán sus tareas desde hoy hasta fin de mes. Las que requieran aprobación llegarán a tus revisiones cuando se marquen.
            </p>
            <button
              type="button"
              className="tuvet-btn tv-resumen-boton"
              onClick={asignar}
              disabled={!plantilla || !seleccion.length || asignando || !plantilla.tareas?.length}
              aria-busy={asignando}
            >
              {asignando ? 'Asignando...' : seleccion.length ? `Asignar a ${seleccion.length} gerente(s)` : 'Selecciona gerentes'}
            </button>
            <button type="button" className="tuvet-btn tuvet-btn-ghost" onClick={() => navigate('/tuvet/seguimiento')}>Cancelar</button>
          </aside>
        </div>
      </EstadoCarga>
      {dialogo}
    </div>
  )
}
