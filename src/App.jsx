import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import AssessmentRoute from './components/AssessmentRoute'
import { AssessmentProvider } from './contexts/AssessmentContext'

// Layouts
import RelawanLayout from './components/layout/RelawanLayout'
import AdminLayout from './components/layout/AdminLayout'
import FaskesLayout from './components/layout/FaskesLayout'

// Auth Pages
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'

// Relawan Pages
import HomePage from './pages/relawan/HomePage'
import PatientLookupPage from './pages/relawan/PatientLookupPage'
import PfaPage from './pages/relawan/PfaPage'
import Srq20Page from './pages/relawan/Srq20Page'
import RiskFactorPage from './pages/relawan/RiskFactorPage'
import LongitudinalResultPage from './pages/relawan/LongitudinalResultPage'
import TriagePage from './pages/relawan/TriagePage'
import VerbalPage from './pages/relawan/VerbalPage'
import NonVerbalPage from './pages/relawan/NonVerbalPage'
import ResultPage from './pages/relawan/ResultPage'
import HistoryPage from './pages/relawan/HistoryPage'

// Admin Pages
import DashboardPage from './pages/admin/DashboardPage'
import MapPage from './pages/admin/MapPage'
import CasesPage from './pages/admin/CasesPage'
import StatsPage from './pages/admin/StatsPage'
import EmergencyQueuePage from './pages/faskes/EmergencyQueuePage'
import EmergencyDetailPage from './pages/faskes/EmergencyDetailPage'

function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Relawan Routes */}
        <Route
          path="/relawan"
          element={
            <ProtectedRoute allowedRole="relawan">
              <AssessmentProvider>
                <RelawanLayout />
              </AssessmentProvider>
            </ProtectedRoute>
          }
        >
          <Route index element={<HomePage />} />
          <Route path="patient-lookup" element={<PatientLookupPage />} />
          <Route element={<AssessmentRoute />}>
            <Route path="pfa" element={<PfaPage />} />
            <Route path="srq20" element={<Srq20Page />} />
            <Route path="risk-factor" element={<RiskFactorPage />} />
            <Route path="srq20/result" element={<LongitudinalResultPage />} />
            <Route path="triage" element={<TriagePage />} />
            <Route path="triage/verbal" element={<VerbalPage />} />
            <Route path="triage/nonverbal" element={<NonVerbalPage />} />
            <Route path="triage/result" element={<ResultPage />} />
          </Route>
          <Route path="history" element={<HistoryPage />} />
        </Route>

        {/* Nakes / Faskes Routes */}
        <Route
          path="/faskes"
          element={
            <ProtectedRoute allowedRole="nakes">
              <FaskesLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<EmergencyQueuePage />} />
          <Route path="emergencies/:id" element={<EmergencyDetailPage />} />
        </Route>

        {/* Admin Routes */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRole="admin">
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="map" element={<MapPage />} />
          <Route path="cases" element={<CasesPage />} />
          <Route path="stats" element={<StatsPage />} />
        </Route>

        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AuthProvider>
  )
}

export default App
