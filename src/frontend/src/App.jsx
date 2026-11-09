import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import OrganizationProfilePage from './pages/OrganizationProfilePage'
import ProfilePage from './pages/ProfilePage'
import OrganizationSignupPage from './pages/OrganizationSignupPage'
import ProjetoSocialLoginPage from './pages/ProjetoSocialLoginPage'
import ProjetoSocialSignupPage from './pages/ProjetoSocialSignupPage'
import VolunteerSignupPage from './pages/VolunteerSignupPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/login/projeto-social" element={<ProjetoSocialLoginPage />} />
      <Route path="/cadastro/voluntario" element={<VolunteerSignupPage />} />
      <Route path="/cadastro/organizacao" element={<OrganizationSignupPage />} />
      <Route path="/cadastro/projeto-social" element={<ProjetoSocialSignupPage />} />
      <Route element={<ProtectedRoute perfil="VOLUNTARIO" />}>
        <Route path="/voluntario" element={<ProfilePage />} />
      </Route>
      <Route element={<ProtectedRoute perfil="ORGANIZACAO" />}>
        <Route path="/organizacao" element={<ProfilePage />} />
        <Route path="/organizacao/perfil" element={<OrganizationProfilePage />} />
      </Route>
      <Route element={<ProtectedRoute perfil="ADMINISTRADOR" />}>
        <Route path="/admin" element={<ProfilePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
