import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import * as XLSX from 'xlsx'
import { describe, expect, it } from 'vitest'
import InventarioDemoPage from './InventarioDemoPage'

const headers = ['Codigo Producto', 'Producto', 'Costo', 'Sucursal', 'Punto de Reorden', 'Existencia']

function archivoExcel(filas, nombre = 'inventario.xlsx') {
  const libro = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet([headers, ...filas]), 'Inventario')
  const bytes = XLSX.write(libro, { type: 'array', bookType: 'xlsx' })
  return new File([bytes], nombre, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

function renderPagina() {
  const resultado = render(<MemoryRouter><InventarioDemoPage /></MemoryRouter>)
  const input = resultado.container.querySelector('input[type="file"]')
  return { ...resultado, input }
}

describe('InventarioDemoPage', () => {
  it('carga el Excel y muestra sucursal, avance y estado pendiente', async () => {
    const { input } = renderPagina()

    fireEvent.change(input, { target: { files: [archivoExcel([['A-1', 'Arroz', 12.5, 'Centro', 4, 8], ['B-2', 'Frijoles', 10, 'Centro', 2, 3]])] } })

    expect(await screen.findByText('2 productos listos para conteo.')).toBeInTheDocument()
    expect(screen.getByText('Centro')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: '0 de 2 productos contados' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pendientes (2)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirmar resumen local' })).toBeDisabled()
  })

  it('rechaza archivos que no son .xlsx con un mensaje que explica cómo resolverlo', async () => {
    const { input } = renderPagina()

    fireEvent.change(input, { target: { files: [new File(['a,b'], 'inventario.csv', { type: 'text/csv' })] } })

    expect(await screen.findByText(/debe ser un Excel \.xlsx/)).toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })
})
