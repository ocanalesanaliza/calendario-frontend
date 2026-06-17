import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { changePassword } from '../services/authService'
import { useAuth } from '../context/AuthContext'
import './ChangePasswordPage.css'

function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { updatePerfil } = useAuth()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await changePassword(currentPassword, newPassword)
      updatePerfil(data.perfil)
      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="cp-wrapper">
      <div className="cp-card">
        <div className="cp-brand">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <h1>Cambiar contraseña</h1>
          <p>Debes establecer una nueva contraseña antes de continuar.</p>
        </div>

        <form className="cp-form" onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="current">Contraseña actual</label>
            <input
              id="current"
              type="password"
              placeholder="••••••••"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          <div className="form-group">
            <label htmlFor="new">Nueva contraseña</label>
            <input
              id="new"
              type="password"
              placeholder="••••••••"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
          </div>

          {error && <p className="cp-error">{error}</p>}

          <button type="submit" className="cp-btn" disabled={loading}>
            {loading ? 'Guardando...' : 'Guardar contraseña'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default ChangePasswordPage
