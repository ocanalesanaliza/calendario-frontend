import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MisTareasPage from './MisTareasPage'

const { getMisTareas, registrarTarea, registrarTareasLote, getTrabajosCampo } = vi.hoisted(() => ({ getMisTareas: vi.fn(), registrarTarea: vi.fn(), registrarTareasLote: vi.fn(), getTrabajosCampo: vi.fn() }))
let perfil = { type: 'gerente_sucursal', sucursal: { nombre: 'Sucursal Norte' } }

vi.mock('../services/operacionService', () => ({ getMisTareas, registrarTarea, registrarTareasLote }))
vi.mock('../../trabajosCampo/services/trabajosCampoService', () => ({ getTrabajosCampo, aceptarTrabajoCampo: vi.fn(), rechazarTrabajoCampo: vi.fn() }))
vi.mock('../../auth/context/AuthContext', () => ({ useAuth: () => ({ perfil }) }))

const taskResponse = { meta: { fecha_consultada: '2026-09-05', hora_servidor: '10:00', jornada_servidor: 'manana' }, resumen: { total: 1, disponibles: 1, registradas: 0, cerradas: 0, bloqueadas: 0, manana: { total: 1 }, tarde: { total: 0 } }, results: [{ id_sucursal_tarea: 44, jornada: 'manana', hora: '09:00', hora_fin_registro: '18:00', disponible_para_registro: true, estado_ui: 'disponible', estado_ui_label: 'Disponible', tarea: { id_tarea: 18, nombre: 'Envio de deposito de Sucursal.' } }] }

describe('MisTareasPage deposit demonstrations', () => {
  beforeEach(() => { perfil = { type: 'gerente_sucursal', sucursal: { nombre: 'Sucursal Norte' } }; getMisTareas.mockReset().mockResolvedValue(taskResponse); getTrabajosCampo.mockReset().mockResolvedValue({ results: [] }); registrarTarea.mockReset(); registrarTareasLote.mockReset() })

  it('opens the GS deposit demo, validates cash sales, and shows local feedback without registering', async () => {
    render(<MisTareasPage />)
    const checkbox = await screen.findByRole('checkbox', { name: /Seleccionar Envio de deposito/i })
    fireEvent.click(checkbox)
    fireEvent.click(screen.getByRole('button', { name: /Registrar 1 tarea/i }))
    expect(await screen.findByRole('dialog', { name: 'Registrar depósito' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Ventas totales'), { target: { value: '100' } })
    fireEvent.change(screen.getByLabelText('Ventas en efectivo'), { target: { value: '101' } })
    expect(screen.getByRole('alert')).toHaveTextContent('no pueden superar')
    fireEvent.change(screen.getByLabelText('Ventas en efectivo'), { target: { value: '80' } })
    fireEvent.change(screen.getByLabelText('Efectivo depositado'), { target: { value: '80' } })
    fireEvent.change(screen.getByLabelText('Referencia'), { target: { value: 'REF-01' } })
    fireEvent.change(screen.getByLabelText('Fecha real de depósito'), { target: { value: '2026-09-05' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar para revisión' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('El depósito se envió para revisión a su gerente de área.')
    expect(registrarTarea).not.toHaveBeenCalled()
  })

  it('shows the GA review demo and its local approval and correction feedback', async () => {
    perfil = { type: 'gerente_area' }
    render(<MisTareasPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Revisar depósito' }))
    expect(await screen.findByText('María González')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Solicitar corrección' }))
    expect(screen.getByText('El comentario es obligatorio para solicitar corrección.')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Comentario de corrección'), { target: { value: 'Adjunta el comprobante.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar solicitud de corrección' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('La solicitud de corrección fue enviada al gerente de sucursal.')
    fireEvent.click(screen.getByRole('button', { name: 'Aprobar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('El depósito fue aprobado.')
    expect(getMisTareas).not.toHaveBeenCalled()
  })
})
