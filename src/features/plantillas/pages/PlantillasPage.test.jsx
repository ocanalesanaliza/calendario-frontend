import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PlantillasPage from './PlantillasPage'

const { getPlantillas } = vi.hoisted(() => ({ getPlantillas: vi.fn() }))

vi.mock('../services/plantillasService', () => ({
  getPlantillas,
  createPlantilla: vi.fn(),
  desactivarPlantilla: vi.fn(),
}))

describe('PlantillasPage', () => {
  beforeEach(() => getPlantillas.mockReset())

  it('shows a loading error instead of the empty list when the request fails', async () => {
    const requestError = Object.assign(new Error('No se pudieron cargar las plantillas.'), { status: 403 })
    let rejectRequest
    const request = new Promise((_, reject) => { rejectRequest = reject })
    getPlantillas.mockReturnValueOnce(request)

    render(<MemoryRouter><PlantillasPage /></MemoryRouter>)

    await waitFor(() => expect(getPlantillas).toHaveBeenCalledTimes(1))
    rejectRequest(requestError)

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron cargar las plantillas.')
    expect(screen.queryByText('No hay plantillas registradas.')).not.toBeInTheDocument()
  })
})
