import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { aplicarApariencia, construirCss, urlFuente } from './aplicarApariencia'
import { contraste, mezclar, revisarContrastes } from './utils/color'
import AparienciaPage from './pages/AparienciaPage'

const { apiRequest, useAuth } = vi.hoisted(() => ({ apiRequest: vi.fn(), useAuth: vi.fn() }))
vi.mock('../../services/apiClient', () => ({ apiRequest }))
vi.mock('../auth/context/AuthContext', () => ({ useAuth }))

const respuesta = (data, ok = true, status = ok ? 200 : 400) => ({ ok, status, json: vi.fn().mockResolvedValue(data) })

const VALORES = {
  color_primario: '#4F46E5', color_primario_hover: '#4338CA', color_acento: '#EA580C',
  color_fondo: '#EEF1F6', color_superficie: '#FFFFFF', color_texto: '#0F172A', color_texto_secundario: '#475569', color_borde: '#E2E8F0',
  color_menu_fondo: '#0F172A', color_menu_texto: '#CBD5E1', color_menu_activo: '#6366F1', color_menu_activo_texto: '#C7D2FE',
  color_boton_primario: '#4F46E5', color_boton_primario_texto: '#FFFFFF', color_boton_secundario: '#FFFFFF', color_boton_secundario_texto: '#334155',
  color_boton_peligro: '#DC2626', color_boton_peligro_texto: '#FFFFFF', color_exito: '#166534', color_advertencia: '#854D0E', color_error: '#B91C1C',
  fuente: 'Plus Jakarta Sans', logo_base64: null,
}

const CATALOGO = {
  grupos: [{ clave: 'marca', nombre: 'Marca' }, { clave: 'botones', nombre: 'Botones' }],
  colores: [
    { campo: 'color_primario', etiqueta: 'Color principal', grupo: 'marca' },
    { campo: 'color_boton_primario', etiqueta: 'Botón principal', grupo: 'botones' },
    { campo: 'color_boton_primario_texto', etiqueta: 'Texto del botón principal', grupo: 'botones' },
  ],
  fuentes: ['Plus Jakarta Sans', 'Inter'],
  logo_max_kb: 256,
}

const DETALLE = {
  empresa: { id: 1, nombre: 'Analiza', modulo_calendario: 'tareas' },
  pais: { id: 5, nombre: 'Honduras' },
  configurada: false,
  apariencia: VALORES,
  valores_por_defecto: VALORES,
  advertencias: [],
  actualizado_por: null,
  updated_at: null,
}

describe('utilidades de color', () => {
  it('calcula contraste WCAG y mezcla colores', () => {
    expect(contraste('#FFFFFF', '#000000')).toBe(21)
    expect(contraste('#FFFFFF', '#4F46E5')).toBe(6.29)
    expect(contraste('azul', '#FFFFFF')).toBeNull()
    expect(mezclar('#000000', '#FFFFFF', 0.5)).toBe('#808080')
  })

  it('marca los textos con contraste insuficiente y se queda con el peor fondo', () => {
    const revision = revisarContrastes({ ...VALORES, color_boton_primario: '#A5B4FC' })
    expect(revision.color_boton_primario_texto.ok).toBe(false)
    expect(revision.color_texto.ok).toBe(true)
    expect(revision.color_texto.fondo).toBe('color_fondo')
  })
})

describe('aplicarApariencia', () => {
  afterEach(() => {
    aplicarApariencia(null, 'tareas')
    aplicarApariencia(null, 'tuvet')
  })

  it('traduce los colores a los tokens del kit, del menú y de los botones', () => {
    const css = construirCss({ ...VALORES, color_primario: '#0E7490', color_boton_primario_texto: '#0F172A', fuente: 'Inter' })
    expect(css).toContain('html:root .tema-analiza')
    expect(css).toContain('--tv-primary: #0E7490;')
    expect(css).toContain('--tv-btn-primary-fg: #0F172A;')
    expect(css).toContain('--nav-bg: #0F172A;')
    expect(css).toContain("--tv-font: 'Inter'")
    expect(construirCss({ ...VALORES, color_primario: 'rojo' })).toBe('')
  })

  it('limita cada apariencia a las pantallas de su calendario', () => {
    const analiza = construirCss(VALORES, 'tareas')
    const tuvet = construirCss(VALORES, 'tuvet')
    expect(analiza).toContain('html:root .tema-analiza {')
    expect(analiza).toContain('html:root .layout:not(.tuvet-app) {')
    expect(analiza).not.toContain('html:root .tuvet-app {')
    expect(tuvet).toContain('html:root .tuvet-app {')
    expect(tuvet).toContain('html:root .layout.tuvet-app {')
    expect(tuvet).not.toContain('.tema-analiza')
  })

  it('inyecta y retira una hoja de estilos y una fuente por calendario', () => {
    aplicarApariencia({ ...VALORES, fuente: 'Inter' }, 'tareas')
    aplicarApariencia({ ...VALORES, color_primario: '#0F766E' }, 'tuvet')
    expect(document.getElementById('apariencia-empresa-tareas').textContent).toContain('--tv-primary: #4F46E5;')
    expect(document.getElementById('apariencia-empresa-tuvet').textContent).toContain('--tv-primary: #0F766E;')
    expect(document.getElementById('apariencia-fuente-tareas')).toHaveAttribute('href', urlFuente('Inter'))
    expect(document.getElementById('apariencia-fuente-tuvet')).toBeNull()

    aplicarApariencia(null, 'tareas')
    expect(document.getElementById('apariencia-empresa-tareas')).toBeNull()
    expect(document.getElementById('apariencia-fuente-tareas')).toBeNull()
    expect(document.getElementById('apariencia-empresa-tuvet')).not.toBeNull()
    expect(urlFuente('Comic Sans MS')).toBeNull()
  })
})

describe('AparienciaPage', () => {
  beforeEach(() => {
    apiRequest.mockReset()
    useAuth.mockReturnValue({ perfil: { es_cuenta_sistemas: true } })
  })

  function mockApi({ guardar } = {}) {
    apiRequest.mockImplementation(async (path, options) => {
      if (path.startsWith('/api/v1/organization/branding/targets/')) {
        return respuesta({ results: [{ empresa: DETALLE.empresa, paises: [{ id: 5, nombre: 'Honduras', configurada: false }] }], catalogo: CATALOGO })
      }
      if (path.startsWith('/api/v1/organization/branding/recommendations/')) {
        return respuesta({ results: [
          { clave: 'monocromatica', nombre: 'Monocromática', descripcion: 'Tonos del color base.', colores: { ...VALORES, color_primario: '#0E7490', color_boton_primario: '#0E7490', color_menu_activo: '#0E7490', color_acento: '#56A0B4' }, advertencias: [] },
          { clave: 'complementaria', nombre: 'Complementaria', descripcion: 'Color opuesto.', colores: { ...VALORES, color_primario: '#0E7490', color_boton_primario: '#0E7490', color_menu_activo: '#C2410C', color_acento: '#902A0E' }, advertencias: [] },
        ] })
      }
      if (options?.method === 'PUT') return guardar ? guardar(JSON.parse(options.body)) : respuesta({ ...DETALLE, configurada: true, apariencia: JSON.parse(options.body) })
      return respuesta(DETALLE)
    })
  }

  it('carga la empresa y país, aplica una paleta recomendada y guarda los colores', async () => {
    mockApi()
    render(<AparienciaPage />)

    expect(await screen.findByLabelText('Color principal', { selector: 'input:not([type="color"])' }))
      .toHaveValue('#4F46E5')
    expect(screen.getByText('Usa los colores del sistema')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Color base'), { target: { value: '#0E7490' } })
    fireEvent.click(screen.getByRole('button', { name: 'Recomendar paletas' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Aplicar paleta Monocromática' }))
    expect(screen.getByLabelText('Color principal', { selector: 'input:not([type="color"])' })).toHaveValue('#0E7490')

    fireEvent.click(screen.getByRole('button', { name: /^Guardar \d+ cambio/ }))
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/api/v1/organization/branding/', expect.objectContaining({ method: 'PUT' })))
    const enviado = JSON.parse(apiRequest.mock.calls.find(([, options]) => options?.method === 'PUT')[1].body)
    expect(enviado).toMatchObject({ company_id: '1', country_id: '5', color_primario: '#0E7490' })
    expect(await screen.findByText('Apariencia guardada para Analiza · Honduras.')).toBeInTheDocument()
  })

  it('actualiza la vista previa al aplicar una segunda recomendación y marca la aplicada', async () => {
    mockApi()
    render(<AparienciaPage />)
    await screen.findByLabelText('Color principal', { selector: 'input:not([type="color"])' })
    fireEvent.change(screen.getByLabelText('Color base'), { target: { value: '#0E7490' } })
    fireEvent.click(screen.getByRole('button', { name: 'Recomendar paletas' }))

    fireEvent.click(await screen.findByRole('button', { name: 'Aplicar paleta Monocromática' }))
    const activo = () => screen.getByRole('complementary', { name: 'Vista previa' }).querySelector('.ap-preview-item.is-activo')
    const chip = () => screen.getByText('Nuevo')
    expect(activo()).toHaveStyle({ boxShadow: 'inset 3px 0 0 #0E7490' })
    const chipMonocromatica = chip().style.color

    fireEvent.click(screen.getByRole('button', { name: 'Aplicar paleta Complementaria' }))
    expect(activo()).toHaveStyle({ boxShadow: 'inset 3px 0 0 #C2410C' })
    expect(chip().style.color).not.toBe(chipMonocromatica)
    expect(screen.getByRole('button', { name: 'Aplicar paleta Monocromática' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Aplicar paleta Complementaria' })).not.toBeInTheDocument()
    expect(screen.getByText('Aplicada')).toBeInTheDocument()
  })

  it('muestra el contraste insuficiente y los errores por campo del servidor', async () => {
    mockApi({ guardar: () => respuesta({ color_boton_primario: ['Usa el formato #RRGGBB.'] }, false) })
    render(<AparienciaPage />)
    const texto = await screen.findByLabelText('Texto del botón principal', { selector: 'input:not([type="color"])' })

    fireEvent.change(texto, { target: { value: '#6366F1' } })
    const lateral = screen.getByRole('complementary', { name: 'Vista previa' })
    expect(within(lateral).getByText(/Contraste bajo/)).toBeInTheDocument()
    expect(within(lateral).getByText(/Texto del botón principal: 1\.\d+:1/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^Guardar/ }))
    expect(await screen.findByText('Revisa los campos marcados.')).toBeInTheDocument()
    expect(screen.getByText('Usa el formato #RRGGBB.')).toBeInTheDocument()
  })

  it('explica qué hacer cuando no hay países que configurar', async () => {
    // Tuvet tiene países, pero la página de Analiza solo lista empresas del calendario de tareas.
    apiRequest.mockResolvedValue(respuesta({
      results: [{ empresa: { id: 2, nombre: 'Tuvet', modulo_calendario: 'tuvet' }, paises: [{ id: 20, nombre: 'Honduras', configurada: false }] }],
      catalogo: CATALOGO,
    }))
    render(<AparienciaPage />)
    expect(await screen.findByText(/No hay países registrados en las empresas del calendario Analiza/)).toBeInTheDocument()
  })
})
