import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TuvetAsignarPage from './TuvetAsignarPage'
import TuvetSeguimientoPage from './TuvetSeguimientoPage'

const service = vi.hoisted(() => ({
  getRevisiones: vi.fn(),
  getPlantillas: vi.fn(),
  getGerentesSucursalDisponibles: vi.fn(),
  getGerentesSucursal: vi.fn(),
  getAsignacionesPlantilla: vi.fn(),
  asignarPlantilla: vi.fn(),
  desasignar: vi.fn(),
  descargarDocumento: vi.fn(),
}))
vi.mock('../services/tuvetService', async (importOriginal) => ({ ...(await importOriginal()), ...service }))

const lista = (results) => ({ count: results.length, results })
const ana = { id: 31, nombre_completo: 'Ana Rivas', email: 'ana@tuvet.com' }
const beto = { id: 32, nombre_completo: 'Beto Núñez', email: 'beto@tuvet.com' }
const ocurrencia = (id, gerente, estado, extra = {}) => ({
  id,
  gerente_sucursal: gerente,
  departamento: { id: 4, nombre: 'Laboratorio' },
  plantilla: { id: 15, nombre: 'Control diario' },
  nombre: `Tarea ${id}`,
  estado,
  vencida: false,
  fecha_limite: '2099-01-01T23:59:00-06:00',
  documentos: [],
  eventos: [],
  ...extra,
})

function renderEn(ruta, elemento) {
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route path={ruta.split('?')[0]} element={elemento} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('TuvetSeguimientoPage', () => {
  beforeEach(() => {
    Object.values(service).forEach((mock) => mock.mockReset())
    service.getRevisiones.mockImplementation((year, month, estado) => Promise.resolve(lista({
      pendiente: [ocurrencia(1, ana, 'pendiente', { vencida: true }), ocurrencia(2, beto, 'pendiente')],
      en_revision: [ocurrencia(3, ana, 'en_revision')],
      aprobada: [ocurrencia(4, beto, 'aprobada'), ocurrencia(5, beto, 'aprobada'), ocurrencia(6, ana, 'aprobada')],
    }[estado] ?? [])))
  })

  it('consulta las ocurrencias del mes por estado y calcula el cumplimiento por gerente', async () => {
    renderEn('/tuvet/seguimiento', <TuvetSeguimientoPage />)

    const filaAna = (await screen.findByText('Ana Rivas')).closest('tr')
    expect(service.getRevisiones).toHaveBeenCalledTimes(3)
    expect(service.getRevisiones.mock.calls.map((llamada) => llamada[2])).toEqual(['pendiente', 'en_revision', 'aprobada'])
    expect(within(filaAna).getByText('33,33 %')).toBeInTheDocument()
    expect(within(filaAna).getByText(/1 vencidas/)).toBeInTheDocument()
    expect(screen.getByText('Cumplimiento general')).toBeInTheDocument()
  })

  it('cambia a la vista de tablero por urgencia', async () => {
    renderEn('/tuvet/seguimiento', <TuvetSeguimientoPage />)
    await screen.findByText('Ana Rivas')

    fireEvent.click(screen.getByRole('button', { name: 'Tablero' }))

    expect(screen.getByRole('heading', { name: 'Vencidas' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Por revisar' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Revisar' })).toHaveAttribute('href', '/tuvet/revisiones')
  })

  it('filtra los gerentes con tareas vencidas', async () => {
    renderEn('/tuvet/seguimiento', <TuvetSeguimientoPage />)
    await screen.findByText('Ana Rivas')

    fireEvent.click(screen.getByRole('button', { name: 'Con vencidas (1)' }))

    expect(screen.getByText('Ana Rivas')).toBeInTheDocument()
    expect(screen.queryByText('Beto Núñez')).not.toBeInTheDocument()
  })
})

describe('TuvetAsignarPage', () => {
  beforeEach(() => {
    Object.values(service).forEach((mock) => mock.mockReset())
    service.getPlantillas.mockResolvedValue(lista([{ id: 15, nombre: 'Control diario', activa: true, tareas: [{ id: 81, nombre: 'Bitácora', tipo_programacion: 'recurrente', tipo_recurrencia: 'diario', valor_recurrencia: {} }] }]))
    service.getGerentesSucursalDisponibles.mockResolvedValue(lista([ana, beto]))
    service.getGerentesSucursal.mockResolvedValue(lista([ana]))
    service.getAsignacionesPlantilla.mockResolvedValue(lista([{ id: 90, plantilla_id: 15, gerente_sucursal: ana, fecha_inicio: '2026-10-01', activa: true }]))
    service.asignarPlantilla.mockResolvedValue({ created_count: 1, results: [] })
  })

  it('marca quién ya tiene la plantilla y asigna solo a los nuevos seleccionados', async () => {
    renderEn('/tuvet/asignar?plantilla=15', <TuvetAsignarPage />)

    expect(await screen.findByText(/Ya la tiene/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('checkbox', { name: /Beto Núñez/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Asignar a 1 gerente(s)' }))

    await waitFor(() => expect(service.asignarPlantilla).toHaveBeenCalledWith(15, [32]))
    expect(await screen.findByText(/asignada a 1 gerente/)).toBeInTheDocument()
  })

  it('filtra a los gerentes que dependen del encargado', async () => {
    renderEn('/tuvet/asignar?plantilla=15', <TuvetAsignarPage />)
    await screen.findByText('Beto Núñez')

    fireEvent.click(screen.getByRole('button', { name: /Solo los que dependen de mí/ }))

    expect(screen.queryByText('Beto Núñez')).not.toBeInTheDocument()
    expect(screen.getByText('Ana Rivas')).toBeInTheDocument()
  })
})
