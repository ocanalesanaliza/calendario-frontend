import { useEffect, useRef } from 'react'
import { Icono } from '../../tuvet/components/TuvetUi'
import './RevisionGuardiaDetalleModal.css'

const EMPTY_VALUE = '—'

const UNIFORME_LABELS = {
  botas: 'Botas',
  zapatillas: 'Zapatillas',
  tenis: 'Tenis',
  camisa_con_logo: 'Camisa con logo',
  pantalon_tela: 'Pantalón de tela',
  pantalon_jean: 'Pantalón jean',
  gorra: 'Gorra',
}

const EQUIPAMIENTO_LABELS = {
  porta_carnet: 'Porta carnet',
  revolver: 'Revólver',
  escopeta: 'Escopeta',
  tolete: 'Tolete',
  libro_novedades: 'Libro de novedades',
}

function present(value) {
  return value || EMPTY_VALUE
}

function displayName(value) {
  return value?.nombre ?? value?.nombre_usuario ?? EMPTY_VALUE
}

function fullName(guardia) {
  const name = guardia.nombre_completo
    ?? guardia.nombre
    ?? [guardia.primer_nombre, guardia.segundo_nombre, guardia.primer_apellido, guardia.segundo_apellido]
      .filter(Boolean)
      .join(' ')

  return present(name)
}

function getGuardias(revision) {
  return revision.guardias ?? revision.detalle?.guardias ?? (revision.guardia ? [revision.guardia] : [])
}

function getMissingItems(items, labels) {
  return Object.entries(labels)
    .filter(([key]) => items?.[key] === false)
    .map(([, label]) => label)
}

export default function RevisionGuardiaDetalleModal({ revision, onClose }) {
  const dialogRef = useRef(null)
  const previousFocusRef = useRef(null)

  useEffect(() => {
    previousFocusRef.current = document.activeElement
    const dialog = dialogRef.current
    ;(dialog.querySelector('[data-autofocus]') || dialog.querySelector('button, input, select, textarea') || dialog).focus()
    return () => previousFocusRef.current?.focus()
  }, [])

  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }
    if (event.key !== 'Tab') return

    const focusable = [...dialogRef.current.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
    const first = focusable[0]
    const last = focusable.at(-1)
    if (!first) return
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  const guardias = getGuardias(revision)
  const resultado = revision.no_se_presento_guardia ? 'No se presentó guardia' : 'Revisión realizada'
  const sucursal = displayName(revision.sucursal) !== EMPTY_VALUE ? displayName(revision.sucursal) : revision.nombre_sucursal
  const gs = displayName(revision.usuario) !== EMPTY_VALUE ? displayName(revision.usuario) : displayName(revision.gerente_sucursal)

  const realizada = !revision.no_se_presento_guardia

  // Estructura del kit (tuvet-modal) con el foco y el ciclo de Tab propios de este componente.
  return (
    <div className="tuvet-modal-backdrop revision-guardia-detalle-overlay">
      <section ref={dialogRef} className="tuvet-modal tuvet-modal-wide revision-guardia-detalle-modal" role="dialog" aria-modal="true" aria-label="Detalle de revisión de guardia" tabIndex="-1" onKeyDown={handleKeyDown}>
        <div className="tuvet-modal-header">
          <div className="tuvet-modal-heading">
            <span className={`tuvet-modal-icon tuvet-modal-icon-${realizada ? 'success' : 'danger'}`}><Icono nombre={realizada ? 'check' : 'alerta'} /></span>
            <div>
              <h2>Detalle de revisión</h2>
              <p className="tuvet-modal-subtitle">{present(revision.fecha)}</p>
            </div>
          </div>
          <button data-autofocus type="button" className="tuvet-icon-btn" aria-label="Cerrar detalle" onClick={onClose}><Icono nombre="cerrar" /></button>
        </div>

        <div className="tuvet-modal-body">
          <dl className="revision-guardia-detalle-summary">
            <div><dt>Sucursal</dt><dd>{present(sucursal)}</dd></div>
            <div><dt>Gerente de sucursal</dt><dd>{present(gs)}</dd></div>
            <div><dt>Resultado</dt><dd><span className={`tuvet-badge ${realizada ? 'tuvet-badge-aprobada' : 'tuvet-badge-vencida'}`}>{resultado}</span></dd></div>
            <div><dt>Cantidad de guardias</dt><dd>{guardias.length}</dd></div>
            <div className="revision-guardia-detalle-notes"><dt>Notas</dt><dd>{present(revision.notas)}</dd></div>
          </dl>

          <section className="revision-guardia-detalle-seccion" aria-labelledby="revision-guardia-detalle-guardias">
            <h3 id="revision-guardia-detalle-guardias">Guardias</h3>
            {guardias.length === 0 ? (
              <p className="revision-guardia-detalle-empty">No hay guardias registrados.</p>
            ) : (
              <div className="revision-guardia-detalle-guardias">
                {guardias.map((guardia, index) => {
                  const uniformeFaltante = getMissingItems(guardia.uniforme, UNIFORME_LABELS)
                  const equipamientoFaltante = getMissingItems(guardia.equipamiento, EQUIPAMIENTO_LABELS)
                  const completo = !uniformeFaltante.length && !equipamientoFaltante.length

                  return (
                    <dl key={guardia.id_guardia ?? guardia.numero_guardia ?? index} className={`revision-guardia-detalle-guardia ${completo ? 'is-completo' : 'has-faltantes'}`}>
                      <div><dt>Número</dt><dd>{present(guardia.numero_guardia ?? index + 1)}</dd></div>
                      <div><dt>Nombre completo</dt><dd>{fullName(guardia)}</dd></div>
                      <div><dt>Identidad</dt><dd>{present(guardia.identidad)}</dd></div>
                      <div><dt>Teléfono</dt><dd>{present(guardia.telefono)}</dd></div>
                      <div className="revision-guardia-detalle-missing"><dt>Uniforme no portado</dt><dd>{uniformeFaltante.length ? <ul>{uniformeFaltante.map((item) => <li key={item}>{item}</li>)}</ul> : 'Sin faltantes de uniforme.'}</dd></div>
                      <div className="revision-guardia-detalle-missing"><dt>Equipamiento no portado</dt><dd>{equipamientoFaltante.length ? <ul>{equipamientoFaltante.map((item) => <li key={item}>{item}</li>)}</ul> : 'Sin faltantes de equipamiento.'}</dd></div>
                    </dl>
                  )
                })}
              </div>
            )}
          </section>
        </div>

        <div className="tuvet-modal-footer">
          <button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={onClose}>Cerrar</button>
        </div>
      </section>
    </div>
  )
}
