import {
  DIAS_MES,
  DIAS_SEMANA,
  RECURRENCIA_LABEL,
  TIPOS_CATALOGO,
  ordenarValores,
  separarValores,
} from '../recurrenceConfig'

export default function RecurrenceSelector({
  tipo,
  valor,
  onTipoChange,
  onValorChange,
  permitirVariable = false,
  permitirManual = false,
  permitirEspecial = false,
}) {
  const tipos = [...TIPOS_CATALOGO]
  if (permitirManual) tipos.push('manual')
  if (permitirVariable) tipos.push('variable')
  if (permitirEspecial) tipos.push('especial')

  const opciones = tipo === 'semanal'
    ? DIAS_SEMANA
    : tipo === 'quincenal' || tipo === 'mensual-dias'
      ? DIAS_MES
      : null

  return (
    <div className="recurrence-fields">
      <div className="form-group">
        <label htmlFor="tipo-recurrencia">Tipo de recurrencia</label>
        <select
          id="tipo-recurrencia"
          value={tipo}
          onChange={(event) => onTipoChange(event.target.value)}
          required
        >
          {tipos.map((value) => (
            <option key={value} value={value}>
              {value === 'especial' ? 'Configuración actual con varias reglas' : RECURRENCIA_LABEL[value]}
            </option>
          ))}
        </select>
      </div>

      {opciones && (
        <div className="form-group">
          <label>{tipo === 'semanal' ? 'Días de la semana' : 'Días del mes'}</label>
          <MultiSelectDropdown
            options={opciones}
            value={valor}
            onChange={onValorChange}
            placeholder={tipo === 'quincenal' ? 'Cada 14 días' : 'Seleccionar días'}
          />
          {tipo === 'quincenal' && (
            <span className="recurrence-help">Sin días seleccionados se ejecuta cada 14 días desde la asignación.</span>
          )}
        </div>
      )}

      {tipo === 'variable' && (
        <div className="form-group">
          <label htmlFor="valor-recurrencia-especial">Configuración especial</label>
          <select
            id="valor-recurrencia-especial"
            value={valor || 'sin recurrencia'}
            onChange={(event) => onValorChange(event.target.value)}
          >
            {valor && valor !== 'sin recurrencia' && (
              <option value={valor}>Configuración existente</option>
            )}
            <option value="sin recurrencia">Sin recurrencia automática</option>
          </select>
          <span className="recurrence-help">Selecciona otro tipo de recurrencia para reemplazar esta configuración.</span>
        </div>
      )}

      {tipo === 'especial' && (
        <div className="form-group">
          <label>Configuración actual</label>
          <div className="recurrence-readonly">Se conservarán las reglas existentes mientras no elijas otro tipo.</div>
        </div>
      )}
    </div>
  )
}

function MultiSelectDropdown({ options, value, onChange, placeholder }) {
  const seleccionados = separarValores(value)
  const labels = options
    .filter((option) => seleccionados.includes(option.value))
    .map((option) => option.label)

  function toggle(optionValue) {
    const siguiente = seleccionados.includes(optionValue)
      ? seleccionados.filter((item) => item !== optionValue)
      : [...seleccionados, optionValue]
    onChange(ordenarValores(siguiente, options.length))
  }

  return (
    <details className="recurrence-dropdown">
      <summary>{labels.length ? labels.join(', ') : placeholder}</summary>
      <div className="recurrence-options" role="group" aria-label={placeholder}>
        {options.map((option) => (
          <label key={option.value} className="recurrence-option">
            <input
              type="checkbox"
              checked={seleccionados.includes(option.value)}
              onChange={() => toggle(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </details>
  )
}
