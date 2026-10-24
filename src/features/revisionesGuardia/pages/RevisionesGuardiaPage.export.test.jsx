import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import RevisionesGuardiaPage from './RevisionesGuardiaPage'

const { getSucursales, getGerentes, getUsuarios, getAnalitica, aoaToSheet, bookNew, bookAppendSheet, writeFile, encodeCol } = vi.hoisted(() => ({
  getSucursales: vi.fn(),
  getGerentes: vi.fn(),
  getUsuarios: vi.fn(),
  getAnalitica: vi.fn(),
  aoaToSheet: vi.fn(),
  bookNew: vi.fn(),
  bookAppendSheet: vi.fn(),
  writeFile: vi.fn(),
  encodeCol: vi.fn(),
}))

vi.mock('xlsx', () => ({
  utils: { aoa_to_sheet: aoaToSheet, book_new: bookNew, book_append_sheet: bookAppendSheet, encode_col: encodeCol },
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
    aoaToSheet.mockReset().mockImplementation((data) => ({ data }))
    bookNew.mockReset().mockReturnValue({ workbook: true })
    bookAppendSheet.mockReset()
    writeFile.mockReset()
    encodeCol.mockReset().mockImplementation((index) => String.fromCharCode(65 + index))
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
    await screen.findByRole('table')
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
    await waitFor(() => expect(aoaToSheet).toHaveBeenCalledTimes(2))
    expect(aoaToSheet).toHaveBeenNthCalledWith(1, [
      ['Revisiones de guardia'],
      ['Página 1', 'Generado: 2026-09-24T12:00:00.000Z'],
      [],
      ...expectedSheetData,
    ])
    expect(JSON.stringify(aoaToSheet.mock.calls[0][0])).not.toMatch(/identidad|tel[eé]fono|María|0801-2000-12345|9999-0000/i)
    expect(aoaToSheet).toHaveBeenNthCalledWith(2, [
      ['Revisiones de guardia'],
      ['Página 1', 'Generado: 2026-09-24T12:00:00.000Z'],
      [],
      ['Fecha', 'Sucursal', 'Código', 'Gerente de sucursal', 'Resultado', 'Número de guardia', 'Nombre completo', 'Teléfono', 'Uniforme no portado', 'Equipamiento no portado', 'Nota'],
      ['2026-09-09', 'Sucursal Centro', 'CENTRO-01', 'GS Ana', 'Revisión realizada', 1, 'María López', '9999-0000', 'Botas', 'Porta carnet', 'Nota visible de la página.'],
    ])
    expect(JSON.stringify(aoaToSheet.mock.calls[1][0])).not.toMatch(/identidad|0801-2000-12345/i)
    expect(aoaToSheet.mock.results[0].value).toMatchObject({
      '!cols': [{ wch: 12 }, { wch: 28 }, { wch: 16 }, { wch: 28 }, { wch: 24 }, { wch: 24 }, { wch: 22 }, { wch: 42 }],
      '!rows': [{}, {}, {}, { hpt: 32 }],
      '!autofilter': { ref: 'A4:H5' },
    })
    expect(aoaToSheet.mock.results[1].value).toMatchObject({
      '!cols': [{ wch: 12 }, { wch: 28 }, { wch: 16 }, { wch: 28 }, { wch: 24 }, { wch: 18 }, { wch: 32 }, { wch: 16 }, { wch: 42 }, { wch: 42 }, { wch: 42 }],
      '!rows': [{}, {}, {}, { hpt: 32 }],
      '!autofilter': { ref: 'A4:K5' },
    })
    expect(bookNew).toHaveBeenCalledOnce()
    expect(bookNew.mock.results[0].value).toMatchObject({
      Props: {
        Title: 'Revisiones de guardia',
        Subject: 'Página 1 exportada el 2026-09-24T12:00:00.000Z',
        Author: 'Calendario',
        CreatedDate: expect.any(Date),
      },
    })
    expect(bookAppendSheet).toHaveBeenNthCalledWith(1, { workbook: true, Props: expect.any(Object) }, aoaToSheet.mock.results[0].value, 'Revisiones')
    expect(bookAppendSheet).toHaveBeenNthCalledWith(2, { workbook: true, Props: expect.any(Object) }, aoaToSheet.mock.results[1].value, 'Guardias')
    expect(writeFile).toHaveBeenCalledWith({ workbook: true, Props: expect.any(Object) }, 'revisiones-guardia-pagina-1-2026-09-24.xlsx')
    expect([getSucursales, getGerentes, getUsuarios, getAnalitica].map((request) => request.mock.calls.length)).toEqual(requestsBeforeExport)
  })
})
