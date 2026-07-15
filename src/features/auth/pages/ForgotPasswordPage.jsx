import { useState } from 'react'
import { Link } from 'react-router-dom'
import { forgotPassword } from '../services/authService'
import './LoginPage.css'

function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [enviado, setEnviado] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await forgotPassword(email)
      setEnviado(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <div className="login-brand">
          <div className="login-icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h1 className="login-title">Recuperar acceso</h1>
          <p className="login-subtitle">Te enviaremos una contraseña temporal</p>
        </div>

        {enviado ? (
          <p className="login-subtitle" style={{ textAlign: 'center' }}>
            Si el correo existe en el sistema, se enviará una contraseña temporal. Revisa tu bandeja de entrada.
          </p>
        ) : (
          <form className="login-form" onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <label htmlFor="email">Correo electrónico</label>
              <div className="input-wrapper">
                <input
                  id="email"
                  type="email"
                  placeholder="usuario@correo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            {error && <p className="login-error">{error}</p>}

            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? 'Enviando...' : 'Enviar contraseña temporal'}
            </button>
          </form>
        )}

        <div className="form-options" style={{ justifyContent: 'center', marginTop: '1.5rem' }}>
          <Link to="/Login" className="forgot-link">Volver al inicio de sesión</Link>
        </div>
      </div>

      <div className="blob blob-1" />
      <div className="blob blob-2" />
    </div>
  )
}

export default ForgotPasswordPage
