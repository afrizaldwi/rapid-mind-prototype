import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { getHomeRouteForRole } from '../lib/authRoles'
import { Brain, LogIn, Mail, Lock, AlertCircle } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login, user, userProfile, loading: authLoading, profileLoading, profileIssue, retryProfile, logout } = useAuth()
  const homeRoute = getHomeRouteForRole(userProfile?.role)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await login(email, password)
    } catch (err) {
      switch (err.code) {
        case 'auth/user-not-found':
          setError('Akun tidak ditemukan. Silakan daftar terlebih dahulu.')
          break
        case 'auth/wrong-password':
          setError('Password salah. Silakan coba lagi.')
          break
        case 'auth/invalid-email':
          setError('Format email tidak valid.')
          break
        case 'auth/invalid-credential':
          setError('Email atau password salah.')
          break
        default:
          setError('Terjadi kesalahan. Silakan coba lagi.')
      }
    } finally {
      setLoading(false)
    }
  }

  if (homeRoute) return <Navigate to={homeRoute} replace />

  if (authLoading || (user && profileLoading)) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">Memuat profil akun...</div>
  }

  if (user && profileIssue) {
    const message = profileIssue === 'offline'
      ? 'Profil akun belum tersimpan di perangkat ini. Sambungkan internet, lalu coba lagi.'
      : profileIssue === 'missing'
        ? 'Profil akun tidak ditemukan. Hubungi pengelola akun.'
        : profileIssue === 'invalid'
          ? 'Peran pada profil akun tidak didukung. Hubungi pengelola akun.'
          : 'Profil akun belum dapat dimuat. Periksa koneksi, lalu coba lagi.'
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-sm rounded-lg bg-white p-6 text-center shadow-sm">
          <h1 className="font-semibold text-slate-800">Profil belum tersedia</h1>
          <p className="mt-2 text-sm text-slate-600">{message}</p>
          <div className="mt-4 flex justify-center gap-3">
            <button type="button" onClick={retryProfile} className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white">Coba lagi</button>
            <button type="button" onClick={logout} className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700">Keluar</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo & Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4 shadow-lg shadow-blue-600/30">
            <Brain className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">RAPID-MIND</h1>
          <p className="text-slate-500 mt-1">Emergency Psychological Triage System</p>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-6">Masuk ke Akun</h2>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@email.com"
                  required
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan password"
                  required
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  Masuk
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-slate-500">
              Belum punya akun?{' '}
              <Link to="/register" className="text-blue-600 hover:text-blue-700 font-medium">
                Daftar Sekarang
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
