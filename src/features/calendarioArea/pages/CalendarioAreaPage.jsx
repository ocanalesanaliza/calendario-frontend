import { useEffect, useState } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import { occurrencesToCalendarEvents } from '../adapters/calendarEvents'
import { getMonthlyAreaOccurrences } from '../services/calendarioAreaService'
import './CalendarioAreaPage.css'

function monthFromDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export default function CalendarioAreaPage() {
  const [month, setMonth] = useState(() => monthFromDate(new Date()))
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    let active = true

    async function loadOccurrences() {
      setLoading(true)
      setError('')
      try {
        const data = await getMonthlyAreaOccurrences(month)
        if (active) setEvents(occurrencesToCalendarEvents(data.occurrences))
      } catch (requestError) {
        if (active) {
          setEvents([])
          setError(requestError.message)
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    loadOccurrences()
    return () => { active = false }
  }, [month, retryKey])

  function handleDatesSet({ view }) {
    const visibleMonth = monthFromDate(view.currentStart)
    setMonth((currentMonth) => currentMonth === visibleMonth ? currentMonth : visibleMonth)
  }

  return (
    <section className="calendario-area-page">
      <div className="page-header">
        <div>
          <h1>Calendario del área</h1>
          <p>Consulta las tareas programadas de tu área por mes.</p>
        </div>
      </div>

      {error ? (
        <div className="calendario-area-error" role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => setRetryKey((key) => key + 1)}>Reintentar</button>
        </div>
      ) : loading ? (
        <p className="calendario-area-state">Cargando calendario...</p>
      ) : events.length === 0 ? (
        <p className="calendario-area-state">No hay tareas programadas para este mes.</p>
      ) : null}

      <div className="calendario-area-calendar" aria-busy={loading}>
        <FullCalendar
          plugins={[dayGridPlugin]}
          initialView="dayGridMonth"
          locale="es"
          buttonText={{ today: 'Hoy', month: 'Mes' }}
          events={events}
          datesSet={handleDatesSet}
          height="auto"
        />
      </div>
    </section>
  )
}
