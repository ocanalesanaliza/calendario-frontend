import { useState, useEffect } from 'react'
import { useAuth } from '../../auth/context/AuthContext'
import { getGerentes } from '../../gerentes/services/gerentesService'
import { generarReporteJson, generarReportePdf } from '../services/reportesService'
import './ReportesPage.css'

const hoy = new Date()
const ANIO_ACTUAL = hoy.getFullYear()
const MES_ACTUAL = hoy.getMonth() + 1
// semanal: default a hace 7 días para que el rango completo sea pasado
const hace7 = new Date(hoy)
hace7.setDate(hace7.getDate() - 7)
const HACE7_STR = hace7.toISOString().slice(0, 10)

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

function scoreColor(pct) {
  const n = parseFloat(pct)
  if (n >= 80) return 'high'
  if (n >= 50) return 'mid'
  return 'low'
}

function scoreBarClass(pct) {
  const n = parseFloat(pct)
  if (n >= 80) return 'score-fill-high'
  if (n >= 50) return 'score-fill-mid'
  return 'score-fill-low'
}

export default function ReportesPage() {
  const { perfil } = useAuth()
  const esAdmin = perfil?.es_admin_maestro === true

  const [tipo, setTipo]                   = useState('semanal')
  const [fechaInicio, setFechaInicio]     = useState(HACE7_STR)
  const [anio, setAnio]                   = useState(ANIO_ACTUAL)
  const [mes, setMes]                     = useState(MES_ACTUAL)
  const [idGerenteArea, setIdGerenteArea] = useState('')
  const [enviarCorreo, setEnviarCorreo]   = useState(false)
  const [gerentes, setGerentes]           = useState([])
  const [loading, setLoading]             = useState(false)
  const [resultado, setResultado]         = useState(null)
  const [correos, setCorreos]             = useState([])
  const [error, setError]                 = useState('')
  const [successMsg, setSuccessMsg]       = useState('')

  useEffect(() => {
    if (esAdmin) {
      getGerentes().then(setGerentes).catch(() => {})
    }
  }, [esAdmin])

  function buildBody() {
    const body = { tipo, enviar_correo: enviarCorreo }
    if (tipo === 'semanal') {
      body.fecha_inicio = fechaInicio
    } else {
      body.anio = parseInt(anio, 10)
      body.mes  = parseInt(mes, 10)
    }
    if (esAdmin && idGerenteArea) {
      body.id_gerente_area = parseInt(idGerenteArea, 10)
    }
    return body
  }

  async function handleJson() {
    setError('')
    setSuccessMsg('')
    setResultado(null)
    setCorreos([])
    setLoading(true)
    try {
      const data = await generarReporteJson(buildBody())
      setResultado(data.resultado)
      setCorreos(data.correos_enviados ?? [])
      if (data.correos_enviados?.length) {
        setSuccessMsg(`Correo(s) enviado(s) a: ${data.correos_enviados.map((c) => c.email).join(', ')}`)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handlePdf() {
    setError('')
    setSuccessMsg('')
    setLoading(true)
    try {
      const { blob, filename, correos: cnt } = await generarReportePdf(buildBody())
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
      if (cnt > 0) {
        setSuccessMsg(`PDF descargado. ${cnt} correo(s) enviado(s).`)
      } else {
        setSuccessMsg('PDF descargado correctamente.')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="reportes-page">
      <div className="page-header">
        <div>
          <h1>Reportes de rendimiento</h1>
          <p>Genera reportes por periodo para tu área o para todas las áreas.</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="filtros-card">
        <div className="filtros-row">
          <div className="filtro-group">
            <label>Tipo de reporte</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="semanal">Semanal</option>
              {esAdmin && <option value="quincenal">Quincenal</option>}
              {esAdmin && <option value="mensual">Mensual</option>}
            </select>
          </div>

          {tipo === 'semanal' ? (
            <div className="filtro-group">
              <label>Fecha de inicio</label>
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
              />
            </div>
          ) : (
            <>
              <div className="filtro-group">
                <label>Año</label>
                <input
                  type="number"
                  value={anio}
                  min="2020"
                  max={ANIO_ACTUAL}
                  onChange={(e) => setAnio(e.target.value)}
                  style={{ width: 90 }}
                />
              </div>
              <div className="filtro-group">
                <label>Mes</label>
                <select value={mes} onChange={(e) => setMes(e.target.value)}>
                  {MESES.map((m, i) => (
                    <option key={i + 1} value={i + 1}>{m}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {esAdmin && (
            <div className="filtro-group">
              <label>Gerente de área</label>
              <select value={idGerenteArea} onChange={(e) => setIdGerenteArea(e.target.value)}>
                <option value="">Todos</option>
                {gerentes.map((g) => (
                  <option key={g.id_gerente_area} value={g.id_gerente_area}>
                    {g.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}

          <label className="filtro-check">
            <input
              type="checkbox"
              checked={enviarCorreo}
              onChange={(e) => setEnviarCorreo(e.target.checked)}
            />
            Enviar por correo
          </label>
        </div>

        <div className="filtros-actions">
          <button className="btn-generar" onClick={handleJson} disabled={loading}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10"/>
              <line x1="12" y1="20" x2="12" y2="4"/>
              <line x1="6"  y1="20" x2="6"  y2="14"/>
            </svg>
            {loading ? 'Generando...' : 'Ver reporte'}
          </button>

          <button className="btn-pdf" onClick={handlePdf} disabled={loading}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="12" y1="18" x2="12" y2="12"/>
              <line x1="9"  y1="15" x2="15" y2="15"/>
            </svg>
            {loading ? 'Generando...' : 'Descargar PDF'}
          </button>

          {error     && <p className="error-msg">{error}</p>}
          {successMsg && <p className="success-msg">{successMsg}</p>}
        </div>
      </div>

      {/* Resultados JSON */}
      {resultado && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="reporte-periodo-info">
            <span><strong>Tipo:</strong> {resultado.tipo}</span>
            <span><strong>Periodo:</strong> {resultado.fecha_inicio} — {resultado.fecha_fin}</span>
            <span><strong>Áreas incluidas:</strong> {resultado.count}</span>
          </div>

          {resultado.reportes.map((rep, i) => (
            <ReporteCard key={i} reporte={rep} />
          ))}
        </div>
      )}
    </div>
  )
}

function ReporteCard({ reporte }) {
  const [expandido, setExpandido] = useState(true)
  const pct = parseFloat(reporte.promedio_general)

  return (
    <div className="reporte-card">
      <div className="reporte-card-header">
        <div className="reporte-gerente-info">
          <h3>{reporte.gerente_area.nombre}</h3>
          <p>{reporte.gerente_area.email}</p>
        </div>
        <div className="reporte-stats">
          <div className="stat-item">
            <div className={`stat-value ${scoreColor(reporte.promedio_general)}`}>
              {pct.toFixed(1)}%
            </div>
            <div className="stat-label">Promedio área</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{reporte.usuarios_count}</div>
            <div className="stat-label">Gerentes</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{reporte.dias_periodo}</div>
            <div className="stat-label">Días periodo</div>
          </div>
          <button
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: '0.82rem' }}
            onClick={() => setExpandido((v) => !v)}
          >
            {expandido ? 'Ocultar' : 'Ver detalle'}
          </button>
        </div>
      </div>

      {expandido && (
        <div className="usuarios-table-wrap">
          <table className="usuarios-table">
            <thead>
              <tr>
                <th>Gerente de sucursal</th>
                <th>Sucursal</th>
                <th>Días laborales</th>
                <th>Días no laborales</th>
                <th>Rendimiento periodo</th>
              </tr>
            </thead>
            <tbody>
              {reporte.usuarios.map((u, i) => {
                const pctU = parseFloat(u.porcentaje_periodo)
                return (
                  <tr key={i}>
                    <td>{u.usuario?.nombre ?? '—'}</td>
                    <td>{u.usuario?.sucursal ?? '—'}</td>
                    <td>{u.dias_laborales}</td>
                    <td>{u.dias_no_laborales}</td>
                    <td>
                      <div className="score-bar-wrap">
                        <div className="score-bar-bg">
                          <div
                            className={`score-bar-fill ${scoreBarClass(u.porcentaje_periodo)}`}
                            style={{ width: `${Math.min(pctU, 100)}%` }}
                          />
                        </div>
                        <span className="score-pct">{pctU.toFixed(1)}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
