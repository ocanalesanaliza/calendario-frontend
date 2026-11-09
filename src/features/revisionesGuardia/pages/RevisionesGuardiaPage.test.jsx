import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
  guardias: [{
    numero_guardia: 1,
    primer_nombre: 'María',
    primer_apellido: 'López',
    identidad: '0801-2000-12345',
    telefono: '9999-0000',
    uniforme: { botas: false, zapatillas: true, pantalon_jean: false },
    equipamiento: { porta_carnet: false, revolver: true },
  }],
  notas: 'La revisión fue completada y esta nota se muestra íntegramente en el detalle protegido.',
}

describe('RevisionesGuardiaPage', () => {
  beforeEach(() => {
    getSucursales.mockReset().mockResolvedValue([revision.sucursal])
    getGerentes.mockReset().mockResolvedValue([revision.gerente_area])
    getUsuarios.mockReset().mockResolvedValue([revision.usuario])
    getAnalitica.mockReset().mockResolvedValue({ count: 41, results: [revision] })
  })

  it('muestra la tabla compacta con 6 columnas y la paginación del servidor', async () => {
    render(<RevisionesGuardiaPage />)

    const tabla = await screen.findByRole('table')
    expect(within(tabla).getAllByRole('columnheader').map((th) => th.textContent)).toEqual([
      'Fecha', 'Sucursal', 'Responsables', 'Resultado', 'Guardias', 'Nota', 'Acciones',
    ])
    const fila = within(tabla).getAllByRole('row')[1]
    expect(fila).toHaveTextContent('9 sep2026')
    expect(fila).toHaveTextContent('Sucursal CentroCENTRO-01')
    expect(fila).toHaveTextContent('GS AnaGA: GA Centro')
    expect(within(fila).getByText('Realizada')).toHaveClass('tuvet-badge-aprobada')
    expect(screen.getByText('Mostrando 1–1 de 41 revisiones')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Página 1' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: 'Página 3' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Página anterior' })).toBeDisabled()
  })

  it('aplica filtros y reinicia la página API a 1', async () => {
    render(<RevisionesGuardiaPage />)
    await screen.findByRole('table')
    fireEvent.click(screen.getByRole('button', { name: 'Página siguiente' }))
    await waitFor(() => expect(getAnalitica).toHaveBeenLastCalledWith({ page: 2, page_size: 20 }))
    fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2026-09-09' } })
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-09-01' } })
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-09-09' } })
    await screen.findByRole('option', { name: 'Sucursal Centro' })
    fireEvent.change(screen.getByLabelText('Sucursal'), { target: { value: '15' } })
    fireEvent.change(screen.getByLabelText('Gerente de área'), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText('GS'), { target: { value: '12' } })
    fireEvent.change(screen.getByLabelText('Buscar'), { target: { value: 'Centro' } })
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }))

    await waitFor(() => expect(getAnalitica).toHaveBeenLastCalledWith({
      fecha: '2026-09-09', fecha_inicio: '2026-09-01', fecha_fin: '2026-09-09', id_sucursal: '15', id_gerente_area: '2', id_usuario: '12', buscar: 'Centro', page: 1, page_size: 20,
    }))
  })

  it('convierte la página 1 de la tabla a página 1 de API y reinicia al cambiar pageSize', async () => {
    render(<RevisionesGuardiaPage />)
    await screen.findByRole('table')
    expect(getAnalitica).toHaveBeenLastCalledWith({ page: 1, page_size: 20 })
    fireEvent.click(screen.getByRole('button', { name: 'Página siguiente' }))
    await waitFor(() => expect(getAnalitica).toHaveBeenLastCalledWith({ page: 2, page_size: 20 }))
    fireEvent.change(screen.getByLabelText('Por página'), { target: { value: '50' } })
    await waitFor(() => expect(getAnalitica).toHaveBeenLastCalledWith({ page: 1, page_size: 50 }))
  })

  it('rellena Desde y Hasta con los atajos de rango sin consultar hasta aplicar', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 22, 10, 0))
    try {
      render(<RevisionesGuardiaPage />)
      await screen.findByRole('table')
      const llamadas = getAnalitica.mock.calls.length

      fireEvent.click(screen.getByRole('button', { name: 'Últimos 7 días' }))
      expect(screen.getByLabelText('Desde')).toHaveValue('2026-10-16')
      expect(screen.getByLabelText('Hasta')).toHaveValue('2026-10-22')
      fireEvent.click(screen.getByRole('button', { name: 'Este mes' }))
      expect(screen.getByLabelText('Desde')).toHaveValue('2026-10-01')
      expect(getAnalitica).toHaveBeenCalledTimes(llamadas)

      fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }))
      await waitFor(() => expect(getAnalitica).toHaveBeenLastCalledWith({ fecha_inicio: '2026-10-01', fecha_fin: '2026-10-22', page: 1, page_size: 20 }))
    } finally {
      vi.useRealTimers()
    }
  })

  it('marca con insignia las revisiones donde no se presentó guardia', async () => {
    getAnalitica.mockResolvedValueOnce({ count: 1, results: [{ ...revision, no_se_presento_guardia: true }] })
    render(<RevisionesGuardiaPage />)
    await screen.findByRole('table')

    expect(screen.getByText('Sin guardia')).toHaveClass('tuvet-badge-vencida')
    expect(screen.getAllByRole('row')[1]).toHaveClass('rk-sin-guardia')
    expect(screen.getByText('1 sin guardia en esta página')).toBeInTheDocument()
  })

  it('limpia filtros y reinicia la página API a 1', async () => {
    render(<RevisionesGuardiaPage />)
    await screen.findByRole('table')
    fireEvent.click(screen.getByRole('button', { name: 'Página siguiente' }))
    await waitFor(() => expect(getAnalitica).toHaveBeenLastCalledWith({ page: 2, page_size: 20 }))
    fireEvent.change(screen.getByLabelText('Buscar'), { target: { value: 'Centro' } })
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar' }))

    await waitFor(() => expect(getAnalitica).toHaveBeenLastCalledWith({ page: 1, page_size: 20 }))
  })

  it('conserva los estados de carga, error y vacío', async () => {
    getAnalitica.mockRejectedValueOnce(new Error('No se pudo cargar'))
    const { unmount } = render(<RevisionesGuardiaPage />)
    expect(screen.getByText('Cargando revisiones...')).toBeInTheDocument()
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cargar')
    unmount()

    getAnalitica.mockResolvedValueOnce({ count: 0, results: [] })
    render(<RevisionesGuardiaPage />)
    expect(await screen.findByText('No hay revisiones para los filtros aplicados.')).toBeInTheDocument()
  })

  it('abre el detalle desde la revisión original sin exponer PII en la tabla ni solicitar datos adicionales', async () => {
    render(<RevisionesGuardiaPage />)
    await screen.findByRole('table')
    const requestsBeforeOpen = getAnalitica.mock.calls.length

    expect(screen.getByRole('button', { name: /^Ver detalle/ })).toBeEnabled()
    expect(screen.getByRole('table')).not.toHaveTextContent('0801-2000-12345')
    expect(screen.getByRole('table')).not.toHaveTextContent('9999-0000')
    fireEvent.click(screen.getByRole('button', { name: /^Ver detalle/ }))

    expect(screen.getByRole('dialog')).toHaveTextContent('Sucursal Centro')
    expect(screen.getByRole('dialog')).toHaveTextContent('María López')
    expect(screen.getByRole('dialog')).toHaveTextContent('0801-2000-12345')
    expect(screen.getByRole('dialog')).toHaveTextContent('9999-0000')
    expect(screen.getByRole('dialog')).toHaveTextContent(revision.notas)
    expect(screen.getByRole('dialog')).toHaveTextContent('Uniforme no portadoBotasPantalón jean')
    expect(screen.getByRole('dialog')).toHaveTextContent('Equipamiento no portadoPorta carnet')
    expect(screen.getByRole('dialog')).not.toHaveTextContent('Zapatillas')
    expect(screen.getByRole('dialog')).not.toHaveTextContent('Revólver')
    expect(screen.getByRole('dialog')).toHaveTextContent('Gerente de sucursalGS Ana')
    expect(screen.getByRole('dialog')).not.toHaveTextContent('Código')
    expect(screen.getByRole('dialog')).not.toHaveTextContent('Gerente de área')
    expect(getAnalitica).toHaveBeenCalledTimes(requestsBeforeOpen)
  })

  it('no trata campos ausentes como faltantes de uniforme o equipamiento', async () => {
    getAnalitica.mockResolvedValueOnce({ count: 1, results: [{ ...revision, guardias: [{ numero_guardia: 1, uniforme: { botas: true }, equipamiento: {} }] }] })
    render(<RevisionesGuardiaPage />)
    await screen.findByRole('table')
    fireEvent.click(screen.getByRole('button', { name: /^Ver detalle/ }))

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent('Uniforme no portadoSin faltantes de uniforme.')
    expect(dialog).toHaveTextContent('Equipamiento no portadoSin faltantes de equipamiento.')
    expect(dialog).not.toHaveTextContent('Camisa con logo')
    expect(dialog).not.toHaveTextContent('Escopeta')
  })

  it('muestra guardias múltiples o ausencia de guardias con valores de presentación consistentes', async () => {
    getAnalitica.mockResolvedValueOnce({ count: 1, results: [{ ...revision, guardias: [] }] })
    const { unmount } = render(<RevisionesGuardiaPage />)
    await screen.findByRole('table')
    fireEvent.click(screen.getByRole('button', { name: /^Ver detalle/ }))
    expect(screen.getByRole('dialog')).toHaveTextContent('Cantidad de guardias0')
    expect(screen.getByText('No hay guardias registrados.')).toBeInTheDocument()
    unmount()

    getAnalitica.mockResolvedValueOnce({ count: 1, results: [{ ...revision, guardias: [revision.guardias[0], { numero_guardia: 2 }] }] })
    render(<RevisionesGuardiaPage />)
    await screen.findByRole('table')
    fireEvent.click(screen.getByRole('button', { name: /^Ver detalle/ }))
    expect(screen.getByRole('dialog')).toHaveTextContent('Número2')
    expect(screen.getByRole('dialog')).toHaveTextContent('Identidad—')
    expect(screen.getByRole('dialog')).toHaveTextContent('Teléfono—')
  })

  it('cierra por botón y Escape, restaura el foco y no solicita datos adicionales', async () => {
    render(<RevisionesGuardiaPage />)
    await screen.findByRole('table')
    const trigger = screen.getByRole('button', { name: /^Ver detalle/ })
    const requestsBeforeClose = getAnalitica.mock.calls.length

    trigger.focus()
    fireEvent.click(trigger)
    const closeButton = screen.getByRole('button', { name: 'Cerrar detalle' })
    expect(closeButton).toHaveFocus()
    fireEvent.click(closeButton)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()

    fireEvent.click(trigger)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
    expect(getAnalitica).toHaveBeenCalledTimes(requestsBeforeClose)
  })

  it('contiene Tab dentro del diálogo', async () => {
    render(<RevisionesGuardiaPage />)
    await screen.findByRole('table')
    const trigger = screen.getByRole('button', { name: /^Ver detalle/ })
    trigger.focus()
    fireEvent.click(trigger)

    const dialog = screen.getByRole('dialog')
    const first = screen.getByRole('button', { name: 'Cerrar detalle' })
    const last = screen.getByRole('button', { name: 'Cerrar', exact: true })
    expect(first).toHaveFocus()
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true })
    expect(last).toHaveFocus()
    fireEvent.keyDown(last, { key: 'Tab' })
    expect(first).toHaveFocus()
    expect(dialog).toBeInTheDocument()
  })
})
