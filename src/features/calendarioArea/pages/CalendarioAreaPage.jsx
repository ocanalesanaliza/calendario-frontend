import { useState } from 'react'

import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import listPlugin from '@fullcalendar/list'
import multiMonthPlugin from '@fullcalendar/multimonth'

import './CalendarioAreaPage.css'

const MOCK_EVENTS = [
  {
    id: '1',
    title: 'Revisión de depósito',
    start: '2026-09-09',
    extendedProps: {
      descripcion: 'Depósito de sucursal Tres Caminos y Morazán',
      estado: 'Pendiente',
    },
  },
  {
    id: '2',
    title: 'Revisión de depósito',
    start: '2026-09-10',
    extendedProps: {
      descripcion: 'Depósito de sucursal Tres Caminos y Morazán',
      estado: 'Pendiente',
    },
  },
  {
    id: '3',
    title: 'Revisión de depósito',
    start: '2026-09-11',
    extendedProps: {
      descripcion: 'Depósito de sucursal Tres Caminos y Morazán',
      estado: 'Pendiente',
    },
  },
  {
    id: '4',
    title: 'Revisión de depósito',
    start: '2026-09-12',
    extendedProps: {
      descripcion: 'Depósito de sucursal',
      estado: 'Pendiente',
    },
  },
  {
    id: '5',
    title: 'Revisión de depósito',
    start: '2026-09-14',
    extendedProps: {
      descripcion: 'Depósito de sucursal',
      estado: 'Pendiente',
    },
  },
  {
    id: '6',
    title: 'Revisión de depósito',
    start: '2026-09-16',
    extendedProps: {
      descripcion: 'Depósito de sucursal',
      estado: 'Pendiente',
    },
  },
  {
    id: '7',
    title: 'Revisión de depósito',
    start: '2026-09-17',
    extendedProps: {
      descripcion: 'Depósito de sucursal',
      estado: 'Pendiente',
    },
  },
  {
    id: '8',
    title: 'Revisión de depósito',
    start: '2026-09-18',
    extendedProps: {
      descripcion: 'Depósito de sucursal',
      estado: 'Pendiente',
    },
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
  const [events] = useState(MOCK_EVENTS)
  const [modal, setModal] = useState(null)

  function handleEventClick(info) {
    setModal({
      type: 'event',
      title: info.event.title,
      start: info.event.start,
      descripcion:
        info.event.extendedProps.descripcion || 'Sin descripción',
      estado:
        info.event.extendedProps.estado || 'Sin estado',
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

    setMonth((currentMonth) =>
      currentMonth === visibleMonth
        ? currentMonth
        : visibleMonth
    )
  }

  return (
    <section className="calendario-area-page">

      <div className="page-header">
        <div>
          <h1>Calendario del área</h1>
        </div>
      </div>

      <div className="calendario-area-calendar">

        <FullCalendar
          plugins={[
            dayGridPlugin,
            interactionPlugin,
            timeGridPlugin,
            listPlugin,
            multiMonthPlugin,
          ]}

          headerToolbar={{
            start: 'prev,today,next',
            center: 'title',
            end: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek,multiMonthYear',
          }}

          views={{
            listWeek: {
              buttonText: 'Lista semanal',
            },
            multiMonthYear: {
              buttonText: 'Año',
            },
          }}

          initialView="dayGridMonth"

          locale="es"

          buttonText={{
            today: 'Hoy',
            month: 'Mes',
            week: 'Semana',
            day: 'Día',
            list: 'Lista',
            year: 'Año',
          }}

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
              type="button"
              className="calendar-modal-close"
              onClick={() => setModal(null)}
              aria-label="Cerrar"
            >
              ×
            </button>

            {modal.type === 'event' ? (
              <>
                <h2>{modal.title}</h2>

                <p>
                  <strong>Fecha:</strong>{' '}
                  {modal.start?.toLocaleDateString('es-HN')}
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

                <p>{modal.date}</p>

                <button type="button">
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