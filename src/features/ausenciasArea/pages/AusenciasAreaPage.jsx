import { useAuth } from '../../auth/context/AuthContext'
import { getProfileCapabilities } from '../../auth/profilePolicies'
import './AusenciasAreaPage.css'

export default function AusenciasAreaPage() {
  const { perfil } = useAuth()
  const { isAreaManager, canManageAreaAbsences } = getProfileCapabilities(perfil)

  return (
    <section className="ausencias-area-page">
      <header className="page-header">
        <div>
          <h1>Vacaciones y situaciones del área</h1>
          <p>{isAreaManager ? 'Gestiona tus solicitudes de vacaciones.' : 'Resuelve vacaciones y administra situaciones especiales de gerentes de área.'}</p>
        </div>
      </header>
      <p>{canManageAreaAbsences ? 'La gestión de ausencias estará disponible aquí.' : 'Tus solicitudes de vacaciones estarán disponibles aquí.'}</p>
    </section>
  )
}
