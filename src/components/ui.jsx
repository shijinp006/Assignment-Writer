export function Slider({ label, value, onChange, min, max, step = 1, suffix = '' }) {
  return (
    <label className="block">
      <div className="mb-1 flex items-center justify-between text-xs font-medium text-neutral-600">
        <span>{label}</span>
        <span className="flex items-center gap-1">
          <input
            type="number"
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={(e) => e.target.value !== '' && onChange(Number(e.target.value))}
            className="w-16 rounded border border-neutral-300 px-1 py-0.5 text-right text-xs"
          />
          {suffix}
        </span>
      </div>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-indigo-600"
      />
    </label>
  )
}

export function Button({ variant = 'default', className = '', ...props }) {
  const styles = {
    default: 'border border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50',
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700',
    danger: 'border border-red-200 bg-white text-red-600 hover:bg-red-50',
    active: 'border border-indigo-600 bg-indigo-50 text-indigo-700',
  }
  return (
    <button
      type="button"
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition disabled:opacity-50 ${styles[variant]} ${className}`}
      {...props}
    />
  )
}
