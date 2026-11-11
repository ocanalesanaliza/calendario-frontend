import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CoberturasPage from './CoberturasPage'

const { apiRequest } = vi.hoisted(() => ({ apiRequest: vi.fn() }))

vi.mock('../../../services/apiClient', () => ({ apiRequest }))

const response = (data, ok = true) => ({ ok, json: vi.fn().mockResolvedValue(data) })
const SUNDAY = '2026-11-08'
const SATURDAY = '2026-11-07'
const WEEKDAY = '2026-11-09'

function mockApi({ sundayOpen }) {
  apiRequest.mockImplementation(async (path, options) => {
    if (path === '/api/coberturas-temporales/' && options?.method === 'POST') return response({ id_cobertura: 1 })
    if (path === '/api/coberturas-temporales/') return response({ count: 0, results: [] })
    if (path === '/api/usuarios/') return response({ results: [{ id_usuario: 10, nombre: 'Ana', habilitado: true }] })
    if (path === '/api/sucursales/') return response({ results: [{ id_sucursal: 1, nombre: 'Centro', activa: true }] })
    if (path === '/api/sucursales/1/horarios/') {
      return response({ results: [{ dia_semana: 7, abre: sundayOpen }] })
    }
    if (path.startsWith('/api/sucursales/1/titular/')) return response({ usuario_titular: null })
    throw new Error(`Unexpected request: ${path}`)
  })
}

async function openCoverageForm({ sundayOpen = true } = {}) {
  mockApi({ sundayOpen })
  render(<CoberturasPage />)
  await screen.findByText('No hay coberturas registradas.')
  fireEvent.click(screen.getByRole('button', { name: 'Nueva cobertura' }))
  await screen.findByRole('option', { name: 'Ana' })
  fireEvent.change(screen.getByLabelText(/^Usuario reemplazo/), { target: { value: '10' } })
  fireEvent.change(screen.getByLabelText(/^Sucursal destino/), { target: { value: '1' } })
  await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/api/sucursales/1/horarios/'))
}

async function setDate(date) {
  fireEvent.change(screen.getByLabelText(/^Fecha/), { target: { value: date } })
}

function submit() {
  fireEvent.click(screen.getByRole('button', { name: 'Crear cobertura' }))
}

describe('CoberturasPage weekend validation', () => {
  beforeEach(() => {
    apiRequest.mockReset()
  })

  it.each(['manana', 'tarde'])('does not allow selecting Sunday %s coverage', async (jornada) => {
    await openCoverageForm()
    await setDate(SUNDAY)
    const jornadaSelect = screen.getByLabelText('Jornada')

    expect(screen.getByRole('option', { name: jornada === 'manana' ? 'Mañana' : 'Tarde' })).toBeDisabled()
    fireEvent.change(jornadaSelect, { target: { value: jornada } })

    expect(jornadaSelect).toHaveValue('dia_completo')
  })

  it.each(['manana', 'tarde'])('does not allow selecting Saturday %s coverage', async (jornada) => {
    await openCoverageForm()
    await setDate(SATURDAY)
    const jornadaSelect = screen.getByLabelText('Jornada')

    expect(screen.getByRole('option', { name: jornada === 'manana' ? 'Mañana' : 'Tarde' })).toBeDisabled()
    fireEvent.change(jornadaSelect, { target: { value: jornada } })

    expect(jornadaSelect).toHaveValue('dia_completo')
  })

  it('does not submit a full-day Sunday coverage when the branch is closed', async () => {
    await openCoverageForm({ sundayOpen: false })
    await setDate(SUNDAY)
    submit()

    expect(await screen.findByText('La sucursal seleccionada no abre los domingos.')).toBeInTheDocument()
    expect(apiRequest).not.toHaveBeenCalledWith('/api/coberturas-temporales/', expect.objectContaining({ method: 'POST' }))
  })

  it('submits a full-day Sunday coverage when the branch is open', async () => {
    await openCoverageForm({ sundayOpen: true })
    await setDate(SUNDAY)
    submit()

    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/api/coberturas-temporales/', expect.objectContaining({
      method: 'POST',
      body: expect.stringContaining('"jornada":"dia_completo"'),
    })))
  })

  it('submits a full-day Saturday coverage without requiring the branch to open on Sunday', async () => {
    await openCoverageForm({ sundayOpen: false })
    await setDate(SATURDAY)
    submit()

    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/api/coberturas-temporales/', expect.objectContaining({
      method: 'POST',
      body: expect.stringContaining('"jornada":"dia_completo"'),
    })))
  })

  it('keeps weekday half-day coverage behavior unchanged', async () => {
    await openCoverageForm({ sundayOpen: false })
    await setDate(WEEKDAY)
    fireEvent.change(screen.getByLabelText('Jornada'), { target: { value: 'tarde' } })
    submit()

    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/api/coberturas-temporales/', expect.objectContaining({
      method: 'POST',
      body: expect.stringContaining('"jornada":"tarde"'),
    })))
  })
})
