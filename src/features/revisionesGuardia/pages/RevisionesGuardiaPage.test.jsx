import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RevisionesGuardiaPage from './RevisionesGuardiaPage'

const { getSucursales, getGerentes, getUsuarios, getAnalitica, gridProps } = vi.hoisted(() => ({
  getSucursales: vi.fn(),
  getGerentes: vi.fn(),
  getUsuarios: vi.fn(),
  getAnalitica: vi.fn(),
  gridProps: { current: null },
}))

vi.mock('@mui/x-data-grid', () => ({
  DataGrid: (props) => {
    gridProps.current = props
    return <div role="grid">
      {props.columns.map((column) => <span key={column.field}>{column.headerName}</span>)}
      {props.rows.map((row) => <div key={row.id}>{props.columns.map((column) => (
        column.renderCell ? <span key={column.field}>{column.renderCell({ row })}</span> : <span key={column.field}>{row[column.field]}</span>
      ))}</div>)}
      <button type="button" onClick={() => props.onPaginationModelChange({ ...props.paginationModel, page: props.paginationModel.page + 1 })}>Siguiente</button>
      <label>Por página<select value={props.paginationModel.pageSize} onChange={(event) => props.onPaginationModelChange({ page: props.paginationModel.page, pageSize: Number(event.target.value) })}><option value="10">10</option><option value="20">20</option><option value="50">50</option><option value="100">100</option></select></label>
    </div>
  },
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
  notas: 'La revisión fue completada y esta nota se muestra íntegramente en el detalle protegido.',
}

describe('RevisionesGuardiaPage', () => {
  beforeEach(() => {
    gridProps.current = null
    getSucursales.mockReset().mockResolvedValue([revision.sucursal])
    getGerentes.mockReset().mockResolvedValue([revision.gerente_area])
    getUsuarios.mockReset().mockResolvedValue([revision.usuario])
    getAnalitica.mockReset().mockResolvedValue({ count: 41, results: [revision] })
  })

  it('configura el grid con paginación de servidor y sin filtrado u ordenamiento local', async () => {
    render(<RevisionesGuardiaPage />)

    await screen.findByRole('grid')

    expect(gridProps.current).toMatchObject({
      rowCount: 41,
      paginationMode: 'server',
      sortingMode: 'server',
      filterMode: 'server',
      disableColumnFilter: true,
      disableColumnSorting: true,
    })
    expect(gridProps.current.columns.map(({ headerName }) => headerName)).toEqual([
      'Fecha', 'Sucursal', 'Código', 'Gerente de área', 'GS', 'Resultado', 'Cantidad de guardias', 'Nota resumida', 'Acción',
    ])
  })

  it('aplica filtros y reinicia la página API a 1', async () => {
    render(<RevisionesGuardiaPage />)
    await screen.findByRole('grid')
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
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

  it('convierte la página 0 del grid a página 1 de API y reinicia al cambiar pageSize', async () => {
    render(<RevisionesGuardiaPage />)
    await screen.findByRole('grid')
    expect(getAnalitica).toHaveBeenLastCalledWith({ page: 1, page_size: 20 })
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    await waitFor(() => expect(getAnalitica).toHaveBeenLastCalledWith({ page: 2, page_size: 20 }))
    fireEvent.change(screen.getByLabelText('Por página'), { target: { value: '50' } })
    await waitFor(() => expect(getAnalitica).toHaveBeenLastCalledWith({ page: 1, page_size: 50 }))
  })

  it('limpia filtros y reinicia la página API a 1', async () => {
    render(<RevisionesGuardiaPage />)
    await screen.findByRole('grid')
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
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

  it('abre el detalle desde la revisión original sin exponer PII en el grid ni solicitar datos adicionales', async () => {
    render(<RevisionesGuardiaPage />)
    await screen.findByRole('grid')
    const requestsBeforeOpen = getAnalitica.mock.calls.length

    expect(screen.getByRole('button', { name: 'Ver detalle' })).toBeEnabled()
    expect(screen.getByRole('grid')).not.toHaveTextContent('0801-2000-12345')
    expect(screen.getByRole('grid')).not.toHaveTextContent('9999-0000')
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalle' }))

    expect(screen.getByRole('dialog')).toHaveTextContent('Sucursal Centro')
    expect(screen.getByRole('dialog')).toHaveTextContent('María López')
    expect(screen.getByRole('dialog')).toHaveTextContent('0801-2000-12345')
    expect(screen.getByRole('dialog')).toHaveTextContent('9999-0000')
    expect(screen.getByRole('dialog')).toHaveTextContent(revision.notas)
    expect(getAnalitica).toHaveBeenCalledTimes(requestsBeforeOpen)
  })

  it('muestra guardias múltiples o ausencia de guardias con valores de presentación consistentes', async () => {
    getAnalitica.mockResolvedValueOnce({ count: 1, results: [{ ...revision, guardias: [] }] })
    const { unmount } = render(<RevisionesGuardiaPage />)
    await screen.findByRole('grid')
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalle' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('Cantidad de guardias0')
    expect(screen.getByText('No hay guardias registrados.')).toBeInTheDocument()
    unmount()

    getAnalitica.mockResolvedValueOnce({ count: 1, results: [{ ...revision, guardias: [revision.guardias[0], { numero_guardia: 2 }] }] })
    render(<RevisionesGuardiaPage />)
    await screen.findByRole('grid')
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalle' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('Número2')
    expect(screen.getByRole('dialog')).toHaveTextContent('Identidad—')
    expect(screen.getByRole('dialog')).toHaveTextContent('Teléfono—')
  })

  it('cierra por botón y Escape, restaura el foco y no solicita datos adicionales', async () => {
    render(<RevisionesGuardiaPage />)
    await screen.findByRole('grid')
    const trigger = screen.getByRole('button', { name: 'Ver detalle' })
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
    await screen.findByRole('grid')
    const trigger = screen.getByRole('button', { name: 'Ver detalle' })
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
