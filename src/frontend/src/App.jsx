import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import ProfilePage from './pages/ProfilePage'
import VolunteerSignupPage from './pages/VolunteerSignupPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/cadastro/voluntario" element={<VolunteerSignupPage />} />
      <Route element={<ProtectedRoute perfil="VOLUNTARIO" />}>
        <Route path="/voluntario" element={<ProfilePage />} />
      </Route>
      <Route element={<ProtectedRoute perfil="ORGANIZACAO" />}>
        <Route path="/organizacao" element={<ProfilePage />} />
      </Route>
      <Route element={<ProtectedRoute perfil="ADMINISTRADOR" />}>
        <Route path="/admin" element={<ProfilePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
