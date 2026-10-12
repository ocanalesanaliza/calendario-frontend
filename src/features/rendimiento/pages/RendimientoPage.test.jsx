import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RendimientoPage from './RendimientoPage'

const { apiRequest, useAuth } = vi.hoisted(() => ({ apiRequest: vi.fn(), useAuth: vi.fn() }))
vi.mock('../../../services/apiClient', () => ({ apiRequest }))
vi.mock('../../auth/context/AuthContext', () => ({ useAuth }))

const response = (data, status = 200) => ({ ok: status < 400, status, json: async () => data })
const ahora = new Date()
const HOY = ahora.toISOString().slice(0, 10)
const ANIO = ahora.getFullYear()
const MES = ahora.getMonth() + 1
const ACCESO_LECTURA = {
  id_usuario: 12,
  modo: 'solo_lectura',
  solo_lectura: true,
  puede_registrar_tareas: false,
}

const rendimiento = {
  usuario: { id_usuario: 12, nombre: 'GS Ana' },
  porcentaje_dia: '75.00',
  tareas_programadas: 4,
  tareas_cumplidas: 1,
  tareas_no_puntuan: 1,
  peso_total_cumplido: '3.00',
  peso_total_programado: '4.00',
  cerrado_en: null,
  detalles: [
    { id_rendimiento_detalle: 1, nombre_tarea_snapshot: 'Tarea 1', jornada: 'manana', hora_programada: '08:00', estado_final: 'realizada' },
    { id_rendimiento_detalle: 2, nombre_tarea_snapshot: 'Tarea 2', jornada: 'manana', hora_programada: '09:00', estado_final: 'pendiente' },
    { id_rendimiento_detalle: 3, nombre_tarea_snapshot: 'Tarea 3', jornada: 'tarde', hora_programada: '14:00', estado_final: 'incumplida' },
    { id_rendimiento_detalle: 4, nombre_tarea_snapshot: 'Registro de Guardia', jornada: 'tarde', hora_programada: '15:00', estado_final: 'cumplida', peso_programado: '2.00', cuenta_en_rendimiento: true, revision_guardia: { no_se_presento_guardia: true, notas: 'El guardia no se presentó.' } },
    { id_rendimiento_detalle: 5, nombre_tarea_snapshot: 'Tarea informativa', jornada: 'tarde', hora_programada: '16:00', estado_final: 'no_puntua' },
  ],
}

function renderPage(entry = '/rendimiento?id_usuario=12') {
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/rendimiento" element={<RendimientoPage />} />
        <Route path="/dashboard" element={<p>Dashboard operativo</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('RendimientoPage: consulta por usuario', () => {
  beforeEach(() => {
    apiRequest.mockReset()
    useAuth.mockReturnValue({ perfil: { type: 'gerente_area' } })
    apiRequest.mockImplementation(async (path) => {
      if (path === '/api/usuarios/') return response({ results: [{ id_usuario: 12, nombre: 'GS Ana' }] })
      if (path === `/api/rendimiento/diario/?id_usuario=12&fecha=${HOY}`) {
        return response({ rendimiento, acceso: ACCESO_LECTURA })
      }
      if (path === `/api/rendimiento/mensual/?id_usuario=12&anio=${ANIO}&mes=${MES}`) {
        return response({
          resumen: {
            porcentaje_mes: '88.00',
            dias_con_tareas: 10,
            dias_cerrados: 8,
            peso_total_cumplido: '88.00',
            peso_total_programado: '100.00',
            dias: [],
          },
          acceso: ACCESO_LECTURA,
        })
      }
      throw new Error(`Unexpected request: ${path}`)
    })
  })

  it('consulta el rendimiento diario indicado por la URL y lo presenta en solo lectura', async () => {
    renderPage()

    expect(await screen.findByText('Solo lectura')).toBeInTheDocument()
    expect(screen.getByLabelText('Usuario')).toHaveValue('12')
    expect(screen.getAllByText('Realizada')).toHaveLength(2)
    expect(screen.getByText('Pendiente')).toBeInTheDocument()
    expect(screen.getByText('Incumplida')).toBeInTheDocument()
    expect(screen.getByText('No puntuable')).toBeInTheDocument()
    expect(screen.getByText('El guardia no se presentó.')).toBeInTheDocument()
    const filaGuardia = screen.getByText('Registro de Guardia').closest('tr')
    expect(within(filaGuardia).getByText('2.00')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cerrar día' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reabrir día' })).not.toBeInTheDocument()
    expect(apiRequest).toHaveBeenCalledWith(`/api/rendimiento/diario/?id_usuario=12&fecha=${HOY}`)
  })

  it('permite regresar al dashboard al consultar el rendimiento de un GS', async () => {
    renderPage()
    await screen.findByText('Solo lectura')

    fireEvent.click(screen.getByRole('button', { name: 'Regresar al dashboard' }))

    expect(await screen.findByText('Dashboard operativo')).toBeInTheDocument()
  })

  it('conserva id_usuario al abrir el resumen mensual', async () => {
    renderPage()
    await screen.findAllByText('Realizada')

    fireEvent.click(screen.getByRole('button', { name: 'Mensual' }))

    expect(await screen.findByText('88%')).toBeInTheDocument()
    expect(screen.getByText('Solo lectura')).toBeInTheDocument()
    expect(apiRequest).toHaveBeenCalledWith(`/api/rendimiento/mensual/?id_usuario=12&anio=${ANIO}&mes=${MES}`)
  })

  it('muestra el 403 de otro área en lugar de indicar que no hay datos', async () => {
    apiRequest.mockImplementation(async (path) => {
      if (path === '/api/usuarios/') return response({ results: [] })
      if (path === `/api/rendimiento/diario/?id_usuario=99&fecha=${HOY}`) {
        return response({ detail: 'No tiene permiso para consultar este usuario.' }, 403)
      }
      throw new Error(`Unexpected request: ${path}`)
    })

    renderPage('/rendimiento?id_usuario=99')

    expect(await screen.findByRole('alert')).toHaveTextContent('No tiene permiso para consultar este usuario.')
    expect(screen.queryByText('Sin datos para esta fecha.')).not.toBeInTheDocument()
  })

  it('actualiza el parámetro al seleccionar otro GS', async () => {
    apiRequest.mockImplementation(async (path) => {
      if (path === '/api/usuarios/') return response({ results: [
        { id_usuario: 12, nombre: 'GS Ana' },
        { id_usuario: 14, nombre: 'GS Beto' },
      ] })
      if (path.includes('/api/rendimiento/diario/')) return response({ rendimiento, acceso: ACCESO_LECTURA })
      throw new Error(`Unexpected request: ${path}`)
    })
    renderPage()
    await screen.findAllByText('Realizada')

    fireEvent.change(screen.getByLabelText('Usuario'), { target: { value: '14' } })

    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith(`/api/rendimiento/diario/?id_usuario=14&fecha=${HOY}`))
  })
})
