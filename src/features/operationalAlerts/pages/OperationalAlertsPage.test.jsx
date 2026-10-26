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

    fireEvent.click(screen.getByRole('tab', { name: 'History' }))
    expect(await screen.findByText('Historical')).toBeInTheDocument()
    expect(service.getOperationalAlerts).toHaveBeenLastCalledWith({ scope: 'history', limit: 25 })
    expect(screen.queryByText('Active', { selector: 'strong' })).not.toBeInTheDocument()
  })

  it('shows meaningful empty states and a backend 403 state', async () => {
    service.getOperationalAlerts.mockResolvedValueOnce(page([])).mockRejectedValueOnce(Object.assign(new Error('Forbidden'), { status: 403 }))
    const { rerender } = render(<OperationalAlertsPage />)
    expect(await screen.findByText(/No active operational alerts/)).toBeInTheDocument()

    rerender(<OperationalAlertsPage key="forbidden" />)
    expect(await screen.findByText(/not authorized/i)).toBeInTheDocument()
    expect(screen.getByText(/server remains authoritative/i)).toBeInTheDocument()
  })

  it('shows the history empty state and a retryable generic API error', async () => {
    service.getOperationalAlerts.mockResolvedValueOnce(page([])).mockRejectedValueOnce(new Error('Service unavailable'))
    render(<OperationalAlertsPage />)
    expect(await screen.findByText(/No active operational alerts/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'History' }))
    expect(await screen.findByText('Service unavailable')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    await waitFor(() => expect(service.getOperationalAlerts).toHaveBeenCalledTimes(3))
  })

  it('renders the history-specific empty state', async () => {
    service.getOperationalAlerts.mockResolvedValueOnce(page([])).mockResolvedValueOnce(page([]))
    render(<OperationalAlertsPage />)
    await screen.findByText(/No active operational alerts/)

    fireEvent.click(screen.getByRole('tab', { name: 'History' }))
    expect(await screen.findByText(/No operational-alert history/)).toBeInTheDocument()
  })

  it('appends a cursor page, prevents duplicate loading, and retains rows on cursor errors', async () => {
    let resolveNext
    service.getOperationalAlerts.mockResolvedValueOnce(page([alert('a', 'First', 'Open')], 'cursor-a')).mockImplementationOnce(() => new Promise((resolve) => { resolveNext = resolve }))
    render(<OperationalAlertsPage />)
    await screen.findByText('First')

    fireEvent.click(screen.getByRole('button', { name: 'Load more' }))
    fireEvent.click(screen.getByRole('button', { name: 'Loading more…' }))
    expect(service.getOperationalAlerts).toHaveBeenCalledTimes(2)
    resolveNext(page([alert('b', 'Second', 'Retry')], 'cursor-b'))
    expect(await screen.findByText('Second')).toBeInTheDocument()

    service.getOperationalAlerts.mockRejectedValueOnce(new Error('Next page failed'))
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }))
    expect(await screen.findByText(/Next page failed/)).toBeInTheDocument()
    expect(screen.getByText('First')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Approve|Reject|Acknowledge/ })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Retry loading more' }))
    await waitFor(() => expect(service.getOperationalAlerts).toHaveBeenCalledTimes(4))
  })
})
