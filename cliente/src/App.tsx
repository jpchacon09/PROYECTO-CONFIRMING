import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { LoginSimple } from './pages/auth/LoginSimple'
import { CallbackPage } from './pages/auth/CallbackPage'
import { Dashboard } from './pages/dashboard/Dashboard'
import { DatosEmpresa } from './pages/onboarding/DatosEmpresa'
import { Documentos } from './pages/onboarding/Documentos'
import { Confirmacion } from './pages/onboarding/Confirmacion'
import { ProtectedRoute } from './components/layout/ProtectedRoute'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginSimple />} />
        <Route path="/auth/callback" element={<CallbackPage />} />
        <Route
          path="/dashboard"
          element={(
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/onboarding/datos-empresa"
          element={(
            <ProtectedRoute>
              <DatosEmpresa />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/onboarding/documentos"
          element={(
            <ProtectedRoute>
              <Documentos />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/onboarding/confirmacion"
          element={(
            <ProtectedRoute>
              <Confirmacion />
            </ProtectedRoute>
          )}
        />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
      <Toaster position="top-right" richColors />
    </BrowserRouter>
  )
}

export default App
