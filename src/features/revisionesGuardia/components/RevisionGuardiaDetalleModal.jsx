import { useEffect, useRef } from 'react'
import './RevisionGuardiaDetalleModal.css'

const EMPTY_VALUE = '—'

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
  const codigo = revision.sucursal?.codigo ?? revision.codigo_sucursal
  const gerente = displayName(revision.gerente_area)
  const gs = displayName(revision.usuario) !== EMPTY_VALUE ? displayName(revision.usuario) : displayName(revision.gerente_sucursal)

  return (
    <div className="modal-overlay revision-guardia-detalle-overlay">
      <section ref={dialogRef} className="modal revision-guardia-detalle-modal" role="dialog" aria-modal="true" aria-label="Detalle de revisión de guardia" tabIndex="-1" onKeyDown={handleKeyDown}>
        <div className="modal-header">
          <div>
            <h2>Detalle de revisión</h2>
            <p>{present(revision.fecha)}</p>
          </div>
          <button data-autofocus type="button" className="modal-close" aria-label="Cerrar detalle" onClick={onClose}>×</button>
        </div>

        <dl className="revision-guardia-detalle-summary">
          <div><dt>Sucursal</dt><dd>{present(sucursal)}</dd></div>
          <div><dt>Código</dt><dd>{present(codigo)}</dd></div>
          <div><dt>Gerente de área</dt><dd>{present(gerente)}</dd></div>
          <div><dt>GS</dt><dd>{present(gs)}</dd></div>
          <div><dt>Resultado</dt><dd>{resultado}</dd></div>
          <div><dt>Cantidad de guardias</dt><dd>{guardias.length}</dd></div>
          <div className="revision-guardia-detalle-notes"><dt>Notas</dt><dd>{present(revision.notas)}</dd></div>
        </dl>

        <section aria-labelledby="revision-guardia-detalle-guardias">
          <h3 id="revision-guardia-detalle-guardias">Guardias</h3>
          {guardias.length === 0 ? (
            <p className="revision-guardia-detalle-empty">No hay guardias registrados.</p>
          ) : (
            <div className="revision-guardia-detalle-guardias">
              {guardias.map((guardia, index) => (
                <dl key={guardia.id_guardia ?? guardia.numero_guardia ?? index} className="revision-guardia-detalle-guardia">
                  <div><dt>Número</dt><dd>{present(guardia.numero_guardia ?? index + 1)}</dd></div>
                  <div><dt>Nombre completo</dt><dd>{fullName(guardia)}</dd></div>
                  <div><dt>Identidad</dt><dd>{present(guardia.identidad)}</dd></div>
                  <div><dt>Teléfono</dt><dd>{present(guardia.telefono)}</dd></div>
                </dl>
              ))}
            </div>
          )}
        </section>

        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>Cerrar</button>
        </div>
      </section>
    </div>
  )
}
