import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CoberturasPage from './CoberturasPage'

const { apiRequest } = vi.hoisted(() => ({ apiRequest: vi.fn() }))

vi.mock('../../../services/apiClient', () => ({ apiRequest }))

const response = (data, ok = true) => ({ ok, json: vi.fn().mockResolvedValue(data) })
const SUNDAY = '2026-11-08'
const SATURDAY = '2026-11-07'
const WEEKDAY = '2026-11-09'

function mockApi({ sundayOpen, branches = [{ id_sucursal: 1, codigo: 'CENTRO', nombre: 'Centro', area: { nombre: 'Área Centro' }, titular: { nombre: 'Laura' }, abre_domingo: true }] }) {
  apiRequest.mockImplementation(async (path, options) => {
    if (path === '/api/coberturas-temporales/' && options?.method === 'POST') return response({ id_cobertura: 1 })
    if (path === '/api/coberturas-temporales/') return response({ count: 0, results: [] })
    if (path.startsWith('/api/coberturas-temporales/catalogo/')) return response({
      reemplazos: [{ id_usuario: 10, nombre: 'Ana', habilitado: true }],
      sucursales: branches.map((branch) => ({ ...branch, abre_domingo: sundayOpen && branch.abre_domingo })),
    })
    throw new Error(`Unexpected request: ${path}`)
  })
}

async function openCoverageForm({ sundayOpen = true } = {}) {
  mockApi({ sundayOpen })
  render(<CoberturasPage />)
  await screen.findByText('No hay coberturas registradas todavía.')
  fireEvent.click(screen.getAllByRole('button', { name: 'Nueva cobertura' })[0])
  await screen.findByRole('option', { name: 'Ana' })
  fireEvent.change(screen.getByLabelText(/^Usuario reemplazo/), { target: { value: '10' } })
  const branchInput = screen.getByLabelText(/^Sucursal destino/)
  fireEvent.change(branchInput, { target: { value: 'Centro' } })
  fireEvent.click(await screen.findByRole('option', { name: 'Centro' }))
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

  it('searches and selects a same-country branch from another area', async () => {
    mockApi({
      sundayOpen: true,
      branches: [{ id_sucursal: 2, codigo: 'NORTE-02', nombre: 'Norte', area: { nombre: 'Área 2' }, titular: { nombre: 'María' }, abre_domingo: true }],
    })
    render(<CoberturasPage />)
    await screen.findByText('No hay coberturas registradas todavía.')
    fireEvent.click(screen.getAllByRole('button', { name: 'Nueva cobertura' })[0])

    const branchInput = await screen.findByLabelText(/^Sucursal destino/)
    fireEvent.change(branchInput, { target: { value: 'NORTE-02' } })
    fireEvent.keyDown(branchInput, { key: 'ArrowDown' })
    fireEvent.keyDown(branchInput, { key: 'Enter' })

    expect(branchInput).toHaveValue('Norte')
    await setDate(WEEKDAY)
    expect(await screen.findByDisplayValue('María')).toBeDisabled()
    expect(screen.queryByText('Área 2')).not.toBeInTheDocument()
  })

  it('opens and closes the accessible modal with Escape, restoring trigger focus', async () => {
    mockApi({ sundayOpen: true })
    render(<CoberturasPage />)
    await screen.findByText('No hay coberturas registradas todavía.')
    const [trigger] = screen.getAllByRole('button', { name: 'Nueva cobertura' })
    trigger.focus()
    fireEvent.click(trigger)

    expect(await screen.findByRole('dialog', { name: 'Nueva cobertura' })).toBeInTheDocument()
    expect(screen.getByLabelText(/^Usuario reemplazo/)).toHaveFocus()
    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('dialog', { name: 'Nueva cobertura' })).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('filters loaded coverage rows by status chips and announces their counts', async () => {
    apiRequest.mockImplementation(async (path) => {
      if (path === '/api/coberturas-temporales/') return response({ count: 2, results: [
        { id_cobertura: 1, estado: 'pendiente', usuario_reemplazo: { nombre: 'Ana' }, sucursal_destino: { nombre: 'Centro' }, fecha: WEEKDAY, jornada: 'dia_completo' },
        { id_cobertura: 2, estado: 'activa', usuario_reemplazo: { nombre: 'Luis' }, sucursal_destino: { nombre: 'Norte' }, fecha: WEEKDAY, jornada: 'tarde' },
      ] })
      throw new Error(`Unexpected request: ${path}`)
    })
    render(<CoberturasPage />)
    await screen.findByText('Ana')

    expect(screen.getByRole('button', { name: 'Pendientes (1)' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Activas (1)' }))
    expect(screen.getByText('Luis')).toBeInTheDocument()
    expect(screen.queryByText('Ana')).not.toBeInTheDocument()
  })

  it('renders retryable error and loading states', async () => {
    apiRequest.mockRejectedValueOnce(new Error('Sin conexión'))
    render(<CoberturasPage />)
    expect(screen.getByRole('status', { name: 'Cargando' })).toBeInTheDocument()
    expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexión')
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })
})
