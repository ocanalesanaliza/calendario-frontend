import { useEffect, useRef } from 'react'
import './Toast.css'

export default function Toast({ message, type = 'error', onClose, duration = 4000 }) {
  // Se guarda el último onClose: si fuera dependencia, cada render del padre reiniciaría el temporizador.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    const t = setTimeout(() => onCloseRef.current?.(), duration)
    return () => clearTimeout(t)
  }, [message, duration])

  return (
    <div className={`toast toast-${type}`}>
      <div className="toast-icon">
        {type === 'error' ? (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        )}
      </div>
      <span className="toast-message">{message}</span>
      <button className="toast-close" onClick={onClose}>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  )
}
