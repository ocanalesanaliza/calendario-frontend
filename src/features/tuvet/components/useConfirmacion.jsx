import { useCallback, useState } from 'react'
import { ConfirmDialog } from './TuvetUi'

// Sustituye a window.confirm: confirmar({ title, message, confirmLabel, accion }) abre un diálogo
// accesible. Si se pasa `accion`, se ejecuta dentro del diálogo y sus errores se muestran ahí.
export function useConfirmacion() {
  const [pendiente, setPendiente] = useState(null)

  const confirmar = useCallback((opciones) => new Promise((resolve) => {
    setPendiente({ ...opciones, resolve })
  }), [])

  const dialogo = pendiente && (
    <ConfirmDialog
      title={pendiente.title}
      message={pendiente.message}
      detail={pendiente.detail}
      confirmLabel={pendiente.confirmLabel}
      tone={pendiente.tone}
      onCancel={() => {
        pendiente.resolve(false)
        setPendiente(null)
      }}
      onConfirm={async () => {
        if (pendiente.accion) await pendiente.accion()
        pendiente.resolve(true)
        setPendiente(null)
      }}
    />
  )

  return [confirmar, dialogo]
}
