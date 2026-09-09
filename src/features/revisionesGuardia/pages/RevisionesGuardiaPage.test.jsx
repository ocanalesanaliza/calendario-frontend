import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RevisionesGuardiaPage from './RevisionesGuardiaPage'

const { getSucursales, getGerentes, getUsuarios, getAnalitica } = vi.hoisted(() => ({
  getSucursales: vi.fn(),
  getGerentes: vi.fn(),
  getUsuarios: vi.fn(),
  getAnalitica: vi.fn(),
}))
vi.mock('../../sucursales/services/sucursalesService', () => ({ getSucursales }))
vi.mock('../../gerentes/services/gerentesService', () => ({ getGerentes }))
vi.mock('../../usuarios/services/usuariosService', () => ({ getUsuarios }))
vi.mock('../services/revisionesGuardiaAnaliticaService', () => ({ getAnaliticaRevisionesGuardia: getAnalitica }))

const revision = {
  id_revision_guardia: 9,
  fecha: '2026-09-09',
  sucursal: { id_sucursal: 15, nombre: 'Sucursal Centro', codigo: 'CENTRO-01' },
  gerente_area: { id_gerente_area: 2, nombre: 'GA Centro' },
  usuario: { id_usuario: 12, nombre: 'GS Ana' },
  guardias: [{ numero_guardia: 1, primer_nombre: 'María', primer_apellido: 'López', identidad: '0801-2000-12345', telefono: '9999-0000' }],
}

describe('RevisionesGuardiaPage', () => {
  beforeEach(() => {
    getSucursales.mockReset().mockResolvedValue([revision.sucursal])
    getGerentes.mockReset().mockResolvedValue([revision.gerente_area])
    getUsuarios.mockReset().mockResolvedValue([revision.usuario])
    getAnalitica.mockReset().mockResolvedValue({ count: 41, results: [revision] })
  })

  it('muestra las revisiones y aplica todos los filtros disponibles', async () => {
    render(<RevisionesGuardiaPage />)
    expect(await screen.findByText('María López')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2026-09-09' } })
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-09-01' } })
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-09-09' } })
    await screen.findByRole('option', { name: 'Sucursal Centro' })
    fireEvent.change(screen.getByLabelText('Sucursal'), { target: { value: '15' } })
    fireEvent.change(screen.getByLabelText('Gerente de área'), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText('GS'), { target: { value: '12' } })
    fireEvent.change(screen.getByLabelText('Buscar'), { target: { value: '0801' } })
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }))

    await waitFor(() => expect(getAnalitica).toHaveBeenLastCalledWith({
      fecha: '2026-09-09',
      fecha_inicio: '2026-09-01',
      fecha_fin: '2026-09-09',
      id_sucursal: '15',
      id_gerente_area: '2',
      id_usuario: '12',
      buscar: '0801',
      page: 1,
      page_size: 20,
    }))
  })

  it('envía page y page_size al navegar', async () => {
    render(<RevisionesGuardiaPage />)
    await screen.findByText('María López')
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    await waitFor(() => expect(getAnalitica).toHaveBeenLastCalledWith({ page: 2, page_size: 20 }))
    fireEvent.change(screen.getByLabelText('Por página'), { target: { value: '50' } })
    await waitFor(() => expect(getAnalitica).toHaveBeenLastCalledWith({ page: 1, page_size: 50 }))
  })
})
