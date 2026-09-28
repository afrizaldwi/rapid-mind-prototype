import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import EmergencyDetailContent from '../src/components/faskes/EmergencyDetailContent.jsx';

const baseRecord = {
  id: 'em-demo',
  origin: { status: 't0-suspect', timestamp: '2026-09-27T12:00:00.000Z', relawanId: 'relawan-demo', gates: ['redflag.immediate_harm'] },
  validation: null, referral: null, workflowIssue: null,
};
const confirmed = { ...baseRecord, validation: { outcome: 't0-confirmed', decidedAt: '2026-09-27T12:30:00.000Z' }, referral: { status: 'waiting-dispatch' } };
const props = {
  online: true, history: { nik: null, loading: false, offline: false }, teleStarted: false,
  draft: { outcome: '', downgradedTo: '', clinicalNote: '' }, confirming: null,
  busy: false, blockReason: null, feedback: null,
  onRetry: () => {}, onHistoryRetry: () => {}, onStart: () => {}, onDraftChange: () => {},
  onReviewDecision: () => {}, onCancelConfirmation: () => {}, onConfirmDecision: () => {}, onAdvanceReferral: () => {},
};

function render(detail, overrides = {}) {
  return renderToStaticMarkup(React.createElement(MemoryRouter, null,
    React.createElement(EmergencyDetailContent, { ...props, detail, ...overrides })));
}

function detail(record, metadata = {}) {
  return { record, loading: false, fromCache: false, hasPendingWrites: false, listenerError: null, notFound: false, invalidOrigin: false, ...metadata };
}

describe('static Faskes detail presentation', () => {
  it('renders loading, verified not-found, invalid-origin, and listener error distinctly', () => {
    expect(render(detail(null, { loading: true }))).toContain('Memuat detail emergency');
    expect(render(detail(null, { notFound: true }))).toContain('Emergency tidak ditemukan di server');
    expect(render(detail(null, { invalidOrigin: true }))).toContain('Data asal emergency tidak valid');
    expect(render(detail(baseRecord, { listenerError: new Error('offline') }))).toContain('Listener emergency terputus');
    expect(render(detail(baseRecord, { fromCache: true }))).toContain('Menunggu konfirmasi data dari server');
  });

  it('shows anonymous origin and simulation before a decision, with a form only after starting', () => {
    const initial = render(detail(baseRecord));
    expect(initial).toContain('Emergency anonim');
    expect(initial).toContain('Tanpa NIK tertaut');
    expect(initial).toContain('Tele-Emergency · Simulasi');
    expect(initial).toContain('tidak melakukan panggilan langsung');
    expect(initial).toContain('Mulai Validasi');
    expect(initial).not.toContain('Tinjau keputusan final');
    expect(initial).toContain('Wording indikator masih provisional');
    const started = render(detail(baseRecord), { teleStarted: true });
    expect(started).toContain('Confirm T0');
    expect(started).toContain('Downgrade');
    expect(started).toContain('Tinjau keputusan final');
  });

  it('shows linked history and both persisted SRQ and PFA summaries', () => {
    const record = { ...baseRecord, origin: { ...baseRecord.origin, patientNik: '3201234567890001', patientName: 'Pasien Demo' } };
    const history = { nik: record.origin.patientNik, loading: false, offline: false,
      patient: { status: 'found', data: { nama: 'Pasien Demo', usia: 34 } },
      cases: { status: 'ready', unknownCount: 0, items: [
        { id: 'pfa', type: 'pfa', timestamp: '2026-09-25T12:00:00Z' },
        { id: 'srq', type: 'srq20', tier: 'T2', score: 6, inputMode: 'verbal', timestamp: '2026-09-26T12:00:00Z' },
        { id: 'legacy', type: 'legacy-triage', zone: 'merah', timestamp: '2026-09-24T12:00:00Z' },
      ] } };
    const html = render(detail(record), { history });
    expect(html).toContain('Pasien Demo');
    expect(html).toContain('PFA tercatat');
    expect(html).toContain('SRQ-20 · T2 · 6/20');
    expect(html).toContain('Triase legacy · Zona merah');
  });

  it('renders final downgrade without referral or revalidation and completed referral without next action', () => {
    for (const tier of ['T1', 'T2']) {
      const html = render(detail({ ...baseRecord, validation: { outcome: 'downgraded', downgradedTo: tier } }));
      expect(html).toContain(`Downgraded → ${tier}`);
      expect(html).not.toContain('Referral / transport');
      expect(html).not.toContain('Tinjau keputusan final');
    }
    const completed = render(detail({ ...confirmed, referral: { status: 'completed' } }));
    expect(completed).toContain('Referral selesai. Tidak ada langkah berikutnya.');
    expect(completed).not.toContain('Tinjau keputusan final');
  });

  it('renders exactly the immediate referral action from a confirmed state', () => {
    const html = render(detail(confirmed));
    expect(html).toContain('Langkah berikutnya: Menuju Lokasi');
    expect(html.match(/>Menuju Lokasi<\/button>/g)).toHaveLength(1);
    expect(html).not.toContain('Langkah berikutnya: Tiba di Posko');
  });

  it('keeps a malformed-workflow origin visible and shows disabled-action warning', () => {
    const html = render(detail({ ...baseRecord, workflowIssue: { codes: ['malformed-validation'] } }), { blockReason: 'Metadata alur Faskes tidak valid.' });
    expect(html).toContain('Asal · T0-Suspect');
    expect(html).toContain('Metadata alur Faskes tidak valid atau tidak konsisten');
    expect(html).not.toContain('Tinjau keputusan final');
  });
});
