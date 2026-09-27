// Provisional prototype wording. Keep the IDs stable when clinical copy changes.
export const RED_FLAG_PROTOCOL = {
  version: 'redflag-prototype-v1',
  indicators: [
    {
      id: 'redflag.immediate_harm',
      label: 'Ada ancaman segera menyakiti diri sendiri atau orang lain.',
    },
    {
      id: 'redflag.severe_mental_state',
      label: 'Ada perubahan kondisi mental berat yang mengganggu keselamatan.',
    },
    {
      id: 'redflag.acute_medical',
      label: 'Ada kondisi medis atau cedera akut yang membutuhkan bantuan segera.',
    },
  ],
};
