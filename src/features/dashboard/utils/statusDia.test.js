import { describe, expect, it } from 'vitest'
import {
  CHIP,
  ESTADOS_SIN_VENTANA,
  clasificarEstado,
  formatearFecha,
  formatearPorcentaje,
  formatearRango,
  hoyLocal,
  ordenarTarjetas,
  textoExcepcion,
  textoPie,
} from './statusDia'

function dia(overrides = {}) {
  const { resultado_dia: resultadoOverrides, ...resto } = overrides
  return {
    nombre_usuario: 'GS Ana',
    estado: 'activo',
    estado_operativo: 'tarde',
    hora_apertura: '08:00',
    operacion_habilitada: true,
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

describe('ESTADOS_SIN_VENTANA', () => {
  it('declara solo las jornadas sin ventana abierta', () => {
    expect(ESTADOS_SIN_VENTANA).toEqual(['antes_apertura', 'sucursal_cerrada', 'sin_sucursal', 'cerrado'])
  })

  it('considera abiertas las jornadas que no están en la lista', () => {
    for (const estado of ['manana', 'tarde', 'cambio_jornada', 'dia_completo']) {
      expect(clasificarEstado(dia({ estado_operativo: estado })).chip).toBeNull()
    }
  })
})

describe('clasificarEstado: las seis filas de la regla del chip', () => {
  it('fila 1 — un tipo de día distinto de normal dibuja "Día especial"', () => {
    const estado = clasificarEstado(dia({
      resultado_dia: { tipo_dia: 'vacaciones_programadas', porcentaje_dia: '100.00', tareas_programadas: 0, tareas_cumplidas: 0 },
    }))

    expect(estado.chip).toBe(CHIP.DIA_ESPECIAL)
    expect(estado.etiquetaChip).toBe('Día especial')
    expect(estado.porcentaje).toBe(100)
    expect(estado.rayada).toBe(true)
  })

  it('fila 1 gana sobre "sin tareas": un día especial no cae en "No aplica"', () => {
    const estado = clasificarEstado(dia({
      resultado_dia: { tipo_dia: 'incapacidad', porcentaje_dia: '100.00', tareas_programadas: 0, tareas_cumplidas: 0 },
    }))

    expect(estado.chip).toBe(CHIP.DIA_ESPECIAL)
    expect(estado.motivo).toBe(CHIP.DIA_ESPECIAL)
  })

  it('fila 2 — operación dominical no habilitada dibuja "No aplica"', () => {
    const estado = clasificarEstado(dia({
      operacion_habilitada: false,
      motivo_no_disponible: 'operacion_dominical_no_habilitada',
      resultado_dia: { ultima_marca: null, porcentaje_dia: '0.00' },
    }))

    expect(estado.chip).toBe(CHIP.NO_APLICA)
    expect(estado.motivo).toBe('domingo')
    expect(textoPie(dia({
      operacion_habilitada: false,
      motivo_no_disponible: 'operacion_dominical_no_habilitada',
      resultado_dia: { ultima_marca: null, tareas_programadas: 10, tareas_cumplidas: 0 },
    }))).toEqual({ izquierda: 'Operación dominical no habilitada', derecha: '—', tono: null })
  })

  it('fila 3 — sin tareas programadas en un día normal dibuja "No aplica"', () => {
    const estado = clasificarEstado(dia({
      resultado_dia: { tareas_programadas: 0, tareas_cumplidas: 0, ultima_marca: null },
    }))

    expect(estado.chip).toBe(CHIP.NO_APLICA)
    expect(estado.motivo).toBe('sin_tareas')
    expect(textoPie(dia({
      resultado_dia: { tareas_programadas: 0, tareas_cumplidas: 0, ultima_marca: null },
    })).izquierda).toBe('Sin tareas programadas hoy')
  })

  it('fila 4 — una jornada sin ventana dibuja "No aplica" y nunca "Sin marcas"', () => {
    for (const estadoOperativo of ESTADOS_SIN_VENTANA) {
      const estado = clasificarEstado(dia({
        estado_operativo: estadoOperativo,
        resultado_dia: { ultima_marca: null },
      }))

      expect(estado.chip).toBe(CHIP.NO_APLICA)
      expect(estado.motivo).toBe(estadoOperativo)
    }
  })

  it('fila 5 — con ventana abierta y sin marcas dibuja "Sin marcas"', () => {
    const estado = clasificarEstado(dia({ resultado_dia: { ultima_marca: null, tareas_cumplidas: 0 } }))

    expect(estado.chip).toBe(CHIP.SIN_MARCAS)
    expect(estado.etiquetaChip).toBe('Sin marcas')
    expect(estado.tonoChip).toBe('peligro')
  })

  it('fila 6 — una tarjeta con ventana, tareas y marcas no dibuja chip', () => {
    const estado = clasificarEstado(dia())

    expect(estado.chip).toBeNull()
    expect(estado.etiquetaChip).toBeNull()
    expect(estado.tituloChip).toBeNull()
  })
})

describe('clasificarEstado: "Sin marcas" depende de ultima_marca, no del conteo', () => {
  it('tareas_cumplidas 0 con ultima_marca presente no es "Sin marcas"', () => {
    const estado = clasificarEstado(dia({
      resultado_dia: { tareas_cumplidas: 0, tareas_programadas: 51, ultima_marca: '09:12' },
    }))

    expect(estado.chip).toBeNull()
  })

  it('tareas_cumplidas mayor que cero con ultima_marca nula sí es "Sin marcas"', () => {
    const estado = clasificarEstado(dia({
      resultado_dia: { tareas_cumplidas: 5, tareas_programadas: 51, ultima_marca: null },
    }))

    expect(estado.chip).toBe(CHIP.SIN_MARCAS)
  })

  it('un tipo de día desconocido distinto de normal se trata como especial', () => {
    expect(clasificarEstado(dia({ resultado_dia: { tipo_dia: 'permiso_aprobado' } })).chip).toBe(CHIP.DIA_ESPECIAL)
  })

  it('sin_rendimiento no se confunde con un día especial', () => {
    expect(clasificarEstado(dia({
      resultado_dia: { tipo_dia: 'sin_rendimiento', tareas_programadas: 0, tareas_cumplidas: 0, ultima_marca: null },
    })).chip).toBe(CHIP.NO_APLICA)
  })
})

describe('clasificarEstado: número y barra', () => {
  it('expone porcentaje_dia redondeado a entero como número grande', () => {
    const estado = clasificarEstado(dia({ resultado_dia: { porcentaje_dia: '57.60' } }))

    expect(estado.porcentaje).toBe(58)
    expect(estado.numeroVisible).toBe(true)
    expect(estado.anchoBarra).toBe(58)
  })

  it('aplica el techo del 100 % al número y a la barra', () => {
    const estado = clasificarEstado(dia({ resultado_dia: { porcentaje_dia: '137.00' } }))

    expect(estado.porcentaje).toBe(100)
    expect(estado.anchoBarra).toBe(100)
  })

  it('con antes de apertura, sucursal cerrada o sin sucursal el número es un guion y la barra va vacía', () => {
    for (const estadoOperativo of ['antes_apertura', 'sucursal_cerrada', 'sin_sucursal']) {
      const estado = clasificarEstado(dia({ estado_operativo: estadoOperativo }))

      expect(estado.numeroVisible).toBe(false)
      expect(estado.anchoBarra).toBe(0)
    }
  })

  it('con la jornada cerrada el número y la barra conservan el resultado final', () => {
    const estado = clasificarEstado(dia({ estado_operativo: 'cerrado', resultado_dia: { porcentaje_dia: '46.00' } }))

    expect(estado.chip).toBe(CHIP.NO_APLICA)
    expect(estado.numeroVisible).toBe(true)
    expect(estado.porcentaje).toBe(46)
    expect(estado.anchoBarra).toBe(46)
  })

  it('anuncia porcentaje y conteo en la barra', () => {
    expect(clasificarEstado(dia()).ariaBarra).toBe('58 por ciento ponderado. 27 de 51 tareas registradas.')
  })

  it('anuncia la razón cuando no hay jornada abierta', () => {
    const estado = clasificarEstado(dia({
      estado_operativo: 'antes_apertura',
      hora_apertura: '11:00',
      resultado_dia: { tareas_programadas: 28, tareas_cumplidas: 0, ultima_marca: null },
    }))

    expect(estado.ariaBarra).toBe('Sin jornada abierta: la sucursal abre a las 11:00. 0 de 28 tareas registradas.')
  })
})

describe('ordenarTarjetas', () => {
  it('ordena por riesgo con mezcla de los cuatro grupos y desempata por nombre', () => {
    const normalTarde = dia({
      nombre_usuario: 'Normal tarde',
      resultado_dia: { porcentaje_dia: '40.00', ultima_marca: '11:00' },
    })
    const normalTemprano = dia({
      nombre_usuario: 'Normal temprano',
      resultado_dia: { porcentaje_dia: '40.00', ultima_marca: '08:15' },
    })
    const sinMarcasPoco = dia({
      nombre_usuario: 'Sin marcas poco',
      resultado_dia: { porcentaje_dia: '0.00', tareas_programadas: 10, tareas_cumplidas: 0, ultima_marca: null },
    })
    const sinMarcasMucho = dia({
      nombre_usuario: 'Sin marcas mucho',
      resultado_dia: { porcentaje_dia: '0.00', tareas_programadas: 80, tareas_cumplidas: 0, ultima_marca: null },
    })
    const sinMarcasMuchoB = dia({
      nombre_usuario: 'Sin marcas mucho B',
      resultado_dia: { porcentaje_dia: '0.00', tareas_programadas: 80, tareas_cumplidas: 0, ultima_marca: null },
    })
    const noAplica = dia({
      nombre_usuario: 'No aplica',
      estado_operativo: 'antes_apertura',
      resultado_dia: { porcentaje_dia: '0.00', ultima_marca: null },
    })
    const especial = dia({
      nombre_usuario: 'Día especial',
      resultado_dia: { porcentaje_dia: '100.00', tipo_dia: 'vacaciones_programadas', tareas_programadas: 0, tareas_cumplidas: 0 },
    })

    const orden = ordenarTarjetas([
      especial,
      normalTarde,
      noAplica,
      sinMarcasPoco,
      normalTemprano,
      sinMarcasMuchoB,
      sinMarcasMucho,
    ]).map((t) => t.nombre_usuario)

    expect(orden).toEqual([
      'Sin marcas mucho',
      'Sin marcas mucho B',
      'Sin marcas poco',
      'No aplica',
      'Normal temprano',
      'Normal tarde',
      'Día especial',
    ])
  })

  it('compara ultima_marca como hora y no como texto', () => {
    const temprano = dia({ nombre_usuario: 'B', resultado_dia: { ultima_marca: '09:05' } })
    const tarde = dia({ nombre_usuario: 'A', resultado_dia: { ultima_marca: '10:02' } })

    expect(ordenarTarjetas([tarde, temprano]).map((t) => t.nombre_usuario)).toEqual(['B', 'A'])
  })

  it('no muta la lista original', () => {
    const original = [dia({ nombre_usuario: 'B' }), dia({ nombre_usuario: 'A' })]

    ordenarTarjetas(original)

    expect(original.map((t) => t.nombre_usuario)).toEqual(['B', 'A'])
  })
})

describe('textoPie', () => {
  it('sin marcas muestra la hora de apertura y el conteo', () => {
    expect(textoPie(dia({
      hora_apertura: '08:00',
      resultado_dia: { tareas_programadas: 51, tareas_cumplidas: 0, ultima_marca: null },
    }))).toEqual({ izquierda: 'Sin marcas desde apertura (08:00)', derecha: '0 de 51 tareas', tono: 'alerta' })
  })

  it('degrada el texto cuando hora_apertura es nula', () => {
    expect(textoPie(dia({
      hora_apertura: null,
      resultado_dia: { tareas_programadas: 51, tareas_cumplidas: 0, ultima_marca: null },
    })).izquierda).toBe('Sin marcas desde la apertura')
  })

  it('normal muestra la última marca tal cual, sin calcular diferencias', () => {
    expect(textoPie(dia())).toEqual({ izquierda: 'Última marca 09:48', derecha: '27 de 51 tareas', tono: null })
  })

  it('antes de apertura anuncia la hora de apertura', () => {
    expect(textoPie(dia({
      estado_operativo: 'antes_apertura',
      hora_apertura: '11:00',
      resultado_dia: { tareas_programadas: 28, tareas_cumplidas: 0, ultima_marca: null },
    }))).toEqual({ izquierda: 'Abre a las 11:00 · sin marcas todavía', derecha: '0 de 28 tareas', tono: null })
  })

  it('jornada cerrada conserva el conteo', () => {
    expect(textoPie(dia({
      estado_operativo: 'cerrado',
      resultado_dia: { tareas_programadas: 51, tareas_cumplidas: 46, ultima_marca: null },
    }))).toEqual({ izquierda: 'Jornada cerrada', derecha: '46 de 51 tareas', tono: null })
  })

  it('sin sucursal no inventa conteo', () => {
    expect(textoPie(dia({ estado_operativo: 'sin_sucursal' }))).toEqual({
      izquierda: 'Sin sucursal asignada',
      derecha: '—',
      tono: null,
    })
  })

  it('día especial dice "Sin tareas programadas" y "0 tareas"', () => {
    expect(textoPie(dia({
      resultado_dia: { tipo_dia: 'vacaciones_programadas', tareas_programadas: 0, tareas_cumplidas: 0, porcentaje_dia: '100.00' },
    }))).toEqual({ izquierda: 'Sin tareas programadas', derecha: '0 tareas', tono: null })
  })
})

describe('textoExcepcion', () => {
  it('prioriza trabajo de campo pendiente', () => {
    expect(textoExcepcion(dia({
      trabajo_campo: { estado: 'pendiente' },
      estado: 'en_almuerzo',
      resultado_dia: { tipo_dia: 'vacaciones' },
    }))).toEqual({ texto: 'Trabajo de campo pendiente', tono: 'accent', icono: 'campo' })
  })

  it('distingue el trabajo de campo autorizado', () => {
    expect(textoExcepcion(dia({ trabajo_campo: { estado: 'aceptado' } }))).toEqual({
      texto: 'Trabajo de campo autorizado',
      tono: 'muted',
      icono: 'campo',
    })
  })

  it('muestra el almuerzo', () => {
    expect(textoExcepcion(dia({ estado: 'en_almuerzo' }))).toEqual({
      texto: 'En almuerzo',
      tono: 'warning',
      icono: 'almuerzo',
    })
  })

  it('usa motivo_dia_especial y cae en la etiqueta del tipo', () => {
    expect(textoExcepcion(dia({ resultado_dia: { tipo_dia: 'vacaciones', motivo_dia_especial: 'Viaje familiar' } })))
      .toEqual({ texto: 'Viaje familiar', tono: 'muted', icono: 'bandera' })
    expect(textoExcepcion(dia({ resultado_dia: { tipo_dia: 'vacaciones', motivo_dia_especial: '' } })))
      .toEqual({ texto: 'Permiso extraordinario', tono: 'muted', icono: 'bandera' })
  })

  it('no dibuja nada en una tarjeta normal', () => {
    expect(textoExcepcion(dia())).toBeNull()
  })
})

describe('Fechas y porcentajes del resumen', () => {
  it('hoyLocal arma la fecha en hora local, no en UTC', () => {
    // 13 de noviembre de 2026, 20:30 en Honduras (UTC-6): en UTC ya es el día 14.
    expect(hoyLocal(new Date(2026, 10, 13, 20, 30))).toBe('2026-11-13')
  })

  it('formatearFecha capitaliza el día de la semana', () => {
    expect(formatearFecha('2026-11-13')).toBe('Viernes 13 de noviembre')
  })

  it('formatearFecha devuelve vacío para una fecha inválida', () => {
    expect(formatearFecha('2026-02-31')).toBe('')
    expect(formatearFecha('')).toBe('')
    expect(formatearFecha(null)).toBe('')
  })

  it('formatearRango omite el mes repetido', () => {
    expect(formatearRango('2026-11-01', '2026-11-13')).toBe('del 1 al 13 de noviembre')
  })

  it('formatearRango nombra ambos meses y años cuando cambian', () => {
    expect(formatearRango('2026-10-28', '2026-11-03')).toBe('del 28 de octubre al 3 de noviembre')
    expect(formatearRango('2025-12-28', '2026-01-03')).toBe('del 28 de diciembre de 2025 al 3 de enero de 2026')
  })

  it('formatearRango devuelve vacío si falta una fecha', () => {
    expect(formatearRango('2026-11-01', null)).toBe('')
  })

  it('formatearPorcentaje conserva un decimal con coma, sin redondear a entero', () => {
    expect(formatearPorcentaje('41.20')).toBe('41,2 %')
    expect(formatearPorcentaje('4.00')).toBe('4,0 %')
    expect(formatearPorcentaje(100)).toBe('100,0 %')
    expect(formatearPorcentaje(null)).toBe('—')
  })
})
