import { Link } from 'react-router-dom'
import { formatPorcentaje } from '../utils/formato'
import { META_CUMPLIMIENTO } from '../utils/seguimiento'
import { Avatar, Icono } from './TuvetUi'

// Barra de cumplimiento contra la meta (bullet chart): valor + marcador de meta + texto.
export function BarraMeta({ porcentaje, nivel, grande = false }) {
  const valor = Math.max(0, Math.min(100, porcentaje ?? 0))
  return (
    <div
      className={`tv-meta ${grande ? 'tv-meta-grande' : ''}`}
      role="img"
      aria-label={porcentaje === null ? 'Sin tareas este mes' : `${formatPorcentaje(porcentaje)} de cumplimiento; meta ${META_CUMPLIMIENTO} %`}
    >
      <div className={`tv-meta-relleno tv-nivel-${nivel.clave}`} style={{ width: `${valor}%` }} />
      <div className="tv-meta-marca" style={{ left: `${META_CUMPLIMIENTO}%` }} aria-hidden="true" />
    </div>
  )
}

export function NivelBadge({ nivel, largo = false }) {
  return <span className={`tv-nivel-badge tv-nivel-badge-${nivel.clave}`}>{largo ? nivel.etiquetaLarga : nivel.etiqueta}</span>
}

// Reparto de estados del mes (barra 100 % apilada). El texto alternativo enumera cada valor.
export function BarraEstados({ fila }) {
  const segmentos = [
    ['aprobadas', fila.aprobadas],
    ['revision', fila.revision],
    ['pendientes', fila.pendientes],
    ['vencidas', fila.vencidas],
  ].filter(([, valor]) => valor > 0)
  const resumen = `${fila.aprobadas} aprobadas, ${fila.revision} en revisión, ${fila.pendientes} pendientes, ${fila.vencidas} vencidas`
  return (
    <div className="tv-estados" role="img" aria-label={resumen}>
      {segmentos.map(([clave, valor]) => (
        <div key={clave} className={`tv-estados-seg tv-estados-${clave}`} style={{ width: `${(valor / fila.total) * 100}%` }} />
      ))}
      <div className="tv-meta-marca" style={{ left: `${META_CUMPLIMIENTO}%` }} aria-hidden="true" />
    </div>
  )
}

export function LeyendaEstados() {
  return (
    <div className="tv-leyenda">
      <span className="tv-leyenda-titulo">Leyenda</span>
      <span><i className="tv-estados-aprobadas" aria-hidden="true" />Aprobadas</span>
      <span><i className="tv-estados-revision" aria-hidden="true" />En revisión</span>
      <span><i className="tv-estados-pendientes" aria-hidden="true" />Pendientes</span>
      <span><i className="tv-estados-vencidas" aria-hidden="true" />Vencidas</span>
      <span className="tv-leyenda-meta">La línea vertical marca la meta del {META_CUMPLIMIENTO} %</span>
    </div>
  )
}

function UrgenciaChip({ tarea }) {
  return <span className={`tv-urgencia tv-urgencia-${tarea.urgencia}`}>{tarea.cuando}</span>
}

function EstadoChips({ fila }) {
  return (
    <div className="tv-chips">
      <span className="tuvet-badge tuvet-badge-aprobada"><Icono nombre="check" className="tuvet-badge-icon" />{fila.aprobadas} aprobadas</span>
      {fila.revision > 0 && <span className="tuvet-badge tuvet-badge-en_revision">{fila.revision} en revisión</span>}
      {fila.pendientes > 0 && <span className="tuvet-badge tuvet-badge-pendiente">{fila.pendientes} pendientes</span>}
      {fila.vencidas > 0 && <span className="tuvet-badge tuvet-badge-vencida"><Icono nombre="alerta" className="tuvet-badge-icon" />{fila.vencidas} vencidas</span>}
    </div>
  )
}

// ── Opción A: tabla de seguimiento ──
export function VistaTabla({ filas, onVerGerente }) {
  return (
    <div className="tuvet-card tv-tabla-card">
      <div className="tuvet-table-wrap">
        <table className="tuvet-table tv-tabla">
          <thead>
            <tr>
              <th scope="col">Gerente de sucursal</th>
              <th scope="col" className="tv-col-cumplimiento">Cumplimiento</th>
              <th scope="col">Estado del mes</th>
              <th scope="col">Próxima a vencer</th>
              <th scope="col"><span className="tuvet-visually-hidden">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            {filas.map((fila) => (
              <tr key={fila.gerente.id}>
                <td>
                  <span className="tuvet-persona-cell">
                    <Avatar persona={fila.gerente} />
                    <span className="tv-persona">
                      <strong>{fila.nombre}</strong>
                      <span className="tuvet-hint">{fila.total} tareas este mes</span>
                    </span>
                  </span>
                </td>
                <td>
                  <div className="tv-cumplimiento">
                    <span className="tv-cumplimiento-valor">{fila.porcentaje === null ? '—' : formatPorcentaje(fila.porcentaje)}</span>
                    <BarraMeta porcentaje={fila.porcentaje} nivel={fila.nivel} />
                    <NivelBadge nivel={fila.nivel} />
                  </div>
                </td>
                <td><EstadoChips fila={fila} /></td>
                <td>
                  {fila.proxima ? (
                    <span className="tv-persona">
                      <strong>{fila.proxima.nombre}</strong>
                      <UrgenciaChip tarea={fila.proxima} />
                    </span>
                  ) : <span className="tuvet-hint">Nada pendiente</span>}
                </td>
                <td className="tuvet-cell-acciones">
                  <button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={() => onVerGerente(fila)}>Ver tareas</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Opción B: tarjetas por gerente ──
export function VistaTarjetas({ filas, onVerGerente }) {
  return (
    <>
      <LeyendaEstados />
      <div className="tv-tarjetas">
        {filas.map((fila) => (
          <article key={fila.gerente.id} className={`tv-tarjeta ${fila.vencidas > 0 ? 'tv-tarjeta-alerta' : ''}`}>
            <header className="tv-tarjeta-cabecera">
              <Avatar persona={fila.gerente} />
              <div className="tv-persona">
                <h2>{fila.nombre}</h2>
                <span className="tuvet-hint">{fila.total} tareas este mes</span>
              </div>
              <div className="tv-tarjeta-pct">
                <span>{fila.porcentaje === null ? '—' : formatPorcentaje(fila.porcentaje)}</span>
                <NivelBadge nivel={fila.nivel} largo />
              </div>
            </header>

            <BarraEstados fila={fila} />

            <dl className="tv-contadores">
              <div><dt>Aprobadas</dt><dd>{fila.aprobadas}</dd></div>
              <div><dt>Revisión</dt><dd>{fila.revision}</dd></div>
              <div><dt>Pendientes</dt><dd>{fila.pendientes}</dd></div>
              <div className={fila.vencidas > 0 ? 'tv-contador-alerta' : ''}><dt>Vencidas</dt><dd>{fila.vencidas}</dd></div>
            </dl>

            <div className="tv-proximas">
              <h3>Próximas a vencer</h3>
              {fila.porVencer.length ? (
                <ul>
                  {fila.porVencer.slice(0, 2).map((tarea) => (
                    <li key={tarea.id}>
                      <span>{tarea.nombre}</span>
                      <UrgenciaChip tarea={tarea} />
                    </li>
                  ))}
                </ul>
              ) : <p className="tuvet-hint">Nada pendiente.</p>}
            </div>

            <button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={() => onVerGerente(fila)}>Ver sus tareas</button>
          </article>
        ))}
      </div>
    </>
  )
}

// ── Opción C: tablero por urgencia ──
export function VistaTablero({ columnas }) {
  return (
    <div className="tv-tablero">
      {columnas.map((columna) => (
        <section key={columna.clave} className="tv-columna" aria-labelledby={`tv-col-${columna.clave}`}>
          <header className="tv-columna-cabecera">
            <h2 id={`tv-col-${columna.clave}`} className={`tv-columna-titulo tv-urgencia-texto-${columna.clave}`}>
              <span className={`tv-punto tv-punto-${columna.clave}`} aria-hidden="true" />
              {columna.titulo}
            </h2>
            <span className="tv-columna-total">{columna.tareas.length}</span>
          </header>
          <p className="tv-columna-ayuda">{columna.ayuda}</p>
          {columna.tareas.length ? columna.tareas.map((tarea) => (
            <article key={tarea.id} className="tv-tarea">
              <div className="tv-tarea-cabecera">
                <h3>{tarea.nombre}</h3>
                <UrgenciaChip tarea={tarea} />
              </div>
              <div className="tv-tarea-gerente">
                <Avatar persona={tarea.gerente_sucursal} size="sm" />
                <span>{tarea.gerente_sucursal?.nombre_completo ?? tarea.gerente_sucursal?.nombre}</span>
              </div>
              <div className="tv-chips">
                {tarea.plantilla?.nombre && <span className="tuvet-tag">{tarea.plantilla.nombre}</span>}
                {tarea.requiere_documento && <span className="tuvet-tag">Con documento</span>}
              </div>
              {columna.clave === 'revision' && (
                <Link className="tuvet-btn" to="/tuvet/revisiones">Revisar</Link>
              )}
            </article>
          )) : <p className="tv-columna-vacia">Nada aquí.</p>}
        </section>
      ))}
    </div>
  )
}
