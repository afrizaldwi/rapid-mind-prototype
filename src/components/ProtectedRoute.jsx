import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { getHomeRouteForRole } from '../lib/authRoles'

export default function ProtectedRoute({ children, allowedRole }) {
  const { user, userProfile, loading, profileLoading, profileIssue, retryProfile, logout } = useAuth()

  if (loading || (user && profileLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Memuat...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!userProfile) {
    const message = profileIssue === 'offline'
      ? 'Profil akun belum tersimpan di perangkat ini. Sambungkan internet, lalu coba lagi.'
      : profileIssue === 'missing'
        ? 'Profil akun tidak ditemukan. Hubungi pengelola akun.'
        : profileIssue === 'invalid'
          ? 'Peran pada profil akun tidak didukung. Hubungi pengelola akun.'
          : 'Profil akun belum dapat dimuat. Periksa koneksi, lalu coba lagi.'
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="max-w-sm rounded-lg bg-white p-6 text-center shadow-sm">
          <h1 className="font-semibold text-slate-800">Profil belum tersedia</h1>
          <p className="mt-2 text-sm text-slate-600">{message}</p>
          <div className="mt-4 flex justify-center gap-3">
            <button onClick={retryProfile} className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white">Coba lagi</button>
            <button onClick={logout} className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700">Keluar</button>
          </div>
        </div>
      </div>
    )
  }

  if (allowedRole && userProfile?.role !== allowedRole) {
    const redirectTo = getHomeRouteForRole(userProfile.role)
    return <Navigate to={redirectTo} replace />
  }

  return children
}
