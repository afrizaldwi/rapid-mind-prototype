import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Brain, ClipboardList, LogOut, Wifi, WifiOff } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { db } from '../../lib/firebase';
import { healthcareOrganizationSchema, membershipStatus } from '../../schemas/healthcareOrganization';

export default function FaskesLayout() {
  const { user, userProfile, logout } = useAuth();
  const isOnline = useOnlineStatus();
  const navigate = useNavigate();
  const [membership, setMembership] = useState({ status: 'loading', name: null });

  useEffect(() => {
    if (!user?.uid) return undefined;
    let unsubscribeOrganization = () => {};
    const unsubscribeProfile = onSnapshot(doc(db, 'users', user.uid), (snapshot) => {
      unsubscribeOrganization();
      const organizationId = membershipStatus(snapshot.data());
      if (!organizationId) {
        setMembership({ status: 'unassigned', name: null });
        return;
      }
      if (organizationId.includes('/')) {
        setMembership({ status: 'invalid', name: null });
        return;
      }
      setMembership({ status: 'loading', name: null });
      unsubscribeOrganization = onSnapshot(doc(db, 'healthcareOrganizations', organizationId), (organization) => {
        if (!organization.exists()) { setMembership({ status: 'missing', name: null }); return; }
        const parsed = healthcareOrganizationSchema.safeParse(organization.data());
        setMembership(parsed.success ? { status: 'assigned', name: parsed.data.name } : { status: 'invalid', name: null });
      }, () => setMembership({ status: 'error', name: null }));
    }, () => setMembership({ status: 'error', name: null }));
    return () => { unsubscribeProfile(); unsubscribeOrganization(); };
  }, [user?.uid]);

  const hospitalLabel = {
    loading: 'Memuat organisasi...', unassigned: 'Belum ditugaskan ke rumah sakit',
    missing: 'Rumah sakit terkait tidak ditemukan', invalid: 'Data rumah sakit tidak valid',
    error: 'Organisasi tidak dapat dimuat',
  }[membership.status] || membership.name;

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-red-700 p-2 text-white"><Brain className="h-6 w-6" /></div>
            <div>
              <p className="font-bold text-slate-900">RAPID-MIND</p>
              <p className="text-sm text-slate-600">Faskes · Validasi dan Rujukan</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 ${isOnline ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-800'}`}>
              {isOnline ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
              Browser {isOnline ? 'online' : 'offline'}
            </span>
            <div className="max-w-48 text-right">
              <p className="truncate font-semibold text-slate-800" title={userProfile?.name || ''}>{userProfile?.name || 'Nakes'}</p>
              <p className="truncate text-xs text-slate-500" title={hospitalLabel}>{hospitalLabel}</p>
            </div>
            <button type="button" onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-slate-700 hover:bg-slate-50">
              <LogOut className="h-4 w-4" /> Keluar
            </button>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <nav aria-label="Navigasi Faskes" className="mb-6">
          <NavLink to="/faskes" end className={({ isActive }) =>
            `inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold ${isActive ? 'bg-red-700 text-white' : 'bg-white text-slate-700 hover:bg-slate-100'}`}>
            <ClipboardList className="h-4 w-4" /> Antrean Darurat
          </NavLink>
        </nav>
        <main><Outlet /></main>
      </div>
    </div>
  );
}
