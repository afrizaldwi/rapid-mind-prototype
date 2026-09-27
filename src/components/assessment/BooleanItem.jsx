export default function BooleanItem({ item, value, error, onAnswer }) {
  const answered = typeof value === 'boolean';

  return (
    <fieldset aria-invalid={Boolean(error)} aria-describedby={error ? `${item.id}-error` : undefined}
      className={`rounded-xl border bg-white p-4 shadow-sm ${error ? 'border-red-300' : 'border-gray-200'}`}>
      <legend className="px-1 text-sm font-semibold text-gray-800">{item.label}</legend>
      <p className={`mt-1 text-xs ${answered ? 'text-gray-500' : 'font-medium text-amber-700'}`}>
        {answered ? `Jawaban: ${value ? 'Ya' : 'Tidak'}` : 'Belum dijawab'}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {[[true, 'Ya'], [false, 'Tidak']].map(([answer, label]) => (
          <button key={label} type="button" aria-pressed={value === answer}
            onClick={() => onAnswer(item.id, answer)}
            className={`rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors ${
              value === answer
                ? 'border-blue-600 bg-blue-50 text-blue-700'
                : 'border-gray-200 text-gray-600 hover:border-blue-300'
            }`}>
            {label}
          </button>
        ))}
      </div>
      {error && <p id={`${item.id}-error`} className="mt-2 text-xs text-red-700">{error}</p>}
    </fieldset>
  );
}
