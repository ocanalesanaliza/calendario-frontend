import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import OperationalAlertsPage from './OperationalAlertsPage'

const service = vi.hoisted(() => ({ getOperationalAlerts: vi.fn() }))
vi.mock('../services/operationalAlertsService', () => service)

const page = (results, next_cursor = null) => ({ results, next_cursor })
const alert = (id, label, context) => ({ id, label, context, created_at: '2026-10-25T10:00:00Z' })

describe('OperationalAlertsPage', () => {
  beforeEach(() => service.getOperationalAlerts.mockReset())

  it('loads active alerts by default and preserves server order', async () => {
    service.getOperationalAlerts.mockResolvedValue(page([alert('2', 'Second from server', 'Scheduler'), alert('1', 'First from server', 'Gaps')]))
    render(<OperationalAlertsPage />)

    expect(screen.getByRole('status', { name: 'Cargando' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Alertas operativas' })).toBeInTheDocument()
    expect(screen.getByText(/Consulta de solo lectura para Sistemas/)).toBeInTheDocument()
    expect(screen.getByRole('tablist', { name: 'Alcance de alertas operativas' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Activas' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Historial' })).toHaveAttribute('aria-selected', 'false')
    expect(await screen.findByText('Second from server')).toBeInTheDocument()
    expect(service.getOperationalAlerts).toHaveBeenCalledWith({ scope: 'active', limit: 25 })
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual(expect.arrayContaining([
      expect.stringContaining('Second from serverScheduler'),
      expect.stringContaining('First from serverGaps'),
    ]))
  })

  it('clears pagination and reloads history when the scope changes', async () => {
    service.getOperationalAlerts.mockResolvedValueOnce(page([alert('a', 'Active', 'Open')], 'cursor-a')).mockResolvedValueOnce(page([alert('h', 'Historical', 'Recovered')]))
    render(<OperationalAlertsPage />)
    await screen.findByText('Active')

    fireEvent.click(screen.getByRole('tab', { name: 'Historial' }))
    expect(await screen.findByText('Historical')).toBeInTheDocument()
    expect(service.getOperationalAlerts).toHaveBeenLastCalledWith({ scope: 'history', limit: 25 })
    expect(screen.queryByText('Active', { selector: 'strong' })).not.toBeInTheDocument()
  })

  it('shows meaningful empty states and a backend 403 state', async () => {
    service.getOperationalAlerts.mockResolvedValueOnce(page([])).mockRejectedValueOnce(Object.assign(new Error('Forbidden'), { status: 403 }))
    const { rerender } = render(<OperationalAlertsPage />)
    expect(await screen.findByText(/No hay alertas operativas activas/)).toBeInTheDocument()

    rerender(<OperationalAlertsPage key="forbidden" />)
    expect(await screen.findByText(/No tienes autorización para consultar las alertas operativas/)).toBeInTheDocument()
    expect(screen.getByText(/El servidor mantiene la autorización/i)).toBeInTheDocument()
  })

  it('shows the history empty state and a retryable generic API error', async () => {
    service.getOperationalAlerts.mockResolvedValueOnce(page([])).mockRejectedValueOnce(new Error('Raw English API failure'))
    render(<OperationalAlertsPage />)
    expect(await screen.findByText(/No hay alertas operativas activas/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Historial' }))
    expect(await screen.findByText('No fue posible cargar las alertas operativas.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    await waitFor(() => expect(service.getOperationalAlerts).toHaveBeenCalledTimes(3))
  })

  it('renders the history-specific empty state', async () => {
    service.getOperationalAlerts.mockResolvedValueOnce(page([])).mockResolvedValueOnce(page([]))
    render(<OperationalAlertsPage />)
    await screen.findByText(/No hay alertas operativas activas/)

    fireEvent.click(screen.getByRole('tab', { name: 'Historial' }))
    expect(await screen.findByText(/No hay alertas operativas en el historial/)).toBeInTheDocument()
  })

  it('appends a cursor page, prevents duplicate loading, and retains rows on cursor errors', async () => {
    let resolveNext
    service.getOperationalAlerts.mockResolvedValueOnce(page([alert('a', 'First', 'Open')], 'cursor-a')).mockImplementationOnce(() => new Promise((resolve) => { resolveNext = resolve }))
    render(<OperationalAlertsPage />)
    await screen.findByText('First')

    fireEvent.click(screen.getByRole('button', { name: 'Cargar más' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cargando más…' }))
    expect(service.getOperationalAlerts).toHaveBeenCalledTimes(2)
    resolveNext(page([alert('b', 'Second', 'Retry')], 'cursor-b'))
    expect(await screen.findByText('Second')).toBeInTheDocument()

    service.getOperationalAlerts.mockRejectedValueOnce(new Error('Raw next-page API failure'))
    fireEvent.click(screen.getByRole('button', { name: 'Cargar más' }))
    expect(await screen.findByText('No fue posible cargar las alertas operativas.')).toBeInTheDocument()
    expect(screen.getByText('First')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Approve|Reject|Acknowledge/ })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar la carga' }))
    await waitFor(() => expect(service.getOperationalAlerts).toHaveBeenCalledTimes(4))
  })
})
