import { useState } from 'react'
import { Icono } from '../../tuvet/components/TuvetUi'
import DepositHistoryCompliance from './DepositHistoryCompliance'
import { amount, branchName, money, normalizeHistoryBranch, percent } from './depositHistoryPresentation'

function Status({ item }) {
  const outstanding = amount(item.outstanding_amount)
  const label = item.reconciliation_status === 'pending_reconciliation' || amount(item.closures_pending_reconciliation) > 0 || (outstanding !== null && outstanding > 0)
    ? 'Pendiente' : item.reconciliation_status === 'reconciled' || outstanding === 0 ? 'Conciliado' : null
  return label ? <span className={`deposit-history-status deposit-history-status--${label === 'Pendiente' ? 'pending_reconciliation' : 'reconciled'}`}><Icono nombre={label === 'Pendiente' ? 'reloj' : 'check'} />{label}</span> : <span className="deposit-history-muted">Sin estado</span>
}

export default function DepositHistoryOverview({ history, branches, period, onOpenBranch, overdueCompliance, openingOverdueId, onOpenSubmittedOverdueReport }) {
  const [query, setQuery] = useState('')
  const [pendingOnly, setPendingOnly] = useState(false)
  const [sort, setSort] = useState({ key: 'outstanding_amount', descending: true })
  const data = history.summary ?? history.resumen ?? {}
  const branchRows = branches.map(normalizeHistoryBranch)
  const applied = percent(data.deposited_amount, data.cash_sales)
  const cashShare = percent(data.cash_sales, data.total_sales)
  const pendingBranches = branchRows.filter((item) => amount(item.outstanding_amount) > 0 || amount(item.closures_pending_reconciliation) > 0 || item.reconciliation_status === 'pending_reconciliation')
  const visible = branchRows.filter((item) => branchName(item).toLocaleLowerCase('es').includes(query.trim().toLocaleLowerCase('es')) && (!pendingOnly || pendingBranches.includes(item))).sort((a, b) => {
    const first = amount(a[sort.key])
    const second = amount(b[sort.key])
    if (first === null) return second === null ? branchName(a).localeCompare(branchName(b), 'es') : 1
    if (second === null) return -1
    return (sort.descending ? second - first : first - second) || branchName(a).localeCompare(branchName(b), 'es')
  })
  const metrics = [
    { label: 'Pendiente por aplicar', value: data.outstanding_amount, icon: 'reloj', accent: amount(data.outstanding_amount) > 0, detail: pendingBranches.length ? `${data.closures_pending_reconciliation != null ? `${data.closures_pending_reconciliation} cierres pendientes · ` : ''}${pendingBranches.length} ${pendingBranches.length === 1 ? 'sucursal con pendientes' : 'sucursales con pendientes'}` : 'Saldo del rango consultado' },
    { label: 'Monto ya aplicado', value: data.deposited_amount, icon: 'check', detail: applied === null ? 'Efectivo conciliado' : `${applied.toFixed(1)} % del efectivo` },
    { label: 'Efectivo del cierre', value: data.cash_sales, icon: 'archivo', detail: cashShare === null ? 'Efectivo registrado en los cierres' : `${cashShare.toFixed(1)} % de las ventas` },
    { label: 'Ventas totales', value: data.total_sales, icon: 'edificio', detail: <><span>Ventas con tarjeta</span>: <strong>{money(data.card_sales)}</strong></> },
  ]

  return <div className="deposit-history-overview">
    <section aria-labelledby="deposit-history-summary-title"><h2 id="deposit-history-summary-title" className="tuvet-visually-hidden">Resumen del rango</h2><div className="deposit-history-overview-kpis">{metrics.map((metric) => <article key={metric.label} className={`deposit-history-overview-kpi${metric.accent ? ' deposit-history-overview-kpi--attention' : ''}`}><div><span>{metric.label}</span><Icono nombre={metric.icon} /></div><strong className="deposit-history-overview-value">{money(metric.value)}</strong><p>{metric.detail}</p></article>)}</div></section>
    <section className="deposit-history-panel deposit-history-progress" aria-labelledby="deposit-history-progress-title"><h2 id="deposit-history-progress-title">Conciliación del efectivo</h2>{applied === null ? <p className="deposit-history-muted">{amount(data.cash_sales) === 0 ? 'Sin efectivo para conciliar en este rango.' : 'No hay información suficiente para calcular la conciliación.'}</p> : <div className="deposit-history-progress-content"><div className="deposit-history-progress-track" role="meter" aria-label="Porcentaje del efectivo aplicado" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Number(applied.toFixed(1))}><span style={{ width: `${applied}%` }} /></div><div className="deposit-history-progress-labels"><span><i />Aplicado <strong>{applied.toFixed(1)} %</strong></span><span>Pendiente por aplicar <strong>{money(data.outstanding_amount)}</strong></span></div></div>}</section>
    <section className="deposit-history-panel" aria-labelledby="deposit-history-branches-title">
      <div className="deposit-history-panel-header"><div className="deposit-history-panel-title"><h2 id="deposit-history-branches-title">Sucursales</h2><p>{branches.length} {branches.length === 1 ? 'sucursal en el período' : 'sucursales en el período'}</p></div><label className="deposit-history-search"><Icono nombre="buscar" /><span className="tuvet-visually-hidden">Buscar sucursal o código</span><input type="search" placeholder="Buscar sucursal o código" value={query} onChange={(event) => setQuery(event.target.value)} /></label></div>
      <div className="deposit-history-table-tools" role="group" aria-label="Filtrar sucursales"><button type="button" className={`deposit-history-chip${!pendingOnly ? ' is-active' : ''}`} aria-pressed={!pendingOnly} onClick={() => setPendingOnly(false)}>Todas · {branches.length}</button><button type="button" className={`deposit-history-chip${pendingOnly ? ' is-active' : ''}`} aria-pressed={pendingOnly} onClick={() => setPendingOnly(true)}>Con pendientes · {pendingBranches.length}</button><span aria-live="polite">{visible.length} {visible.length === 1 ? 'resultado' : 'resultados'}</span></div>
      <div className="deposit-history-table-scroll" tabIndex="0" role="region" aria-label="Comparativa financiera de sucursales"><table className="deposit-history-table"><caption className="tuvet-visually-hidden">Comparativa financiera por sucursal · {period}</caption><thead><tr><th scope="col">Sucursal</th>{[['Ventas', 'total_sales'], ['Efectivo', 'cash_sales'], ['Aplicado', 'deposited_amount'], ['Pendiente', 'outstanding_amount']].map(([label, key]) => <th scope="col" className="deposit-history-num" key={key} aria-sort={sort.key === key ? sort.descending ? 'descending' : 'ascending' : undefined}><button type="button" onClick={() => setSort({ key, descending: sort.key === key ? !sort.descending : true })}>{label} <span aria-hidden="true">{sort.key === key ? sort.descending ? '↓' : '↑' : '↕'}</span></button></th>)}<th scope="col">Estado</th><th scope="col"><span className="tuvet-visually-hidden">Acciones</span></th></tr></thead><tbody>{visible.map((item) => <tr key={item.id} className={pendingBranches.includes(item) ? 'deposit-history-row--attention' : undefined}><th scope="row"><span className="deposit-history-branch-name"><strong>{item.code ?? item.codigo ?? 'Sin código'}</strong><span>{item.name ?? item.nombre ?? 'Sucursal'}</span></span></th>{['total_sales', 'cash_sales', 'deposited_amount', 'outstanding_amount'].map((key) => <td key={key} className={`deposit-history-num${key === 'outstanding_amount' && amount(item[key]) > 0 ? ' deposit-history-pending-amount' : ''}${amount(item[key]) === 0 ? ' deposit-history-muted' : ''}`}>{money(item[key])}</td>)}<td><Status item={item} /></td><td><button type="button" className="deposit-history-text-button" aria-label={`Ver cierres de ${[item.code ?? item.codigo, item.name ?? item.nombre].filter(Boolean).join(' ') || 'sucursal'}`} onClick={() => onOpenBranch(item)}>Ver cierres <span aria-hidden="true">→</span></button></td></tr>)}{visible.length === 0 && <tr><td colSpan={7} className="deposit-history-no-results">No hay sucursales que coincidan con estos filtros.</td></tr>}</tbody></table></div>
    </section>
    <DepositHistoryCompliance compliance={history.submission_compliance} branches={branches} period={period} onOpenBranch={onOpenBranch} overdueCompliance={overdueCompliance} openingOverdueId={openingOverdueId} onOpenSubmittedOverdueReport={onOpenSubmittedOverdueReport} />
  </div>
}
