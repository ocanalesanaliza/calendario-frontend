import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AusenciasAreaPage from './AusenciasAreaPage'

const { useAuth, getGAVacationRequests, createGAVacationRequest, actOnGAVacationRequest } = vi.hoisted(() => ({ useAuth: vi.fn(), getGAVacationRequests: vi.fn(), createGAVacationRequest: vi.fn(), actOnGAVacationRequest: vi.fn() }))
vi.mock('../../auth/context/AuthContext', () => ({ useAuth }))
vi.mock('../../calendarArea/services/gaVacationRequestsService', () => ({ getGAVacationRequests, createGAVacationRequest, actOnGAVacationRequest }))
vi.mock('../../calendarArea/services/calendarAreaApi', () => ({ createIdempotencyKey: () => 'command-key' }))

const ga = { type: 'gerente_area', activo: true, habilitado: true }
const manager = { type: 'gerente_operaciones', activo: true, habilitado: true }
const request = { id: 4, date: '2026-09-10', status: 'pending', segments: [{ date: '2026-09-10', slot: 'morning' }] }
function setup(profile = ga) { useAuth.mockReturnValue({ perfil: profile }); getGAVacationRequests.mockResolvedValue({ results: [request] }); render(<AusenciasAreaPage />) }

describe('AusenciasAreaPage vacations', () => {
  beforeEach(() => { vi.clearAllMocks(); createGAVacationRequest.mockResolvedValue({}); actOnGAVacationRequest.mockResolvedValue({}) })
  it('creates a GA vacation request with segments and a command key', async () => { setup(); await screen.findByText('Mis solicitudes'); fireEvent.click(screen.getByRole('button', { name: 'Nueva solicitud' })); fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2026-10-01' } }); fireEvent.change(screen.getByLabelText('Jornada'), { target: { value: 'afternoon' } }); fireEvent.click(screen.getByRole('button', { name: 'Solicitar vacaciones' })); await waitFor(() => expect(createGAVacationRequest).toHaveBeenCalledWith({ segments: [{ date: '2026-10-01', slot: 'afternoon' }] }, 'command-key')) })
  it('allows GO to approve and reject vacation requests', async () => { setup(manager); await screen.findByText('Solicitudes de vacaciones'); fireEvent.click(screen.getByRole('button', { name: 'Aprobar' })); const dialog = screen.getByRole('dialog', { name: 'Aprobar vacaciones' }); fireEvent.change(within(dialog).getByLabelText('Motivo'), { target: { value: 'Validada' } }); fireEvent.click(within(dialog).getByRole('button', { name: 'Aprobar' })); await waitFor(() => expect(actOnGAVacationRequest).toHaveBeenCalledWith(4, 'approve', { reason: 'Validada' }, 'command-key')) })
})
