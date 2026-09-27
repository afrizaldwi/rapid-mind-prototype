import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useAssessment } from '../hooks/useAssessment';
import { saveEmergency } from '../lib/emergencies';
import { RED_FLAG_PROTOCOL } from '../protocols/redFlagProtocol';

export default function RedFlagFAB({ onSaved }) {
  const { user, userProfile } = useAuth();
  const { assessment } = useAssessment();
  const [open, setOpen] = useState(false);
  const [gates, setGates] = useState([]);
  const [note, setNote] = useState('');
  const [mode, setMode] = useState('form');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const saveLock = useRef(false);
  const submissionToken = useRef(0);
  const triggerRef = useRef(null);
  const dialogRef = useRef(null);
  const firstGateRef = useRef(null);
  const acknowledgeRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !saveLock.current) {
        submissionToken.current++;
        setOpen(false);
        triggerRef.current?.focus();
      }
      if (event.key !== 'Tab') return;
      const focusable = [...dialogRef.current.querySelectorAll('button:not([disabled]), input:not([disabled]), textarea:not([disabled])')];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (open && mode === 'form') firstGateRef.current?.focus();
    if (open && mode !== 'form') acknowledgeRef.current?.focus();
  }, [open, mode]);

  useEffect(() => () => { submissionToken.current++; }, []);

  const refreshCount = () => {
    void Promise.resolve().then(() => onSaved?.()).catch((cause) => {
      console.error('Gagal memperbarui hitungan sinkronisasi:', cause);
    });
  };

  const handleOpen = () => {
    submissionToken.current++;
    setGates([]);
    setNote('');
    setError('');
    setMode('form');
    setOpen(true);
  };

  const handleClose = () => {
    if (saveLock.current) return;
    submissionToken.current++;
    setOpen(false);
    triggerRef.current?.focus();
  };

  const toggleGate = (id) => {
    setGates((current) => current.includes(id)
      ? current.filter((gate) => gate !== id) : [...current, id]);
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saveLock.current) return;
    if (!gates.length) {
      setError('Pilih setidaknya satu indikator Red Flag.');
      return;
    }
    saveLock.current = true;
    setSaving(true);
    setError('');
    const token = submissionToken.current;
    try {
      const { upload } = await saveEmergency({ user, userProfile, assessment, gates, note });
      setMode('pending');
      refreshCount();
      // Upload is started by saveEmergency after the local insert. Handle both
      // fulfillment and unexpected rejection without losing the local event.
      void upload.then(({ synced }) => {
        if (submissionToken.current === token) setMode(synced ? 'synced' : 'pending');
        refreshCount();
      }).catch((cause) => {
        console.error('Gagal memantau upload Red Flag:', cause);
        if (submissionToken.current === token) setMode('pending');
        refreshCount();
      });
    } catch (cause) {
      console.error('Gagal menyimpan Red Flag secara lokal:', cause);
      setError('T0-Suspect belum tersimpan di perangkat. Periksa penyimpanan lalu coba lagi.');
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  };

  return (
    <>
      <div className="pointer-events-none fixed left-1/2 z-[55] flex w-full max-w-md -translate-x-1/2 justify-end pr-4"
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 7rem)' }}>
        <button type="button" ref={triggerRef} onClick={handleOpen}
          className="pointer-events-auto inline-flex min-h-12 items-center gap-2 rounded-full bg-red-700 px-4 py-3 font-bold text-white shadow-lg shadow-red-900/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
          aria-label="Buka Red Flag darurat">
          <AlertTriangle className="h-5 w-5" />
          <span className="text-sm">Red Flag</span>
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-2 sm:items-center sm:p-4">
          <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="red-flag-title"
            className="max-h-[calc(100dvh-1rem)] w-full max-w-md overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 bg-red-700 p-4 text-white">
              <div>
                <h2 id="red-flag-title" className="text-lg font-bold">Red Flag — T0-Suspect</h2>
                <p className="mt-1 text-xs text-red-100">Indikator prototipe sementara, bukan kriteria klinis tervalidasi.</p>
              </div>
              <button type="button" onClick={handleClose} disabled={saving}
                className="rounded-lg p-1 text-red-100 hover:bg-red-600 disabled:opacity-50" aria-label="Tutup Red Flag">
                <X className="h-5 w-5" />
              </button>
            </div>

            {mode === 'form' ? (
              <form onSubmit={handleSubmit} className="space-y-4 p-4">
                <p className="text-sm text-gray-700">
                  {assessment?.relawanId === user?.uid && assessment.patient
                    ? `Asesmen aktif: ${assessment.patient.nama || 'Penyintas'} (NIK ${assessment.patient.nik}).`
                    : 'Belum ada asesmen pasien aktif. Red Flag tetap dapat dicatat tanpa NIK.'}
                </p>
                <fieldset disabled={saving}>
                  <legend className="mb-2 text-sm font-bold text-gray-900">Pilih minimal satu indikator</legend>
                  <div className="space-y-2">
                    {RED_FLAG_PROTOCOL.indicators.map((indicator, index) => (
                      <label key={indicator.id} className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 p-3 text-sm text-gray-800 has-[:checked]:border-red-500 has-[:checked]:bg-red-50">
                        <input ref={index === 0 ? firstGateRef : undefined} type="checkbox" checked={gates.includes(indicator.id)}
                          onChange={() => toggleGate(indicator.id)} className="mt-0.5 h-5 w-5 accent-red-700" />
                        <span>{indicator.label}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <label className="block text-sm font-semibold text-gray-900">
                  Catatan tambahan (opsional)
                  <textarea value={note} onChange={(event) => setNote(event.target.value)} disabled={saving}
                    rows={3} className="mt-2 w-full rounded-xl border border-gray-300 p-3 text-sm font-normal text-gray-900 focus:border-red-600 focus:outline-none" />
                </label>
                {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
                <div className="flex gap-2 pb-[env(safe-area-inset-bottom)]">
                  <button type="button" onClick={handleClose} disabled={saving}
                    className="rounded-xl border border-gray-300 px-4 py-3 text-sm font-bold text-gray-700 disabled:opacity-50">Batal</button>
                  <button type="submit" disabled={saving}
                    className="flex-1 rounded-xl bg-red-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">
                    {saving ? 'Menyimpan...' : 'Simpan T0-Suspect'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4 p-4" aria-live="polite">
                <p className="text-sm font-semibold text-gray-900">
                  {mode === 'synced'
                    ? 'Catatan T0-Suspect telah tersinkronisasi. Belum ada konfirmasi penerimaan dari layanan.'
                    : 'T0-Suspect tersimpan di perangkat dan menunggu sinkronisasi.'}
                </p>
                <p className="text-sm text-gray-600">Asesmen yang sedang berlangsung tetap dapat dilanjutkan.</p>
                <button ref={acknowledgeRef} type="button" onClick={handleClose}
                  className="w-full rounded-xl bg-red-700 px-4 py-3 text-sm font-bold text-white">Mengerti, lanjutkan</button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
