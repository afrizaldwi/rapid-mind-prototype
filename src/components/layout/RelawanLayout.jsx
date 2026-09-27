import React, { useEffect, useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Brain, Home, PlusCircle, ClipboardList, LogOut, WifiOff, CheckCircle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useAssessment } from '../../hooks/useAssessment';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import { clearPfaDraft } from '../../lib/pfa';

export default function RelawanLayout() {
  const { userProfile, logout } = useAuth();
  const { assessment, clearAssessment } = useAssessment();
  const assessmentStartedAt = assessment?.startedAt;
  const { isOnline, pendingCount, conflictCount, lastSyncResult } = useOfflineSync();
  const isOffline = !isOnline;
  const location = useLocation();
  const navigate = useNavigate();
  const [showSyncToast, setShowSyncToast] = useState(false);
  const isAssessmentPath = location.pathname === '/relawan/patient-lookup' ||
                           location.pathname === '/relawan/pfa' ||
                           location.pathname === '/relawan/triage' ||
                           location.pathname.startsWith('/relawan/triage/');
  
  // Determine if bottom nav should be hidden (on triage sub-pages that have their own action buttons)
  const hideBottomNav = location.pathname.includes('/triage/verbal') || 
                        location.pathname.includes('/triage/nonverbal') || 
                        location.pathname.includes('/triage/result') ||
                        location.pathname === '/relawan/pfa' ||
                        location.pathname.includes('/patient-lookup');

  useEffect(() => {
    if (lastSyncResult?.complete) {
      setShowSyncToast(true);
      const timer = setTimeout(() => setShowSyncToast(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [lastSyncResult]);

  useEffect(() => {
    if (assessmentStartedAt && location.pathname === '/relawan' &&
        location.state?.completedAssessmentStartedAt === assessmentStartedAt) {
      clearAssessment();
    }
  }, [location.pathname, location.state, assessmentStartedAt, clearAssessment]);

  const handleLogout = async () => {
    clearAssessment();
    clearPfaDraft();
    await logout();
    navigate('/login');
  };

  return (
    <div className={`min-h-screen bg-gray-50 ${hideBottomNav ? 'pb-0' : 'pb-20'} flex flex-col font-sans`}>
      {/* Header */}
      <header className="bg-white shadow-sm px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <Brain className="w-8 h-8 text-blue-600" />
          <span className="font-bold text-lg text-gray-800">RAPID-MIND</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${isOffline ? 'bg-red-500' : 'bg-green-500'}`}></div>
            <span className="text-sm text-gray-600 truncate max-w-[100px]">{userProfile?.name || 'Relawan'}</span>
          </div>
          <button onClick={handleLogout} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Offline Banner */}
      {(isOffline || pendingCount > 0 || conflictCount > 0) && (
        <div className="bg-amber-100 border-b border-amber-200 px-4 py-2 flex items-center justify-between z-10 sticky top-[60px]">
          <div className="flex items-center gap-2 text-amber-800 text-sm">
            <WifiOff className="w-4 h-4" />
            <span>{isOffline ? 'Mode Offline — Data disimpan secara lokal' : pendingCount > 0 ? 'Data menunggu sinkronisasi' : 'Konflik data pasien perlu ditinjau'}</span>
          </div>
          <div className="flex gap-1 text-xs font-medium text-amber-900">
            {pendingCount > 0 && <span>{pendingCount} pending</span>}
            {conflictCount > 0 && <span>{conflictCount} konflik</span>}
          </div>
        </div>
      )}

      {/* Sync Toast */}
      {showSyncToast && pendingCount === 0 && conflictCount === 0 && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 z-50 animate-fade-in">
          <CheckCircle className="w-5 h-5" />
          <span className="text-sm font-medium">Sinkronisasi selesai!</span>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-md mx-auto relative">
        <Outlet />
      </main>

      {/* Bottom Navigation — hidden on triage sub-pages */}
      {!hideBottomNav && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-20 pb-safe">
          <div className="max-w-md mx-auto flex justify-around">
            <Link
              to="/relawan"
              className={`flex flex-col items-center py-3 px-6 ${
                location.pathname === '/relawan' ? 'text-blue-600' : 'text-gray-500 hover:text-blue-500'
              }`}
            >
              <Home className={`w-6 h-6 ${location.pathname === '/relawan' ? 'fill-blue-50' : ''}`} />
              <span className="text-[10px] font-medium mt-1">Beranda</span>
            </Link>
            <Link
              to="/relawan/patient-lookup"
              className={`flex flex-col items-center py-3 px-6 ${
                isAssessmentPath ? 'text-blue-600' : 'text-gray-500 hover:text-blue-500'
              }`}
            >
              <PlusCircle className={`w-6 h-6 ${isAssessmentPath ? 'fill-blue-50' : ''}`} />
              <span className="text-[10px] font-medium mt-1">Triase Baru</span>
            </Link>
            <Link
              to="/relawan/history"
              className={`flex flex-col items-center py-3 px-6 ${
                location.pathname === '/relawan/history' ? 'text-blue-600' : 'text-gray-500 hover:text-blue-500'
              }`}
            >
              <ClipboardList className={`w-6 h-6 ${location.pathname === '/relawan/history' ? 'fill-blue-50' : ''}`} />
              <span className="text-[10px] font-medium mt-1">Riwayat</span>
            </Link>
          </div>
        </nav>
      )}
    </div>
  );
}
