import { useEffect, useState } from 'react'
import { Aviso, EstadoCarga, PageHeader } from '../../tuvet/components/TuvetUi'
import { getDepositHistory, getDepositHistoryBranch, getDepositHistoryClosure } from '../../calendarArea/services/depositHistoryService'
import '../../tuvet/tuvet.css'
import './DepositHistoryPage.css'

function localMonthRange(now = new Date()) {
  const year = now.getFullYear()
  const month = now.getMonth()
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}`
  return { from: `${prefix}-01`, to: `${prefix}-${String(new Date(year, month + 1, 0).getDate()).padStart(2, '0')}` }
}

function formatDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) return value || '—'
  const [year, month, day] = value.split('-').map(Number)
  return new Intl.DateTimeFormat('es-HN', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(year, month - 1, day))
}

function formatRange({ from, to }) {
  if (!from || !to) return 'No disponible'
  const [fromYear, fromMonth, fromDay] = from.split('-').map(Number)
  const [toYear, toMonth, toDay] = to.split('-').map(Number)
  if (fromYear === toYear && fromMonth === toMonth) {
    const month = new Intl.DateTimeFormat('es-HN', { month: 'long', year: 'numeric' }).format(new Date(fromYear, fromMonth - 1, 1))
    return `${fromDay}–${toDay} de ${month}`
  }
  return `${formatDate(from)} – ${formatDate(to)}`
}

function formatAmount(value) {
  if (value === null || value === undefined || value === '') return '—'
  const numeric = Number(value)
  if (Number.isNaN(numeric)) return String(value)
  return `L ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(numeric)}`
}

function safeError(error) {
  return error?.status === 404
    ? 'No hay historial disponible para el rango seleccionado.'
    : 'No fue posible cargar el historial de depósitos. Inténtalo nuevamente.'
}

function branchLabel(branch) {
  return [branch?.code ?? branch?.codigo, branch?.name ?? branch?.nombre].filter(Boolean).join(' · ') || 'Sucursal'
}

function reconciliationLabel(status) {
  return ({ reconciled: 'Conciliado', pending_reconciliation: 'Pendiente de conciliación' })[status] ?? null
}

function hasFinancialData(data) {
  return ['total_sales', 'cash_sales', 'card_sales', 'deposited_amount', 'outstanding_amount'].some((key) => data?.[key] !== null && data?.[key] !== undefined && data?.[key] !== '')
}

function FinancialSummary({ data, compact = false, separated = false }) {
  const values = data ?? {}
  const pending = values.reconciliation_status === 'pending_reconciliation'
  const sales = [
    ['Ventas totales', values.total_sales],
    ['Efectivo del cierre', values.cash_sales],
    ['Ventas con tarjeta', values.card_sales],
  ]
  const reconciliation = [
    ['Monto ya aplicado', values.deposited_amount],
    ['Pendiente por aplicar', values.outstanding_amount, pending],
  ]
  const renderMetrics = (metrics) => <div className={`deposit-history-kpis ${compact ? 'deposit-history-kpis--compact' : ''}`} aria-label="Resumen financiero">
    {metrics.map(([label, value, pendingMetric]) => <div className={`deposit-history-kpi ${pendingMetric ? 'deposit-history-kpi--pending' : ''}`} key={label}>
      <span className="deposit-history-kpi-label">{label}</span>
      <strong className={`deposit-history-kpi-value ${pendingMetric ? 'deposit-history-kpi-value--pending' : ''}`}>{formatAmount(value)}</strong>
    </div>)}
  </div>
  if (!separated) return renderMetrics([...sales, ...reconciliation])
  return <div className="deposit-history-financial-groups">
    <section aria-labelledby="deposit-history-sales-title"><h3 id="deposit-history-sales-title">Composición de ventas</h3>{renderMetrics(sales)}</section>
    <section aria-labelledby="deposit-history-reconciliation-title"><h3 id="deposit-history-reconciliation-title">Conciliación de efectivo</h3>{renderMetrics(reconciliation)}</section>
  </div>
}

function Breadcrumbs({ items }) {
  return <p className="deposit-history-breadcrumbs" aria-label="Ubicación actual">{items.join(' / ')}</p>
}

function NavigationContext({ items, onBack, label }) {
  return <div className="deposit-history-navigation"><Breadcrumbs items={items} /><button type="button" className="deposit-history-back" onClick={onBack}>{label}</button></div>
}

export default function DepositHistoryPage() {
  const [range, setRange] = useState(localMonthRange)
  const [history, setHistory] = useState(null)
  const [branch, setBranch] = useState(null)
  const [selectedBranch, setSelectedBranch] = useState(null)
  const [closure, setClosure] = useState(null)
  const [selectedClosure, setSelectedClosure] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function loadHistory(nextRange = range) {
    setLoading(true)
    setError('')
    setBranch(null)
    setSelectedBranch(null)
    setClosure(null)
    setSelectedClosure(null)
    try {
      setHistory(await getDepositHistory(nextRange))
    } catch (requestError) {
      setHistory(null)
      setError(safeError(requestError))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    void Promise.resolve().then(async () => {
      try {
        const data = await getDepositHistory(range)
        if (active) setHistory(data)
      } catch (requestError) {
        if (active) setError(safeError(requestError))
      } finally {
        if (active) setLoading(false)
      }
    })
    return () => { active = false }
  // The initial local calendar month is loaded once; subsequent changes are submitted explicitly.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function openBranch(item) {
    setLoading(true)
    setError('')
    setSelectedBranch(item)
    setClosure(null)
    setSelectedClosure(null)
    try {
      setBranch(await getDepositHistoryBranch(item.id, range))
    } catch (requestError) {
      setBranch(null)
      setError(safeError(requestError))
    } finally {
      setLoading(false)
    }
  }

  async function openClosure(item) {
    setLoading(true)
    setError('')
    setSelectedClosure(item)
    try {
      setClosure(await getDepositHistoryClosure(item.id))
    } catch (requestError) {
      setClosure(null)
      setError(safeError(requestError))
    } finally {
      setLoading(false)
    }
  }

  const branches = history?.branches ?? history?.sucursales ?? history?.results ?? []
  const closures = branch?.closures ?? branch?.cierres ?? branch?.results ?? []
  const closureData = closure?.closure ?? closure
  const currentBranch = branch?.branch ?? selectedBranch
  const currentBranchLabel = branchLabel(currentBranch)
  const receipts = closure?.receipts ?? closure?.comprobantes ?? closureData?.receipts ?? closureData?.comprobantes ?? []

  const closureDate = closureData?.closure_date ?? closureData?.fecha_cierre ?? selectedClosure?.closure_date ?? selectedClosure?.fecha_cierre

  return <main className="tema-analiza tuvet-page deposit-history-page" data-testid="deposit-history-layout" data-responsive-breakpoints="375 768 1024 1440">
    <PageHeader title="Historial de depósitos" description="Consulta los cierres y su conciliación histórica por sucursal." />
    <form className="deposit-history-filters" onSubmit={(event) => { event.preventDefault(); void loadHistory(range) }} aria-label="Rango del historial de depósitos">
      <p className="deposit-history-period">Período consultado: <strong>{formatRange(range)}</strong></p>
      <label htmlFor="deposit-history-from">Desde<input id="deposit-history-from" type="date" value={range.from} onChange={(event) => setRange((current) => ({ ...current, from: event.target.value }))} /></label>
      <label htmlFor="deposit-history-to">Hasta<input id="deposit-history-to" type="date" value={range.to} onChange={(event) => setRange((current) => ({ ...current, to: event.target.value }))} /></label>
      <button type="submit" className="tuvet-btn" disabled={loading}>{loading ? 'Cargando…' : 'Consultar historial'}</button>
    </form>

    {error && <Aviso tipo={error.startsWith('No hay') ? 'info' : 'error'} role="alert">{error}</Aviso>}
    <EstadoCarga loading={loading} error="" onRetry={() => void loadHistory()} empty={!loading && !error && history && branches.length === 0} emptyText="No hay historial disponible para el rango seleccionado.">
      {history && !branch && <section aria-labelledby="deposit-history-summary-title">
        <h2 id="deposit-history-summary-title">Resumen del rango</h2>
        <FinancialSummary data={history.summary ?? history.resumen} />
        <h2 className="deposit-history-section-title">Sucursales</h2>
        <div className="deposit-history-branch-list">{branches.map((item) => <button type="button" key={item.id} className="deposit-history-branch-row" onClick={() => void openBranch(item)} aria-label={`Ver cierres de ${[item.code ?? item.codigo, item.name ?? item.nombre].filter(Boolean).join(' ') || 'sucursal'}`}>
          <span><strong>{item.code ?? item.codigo ?? 'Sin código'}</strong><span>{item.name ?? item.nombre ?? 'Sucursal'}</span>{hasFinancialData(item) && <FinancialSummary data={item} compact />}</span><span className="deposit-history-row-action">Ver cierres <span aria-hidden="true">→</span></span>
        </button>)}</div>
      </section>}
      {branch && !closure && <section aria-labelledby="deposit-history-branch-title">
        <NavigationContext items={['Historial de depósitos', currentBranchLabel]} label="← Volver a sucursales" onBack={() => { setBranch(null); setSelectedBranch(null); setError('') }} />
        <h2 id="deposit-history-branch-title">Cierres de {currentBranchLabel}</h2>
        <div className="deposit-history-closure-list">{closures.map((item) => <article key={item.id} className="deposit-history-closure-row">
          <div className="deposit-history-closure-content"><div className="deposit-history-closure-header"><div><h3>Cierre del {formatDate(item.closure_date ?? item.fecha_cierre)}</h3>{reconciliationLabel(item.reconciliation_status) && <span className={`deposit-history-status deposit-history-status--${item.reconciliation_status}`}>{reconciliationLabel(item.reconciliation_status)}</span>}</div><button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={() => void openClosure(item)}>Ver detalle del cierre {formatDate(item.closure_date ?? item.fecha_cierre)}</button></div><FinancialSummary data={item} compact /></div>
        </article>)}</div>
      </section>}
      {closure && <section aria-label="Detalle del cierre" className="deposit-history-detail">
        <NavigationContext items={['Historial de depósitos', currentBranchLabel, `Cierre ${formatDate(closureDate)}`]} label="← Volver a cierres" onBack={() => { setClosure(null); setSelectedClosure(null); setError('') }} />
        <div className="deposit-history-detail-heading"><h2>Conciliación del cierre</h2>{reconciliationLabel(closureData?.reconciliation_status) && <span className={`deposit-history-status deposit-history-status--${closureData.reconciliation_status}`}>{reconciliationLabel(closureData.reconciliation_status)}</span>}</div><FinancialSummary data={closureData} separated />
        <section className="deposit-history-receipts" aria-labelledby="deposit-history-receipts-title"><h3 id="deposit-history-receipts-title">Comprobantes</h3>
          {receipts.length === 0 ? <p className="deposit-history-empty">No hay comprobantes para este cierre.</p> : <div className="deposit-history-receipts-table"><table><thead><tr><th>Referencia</th><th>Fecha de depósito</th><th>Aplicado</th></tr></thead><tbody>{receipts.map((receipt, index) => <tr key={receipt.id ?? `${receipt.reference ?? receipt.referencia}-${index}`}><td>{receipt.reference ?? receipt.referencia ?? 'Sin referencia'}</td><td>{formatDate(receipt.deposited_on ?? receipt.fecha_deposito)}</td><td>{formatAmount(receipt.allocated_amount ?? receipt.applied_amount ?? receipt.deposited_amount)}</td></tr>)}</tbody></table></div>}
        </section>
      </section>}
    </EstadoCarga>
  </main>
}
