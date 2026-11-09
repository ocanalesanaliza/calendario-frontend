import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/context/AuthContext'
import { getTuvetCapabilities, isTuvetProfile, tuvetHomePath } from './tuvetPolicies'

// El calendario se elige con /api/auth/me/ (modulo_calendario), nunca por correo o grupo.
export function AnalizaModuleRoute({ children }) {
  const { perfil } = useAuth()
  if (isTuvetProfile(perfil)) return <Navigate to="/tuvet" replace />
  return children
}

export function TuvetModuleRoute({ children }) {
  const { perfil } = useAuth()
  if (!getTuvetCapabilities(perfil).canAccessTuvet) return <Navigate to="/" replace />
  return children
}

export function TuvetCapabilityRoute({ capability, children }) {
  const { perfil } = useAuth()
  if (!getTuvetCapabilities(perfil)[capability]) return <Navigate to="/tuvet" replace />
  return children
}

export function TuvetHome() {
  const { perfil } = useAuth()
  return <Navigate to={tuvetHomePath(perfil)} replace />
}
