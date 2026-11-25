import { useEffect, useState } from 'react'
import { Aviso, EstadoCarga, PageHeader } from '../../tuvet/components/TuvetUi'
import { DepositDemoModal } from '../components/DepositDemoModal'
import { getDepositCompliance, openOverdueDepositReport } from '../services/depositService'
import './OverdueDepositsPage.css'

function formatExecutionDate(executionDate) {
  const [year, month, day] = String(executionDate).split('-').map(Number)
  return new Intl.DateTimeFormat('es-HN', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)))
}

function obligationsFrom(response) {
  return (response?.branches ?? []).flatMap((branch) =>
    (branch.obligations ?? []).map((obligation) => ({
      obligationId: obligation.id,
      executionDate: obligation.execution_date,
      isSubmitted: obligation.is_submitted === true,
      canPrepareSubstitute: obligation.can_prepare_substitute === true,
      substituteEligibility: obligation.substitute_eligibility,
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

  const pending = obligations.filter((item) => !item.isSubmitted)
  const eligible = pending.filter((item) => (
    item.canPrepareSubstitute && item.substituteEligibility === 'special_situation_applicable'
  ))
  const notEligible = pending.filter((item) => !eligible.includes(item))

  return <main className="tema-analiza tuvet-page overdue-deposits-page">
    <PageHeader title="Depósitos vencidos" description="Obligaciones vencidas." />
    <div className="overdue-deposits-page__content">
      {error && !loading && <Aviso tipo="error">{error} <button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={load}>Reintentar</button></Aviso>}
      <EstadoCarga loading={loading} error="" onRetry={load} empty={!loading && !error && obligations.length === 0} emptyText="No hay obligaciones vencidas disponibles para preparar.">
        <section className="overdue-deposits-page__list" aria-label="Obligaciones vencidas operativas">
          {eligible.length > 0 && <><h2>Preparación sustituta</h2>{eligible.map((item) => <article className="overdue-deposits-page__row" key={item.obligationId}>
            <div>
              <h3>{item.branchName}</h3>
              <p>Depósito del {formatExecutionDate(item.executionDate)}</p>
            </div>
            <button type="button" className="tuvet-btn" aria-label={`Preparar depósito vencido de ${item.branchName}`} disabled={openingId === item.obligationId} onClick={() => openObligation(item)}>
              {openingId === item.obligationId ? 'Preparando reporte…' : 'Preparar depósito'}
            </button>
          </article>)}</>}
          {notEligible.length > 0 && <><h2>Sin preparación sustituta</h2>{notEligible.map((item) => <article className="overdue-deposits-page__row" key={item.obligationId}>
            <div>
              <h3>{item.branchName}</h3>
              <p>Depósito del {formatExecutionDate(item.executionDate)}</p>
            </div>
          </article>)}</>}
        </section>
      </EstadoCarga>
    </div>
    {selected && <DepositDemoModal overdue={{ obligationId: selected.obligationId, report: selected.report, access: selected.access }} onClose={() => setSelected(null)} />}
  </main>
}
