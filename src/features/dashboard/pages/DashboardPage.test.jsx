import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DashboardPage from './DashboardPage'
import { hoyLocal } from '../utils/statusDia'

const { apiRequest, useAuth } = vi.hoisted(() => ({ apiRequest: vi.fn(), useAuth: vi.fn() }))
vi.mock('../../../services/apiClient', () => ({ apiRequest }))
vi.mock('../../auth/context/AuthContext', () => ({ useAuth }))

const response = (data) => ({ ok: true, status: 200, json: async () => data })
const HOY = hoyLocal()

function urlEsperada(params = {}) {
  return `/api/dashboard-operativo/usuarios/?${new URLSearchParams({ fecha: HOY, ...params }).toString()}`
}

function Destino() {
  const location = useLocation()
  return <p>Destino: {location.pathname}{location.search}</p>
}

function dia(overrides = {}) {
  const { resultado_dia: resultadoOverrides, ...resto } = overrides
  return {
    id_usuario: 12,
    nombre_usuario: 'GS Ana',
    sucursal: 'PSO · El Paraíso',
    estado: 'activo',
    estado_operativo: 'manana',
    hora_apertura: '08:00',
    operacion_habilitada: true,
    detalle_rendimiento: { disponible: true, id_usuario: 12 },
    ...resto,
    resultado_dia: {
      porcentaje_dia: '58.00',
      tareas_cumplidas: 27,
      tareas_programadas: 51,
      tipo_dia: 'normal',
      motivo_dia_especial: '',
      ultima_marca: '09:48',
      ...resultadoOverrides,
    },
  }
}

function renderDashboard(results = [dia()], meta = { requiere_filtro: false, mensaje: '', resumen_areas: [] }) {
  apiRequest.mockResolvedValue(response({ count: results.length, results, meta }))

  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Routes>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/rendimiento" element={<Destino />} />
      </Routes>
    </MemoryRouter>,
  )
}

function tarjetasEnOrden() {
  return Array.from(document.querySelectorAll('.status-card .status-nombre')).map((n) => n.textContent)
}

describe('DashboardPage: Status del día', () => {
  beforeEach(() => {
    apiRequest.mockReset()
    useAuth.mockReturnValue({ perfil: { type: 'gerente_area', es_admin_maestro: false } })
  })

  it('titula la pantalla "Status del día" con el conteo de GS', async () => {
    renderDashboard()

    expect(await screen.findByRole('heading', { name: 'Status del día' })).toBeInTheDocument()
    expect(document.querySelector('.page-sub')).toHaveTextContent('1 gerente de sucursal')
  })

  it('precarga el filtro con la fecha de hoy en hora local', async () => {
    renderDashboard()

    await screen.findByText('GS Ana')
    expect(screen.getByLabelText('Fecha')).toHaveValue(HOY)
    expect(document.querySelector('.page-sub strong').textContent).not.toBe('')
  })

  it('toma la fecha del filtro, no de la fecha del sistema', async () => {
    renderDashboard()

    await screen.findByText('GS Ana')
    fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2026-11-13' } })

    expect(await screen.findByText('GS Ana')).toBeInTheDocument()
    expect(document.querySelector('.page-sub'))
      .toHaveTextContent('Viernes 13 de noviembre · 1 gerente de sucursal')
  })

  it('muestra porcentaje_dia como número grande y el conteo en el pie', async () => {
    renderDashboard()

    const card = await screen.findByRole('button', { name: 'Ver rendimiento de GS Ana' })
    expect(within(card).getByText('58')).toBeInTheDocument()
    expect(within(card).getByText('27 de 51 tareas')).toBeInTheDocument()
    expect(within(card).queryByText('27/51')).not.toBeInTheDocument()
  })

  it('no dibuja chip en una tarjeta normal', async () => {
    renderDashboard()

    const card = await screen.findByRole('button', { name: 'Ver rendimiento de GS Ana' })
    expect(card.querySelector('.status-chip')).toBeNull()
  })

  it('solo existen los tres chips y no hay deltas', async () => {
    renderDashboard([
      dia({ id_usuario: 1, nombre_usuario: 'Ana Uno', resultado_dia: { ultima_marca: null, tareas_cumplidas: 0 } }),
      dia({ id_usuario: 2, nombre_usuario: 'Beto Dos', estado_operativo: 'antes_apertura', resultado_dia: { ultima_marca: null } }),
      dia({ id_usuario: 3, nombre_usuario: 'Carla Tres', resultado_dia: { tipo_dia: 'vacaciones_programadas', porcentaje_dia: '100.00', tareas_programadas: 0, tareas_cumplidas: 0 } }),
      dia({ id_usuario: 4, nombre_usuario: 'Dani Cuatro' }),
    ])

    await screen.findByText('Dani Cuatro')

    expect(screen.getByText('Sin marcas')).toBeInTheDocument()
    expect(screen.getAllByText('No aplica')).toHaveLength(1)
    expect(screen.getByText('Día especial')).toBeInTheDocument()
    expect(screen.queryByText('Al día')).toBeNull()
    expect(screen.queryByText('Atrasada')).toBeNull()
    expect(screen.queryByText('Sin actividad')).toBeNull()
    expect(screen.queryByText(/pts/)).toBeNull()
  })

  it('"Sin marcas" depende de ultima_marca: 0 tareas cumplidas con marca no lleva chip', async () => {
    renderDashboard([dia({
      resultado_dia: { tareas_cumplidas: 0, tareas_programadas: 51, ultima_marca: '09:12' },
    })])

    const card = await screen.findByRole('button', { name: 'Ver rendimiento de GS Ana' })
    expect(card.querySelector('.status-chip')).toBeNull()
    expect(within(card).getByText('Última marca 09:12')).toBeInTheDocument()
  })

  it('la tarjeta "Sin marcas" avisa desde apertura y cuenta las tareas', async () => {
    renderDashboard([dia({
      hora_apertura: '08:00',
      resultado_dia: { ultima_marca: null, tareas_cumplidas: 0, tareas_programadas: 51, porcentaje_dia: '0.00' },
    })])

    const card = await screen.findByRole('button', { name: 'Ver rendimiento de GS Ana' })
    expect(within(card).getByText('Sin marcas')).toBeInTheDocument()
    expect(within(card).getByText('Sin marcas desde apertura (08:00)')).toBeInTheDocument()
    expect(within(card).getByText('0 de 51 tareas')).toBeInTheDocument()
    expect(card).toHaveClass('status-card--critical')
  })

  it('antes de apertura es "No aplica", con guion y la hora de apertura en el pie', async () => {
    renderDashboard([dia({
      estado_operativo: 'antes_apertura',
      hora_apertura: '11:00',
      resultado_dia: { porcentaje_dia: '0.00', ultima_marca: null, tareas_cumplidas: 0, tareas_programadas: 28 },
    })])

    const card = await screen.findByRole('button', { name: 'Ver rendimiento de GS Ana' })
    expect(within(card).getByText('No aplica')).toBeInTheDocument()
    expect(within(card).getByText('—')).toBeInTheDocument()
    expect(within(card).getByText('Abre a las 11:00 · sin marcas todavía')).toBeInTheDocument()
    expect(within(card).getByText('0 de 28 tareas')).toBeInTheDocument()
  })

  it('"Día especial" muestra el porcentaje real y la barra rayada', async () => {
    renderDashboard([dia({
      resultado_dia: { tipo_dia: 'vacaciones_programadas', porcentaje_dia: '100.00', tareas_programadas: 0, tareas_cumplidas: 0 },
    })])

    const card = await screen.findByRole('button', { name: 'Ver rendimiento de GS Ana' })
    expect(within(card).getByText('Día especial')).toBeInTheDocument()
    expect(within(card).getByText('100')).toBeInTheDocument()
    expect(card.querySelector('.status-bar-fill--especial')).toBeInTheDocument()
    expect(within(card).getByText('Sin tareas programadas')).toBeInTheDocument()
    expect(within(card).getByText('0 tareas')).toBeInTheDocument()
  })

  it('sin tareas programadas en un día normal es "No aplica" con su propio pie', async () => {
    renderDashboard([dia({
      resultado_dia: { tareas_programadas: 0, tareas_cumplidas: 0, ultima_marca: null, porcentaje_dia: '0.00' },
    })])

    const card = await screen.findByRole('button', { name: 'Ver rendimiento de GS Ana' })
    expect(within(card).getByText('No aplica')).toBeInTheDocument()
    expect(within(card).getByText('Sin tareas programadas hoy')).toBeInTheDocument()
    expect(within(card).getByText('—')).toBeInTheDocument()
  })

  it('cada barra anuncia porcentaje y conteo, y no lleva marca de referencia', async () => {
    renderDashboard()

    const card = await screen.findByRole('button', { name: 'Ver rendimiento de GS Ana' })
    const barra = card.querySelector('.status-bar')
    expect(barra).toHaveAttribute('aria-label', '58 por ciento ponderado. 27 de 51 tareas registradas.')
    expect(card.querySelector('.status-bar-marker')).toBeNull()
    expect(screen.queryByText(/leyenda/i)).toBeNull()
  })

  it('ordena por riesgo: sin marcas, no aplica, normal y día especial', async () => {
    renderDashboard([
      dia({ id_usuario: 1, nombre_usuario: 'Especial', resultado_dia: { tipo_dia: 'vacaciones_programadas', porcentaje_dia: '100.00', tareas_programadas: 0, tareas_cumplidas: 0 } }),
      dia({ id_usuario: 2, nombre_usuario: 'Normal tarde', resultado_dia: { ultima_marca: '11:00' } }),
      dia({ id_usuario: 3, nombre_usuario: 'No aplica', estado_operativo: 'antes_apertura', resultado_dia: { ultima_marca: null } }),
      dia({ id_usuario: 4, nombre_usuario: 'Sin marcas poco', resultado_dia: { ultima_marca: null, tareas_programadas: 10, tareas_cumplidas: 0 } }),
      dia({ id_usuario: 5, nombre_usuario: 'Normal temprano', resultado_dia: { ultima_marca: '08:15' } }),
      dia({ id_usuario: 6, nombre_usuario: 'Sin marcas mucho', resultado_dia: { ultima_marca: null, tareas_programadas: 80, tareas_cumplidas: 0 } }),
    ])

    await screen.findByText('Especial')

    expect(tarjetasEnOrden()).toEqual([
      'Sin marcas mucho',
      'Sin marcas poco',
      'No aplica',
      'Normal temprano',
      'Normal tarde',
      'Especial',
    ])
  })

  it('agrega el filtro de jornada "Día completo" y lo envía a la API', async () => {
    renderDashboard()

    await screen.findByText('GS Ana')
    fireEvent.change(screen.getByLabelText('Jornada'), { target: { value: 'dia_completo' } })

    expect(await screen.findByText('GS Ana')).toBeInTheDocument()
    expect(apiRequest).toHaveBeenLastCalledWith(urlEsperada({ estado_operativo: 'dia_completo' }))
  })

  it('muestra el placeholder corto y "Todas" en los selects sin filtro', async () => {
    renderDashboard()

    await screen.findByText('GS Ana')
    expect(screen.getByPlaceholderText('Nombre, email o sucursal')).toBeInTheDocument()

    for (const etiqueta of ['Jornada', 'Disponibilidad']) {
      const select = screen.getByLabelText(etiqueta)
      expect(select.options[select.selectedIndex].textContent).toBe('Todas')
    }
  })

  it('no tiene refresco automático ni indicador de tiempo real', async () => {
    renderDashboard()

    await screen.findByText('GS Ana')
    expect(apiRequest).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(/en vivo/i)).toBeNull()
    expect(screen.queryByText(/actualizado a las/i)).toBeNull()
  })

  it('"Actualizar" vuelve a pedir los datos', async () => {
    renderDashboard()

    await screen.findByText('GS Ana')
    fireEvent.click(screen.getByRole('button', { name: /Actualizar/ }))

    expect(apiRequest).toHaveBeenCalledTimes(2)
  })

  it('abre la pantalla de rendimiento con el id_usuario de la tarjeta', async () => {
    renderDashboard([dia({ detalle_rendimiento: { disponible: true, id_usuario: 12 } })])

    fireEvent.click(await screen.findByRole('button', { name: 'Ver rendimiento de GS Ana' }))

    expect(await screen.findByText('Destino: /rendimiento?id_usuario=12')).toBeInTheDocument()
  })

  it('no convierte la tarjeta en acción cuando el detalle no está disponible', async () => {
    renderDashboard([dia({ detalle_rendimiento: { disponible: false, id_usuario: 12 } })])

    await screen.findByText('GS Ana')
    expect(screen.queryByRole('button', { name: 'Ver rendimiento de GS Ana' })).not.toBeInTheDocument()
  })

  it('usa el texto propio de la pantalla cuando el administrador debe elegir área', async () => {
    useAuth.mockReturnValue({ perfil: { type: 'admin_maestro', es_admin_maestro: true } })
    apiRequest.mockResolvedValue(response({
      count: 0,
      results: [],
      meta: { requiere_filtro: true, mensaje: 'Selecciona un gerente de area...', resumen_areas: [] },
    }))

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<DashboardPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText('Selecciona un gerente de área o marca «Ver todos» para ver el status del día.')).toBeInTheDocument()
    expect(screen.queryByText('Selecciona un gerente de area...')).toBeNull()
  })

  it('conserva el estado vacío de los filtros', async () => {
    apiRequest.mockResolvedValueOnce(response({ count: 1, results: [dia()], meta: { requiere_filtro: false, mensaje: '', resumen_areas: [] } }))
      .mockResolvedValueOnce(response({ count: 0, results: [], meta: { requiere_filtro: false, mensaje: '', resumen_areas: [] } }))

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/rendimiento" element={<Destino />} />
        </Routes>
      </MemoryRouter>,
    )

    await screen.findByText('GS Ana')
    fireEvent.change(screen.getByPlaceholderText('Nombre, email o sucursal'), { target: { value: 'Ana' } })

    expect(await screen.findByText('Sin resultados para los filtros aplicados.')).toBeInTheDocument()
    expect(apiRequest).toHaveBeenLastCalledWith(urlEsperada({ buscar: 'Ana' }))
  })

  it('distingue una carga fallida de una respuesta exitosa sin resultados', async () => {
    apiRequest.mockRejectedValueOnce(new TypeError('Failed to fetch'))

    const { unmount } = render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<DashboardPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.queryByText('Sin resultados para los filtros aplicados.')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()

    unmount()
    renderDashboard([])

    expect(await screen.findByText('Sin resultados para los filtros aplicados.')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('espera 300 ms de tecleo antes de buscar y hace una sola petición', async () => {
    vi.useFakeTimers()
    try {
      renderDashboard()
      await act(async () => { await Promise.resolve() })
      expect(apiRequest).toHaveBeenCalledTimes(1)

      fireEvent.change(screen.getByLabelText('Buscar'), { target: { value: 'Ana' } })
      await act(async () => { vi.advanceTimersByTime(299) })
      expect(apiRequest).toHaveBeenCalledTimes(1)

      await act(async () => { vi.advanceTimersByTime(1) })
      await act(async () => { await Promise.resolve() })
      expect(apiRequest).toHaveBeenCalledTimes(2)
      expect(apiRequest).toHaveBeenLastCalledWith(urlEsperada({ buscar: 'Ana' }))
    } finally {
      vi.useRealTimers()
    }
  })

  it('"Limpiar filtros" resetea los filtros y dispara una sola carga', async () => {
    renderDashboard()

    await screen.findByText('GS Ana')
    fireEvent.change(screen.getByLabelText('Jornada'), { target: { value: 'tarde' } })
    await screen.findByText('GS Ana')
    expect(apiRequest).toHaveBeenCalledTimes(2)

    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }))
    await screen.findByText('GS Ana')

    expect(apiRequest).toHaveBeenCalledTimes(3)
    expect(apiRequest).toHaveBeenLastCalledWith(urlEsperada())
    expect(screen.getByLabelText('Jornada')).toHaveValue('')
    expect(screen.getByLabelText('Fecha')).toHaveValue(HOY)
    expect(screen.getByText('1 resultado')).toBeInTheDocument()
  })

  it('agrupa los GS por gerente de área al verlos todos y permite expandir cada grupo', async () => {
    useAuth.mockReturnValue({ perfil: { type: 'admin_maestro', es_admin_maestro: true } })
    renderDashboard([
      dia({ id_usuario: 12, nombre_usuario: 'GS Ana', gerente_area: { id_gerente_area: 7, nombre: 'Karla Méndez' } }),
      dia({ id_usuario: 13, nombre_usuario: 'GS Beto', gerente_area: { id_gerente_area: 8, nombre: 'Lesby Díaz' } }),
    ], {
      requiere_filtro: false,
      mensaje: '',
      resumen_areas: [
        { gerente_area: { id_gerente_area: 7, nombre: 'Karla Méndez' }, fecha_inicio: '2026-11-01', fecha_fin: '2026-11-13', usuarios_count: 10, rendimiento_mes: '41.20' },
        { gerente_area: { id_gerente_area: 8, nombre: 'Lesby Díaz' }, fecha_inicio: '2026-11-01', fecha_fin: '2026-11-13', usuarios_count: 9, rendimiento_mes: '32.10' },
      ],
    })

    fireEvent.click(await screen.findByLabelText('Ver todos los GS'))

    const karlaGroup = await screen.findByRole('button', { name: /Karla Méndez.*10 GS.*41,2 %/ })
    expect(karlaGroup).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: 'Ver rendimiento de GS Ana' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ver rendimiento de GS Beto' })).not.toBeInTheDocument()

    const lesbyGroup = screen.getByRole('button', { name: /Lesby Díaz.*9 GS.*32,1 %/ })
    fireEvent.click(lesbyGroup)
    expect(lesbyGroup).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: 'Ver rendimiento de GS Beto' })).toBeInTheDocument()
  })

  it('la línea de sucursal no repite el área del administrador', async () => {
    useAuth.mockReturnValue({ perfil: { type: 'admin_maestro', es_admin_maestro: true } })
    apiRequest.mockImplementation((url) => {
      if (url.startsWith('/api/gerentes-area/')) {
        return Promise.resolve(response({ results: [{ id_gerente_area: 7, nombre: 'Lesby Díaz' }] }))
      }
      return Promise.resolve(response({
        count: 1,
        results: [dia({ gerente_area: { id_gerente_area: 7, nombre: 'Lesby Díaz' } })],
        meta: { requiere_filtro: false, mensaje: '', resumen_areas: [] },
      }))
    })

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<DashboardPage />} />
        </Routes>
      </MemoryRouter>,
    )

    const card = await screen.findByRole('button', { name: 'Ver rendimiento de GS Ana' })
    expect(within(card).getByText('PSO · El Paraíso')).toBeInTheDocument()
    expect(within(card).queryByText(/Lesby Díaz/)).toBeNull()
    expect(screen.getByLabelText('Ver todos los GS')).toBeInTheDocument()
  })

  it('permite ver todos los GS a un Admin Master territorial', async () => {
    useAuth.mockReturnValue({ perfil: { type: 'admin_master', es_admin_maestro: false } })
    renderDashboard()

    expect(await screen.findByLabelText('Ver todos los GS')).toBeInTheDocument()
    expect(screen.getByLabelText('Gerente de área')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Ver todos los GS'))
    expect(await screen.findByText('GS Ana')).toBeInTheDocument()
    expect(apiRequest).toHaveBeenLastCalledWith(urlEsperada({ todos: 'true' }))
  })
})
