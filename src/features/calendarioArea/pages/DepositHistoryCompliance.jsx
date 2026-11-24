import { useState } from 'react'
import { Icono } from '../../tuvet/components/TuvetUi'
import { branchName, complianceRows } from './depositHistoryPresentation'

const SERIES = [
  { key: 'expected', label: 'Esperados' },
  { key: 'submitted', label: 'Enviados' },
  { key: 'missing', label: 'No enviados' },
]

export default function DepositHistoryCompliance({ compliance, branches, period, onOpenBranch, overdueCompliance, openingOverdueId, onOpenSubmittedOverdueReport }) {
  const [query, setQuery] = useState('')
  const rows = complianceRows(compliance, branches)
  const visible = rows.filter(({ branch }) => branchName(branch).toLocaleLowerCase('es').includes(query.trim().toLocaleLowerCase('es')))
  const totals = rows.reduce((sum, row) => ({ expected: sum.expected + row.expected, submitted: sum.submitted + row.submitted, missing: sum.missing + row.missing }), { expected: 0, submitted: 0, missing: 0 })
  const maxValue = Math.max(1, ...visible.map((row) => row.expected))
  const step = Math.max(1, Math.ceil(maxValue / 6))
  const ceiling = step * Math.ceil(maxValue / step)
  const ticks = Array.from({ length: ceiling / step + 1 }, (_, index) => index * step)
  const missingCalendars = branches.length - rows.length
  const submittedOverdueReports = (overdueCompliance?.branches ?? []).flatMap((item) => item?.state === 'resolved' && Array.isArray(item.obligations) ? item.obligations.map((obligationId) => ({ obligationId, branch: item })) : [])

  return <section className="deposit-history-panel deposit-history-compliance" aria-labelledby="deposit-history-compliance-title">
    <div className="deposit-history-panel-header">
      <div><h2 id="deposit-history-compliance-title">Cumplimiento de envíos por sucursal</h2><p>Cierres esperados, enviados y no enviados · {period}</p></div>
      {rows.length > 0 && <label className="deposit-history-search"><Icono nombre="buscar" /><span className="tuvet-visually-hidden">Buscar sucursal en cumplimiento</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar sucursal" /></label>}
    </div>
    {rows.length === 0 ? <div className="deposit-history-compliance-empty"><Icono nombre="calendario" /><div><h3>Cumplimiento aún no disponible</h3><p>Se necesitan los envíos esperados y recibidos según el calendario de cada sucursal para mostrar este gráfico.</p></div></div> : <>
      <div className="deposit-history-compliance-summary" aria-live="polite">
        <p><strong>{totals.expected}</strong> esperados <span>·</span> <strong>{totals.submitted}</strong> enviados <span>·</span> <strong>{totals.missing}</strong> no enviados</p>
        <span className="deposit-history-status deposit-history-status--neutral">{totals.expected > 0 ? `${new Intl.NumberFormat('es-HN', { maximumFractionDigits: 1 }).format(totals.submitted / totals.expected * 100)} % de cumplimiento` : 'Sin cierres esperados'}</span>
      </div>
      {missingCalendars > 0 && <p className="deposit-history-chart-note">Calendario sin resolver para {missingCalendars} {missingCalendars === 1 ? 'sucursal' : 'sucursales'}. No se contabilizan como faltantes. El resumen corresponde a las {rows.length} sucursales con datos disponibles.</p>}
      {visible.length === 0 ? <p className="deposit-history-empty">No hay sucursales que coincidan con la búsqueda.</p> : <>
        <div className="deposit-history-chart-scroll" tabIndex="0" role="region" aria-label="Gráfico de cumplimiento por sucursal; desplázate horizontalmente para ver más sucursales">
          <div className="deposit-history-chart" style={{ '--chart-width': `${Math.max(560, visible.length * 150 + 60)}px` }}>
            <div className="deposit-history-chart-plot" role="img" aria-label={`Comparativa de envíos de ${visible.length} sucursales. Valores completos en la tabla de datos de cumplimiento.`}>
              <div className="deposit-history-chart-axis" aria-hidden="true">{ticks.map((tick) => <span key={tick} style={{ bottom: `${tick / ceiling * 100}%` }}>{tick}</span>)}</div>
              <div className="deposit-history-chart-grid" aria-hidden="true">{ticks.map((tick) => <span key={tick} style={{ bottom: `${tick / ceiling * 100}%` }} />)}</div>
              <div className="deposit-history-chart-groups" aria-hidden="true">{visible.map((row) => <div className="deposit-history-chart-group" key={row.branch.id}>{SERIES.map(({ key }) => <div className={`deposit-history-chart-bar deposit-history-chart-bar--${key}`} key={key} style={{ height: `${row[key] / ceiling * 100}%` }}><strong>{row[key]}</strong></div>)}</div>)}</div>
            </div>
            <div className="deposit-history-chart-labels">{visible.map(({ branch }) => <div key={branch.id}><strong>{branch.code ?? branch.codigo ?? 'Sucursal'}</strong><span>{branch.name ?? branch.nombre}</span><button type="button" className="deposit-history-text-button" onClick={() => onOpenBranch(branch)}>Ver cierres<span className="tuvet-visually-hidden"> de {branchName(branch)}</span> <span aria-hidden="true">→</span></button></div>)}</div>
          </div>
        </div>
        <ul className="deposit-history-chart-legend" aria-label="Series del gráfico">{SERIES.map(({ key, label }) => <li key={key}><i className={`deposit-history-chart-bar--${key}`} aria-hidden="true" />{label}</li>)}</ul>
        <details className="deposit-history-chart-data"><summary>Ver datos de cumplimiento</summary><div className="deposit-history-table-scroll" tabIndex="0" role="region" aria-label="Datos de cumplimiento"><table className="deposit-history-table"><caption className="tuvet-visually-hidden">Cantidad de cierres por sucursal, {period}</caption><thead><tr><th scope="col">Sucursal</th>{SERIES.map(({ key, label }) => <th scope="col" className="deposit-history-num" key={key}>{label}</th>)}</tr></thead><tbody>{visible.map((row) => <tr key={row.branch.id}><th scope="row">{branchName(row.branch)}</th>{SERIES.map(({ key }) => <td key={key} className="deposit-history-num">{row[key]}</td>)}</tr>)}</tbody></table></div></details>
      </>}
      <p className="deposit-history-chart-note">Esperados según el calendario de cada sucursal. Los días que aún no vencen no se cuentan como no enviados.</p>
    </>}
    {submittedOverdueReports.length > 0 && <section aria-labelledby="submitted-overdue-reports-title"><h3 id="submitted-overdue-reports-title">Reportes vencidos enviados</h3><p>Los detalles financieros están disponibles solo después del envío confirmado por el servidor.</p><div className="deposit-history-closure-list">{submittedOverdueReports.map(({ obligationId, branch }) => <article className="deposit-history-closure-row" key={obligationId}><div className="deposit-history-closure-content"><h4>{branchName(branch)}</h4><button type="button" className="tuvet-btn tuvet-btn-secondary" disabled={openingOverdueId === obligationId} onClick={() => onOpenSubmittedOverdueReport?.(obligationId)} aria-label={`Ver reporte vencido enviado de ${branchName(branch)}`}>{openingOverdueId === obligationId ? 'Cargando reporte…' : 'Ver reporte enviado'}</button></div></article>)}</div></section>}
  </section>
}
