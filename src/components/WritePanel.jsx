const COVER_INPUTS = [
  { key: 'name', label: 'Student name' },
  { key: 'program', label: 'Program' },
  { key: 'specialization', label: 'Specialization' },
  { key: 'enrollment', label: 'Enrollment / Ref. No.' },
  { key: 'subject', label: 'Subject' },
  { key: 'semester', label: 'Semester' },
]

export default function WritePanel({ text, setText, cover, setCover }) {
  return (
    <div className="flex h-full flex-col gap-3">
      <details className="rounded-lg border border-neutral-200 bg-neutral-50 open:pb-3" open>
        <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-neutral-800">Response sheet details (page 1)</summary>
        <div className="grid grid-cols-2 gap-2 px-3">
          {COVER_INPUTS.map((f) => (
            <label key={f.key} className={f.key === 'subject' || f.key === 'enrollment' ? 'col-span-2' : ''}>
              <span className="text-[11px] font-medium text-neutral-500">{f.label}</span>
              <input
                value={cover[f.key] || ''}
                onChange={(e) => setCover({ [f.key]: e.target.value })}
                className="w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm outline-none focus:border-indigo-500"
              />
            </label>
          ))}
        </div>
      </details>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck
        placeholder="Type or paste your assignment here..."
        className="min-h-[50vh] flex-1 resize-none rounded-lg border border-neutral-300 p-3 text-sm leading-relaxed outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
      />
      <div className="rounded-lg bg-neutral-50 p-3 text-xs leading-relaxed text-neutral-600">
        <div className="mb-1 font-semibold text-neutral-700">Formatting</div>
        <ul className="space-y-0.5">
          <li><code className="text-indigo-700"># Title</code> centered + underlined</li>
          <li><code className="text-indigo-700">## Heading</code> underlined</li>
          <li><code className="text-indigo-700">__word__</code> underline some words</li>
          <li><code className="text-indigo-700">&gt;&gt; text</code> right aligned</li>
          <li><code className="text-indigo-700">===</code> on its own line starts a new page</li>
          <li>Leading spaces indent the line, an empty line skips a ruled line</li>
        </ul>
      </div>
    </div>
  )
}
