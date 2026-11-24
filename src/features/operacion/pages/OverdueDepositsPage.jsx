import { useEffect, useState } from 'react'
import { Aviso, EstadoCarga } from '../../tuvet/components/TuvetUi'
import { DepositDemoModal } from '../components/DepositDemoModal'
import { getDepositCompliance, openOverdueDepositReport } from '../services/depositService'
import './OverdueDepositsPage.css'

function obligationsFrom(response) {
  return (response?.branches ?? []).flatMap((branch) =>
    (branch.obligations ?? []).map((obligationId) => ({
      obligationId,
      branchName: branch.name ?? 'Sucursal asignada',
    })),
  )
}

export default function OverdueDepositsPage() {
  const [obligations, setObligations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [openingId, setOpeningId] = useState(null)
  const [selected, setSelected] = useState(null)

  async function load() {
    setLoading(true)
    setError('')
    try {
      setObligations(obligationsFrom(await getDepositCompliance()))
    } catch {
      setError('No fue posible cargar las obligaciones vencidas.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  async function openObligation(item) {
    setOpeningId(item.obligationId)
    setError('')
    try {
      const bridge = await openOverdueDepositReport(item.obligationId)
      setSelected({ ...item, ...bridge })
    } catch {
      setError('No fue posible preparar el reporte vencido.')
    } finally {
      setOpeningId(null)
    }
  }

  return <main className="overdue-deposits-page">
    <header className="overdue-deposits-page__header">
      <div>
        <h1>Depósitos vencidos</h1>
        <p>Prepara y envía reportes sustitutos autorizados de obligaciones vencidas.</p>
      </div>
    </header>
    {error && !loading && <Aviso tipo="error">{error} <button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={load}>Reintentar</button></Aviso>}
    <EstadoCarga loading={loading} error="" onRetry={load} empty={!loading && !error && obligations.length === 0} emptyText="No hay obligaciones vencidas disponibles para preparar.">
      <section className="overdue-deposits-page__list" aria-label="Obligaciones vencidas operativas">
        {obligations.map((item) => <article className="overdue-deposits-page__row" key={item.obligationId}>
          <div>
            <h2>{item.branchName}</h2>
            <p>Obligación de depósito vencida disponible para preparación sustitutiva.</p>
          </div>
          <button type="button" className="tuvet-btn" aria-label={`Preparar depósito vencido de ${item.branchName}`} disabled={openingId === item.obligationId} onClick={() => openObligation(item)}>
            {openingId === item.obligationId ? 'Preparando reporte…' : 'Preparar depósito'}
          </button>
        </article>)}
      </section>
    </EstadoCarga>
    {selected && <DepositDemoModal overdue={{ obligationId: selected.obligationId, report: selected.report, access: selected.access }} onClose={() => setSelected(null)} />}
  </main>
}
