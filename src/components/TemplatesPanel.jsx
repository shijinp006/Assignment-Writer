import { useRef, useState } from 'react'
import { PAGE_H } from '../lib/constants'
import { builtinTemplates, detectLines, lineCapacity } from '../lib/templates'
import { Button, Slider } from './ui'

export default function TemplatesPanel({ templates, settings, update, selectedId, setSelectedId, onUpload, onChangeTemplate, onDeleteTemplate }) {
  const fileRef = useRef(null)
  const [busy, setBusy] = useState('')
  const sel = templates.find((t) => t.id === selectedId)

  async function handleFiles(files) {
    setBusy('Reading pages…')
    try {
      await onUpload([...files])
    } catch (err) {
      alert('Could not read that file: ' + err.message)
    }
    setBusy('')
  }

  /**
   * Auto adjust: finds the ruled lines on the page and sets first line, gap and margins,
   * then fits the text size so the writing sits nicely between the lines.
   */
  async function autoAdjust() {
    setBusy('Finding lines…')
    const d = await detectLines(sel.src).catch(() => null)
    setBusy('')
    const original = sel.builtin ? builtinTemplates().find((t) => t.id === sel.id) : null
    const geo = d
      ? { top: d.top, gap: d.gap, bottom: Math.max(0, d.bottom - 1), left: d.left ?? original?.left ?? 40, right: original?.right ?? 30 }
      : original && { top: original.top, gap: original.gap, bottom: original.bottom, left: original.left, right: original.right }
    if (!geo) return alert('Could not find ruled lines on this page. Set them with the sliders.')
    onChangeTemplate(sel.id, geo)
    update({ fontSize: Math.round(geo.gap * 0.7 * 2) / 2, baseline: Math.round(geo.gap * 0.16 * 2) / 2 })
  }

  return (
    <div className="space-y-5">
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-neutral-800">Your pages</h3>
          <Button variant="primary" onClick={() => fileRef.current?.click()} disabled={!!busy} className="!py-1 text-xs">
            + Add page (image / PDF)
          </Button>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) handleFiles(e.target.files)
              e.target.value = ''
            }}
          />
        </div>
        {busy && <div className="mb-2 text-xs text-indigo-700">{busy}</div>}
        <div className="grid grid-cols-3 gap-2">
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSelectedId(t.id)}
              className={`group overflow-hidden rounded-md border bg-white text-left transition ${
                t.id === selectedId ? 'border-indigo-600 ring-2 ring-indigo-200' : 'border-neutral-200 hover:border-neutral-400'
              }`}
            >
              <img src={t.src} alt="" className="aspect-[794/1123] w-full object-fill" />
              <div className="border-t border-neutral-100 px-1.5 py-1">
                <div className="truncate text-[11px] font-medium text-neutral-700">{t.name}</div>
                <div className="flex gap-1 text-[10px]">
                  {settings.firstTemplateId === t.id && <span className="rounded bg-amber-100 px-1 text-amber-800">Page 1</span>}
                  {settings.restTemplateId === t.id && <span className="rounded bg-emerald-100 px-1 text-emerald-800">Others</span>}
                </div>
              </div>
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          Scan or photograph a blank page (like the university response sheet or a ruled page) and add it. The lines are found automatically.
        </p>
      </section>

      {sel && (
        <section className="space-y-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
          <input
            value={sel.name}
            onChange={(e) => onChangeTemplate(sel.id, { name: e.target.value })}
            className="w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm font-medium"
          />
          <div className="flex flex-wrap gap-2">
            <Button variant={settings.firstTemplateId === sel.id ? 'active' : 'default'} onClick={() => update({ firstTemplateId: sel.id })} className="text-xs">
              Use for page 1
            </Button>
            <Button variant={settings.restTemplateId === sel.id ? 'active' : 'default'} onClick={() => update({ restTemplateId: sel.id })} className="text-xs">
              Use for other pages
            </Button>
          </div>

          <Button variant="primary" onClick={autoAdjust} disabled={!!busy} className="w-full">
            {busy === 'Finding lines…' ? 'Adjusting…' : '✨ Auto adjust'}
          </Button>
          <div className="text-xs text-neutral-500">
            Auto adjust finds the lines on the page and fits the text to them. Or match the <span className="font-semibold text-red-600">red lines</span> to the
            page lines and the <span className="font-semibold text-blue-600">blue lines</span> to the margins by hand.
            <b> {lineCapacity(sel)} lines</b> per page.
          </div>
          <Slider label="First line position" value={sel.top} min={0} max={PAGE_H} step={0.5} onChange={(v) => onChangeTemplate(sel.id, { top: v })} />
          <Slider label="Line gap" value={sel.gap} min={10} max={120} step={0.1} onChange={(v) => onChangeTemplate(sel.id, { gap: v })} />
          <Slider label="Bottom margin" value={sel.bottom} min={0} max={PAGE_H - 50} step={1} onChange={(v) => onChangeTemplate(sel.id, { bottom: v })} />
          <Slider label="Left margin" value={sel.left} min={0} max={400} step={1} onChange={(v) => onChangeTemplate(sel.id, { left: v })} />
          <Slider label="Right margin" value={sel.right} min={0} max={400} step={1} onChange={(v) => onChangeTemplate(sel.id, { right: v })} />

          <div className="flex flex-wrap gap-2 pt-1">
            {!sel.builtin && (
              <Button
                variant="danger"
                className="text-xs"
                onClick={() => confirm(`Delete "${sel.name}"?`) && onDeleteTemplate(sel.id)}
              >
                Delete
              </Button>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
