import { useEffect, useState } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import listPlugin from '@fullcalendar/list'
import multiMonthPlugin from '@fullcalendar/multimonth'

import { occurrencesToCalendarEvents } from '../adapters/calendarEvents'
import { getMonthlyAreaOccurrences } from '../services/calendarioAreaService'

import './CalendarioAreaPage.css'

 const MOCK_EVENTS = [
  {
    id: '1',
    title: 'Revisión de depósito',
    start: '2026-09-09',
    extendedProps: {
      descripcion: 'Depósito de sucursal Tres Caminos y Morazan',
      estado: 'Pendiente',
    },
  },
  {
    id: '2',
    title: 'Revisión de depósito',
    start: '2026-09-10',
    extendedProps: {
      descripcion: 'Depósito de sucursal Tres Caminos y Morazan',
      estado: 'Pendiente',
    },
  },
  {
    id: '3',
    title: 'Revisión de depósito',
    start: '2026-09-11',
    extendedProps: {
      descripcion: 'Depósito de sucursal Tres Caminos y Morazan',
      estado: 'Pendiente',
    },
  },
  {
    id: '4',
    title: 'Revisión de depósito',
    start: '2026-09-12',
  },
  {
    id: '5',
    title: 'Revisión de depósito',
    start: '2026-09-14',
  },
  {
    id: '6',
    title: 'Revisión de depósito',
    start: '2026-09-16',
  },
  {
    id: '7',
    title: 'Revisión de depósito',
    start: '2026-09-17',
  },
  {
    id: '8',
    title: 'Revisión de depósito',
    start: '2026-09-18',
  },
  {
    id: '9',
    title: 'Visita a Aeroplaza',
    start: '2026-09-18',
    extendedProps: {
      descripcion: 'Visita a sucursal',
      estado: 'Programada',
    },
  },

]

function monthFromDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export default function CalendarioAreaPage() {

  

  const [month, setMonth] = useState(() => monthFromDate(new Date()))
  const [events, setEvents] = useState(MOCK_EVENTS)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [retryKey, setRetryKey] = useState(0)
  const [modal, setModal] = useState(null)

 

 /*  useEffect(() => {
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
  }, [month, retryKey]) */

  function handleEventClick(info) {
    setModal({
      type: 'event',
      title: info.event.title,
      start: info.event.start,
      descripcion: info.event.extendedProps.descripcion,
      estado: info.event.extendedProps.estado,
    })
  }

  function handleDateClick(info) {
    setModal({
      type: 'date',
      date: info.dateStr,
    })
  }

  function handleDatesSet({ view }) {
    const visibleMonth = monthFromDate(view.currentStart)
    setMonth((currentMonth) => currentMonth === visibleMonth ? currentMonth : visibleMonth)
  }

  return (
    <section className="calendario-area-page">
      <div className="page-header">
        <div>
          <h1>Calendario del área</h1>
          
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
          plugins={[
            dayGridPlugin, 
            interactionPlugin,
            timeGridPlugin,
            listPlugin,
            multiMonthPlugin
          ]}
          headerToolbar={{
            start: 'add prev,today,next',
            center: 'title',
            end: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek,multiMonthYear',
          }}

          initialView="dayGridMonth"
          locale="es"
          buttonText={{ today: 'Hoy', month: 'Mes' }}
          events={events}
          eventClick={handleEventClick}
          dateClick={handleDateClick}
          datesSet={handleDatesSet}
          height="auto"
        />
      </div>

      {modal && (
        <div
          className="calendar-modal-overlay"
          onClick={() => setModal(null)}
        >
          <div
            className="calendar-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="calendar-modal-close"
              onClick={() => setModal(null)}
            >
              ×
            </button>

            {modal.type === 'event' ? (
              <>
                <h2>{modal.title}</h2>

                <p>
                  <strong>Fecha:</strong>{' '}
                  {modal.start?.toLocaleString()}
                </p>

                <p>
                  <strong>Estado:</strong>{' '}
                  {modal.estado}
                </p>

                <p>
                  {modal.descripcion}
                </p>
              </>
            ) : (
              <>
                <h2>Fecha seleccionada</h2>

                <p>
                  {modal.date}
                </p>

                <button>
                  Crear tarea
                </button>
              </>
            )}
          </div>
        </div>
      )}

    </section>
  )
}
