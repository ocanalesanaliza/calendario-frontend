import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import RevisionesGuardiaPage from './RevisionesGuardiaPage'

const { getSucursales, getGerentes, getUsuarios, getAnalitica, aoaToSheet, bookNew, bookAppendSheet, writeFile } = vi.hoisted(() => ({
  getSucursales: vi.fn(),
  getGerentes: vi.fn(),
  getUsuarios: vi.fn(),
  getAnalitica: vi.fn(),
  aoaToSheet: vi.fn(),
  bookNew: vi.fn(),
  bookAppendSheet: vi.fn(),
  writeFile: vi.fn(),
}))

vi.mock('@mui/x-data-grid', () => ({
  DataGrid: ({ columns, rows }) => <div role="grid">{columns.map((column) => <span key={column.field}>{column.headerName}</span>)}{rows.map((row) => <div key={row.id}>{row.sucursal}</div>)}</div>,
}))
vi.mock('xlsx', () => ({
  utils: { aoa_to_sheet: aoaToSheet, book_new: bookNew, book_append_sheet: bookAppendSheet },
  writeFile,
}))
vi.mock('../../sucursales/services/sucursalesService', () => ({ getSucursales }))
vi.mock('../../gerentes/services/gerentesService', () => ({ getGerentes }))
vi.mock('../../usuarios/services/usuariosService', () => ({ getUsuarios }))
vi.mock('../services/revisionesGuardiaAnaliticaService', () => ({ getAnaliticaRevisionesGuardia: getAnalitica }))

const revision = {
  id_revision_guardia: 9,
  fecha: '2026-09-09',
  sucursal: { nombre: 'Sucursal Centro', codigo: 'CENTRO-01' },
  gerente_area: { nombre: 'GA Centro' },
  usuario: { nombre: 'GS Ana' },
  guardias: [{ numero_guardia: 1, identidad: '0801-2000-12345', telefono: '9999-0000', primer_nombre: 'María', primer_apellido: 'López', uniforme: { botas: false }, equipamiento: { porta_carnet: false } }],
  notas: 'Nota visible de la página.',
}

describe('RevisionesGuardiaPage export', () => {
  beforeEach(() => {
    vi.spyOn(Date.prototype, 'toISOString').mockReturnValue('2026-09-24T12:00:00.000Z')
    getSucursales.mockReset().mockResolvedValue([])
    getGerentes.mockReset().mockResolvedValue([])
    getUsuarios.mockReset().mockResolvedValue([])
    getAnalitica.mockReset().mockResolvedValue({ count: 41, results: [revision] })
    aoaToSheet.mockReset().mockReturnValue({ worksheet: true })
    bookNew.mockReset().mockReturnValue({ workbook: true })
    bookAppendSheet.mockReset()
    writeFile.mockReset()
  })

  afterEach(() => vi.restoreAllMocks())

  it('disables export when the current loaded page has no rows', async () => {
    getAnalitica.mockResolvedValueOnce({ count: 0, results: [] })
    render(<RevisionesGuardiaPage />)

    expect(await screen.findByText('No hay revisiones para los filtros aplicados.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Exportar a excel' })).toBeDisabled()
  })

  it('exports the loaded page into Revisiones then Guardias without further requests', async () => {
    render(<RevisionesGuardiaPage />)
    await screen.findByRole('grid')
    const requestsBeforeExport = [getSucursales, getGerentes, getUsuarios, getAnalitica].map((request) => request.mock.calls.length)

    expect(screen.getByText('Página actual: 1')).toBeInTheDocument()
    const exportButton = screen.getByRole('button', { name: 'Exportar a excel' })
    expect(exportButton).toBeInTheDocument()
    expect(exportButton.querySelector('svg[aria-hidden="true"]')).toBeInTheDocument()
    fireEvent.click(exportButton)

    const expectedSheetData = [
      ['Fecha', 'Sucursal', 'Código', 'Gerente de área', 'GS', 'Resultado', 'Cantidad de guardias', 'Nota'],
      ['2026-09-09', 'Sucursal Centro', 'CENTRO-01', 'GA Centro', 'GS Ana', 'Revisión realizada', 1, 'Nota visible de la página.'],
    ]
    await waitFor(() => expect(aoaToSheet).toHaveBeenNthCalledWith(1, expectedSheetData))
    expect(JSON.stringify(aoaToSheet.mock.calls[0][0])).not.toMatch(/identidad|tel[eé]fono|María|0801-2000-12345|9999-0000/i)
    expect(aoaToSheet).toHaveBeenNthCalledWith(2, [
      ['Fecha', 'Sucursal', 'Código', 'Gerente de sucursal', 'Resultado', 'Número de guardia', 'Nombre completo', 'Teléfono', 'Uniforme no portado', 'Equipamiento no portado', 'Nota'],
      ['2026-09-09', 'Sucursal Centro', 'CENTRO-01', 'GS Ana', 'Revisión realizada', 1, 'María López', '9999-0000', 'Botas', 'Porta carnet', 'Nota visible de la página.'],
    ])
    expect(JSON.stringify(aoaToSheet.mock.calls[1][0])).not.toMatch(/identidad|0801-2000-12345/i)
    expect(bookNew).toHaveBeenCalledOnce()
    expect(bookAppendSheet).toHaveBeenNthCalledWith(1, { workbook: true }, { worksheet: true }, 'Revisiones')
    expect(bookAppendSheet).toHaveBeenNthCalledWith(2, { workbook: true }, { worksheet: true }, 'Guardias')
    expect(writeFile).toHaveBeenCalledWith({ workbook: true }, 'revisiones-guardia-pagina-1-2026-09-24.xlsx')
    expect([getSucursales, getGerentes, getUsuarios, getAnalitica].map((request) => request.mock.calls.length)).toEqual(requestsBeforeExport)
  })
})
