import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../../auth/context/AuthContext'
import { EstadoCarga, MesSelector, PageHeader } from '../components/TuvetUi'
import { getDepartamentos, getGerentesSucursal, getRendimiento, listItems } from '../services/tuvetService'
import { getTuvetCapabilities } from '../tuvetPolicies'
import { formatPorcentaje, mesActual, nombrePersona } from '../utils/formato'

function Barra({ porcentaje }) {
  const valor = Math.max(0, Math.min(100, Number(porcentaje) || 0))
  const nivel = valor >= 90 ? 'alto' : valor >= 70 ? 'medio' : 'bajo'
  return (
    <div className="tuvet-barra" role="img" aria-label={formatPorcentaje(porcentaje)}>
      <div className={`tuvet-barra-relleno tuvet-barra-${nivel}`} style={{ width: `${valor}%` }} />
    </div>
  )
}

export default function TuvetRendimientoPage() {
  const { perfil } = useAuth()
  const { isBranchManager } = getTuvetCapabilities(perfil)
  const [mes, setMes] = useState(mesActual)
  const [departamento, setDepartamento] = useState('')
  const [gerenteSucursal, setGerenteSucursal] = useState('')
  const [departamentos, setDepartamentos] = useState([])
  const [gerentes, setGerentes] = useState([])
  const [filas, setFilas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const peticion = useRef(0)

  useEffect(() => {
    // Los catálogos de filtros son opcionales: si el rol no puede listarlos, el filtro no se muestra.
    getDepartamentos().then((data) => setDepartamentos(listItems(data))).catch(() => setDepartamentos([]))
    if (!isBranchManager) {
      getGerentesSucursal().then((data) => setGerentes(listItems(data))).catch(() => setGerentes([]))
    }
  }, [isBranchManager])

  const cargar = useCallback(async () => {
    const actual = ++peticion.current
    setLoading(true)
    setError('')
    try {
      const data = await getRendimiento({
        year: mes.year,
        month: mes.month,
        departamento: departamento || undefined,
        gerenteSucursal: gerenteSucursal || undefined,
      })
      if (actual === peticion.current) setFilas(listItems(data))
    } catch (err) {
      if (actual === peticion.current) setError(err.message)
    } finally {
      if (actual === peticion.current) setLoading(false)
    }
  }, [mes, departamento, gerenteSucursal])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargar()
  }, [cargar])

  return (
    <div className="tuvet-page">
      <PageHeader title="Rendimiento" description="Porcentaje de tareas aprobadas en el mes. Las tareas canceladas no cuentan.">
        <MesSelector value={mes} onChange={setMes} />
      </PageHeader>

      {(departamentos.length > 0 || gerentes.length > 0) && (
        <div className="tuvet-toolbar">
          {departamentos.length > 0 && (
            <label className="tuvet-field tuvet-field-inline">
              Departamento
              <select value={departamento} onChange={(event) => setDepartamento(event.target.value)}>
                <option value="">Todos</option>
                {departamentos.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
              </select>
            </label>
          )}
          {gerentes.length > 0 && (
            <label className="tuvet-field tuvet-field-inline">
              Gerente de sucursal
              <select value={gerenteSucursal} onChange={(event) => setGerenteSucursal(event.target.value)}>
                <option value="">Todos</option>
                {gerentes.map((item) => <option key={item.id} value={item.id}>{nombrePersona(item)}</option>)}
              </select>
            </label>
          )}
        </div>
      )}

      <EstadoCarga loading={loading} error={error} onRetry={cargar} empty={!filas.length} emptyText="No hay tareas registradas para este mes con los filtros seleccionados.">
        <div className="tuvet-cards">
          {filas.map((fila) => (
            <article key={fila.gerente_sucursal.id} className="tuvet-card">
              <div className="tuvet-card-header">
                <div>
                  <h2>{fila.gerente_sucursal.nombre}</h2>
                  <p className="tuvet-muted">{fila.gerente_sucursal.email}</p>
                </div>
                <span className="tuvet-porcentaje">{formatPorcentaje(fila.general.porcentaje)}</span>
              </div>
              <Barra porcentaje={fila.general.porcentaje} />
              <p className="tuvet-muted">General: {fila.general.aprobadas} de {fila.general.total} aprobadas</p>
              {fila.por_departamento?.length > 0 && (
                <table className="tuvet-table tuvet-table-compacta">
                  <thead><tr><th>Departamento</th><th>Aprobadas</th><th>%</th></tr></thead>
                  <tbody>
                    {fila.por_departamento.map((item) => (
                      <tr key={item.departamento.id}>
                        <td>{item.departamento.nombre}</td>
                        <td>{item.aprobadas}/{item.total}</td>
                        <td>{formatPorcentaje(item.porcentaje)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </article>
          ))}
        </div>
      </EstadoCarga>
    </div>
  )
}
