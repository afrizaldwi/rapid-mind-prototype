// Provisional prototype wording. Keep IDs stable when display text changes.
export const PFA_PROTOCOL = {
  version: 'pfa-prototype-v1',
  sections: [
    {
      id: 'look',
      title: 'LOOK',
      description: 'Amati kondisi penyintas dan lingkungan sekitar.',
      items: [
        { id: 'look.safety_checked', type: 'boolean', label: 'Apakah keamanan lokasi dan penyintas sudah diperiksa?', required: true },
        { id: 'look.basic_needs_checked', type: 'boolean', label: 'Apakah kebutuhan dasar penyintas sudah diperiksa?', required: true },
        { id: 'look.distress_observed', type: 'boolean', label: 'Apakah tanda distres tampak pada penyintas?', required: true },
      ],
    },
    {
      id: 'listen',
      title: 'LISTEN',
      description: 'Dengarkan penyintas dengan tenang dan hormat.',
      items: [
        { id: 'listen.introduced_self', type: 'boolean', label: 'Apakah relawan sudah memperkenalkan diri?', required: true },
        { id: 'listen.concerns_heard', type: 'boolean', label: 'Apakah keluhan penyintas sudah didengarkan?', required: true },
        { id: 'listen.priority_concern', type: 'text', label: 'Keluhan atau kebutuhan paling mendesak', required: false },
      ],
    },
    {
      id: 'link',
      title: 'LINK',
      description: 'Catat hubungan ke dukungan yang dibutuhkan.',
      items: [
        { id: 'link.basic_needs_support', type: 'boolean', label: 'Apakah penyintas sudah dihubungkan dengan dukungan kebutuhan dasar?', required: true },
        { id: 'link.social_support', type: 'boolean', label: 'Apakah penyintas sudah dihubungkan dengan dukungan keluarga atau sosial?', required: true },
        { id: 'link.followup_service', type: 'boolean', label: 'Apakah kebutuhan layanan lanjutan sudah ditinjau?', required: true },
        { id: 'link.notes', type: 'text', label: 'Catatan tindak lanjut', required: false },
      ],
    },
  ],
};
