export default function PfaSection({ section, responses, errors, onAnswer, disabled }) {
  return (
    <section className="space-y-4" aria-labelledby={`pfa-${section.id}`}>
      <div>
        <h2 id={`pfa-${section.id}`} className="text-xl font-bold text-gray-800">{section.title}</h2>
        <p className="mt-1 text-sm text-gray-600">{section.description}</p>
      </div>
      {section.items.map((item) => (
        <div key={item.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          {item.type === 'boolean' ? (
            <fieldset aria-describedby={errors[item.id] ? `${item.id}-error` : undefined}>
              <legend className="text-sm font-semibold text-gray-800">
                {item.label}{item.required && <span className="ml-1 text-red-600">*</span>}
              </legend>
              {item.helperText && <p className="mt-1 text-xs text-gray-500">{item.helperText}</p>}
              <div className="mt-3 grid grid-cols-2 gap-2">
                {[[true, 'Ya'], [false, 'Tidak']].map(([value, label]) => (
                  <button
                    key={label}
                    type="button"
                    disabled={disabled}
                    aria-pressed={responses[item.id] === value}
                    onClick={() => onAnswer(item.id, value)}
                    className={`rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors ${
                      responses[item.id] === value
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-gray-200 text-gray-600 hover:border-blue-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>
          ) : (
            <div>
              <label htmlFor={item.id} className="block text-sm font-semibold text-gray-800">
                {item.label}{item.required && <span className="ml-1 text-red-600">*</span>}
              </label>
              {item.helperText && <p className="mt-1 text-xs text-gray-500">{item.helperText}</p>}
              <textarea
                id={item.id}
                rows={3}
                disabled={disabled}
                value={responses[item.id] ?? ''}
                onChange={(event) => onAnswer(item.id, event.target.value)}
                aria-invalid={Boolean(errors[item.id])}
                aria-describedby={errors[item.id] ? `${item.id}-error` : undefined}
                className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
          )}
          {errors[item.id] && (
            <p id={`${item.id}-error`} role="alert" className="mt-2 text-xs text-red-600">{errors[item.id]}</p>
          )}
        </div>
      ))}
    </section>
  );
}
