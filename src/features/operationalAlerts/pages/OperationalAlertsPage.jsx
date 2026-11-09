import { useCallback, useEffect, useState } from 'react'
import { Aviso, EstadoCarga, PageHeader } from '../../tuvet/components/TuvetUi'
import '../../tuvet/tuvet.css'
import { getOperationalAlerts } from '../services/operationalAlertsService'

const PAGE_SIZE = 25

function rowsOf(data) {
  return Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : []
}

function nextCursorOf(data) {
  return data?.next_cursor ?? null
}

function labelOf(alert) {
  return alert?.label ?? alert?.title ?? alert?.message ?? alert?.event_label ?? 'Alerta operativa'
}

function contextOf(alert) {
  return alert?.context ?? alert?.context_label ?? alert?.source ?? alert?.event_type ?? ''
}

function dateOf(alert) {
  return alert?.created_at ?? alert?.occurred_at ?? alert?.timestamp ?? ''
}

function errorText(error) {
  if (error?.status === 403) return 'No tienes autorización para consultar las alertas operativas. El servidor mantiene la autorización.'
  return 'No fue posible cargar las alertas operativas.'
}

export default function OperationalAlertsPage() {
  const [scope, setScope] = useState('active')
  const [alerts, setAlerts] = useState([])
  const [nextCursor, setNextCursor] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [loadMoreError, setLoadMoreError] = useState('')
  const [loadingMore, setLoadingMore] = useState(false)

  const loadFirstPage = useCallback(async (selectedScope) => {
    setLoading(true)
    setError('')
    setLoadMoreError('')
    setAlerts([])
    setNextCursor(null)
    try {
      const data = await getOperationalAlerts({ scope: selectedScope, limit: PAGE_SIZE })
      setAlerts(rowsOf(data))
      setNextCursor(nextCursorOf(data))
    } catch (requestError) {
      setError(errorText(requestError))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void Promise.resolve().then(() => loadFirstPage(scope))
  }, [loadFirstPage, scope])

  async function loadMore() {
    if (!nextCursor || loadingMore) return
    setLoadingMore(true)
    setLoadMoreError('')
    try {
      const data = await getOperationalAlerts({ scope, cursor: nextCursor, limit: PAGE_SIZE })
      setAlerts((current) => [...current, ...rowsOf(data)])
      setNextCursor(nextCursorOf(data))
    } catch (requestError) {
      setLoadMoreError(errorText(requestError))
    } finally {
      setLoadingMore(false)
    }
  }

  function selectScope(selectedScope) {
    if (selectedScope !== scope) setScope(selectedScope)
  }

  const emptyText = scope === 'active'
    ? 'No hay alertas operativas activas.'
    : 'No hay alertas operativas en el historial.'

  return (
    <div className="tema-analiza tuvet-page operational-alerts-page">
      <PageHeader
        title="Alertas operativas"
      />

      <div className="tuvet-tabs" role="tablist" aria-label="Alcance de alertas operativas">
        <button type="button" role="tab" aria-selected={scope === 'active'} className={`tuvet-tab ${scope === 'active' ? 'active' : ''}`} onClick={() => selectScope('active')}>Activas</button>
        <button type="button" role="tab" aria-selected={scope === 'history'} className={`tuvet-tab ${scope === 'history' ? 'active' : ''}`} onClick={() => selectScope('history')}>Historial</button>
      </div>

      <EstadoCarga loading={loading} error={error} onRetry={() => loadFirstPage(scope)} empty={!error && !loading && alerts.length === 0} emptyText={emptyText}>
        <section aria-label={`Alertas operativas ${scope === 'active' ? 'activas' : 'del historial'}`}>
          <ul className="tuvet-list" aria-live="polite">
            {alerts.map((alert, index) => (
              <li className="tuvet-card" key={alert?.id ?? `${dateOf(alert)}-${index}`}>
                <strong>{labelOf(alert)}</strong>
                {contextOf(alert) && <p>{contextOf(alert)}</p>}
                {dateOf(alert) && <time dateTime={dateOf(alert)}>{dateOf(alert)}</time>}
              </li>
            ))}
          </ul>

          {loadMoreError && <Aviso tipo="error">{loadMoreError}</Aviso>}
          {nextCursor && (
            <button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={loadMore} disabled={loadingMore} aria-busy={loadingMore}>
              {loadingMore ? 'Cargando más…' : 'Cargar más'}
            </button>
          )}
          {loadMoreError && nextCursor && !loadingMore && (
            <button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={loadMore}>Reintentar la carga</button>
          )}
        </section>
      </EstadoCarga>
    </div>
  )
}
