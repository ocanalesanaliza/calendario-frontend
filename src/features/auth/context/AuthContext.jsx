import { createContext, useContext, useState } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [perfil, setPerfil] = useState(() => {
    try {
      const raw = localStorage.getItem('perfil')
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })

  function setAuthData(access, refresh, perfilData) {
    localStorage.setItem('access', access)
    localStorage.setItem('refresh', refresh)
    localStorage.setItem('perfil', JSON.stringify(perfilData))
    setPerfil(perfilData)
  }

  function updatePerfil(perfilData) {
    localStorage.setItem('perfil', JSON.stringify(perfilData))
    setPerfil(perfilData)
  }

  function logout() {
    localStorage.removeItem('access')
    localStorage.removeItem('refresh')
    localStorage.removeItem('perfil')
    setPerfil(null)
  }

  return (
    <AuthContext.Provider value={{ perfil, setAuthData, updatePerfil, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
