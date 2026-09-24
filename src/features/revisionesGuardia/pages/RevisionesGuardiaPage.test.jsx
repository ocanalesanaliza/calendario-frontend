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
      {props.rows.map((row) => <div key={row.id}>{Object.values(row).join(' ')}</div>)}
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
})
