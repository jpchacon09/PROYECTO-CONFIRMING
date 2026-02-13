import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { LoginSimple } from './pages/auth/LoginSimple'
import { CallbackPage } from './pages/auth/CallbackPage'
import { DashboardSimple } from './pages/dashboard/DashboardSimple'
import { DatosEmpresa } from './pages/onboarding/DatosEmpresa'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginSimple />} />
        <Route path="/auth/callback" element={<CallbackPage />} />
        <Route path="/dashboard" element={<DashboardSimple />} />
        <Route path="/onboarding/datos-empresa" element={<DatosEmpresa />} />
      </Routes>
      <Toaster position="top-right" richColors />
    </BrowserRouter>
  )
}

export default App
