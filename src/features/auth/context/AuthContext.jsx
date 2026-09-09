import { createContext, useContext, useEffect, useState } from 'react'
import { getCurrentProfile } from '../services/authService'
import { clearTokens, getAccessToken, setTokens } from '../../../services/tokenStorage'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [accessToken, setAccessToken] = useState(() => {
    localStorage.removeItem('perfil')
    return getAccessToken()
  })
  const [perfil, setPerfil] = useState(null)
  const [perfilLoading, setPerfilLoading] = useState(Boolean(accessToken))

  useEffect(() => {
    if (!accessToken) return undefined

    let cancelled = false

    getCurrentProfile()
      .then((currentProfile) => {
        if (!cancelled) setPerfil(currentProfile)
      })
      .catch(() => {
        if (!cancelled) setPerfil(null)
      })
      .finally(() => {
        if (!cancelled) setPerfilLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [accessToken])

  function setAuthData(access, refresh, remember) {
    setTokens(access, refresh, remember)
    setPerfil(null)
    setPerfilLoading(true)
    setAccessToken(access)
  }

  function revokeMyTasksAccess() {
    setPerfil((currentProfile) => currentProfile && {
      ...currentProfile,
      can_access_my_tasks: false,
    })
  }

  function logout() {
    clearTokens()
    setPerfil(null)
    setAccessToken(null)
  }

  return (
    <AuthContext.Provider value={{ perfil, perfilLoading, setAuthData, revokeMyTasksAccess, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext)
}
