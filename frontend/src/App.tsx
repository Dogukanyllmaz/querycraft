import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { Layout } from '@/components/Layout'
import { Login } from '@/pages/Login'
import { Signup } from '@/pages/Signup'
import { Dashboard } from '@/pages/Dashboard'
import { Connections } from '@/pages/Connections'
import { Reports } from '@/pages/Reports'
import { ReportBuilder } from '@/pages/ReportBuilder'
import { ReportDetail } from '@/pages/ReportDetail'
import { DatabaseBrowser } from '@/pages/DatabaseBrowser'
import { AdminUsers } from '@/pages/AdminUsers'

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          {/* All authenticated users */}
          <Route path="/" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute><Layout><Reports /></Layout></ProtectedRoute>} />
          <Route path="/reports/:id" element={<ProtectedRoute><Layout><ReportDetail /></Layout></ProtectedRoute>} />

          {/* Admin only */}
          <Route path="/connections" element={<ProtectedRoute adminOnly><Layout><Connections /></Layout></ProtectedRoute>} />
          <Route path="/connections/:id/browse" element={<ProtectedRoute adminOnly><Layout><DatabaseBrowser /></Layout></ProtectedRoute>} />
          <Route path="/reports/new" element={<ProtectedRoute adminOnly><Layout><ReportBuilder /></Layout></ProtectedRoute>} />
          <Route path="/reports/:id/edit" element={<ProtectedRoute adminOnly><Layout><ReportBuilder /></Layout></ProtectedRoute>} />
          <Route path="/admin/users" element={<ProtectedRoute adminOnly><Layout><AdminUsers /></Layout></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
      </ErrorBoundary>
    </BrowserRouter>
  )
}
