import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { analizarPixeles, evaluarLogo, LOGO_ALTO, tamanoEnBarra } from './utils/logo'
import AparienciaPage from './pages/AparienciaPage'

const { apiRequest, useAuth, analizarLogo, ajustarLogo } = vi.hoisted(() => ({
  apiRequest: vi.fn(), useAuth: vi.fn(), analizarLogo: vi.fn(), ajustarLogo: vi.fn(),
}))
vi.mock('../../services/apiClient', () => ({ apiRequest }))
vi.mock('../auth/context/AuthContext', () => ({ useAuth }))
// El análisis real usa canvas (no existe en jsdom): en la página se simula su resultado.
vi.mock('./utils/logo', async (importOriginal) => ({ ...(await importOriginal()), analizarLogo, ajustarLogo }))

// Imagen sintética: `pintar(x, y)` devuelve [r, g, b, a].
function imagen(width, height, pintar) {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) data.set(pintar(x, y), (y * width + x) * 4)
  }
  return { width, height, data }
}

const TRANSPARENTE = [0, 0, 0, 0]
const BLANCO = [255, 255, 255, 255]

describe('análisis del logo', () => {
  it('calcula el tamaño en la barra con la misma regla que object-fit: contain', () => {
    expect(tamanoEnBarra(360, 120)).toEqual({ ancho: 132, alto: LOGO_ALTO })
    expect(tamanoEnBarra(800, 100)).toEqual({ ancho: 220, alto: 28 })
    expect(tamanoEnBarra(0, 10)).toBeNull()
  })

  it('detecta márgenes transparentes y el color del dibujo', () => {
    // Lienzo 100×40 con el dibujo (blanco) solo en x 20..79, y 10..29.
    const info = analizarPixeles(imagen(100, 40, (x, y) => (x >= 20 && x < 80 && y >= 10 && y < 30 ? BLANCO : TRANSPARENTE)))
    expect(info).toMatchObject({ ancho: 100, alto: 40, transparente: true, colorPromedio: '#FFFFFF' })
    expect(info.recorte).toEqual({ x: 20, y: 10, ancho: 60, alto: 20 })
  })

  it('detecta el fondo sólido por el color de las esquinas', () => {
    const info = analizarPixeles(imagen(50, 20, (x, y) => (x >= 10 && x < 40 && y >= 5 && y < 15 ? [14, 116, 144, 255] : BLANCO)))
    expect(info.transparente).toBe(false)
    expect(info.recorte).toEqual({ x: 10, y: 5, ancho: 30, alto: 10 })
    expect(info.colorPromedio).toBe('#0E7490')
  })

  it('recomienda ajustar márgenes, transparencia, proporción, resolución y contraste', () => {
    const conProblemas = evaluarLogo(
      { ancho: 400, alto: 200, transparente: false, recorte: { x: 50, y: 60, ancho: 300, alto: 40 }, colorPromedio: '#1E293B' },
      '#0F172A',
    )
    const avisos = Object.fromEntries(conProblemas.checks.map((check) => [check.clave, check]))
    expect(avisos.margenes.ok).toBe(false)
    expect(avisos.transparencia.ok).toBe(false)
    expect(avisos.proporcion.ok).toBe(false)
    expect(avisos.proporcion.texto).toContain('Muy alargado (7,5:1)')
    expect(avisos.resolucion.ok).toBe(false)
    expect(avisos.contraste.ok).toBe(false)
    expect(avisos.contraste.texto).toContain('versión clara')
    expect(conProblemas.ajustable).toBe(true)

    const correcto = evaluarLogo(
      { ancho: 360, alto: 120, transparente: true, recorte: { x: 0, y: 0, ancho: 360, alto: 120 }, colorPromedio: '#F8FAFC' },
      '#0F172A',
    )
    expect(correcto.checks.every((check) => check.ok)).toBe(true)
    expect(correcto.ajustable).toBe(false)
  })
})

describe('AparienciaPage: logo', () => {
  const VALORES = {
    color_primario: '#4F46E5', color_primario_hover: '#4338CA', color_acento: '#EA580C', color_fondo: '#EEF1F6', color_superficie: '#FFFFFF',
    color_texto: '#0F172A', color_texto_secundario: '#475569', color_borde: '#E2E8F0', color_menu_fondo: '#0F172A', color_menu_texto: '#CBD5E1',
    color_menu_activo: '#6366F1', color_menu_activo_texto: '#C7D2FE', color_boton_primario: '#4F46E5', color_boton_primario_texto: '#FFFFFF',
    color_boton_secundario: '#FFFFFF', color_boton_secundario_texto: '#334155', color_boton_peligro: '#DC2626', color_boton_peligro_texto: '#FFFFFF',
    color_exito: '#166534', color_advertencia: '#854D0E', color_error: '#B91C1C', fuente: 'Plus Jakarta Sans',
    logo_base64: 'data:image/png;base64,ORIGINAL',
  }
  const respuesta = (data) => ({ ok: true, status: 200, json: vi.fn().mockResolvedValue(data) })

  beforeEach(() => {
    useAuth.mockReturnValue({ perfil: { es_cuenta_sistemas: true } })
    apiRequest.mockReset().mockImplementation(async (path) => (path.includes('targets/')
      ? respuesta({ results: [{ empresa: { id: 1, nombre: 'Analiza' }, paises: [{ id: 5, nombre: 'Honduras', configurada: true }] }], catalogo: { grupos: [], colores: [], fuentes: ['Plus Jakarta Sans'], logo_max_kb: 256 } })
      : respuesta({ empresa: { id: 1, nombre: 'Analiza' }, pais: { id: 5, nombre: 'Honduras' }, configurada: true, apariencia: VALORES, valores_por_defecto: VALORES, advertencias: [], actualizado_por: null, updated_at: null })))
    analizarLogo.mockReset().mockImplementation(async (logo) => (logo.endsWith('ORIGINAL')
      ? { ancho: 400, alto: 200, transparente: true, recorte: { x: 50, y: 60, ancho: 300, alto: 100 }, colorPromedio: '#1E293B' }
      : { ancho: 300, alto: 100, transparente: true, recorte: { x: 0, y: 0, ancho: 300, alto: 100 }, colorPromedio: '#F8FAFC' }))
    ajustarLogo.mockReset().mockResolvedValue('data:image/png;base64,AJUSTADO')
  })

  function subir(file) {
    fireEvent.change(screen.getByLabelText('Subir logo'), { target: { files: [file] } })
  }

  it('acepta archivos de hasta 8 MB y reduce automáticamente los que pasan de 256 KB', async () => {
    render(<AparienciaPage />)
    await screen.findByRole('list', { name: 'Revisión del logo' })

    subir(new File([new Uint8Array(3 * 1024 * 1024)], 'marca.png', { type: 'image/png' }))

    expect(await screen.findByText(/El logo pesaba 3,0 MB; se redujo automáticamente a/)).toBeInTheDocument()
    expect(ajustarLogo).toHaveBeenCalledWith(expect.stringMatching(/^data:image\/png;base64,/))
    expect(screen.getByRole('img', { name: 'Logo actual' })).toHaveAttribute('src', 'data:image/png;base64,AJUSTADO')
  })

  it('no ajusta un archivo pequeño y rechaza el que supera 8 MB', async () => {
    render(<AparienciaPage />)
    await screen.findByRole('list', { name: 'Revisión del logo' })

    subir(new File([new Uint8Array(10 * 1024)], 'marca.png', { type: 'image/png' }))
    await waitFor(() => expect(screen.getByRole('img', { name: 'Logo actual' }).getAttribute('src')).toMatch(/^data:image\/png;base64,AAAA/))
    expect(ajustarLogo).not.toHaveBeenCalled()

    subir(new File([new Uint8Array(8 * 1024 * 1024 + 1)], 'enorme.png', { type: 'image/png' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('El archivo pesa 8,0 MB; el máximo para subir es 8,0 MB.')
    expect(ajustarLogo).not.toHaveBeenCalled()
  })

  it('revisa el logo, ofrece ajustarlo y vuelve a revisar el resultado', async () => {
    render(<AparienciaPage />)

    const revision = await screen.findByRole('list', { name: 'Revisión del logo' })
    expect(within(revision).getByText(/márgenes vacíos/)).toBeInTheDocument()
    expect(within(revision).getByText(/Se confunde con el fondo del menú/)).toBeInTheDocument()
    expect(screen.getByText(/el dibujo ocupará unos 132 × 44 px/)).toBeInTheDocument()
    expect(screen.getByText('Recomendaciones para que el logo se vea bien')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Ajustar logo automáticamente' }))

    await waitFor(() => expect(ajustarLogo).toHaveBeenCalledWith('data:image/png;base64,ORIGINAL'))
    expect(await screen.findByText(/Logo ajustado/)).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Logo actual' })).toHaveAttribute('src', 'data:image/png;base64,AJUSTADO')
    expect(await screen.findByText('Sin márgenes sobrantes alrededor.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ajustar logo automáticamente' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Guardar 1 cambio/ })).toBeEnabled()
  })
})
