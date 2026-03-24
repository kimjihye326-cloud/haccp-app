import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from './stores/auth-store'

import LoginPage from './pages/LoginPage'
import WorkerDashboard from './pages/worker/Dashboard'
import CleaningForm from './pages/worker/CleaningForm'
import MetalForm from './pages/worker/MetalForm'
import TemperatureForm from './pages/worker/TemperatureForm'
import InventoryForm from './pages/worker/InventoryForm'
import HygieneCheckForm from './pages/worker/HygieneCheckForm'
import AdminDashboard from './pages/admin/AdminDashboard'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchInterval: 30_000,
    },
  },
})

function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const user = useAuthStore((s) => s.user)
  if (!user) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />
  return <>{children}</>
}

export default function App() {
  const user = useAuthStore((s) => s.user)

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route path="/" element={
            <ProtectedRoute>
              {user?.role === 'WORKER'
                ? <WorkerDashboard />
                : <Navigate to="/admin" replace />}
            </ProtectedRoute>
          } />
          <Route path="/inspect/cleaning" element={
            <ProtectedRoute><CleaningForm /></ProtectedRoute>
          } />
          <Route path="/inspect/metal" element={
            <ProtectedRoute><MetalForm /></ProtectedRoute>
          } />
          <Route path="/inspect/temperature" element={
            <ProtectedRoute><TemperatureForm /></ProtectedRoute>
          } />
          <Route path="/inspect/hygiene" element={
            <ProtectedRoute><HygieneCheckForm /></ProtectedRoute>
          } />
          <Route path="/inventory" element={
            <ProtectedRoute><InventoryForm /></ProtectedRoute>
          } />

          <Route path="/admin" element={
            <ProtectedRoute roles={['MANAGER', 'ADMIN']}>
              <AdminDashboard />
            </ProtectedRoute>
          } />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster
        position="bottom-center"
        toastOptions={{
          duration: 3000,
          style: { fontSize: '15px', borderRadius: '12px', padding: '14px 24px' },
          success: { style: { background: '#0d904f', color: '#fff' } },
          error: { style: { background: '#d93025', color: '#fff' } },
        }}
      />
    </QueryClientProvider>
  )
}

