import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import DepositosPendientesPage from './DepositosPendientesPage'

describe('DepositosPendientesPage', () => {
  it('redirects the retired static GA demo route to the area calendar', () => {
    render(<MemoryRouter initialEntries={['/depositospendientes']}><Routes><Route path="/depositospendientes" element={<DepositosPendientesPage />} /><Route path="/calendario-area" element={<p>Calendario del área</p>} /></Routes></MemoryRouter>)
    expect(screen.getByText('Calendario del área')).toBeInTheDocument()
    expect(screen.queryByText('Revisión demostrativa de depósitos pendientes del día.')).not.toBeInTheDocument()
  })
})
