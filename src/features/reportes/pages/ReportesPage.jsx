import { useState, useEffect } from 'react'
import { useAuth } from '../../auth/context/AuthContext'
import { getGerentes } from '../../gerentes/services/gerentesService'
import { getUsuarios } from '../../usuarios/services/usuariosService'
import { generarReporteJson, generarReportePdf } from '../services/reportesService'
import './ReportesPage.css'

const hoy = new Date()
const ANIO_ACTUAL = hoy.getFullYear()
const MES_ACTUAL = hoy.getMonth() + 1
const hace7 = new Date(hoy)
hace7.setDate(hace7.getDate() - 7)
const HACE7_STR = hace7.toISOString().slice(0, 10)

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DIAS_SEMANA = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']

const TIPO_LABEL = {
  vacaciones:       'VAC',
  incapacidad:      'INC',
  permiso_aprobado: 'PER',
  otro_aprobado:    'COM',
  no_aprobada_ga:   'N/A',
}


function contarSituaciones(reportes) {
  let total = 0
  for (const rep of reportes) {
    for (const u of rep.usuarios) {
      const tieneSit = u.dias.some((d) => d.laboral && d.tipo_dia && d.tipo_dia !== 'normal')
      if (tieneSit) total++
    }
  }
  return total
}

function totalUsuarios(reportes) {
  return reportes.reduce((acc, r) => acc + r.usuarios_count, 0)
}

function pctColor(pct) {
  if (pct === null || pct === undefined) return ''
  const n = parseFloat(pct)
  if (n >= 100) return 'pct-excelente'
  if (n >= 90)  return 'pct-bueno'
  if (n >= 80)  return 'pct-regular'
  return 'pct-malo'
}

function generarRango(inicio, fin) {
  const dias = []
  const cur = new Date(inicio + 'T00:00:00')
  const end = new Date(fin + 'T00:00:00')
  while (cur <= end) {
    dias.push(cur.toISOString().slice(0, 10))
    cur.setDate(cur.getDate() + 1)
  }
  return dias
}

function formatFecha(iso) {
  const [, m, d] = iso.split('-')
  return `${parseInt(d)}/${parseInt(m)}`
}

function diaNombre(iso) {
  const d = new Date(iso + 'T00:00:00')
  return DIAS_SEMANA[d.getDay()]
}

export default function ReportesPage() {
  const { perfil } = useAuth()
  const esAdmin = perfil?.es_admin_maestro === true

  const [tipo, setTipo]                   = useState('semanal')
  const [fechaInicio, setFechaInicio]     = useState(HACE7_STR)
  const [anio, setAnio]                   = useState(ANIO_ACTUAL)
  const [mes, setMes]                     = useState(MES_ACTUAL)
  const [idGerenteArea, setIdGerenteArea] = useState('')
  const [idUsuario, setIdUsuario]         = useState('')
  const [enviarCorreo, setEnviarCorreo]   = useState(false)
  const [gerentes, setGerentes]           = useState([])
  const [usuarios, setUsuarios]           = useState([])
  const [loading, setLoading]             = useState(false)
  const [resultado, setResultado]         = useState(null)
  const [error, setError]                 = useState('')
  const [successMsg, setSuccessMsg]       = useState('')

  useEffect(() => {
    if (esAdmin) getGerentes().then(setGerentes).catch(() => {})
  }, [esAdmin])

  useEffect(() => {
    setIdUsuario('')
    const params = esAdmin && idGerenteArea ? { id_gerente_area: idGerenteArea } : {}
    if (esAdmin && !idGerenteArea) { setUsuarios([]); return }
    getUsuarios(params).then(setUsuarios).catch(() => setUsuarios([]))
  }, [esAdmin, idGerenteArea])

  function buildBody() {
    const body = { tipo, enviar_correo: enviarCorreo }
    if (tipo === 'semanal') {
      body.fecha_inicio = fechaInicio
    } else {
      body.anio = parseInt(anio, 10)
      body.mes  = parseInt(mes, 10)
    }
    if (esAdmin && idGerenteArea) body.id_gerente_area = parseInt(idGerenteArea, 10)
    if (idUsuario) body.id_usuario = parseInt(idUsuario, 10)
    return body
  }

  async function handleJson() {
    setError(''); setSuccessMsg(''); setResultado(null); setLoading(true)
    try {
      const data = await generarReporteJson(buildBody())
      setResultado(data.resultado)
      if (data.correos_enviados?.length) {
        setSuccessMsg(`Correo(s) enviado(s) a: ${data.correos_enviados.map((c) => c.email).join(', ')}`)
      }
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  async function handlePdf() {
    setError(''); setSuccessMsg(''); setLoading(true)
    try {
      const { blob, filename, correos: cnt } = await generarReportePdf(buildBody())
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = filename; a.click()
      URL.revokeObjectURL(url)
      setSuccessMsg(`PDF descargado.${cnt > 0 ? ` ${cnt} correo(s) enviado(s).` : ''}`)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="reportes-page">
      <div className="rp-header">
        <h1>Reportes de rendimiento</h1>
        <p>Genera reportes por periodo para tu área o para todas las áreas.</p>
      </div>

      {/* Filtros */}
      <div className="rp-filtros-card">
        <div className="rp-filtros-row">
          <div className="rp-filtro-group">
            <label>Tipo</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="semanal">Semanal</option>
              {esAdmin && <option value="quincenal">Quincenal</option>}
              {esAdmin && <option value="mensual">Mensual</option>}
            </select>
          </div>

          {tipo === 'semanal' ? (
            <div className="rp-filtro-group">
              <label>Fecha de inicio</label>
              <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
            </div>
          ) : (
            <>
              <div className="rp-filtro-group" style={{ width: 90 }}>
                <label>Año</label>
                <input type="number" value={anio} min="2020" max={ANIO_ACTUAL} onChange={(e) => setAnio(e.target.value)} />
              </div>
              <div className="rp-filtro-group">
                <label>Mes</label>
                <select value={mes} onChange={(e) => setMes(e.target.value)}>
                  {MESES.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
                </select>
              </div>
            </>
          )}

          {esAdmin && (
            <div className="rp-filtro-group">
              <label>Gerente de área</label>
              <select value={idGerenteArea} onChange={(e) => setIdGerenteArea(e.target.value)}>
                <option value="">Todos</option>
                {gerentes.map((g) => (
                  <option key={g.id_gerente_area} value={g.id_gerente_area}>{g.nombre}</option>
                ))}
              </select>
            </div>
          )}

          {usuarios.length > 0 && (
            <div className="rp-filtro-group">
              <label>Usuario</label>
              <select value={idUsuario} onChange={(e) => setIdUsuario(e.target.value)}>
                <option value="">Todos</option>
                {usuarios.map((u) => (
                  <option key={u.id_usuario} value={u.id_usuario}>{u.nombre}</option>
                ))}
              </select>
            </div>
          )}

          <label className="rp-filtro-check">
            <input type="checkbox" checked={enviarCorreo} onChange={(e) => setEnviarCorreo(e.target.checked)} />
            Enviar por correo
          </label>
        </div>

        <div className="rp-filtros-actions">
          <button className="rp-btn-ver" onClick={handleJson} disabled={loading}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
            {loading ? 'Generando...' : 'Ver reporte'}
          </button>
          <button className="rp-btn-pdf" onClick={handlePdf} disabled={loading}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
              <line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>
            </svg>
            {loading ? 'Generando...' : 'Descargar PDF'}
          </button>
          {error      && <span className="rp-error">{error}</span>}
          {successMsg && <span className="rp-success">{successMsg}</span>}
        </div>
      </div>

      {/* Resultados */}
      {resultado && <ResultadoReporte resultado={resultado} />}
    </div>
  )
}

function ResultadoReporte({ resultado }) {
  const { tipo, fecha_inicio, fecha_fin, reportes } = resultado
  const totalU   = totalUsuarios(reportes)
  const totalSit = contarSituaciones(reportes)
  const promedioGlobal = reportes.length === 1
    ? parseFloat(reportes[0].promedio_general)
    : reportes.reduce((acc, r) => acc + parseFloat(r.promedio_general), 0) / reportes.length

  return (
    <div className="rp-resultado">
      {/* Periodo banner */}
      <div className="rp-periodo-banner">
        <span className="rp-tipo-badge">{tipo.charAt(0).toUpperCase() + tipo.slice(1)}</span>
        <span>Período: <strong>{formatFecha(fecha_inicio)}/{fecha_inicio.slice(0,4)} — {formatFecha(fecha_fin)}/{fecha_fin.slice(0,4)}</strong></span>
        {reportes.length > 1 && <span>{reportes.length} áreas incluidas</span>}
      </div>

      {/* KPI cards (globales si hay un solo reporte) */}
      {reportes.length === 1 && (
        <KpiCards
          promedio={promedioGlobal}
          usuarios={totalU}
          dias={reportes[0].dias_periodo}
          situaciones={totalSit}
        />
      )}

      {reportes.map((rep, i) => (
        <ReporteArea key={i} reporte={rep} tipo={tipo} mostrarHeader={reportes.length > 1} />
      ))}
    </div>
  )
}

function KpiCards({ promedio, usuarios, dias, situaciones }) {
  return (
    <div className="rp-kpis">
      <div className="rp-kpi">
        <div className={`rp-kpi-valor ${pctColor(promedio)}`}>{parseFloat(promedio).toFixed(2)}%</div>
        <div className="rp-kpi-label">Promedio general</div>
      </div>
      <div className="rp-kpi">
        <div className="rp-kpi-valor">{usuarios}</div>
        <div className="rp-kpi-label">Gerentes evaluados</div>
      </div>
      <div className="rp-kpi">
        <div className="rp-kpi-valor">{dias}</div>
        <div className="rp-kpi-label">Días del período</div>
      </div>
      <div className="rp-kpi">
        <div className="rp-kpi-valor rp-kpi-sit">{situaciones}</div>
        <div className="rp-kpi-label">Con sit. especiales</div>
      </div>
    </div>
  )
}

function ReporteArea({ reporte, tipo, mostrarHeader }) {
  const totalSit = contarSituaciones([reporte])
  const promedio = parseFloat(reporte.promedio_general)

  return (
    <div className="rp-area-card">
      {mostrarHeader && (
        <div className="rp-area-header">
          <div>
            <h3>{reporte.gerente_area.nombre}</h3>
            <span>{reporte.gerente_area.email}</span>
          </div>
          <div className="rp-area-kpis-mini">
            <div className="rp-kpi-mini">
              <span className={`rp-kpi-mini-val ${pctColor(promedio)}`}>{promedio.toFixed(2)}%</span>
              <span>Promedio</span>
            </div>
            <div className="rp-kpi-mini">
              <span className="rp-kpi-mini-val">{reporte.usuarios_count}</span>
              <span>Gerentes</span>
            </div>
            <div className="rp-kpi-mini">
              <span className="rp-kpi-mini-val">{totalSit}</span>
              <span>Sit. esp.</span>
            </div>
          </div>
        </div>
      )}

      {tipo === 'semanal'
        ? <TablaSemanal reporte={reporte} />
        : <TablaRanking reporte={reporte} />
      }
    </div>
  )
}

function TablaSemanal({ reporte }) {
  const rango = generarRango(reporte.fecha_inicio, reporte.fecha_fin)

  const usuariosOrdenados = [...reporte.usuarios].sort(
    (a, b) => parseFloat(b.porcentaje_periodo) - parseFloat(a.porcentaje_periodo)
  )

  return (
    <div className="rp-table-wrap">
      <table className="rp-table rp-table-semanal">
        <thead>
          <tr>
            <th className="th-usuario">Usuario</th>
            <th className="th-sucursal">Sucursal</th>
            {rango.map((fecha) => (
              <th key={fecha} className="th-dia">
                <span className="dia-nombre">{diaNombre(fecha)}</span>
                <span className="dia-fecha">{formatFecha(fecha)}</span>
              </th>
            ))}
            <th className="th-promedio">Promedio</th>
          </tr>
        </thead>
        <tbody>
          {usuariosOrdenados.map((u, i) => {
            const diaMap = {}
            for (const d of u.dias) diaMap[d.fecha] = d
            const sucursal = u.sucursal_principal || '—'
            const pct = parseFloat(u.porcentaje_periodo)
            return (
              <tr key={i}>
                <td className="td-usuario">{u.usuario?.nombre ?? '—'}</td>
                <td className="td-sucursal">{sucursal}</td>
                {rango.map((fecha) => {
                  const dia = diaMap[fecha]
                  return <td key={fecha}><CeldaDia dia={dia} /></td>
                })}
                <td className={`td-promedio ${pctColor(pct)}`}>
                  {pct === 0 ? '—' : `${pct.toFixed(pct % 1 === 0 ? 0 : 2)}%`}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <LeyendaSimbolos />
    </div>
  )
}

function LeyendaSimbolos() {
  return (
    <p className="rp-leyenda">
      <span>— sin dato</span>
      <span><b>N/L</b> aun no laboraba (sin sucursal asignada o sucursal cerrada ese dia)</span>
      <span><b>VAC</b> vacaciones</span>
      <span><b>INC</b> incapacidad</span>
      <span><b>PER</b> permiso aprobado</span>
      <span><b>COM</b> otro aprobado</span>
      <span><b>N/A</b> no aprobada por GA</span>
    </p>
  )
}

function CeldaDia({ dia }) {
  if (!dia) return <span className="celda celda-vacia">—</span>
  if (!dia.laboral) return <span className="celda celda-no-laboral" title={dia.motivo_no_laboral || undefined}>N/L</span>

  const tipo = dia.tipo_dia
  const sucursalTitle = dia.sucursales?.length
    ? dia.sucursales.map((s) => s.tipo === 'temporal' ? `${s.nombre} (temporal)` : s.nombre).join(', ')
    : undefined

  if (tipo && tipo !== 'normal') {
    const label = TIPO_LABEL[tipo] ?? tipo.slice(0, 3).toUpperCase()
    return <span className="celda celda-especial" title={dia.motivo_dia_especial || tipo}>{label}</span>
  }

  if (!dia.rendimiento_id) return <span className="celda celda-sin-datos" title={sucursalTitle}>—</span>

  const pct = parseFloat(dia.porcentaje_dia)
  const cls = pctColor(pct)
  const esTemporal = dia.sucursales?.some((s) => s.tipo === 'temporal')
  return (
    <span className={`celda ${cls}${esTemporal ? ' celda-temporal' : ''}`} title={sucursalTitle}>
      {pct === 100 ? '100%' : `${pct.toFixed(pct % 1 === 0 ? 0 : 1)}%`}
    </span>
  )
}

function TablaRanking({ reporte }) {
  const usuariosOrdenados = [...reporte.usuarios].sort(
    (a, b) => parseFloat(b.porcentaje_periodo) - parseFloat(a.porcentaje_periodo)
  )

  const top5    = usuariosOrdenados.slice(0, 5)
  const bottom5 = usuariosOrdenados.length >= 5
    ? [...usuariosOrdenados].reverse().slice(0, 5).reverse()
    : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {usuariosOrdenados.length >= 6 && (
        <div className="rp-rankings">
          <MiniRanking titulo="Top 5" icono="🏆" usuarios={top5} tipo="top" />
          <MiniRanking titulo="Bottom 5" icono="📉" usuarios={bottom5} tipo="bottom" />
        </div>
      )}

      <div className="rp-table-wrap">
        <table className="rp-table">
          <thead>
            <tr>
              <th style={{ width: 40 }}>#</th>
              <th>Gerente</th>
              <th>Sucursal</th>
              <th>Rendimiento</th>
              <th>Días lab.</th>
              <th>Días no lab.</th>
              <th>Sit. esp.</th>
            </tr>
          </thead>
          <tbody>
            {usuariosOrdenados.map((u, i) => {
              const pct  = parseFloat(u.porcentaje_periodo)
              const sit  = u.dias.filter((d) => d.laboral && d.tipo_dia && d.tipo_dia !== 'normal').length
              const suc  = u.sucursal_principal || '—'
              return (
                <tr key={i}>
                  <td className="td-pos">{i + 1}</td>
                  <td className="td-usuario">{u.usuario?.nombre ?? '—'}</td>
                  <td className="td-sucursal">{suc}</td>
                  <td>
                    <div className="rp-score-wrap">
                      <div className="rp-score-bg">
                        <div className={`rp-score-fill ${pctColor(pct)}-fill`} style={{ width: `${Math.min(pct, 100)}%` }} />
                      </div>
                      <span className={`rp-score-pct ${pctColor(pct)}`}>{pct.toFixed(2)}%</span>
                    </div>
                  </td>
                  <td>{u.dias_laborales}</td>
                  <td>{u.dias_no_laborales}</td>
                  <td>{sit > 0 ? sit : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function MiniRanking({ titulo, icono, usuarios, tipo }) {
  return (
    <div className={`rp-mini-ranking ${tipo}`}>
      <div className="rp-mini-ranking-title">{icono} {titulo}</div>
      <table className="rp-mini-table">
        <thead>
          <tr><th>#</th><th>Gerente</th><th>Rendimiento</th></tr>
        </thead>
        <tbody>
          {usuarios.map((u, i) => {
            const pct = parseFloat(u.porcentaje_periodo)
            return (
              <tr key={i}>
                <td>{i + 1}</td>
                <td>{u.usuario?.nombre ?? '—'}</td>
                <td className={pctColor(pct)}>{pct.toFixed(2)}%</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
