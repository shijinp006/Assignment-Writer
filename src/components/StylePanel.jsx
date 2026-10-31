import { useRef } from 'react'
import { FONTS, INKS } from '../lib/constants'
import { Button, Slider } from './ui'

export default function StylePanel({ settings, update, customFonts, onAddFont, onRemoveFont }) {
  const fileRef = useRef(null)
  const all = [...customFonts.map((f) => ({ name: f.name, custom: true })), ...FONTS.map((name) => ({ name }))]

  return (
    <div className="space-y-5">
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-neutral-800">Handwriting</h3>
          <Button onClick={() => fileRef.current?.click()} className="!px-2 !py-1 text-xs">+ Upload font</Button>
          <input
            ref={fileRef}
            type="file"
            accept=".ttf,.otf,.woff,.woff2"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) onAddFont(e.target.files[0])
              e.target.value = ''
            }}
          />
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          {all.map((f) => (
            <div
              key={f.name}
              role="button"
              tabIndex={0}
              onClick={() => update({ font: f.name })}
              onKeyDown={(e) => e.key === 'Enter' && update({ font: f.name })}
              className={`relative cursor-pointer rounded-lg border px-3 py-2 text-left transition ${
                settings.font === f.name ? 'border-indigo-600 bg-indigo-50 ring-2 ring-indigo-100' : 'border-neutral-200 bg-white hover:border-neutral-400'
              }`}
            >
              <div className="truncate text-xl leading-tight" style={{ fontFamily: `"${f.name}"`, color: settings.color }}>
                Ecosystem notes
              </div>
              <div className="mt-0.5 truncate text-[11px] text-neutral-500">{f.name}{f.custom && ' · yours'}</div>
              {f.custom && (
                <button
                  type="button"
                  title="Remove font"
                  onClick={(e) => {
                    e.stopPropagation()
                    onRemoveFont(f.name)
                  }}
                  className="absolute top-1 right-1.5 text-xs text-neutral-400 hover:text-red-600"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-neutral-800">Ink</h3>
        <div className="flex flex-wrap items-center gap-2">
          {INKS.map((ink) => (
            <button
              key={ink.value}
              type="button"
              title={ink.name}
              onClick={() => update({ color: ink.value })}
              className={`h-8 w-8 rounded-full border-2 ${settings.color === ink.value ? 'border-neutral-900' : 'border-white shadow'}`}
              style={{ background: ink.value }}
            />
          ))}
          <input
            type="color"
            value={settings.color}
            onChange={(e) => update({ color: e.target.value })}
            className="h-8 w-10 cursor-pointer rounded border border-neutral-300"
            title="Custom colour"
          />
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-neutral-800">Size & spacing</h3>
        <Slider label="Text size" value={settings.fontSize} min={10} max={60} step={0.5} onChange={(v) => update({ fontSize: v })} />
        <Slider label="Lift above line" value={settings.baseline} min={-10} max={30} step={0.5} onChange={(v) => update({ baseline: v })} />
        <Slider label="Letter spacing" value={settings.letterSpacing} min={-2} max={6} step={0.1} onChange={(v) => update({ letterSpacing: v })} />
        <Slider label="Word spacing" value={settings.wordSpacing} min={-4} max={30} step={0.5} onChange={(v) => update({ wordSpacing: v })} />
        <Slider label="Natural wobble" value={settings.messiness} min={0} max={1.5} step={0.05} onChange={(v) => update({ messiness: v })} />
      </section>
    </div>
  )
}
