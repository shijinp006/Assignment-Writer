import { get, set } from 'idb-keyval'
import { useEffect, useMemo, useState } from 'react'
import Page from './components/Page'
import StylePanel from './components/StylePanel'
import TemplatesPanel from './components/TemplatesPanel'
import { Button } from './components/ui'
import WritePanel from './components/WritePanel'
import { DEFAULT_SETTINGS, DEFAULT_TEXT, NEAT_HAND } from './lib/constants'
import { layoutDocument, makeMeasure, penWeight } from './lib/layout'
import { downloadPdf, renderPageToCanvas } from './lib/render'
import { builtinTemplates, detectLines, imageFileToDataUrl, pdfFileToDataUrls } from './lib/templates'

const STATE_KEY = 'aw-state-v1'
const FONTS_KEY = 'aw-fonts-v1'

async function registerFont(name, data) {
  const face = new FontFace(name, data)
  await face.load()
  document.fonts.add(face)
}

const TABS = [
  { id: 'write', label: 'Write' },
  { id: 'templates', label: 'Pages / Templates' },
  { id: 'style', label: 'Handwriting' },
]

export default function App() {
  const [loaded, setLoaded] = useState(false)
  const [text, setText] = useState(DEFAULT_TEXT)
  const [templates, setTemplates] = useState(builtinTemplates)
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [customFonts, setCustomFonts] = useState([])
  const [tab, setTab] = useState('write')
  const [selectedTplId, setSelectedTplId] = useState('sgvu-cover')
  const [showGuides, setShowGuides] = useState(false)
  const [skipPrint, setSkipPrint] = useState(() => new Set())
  const [fontTick, setFontTick] = useState(0)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [printBusy, setPrintBusy] = useState(false)
  const [printImages, setPrintImages] = useState([])

  // Load saved work
  useEffect(() => {
    ;(async () => {
      try {
        const saved = await get(STATE_KEY)
        if (saved) {
          if (typeof saved.text === 'string') setText(saved.text)
          if (saved.settings) {
            const s = { ...DEFAULT_SETTINGS, ...saved.settings, cover: { ...DEFAULT_SETTINGS.cover, ...saved.settings.cover } }
            const v = saved.settings.version || 0
            if (v < 2) {
              s.firstTemplateId = DEFAULT_SETTINGS.firstTemplateId
              s.restTemplateId = DEFAULT_SETTINGS.restTemplateId
            }
            if (v < 3) Object.assign(s, NEAT_HAND()) // switch older saves to the neater handwriting
            s.version = DEFAULT_SETTINGS.version
            setSettings(s)
          }
          if (Array.isArray(saved.templates)) {
            const builtins = builtinTemplates()
            const merged = builtins.map((b) => {
              const s = saved.templates.find((t) => t.id === b.id)
              return s && s.rev === b.rev ? { ...s, src: b.src, fields: b.fields, builtin: true } : b
            })
            setTemplates([...merged, ...saved.templates.filter((t) => !t.builtin)])
          }
        }
        const fonts = (await get(FONTS_KEY)) || []
        for (const f of fonts) await registerFont(f.name, f.data).catch(() => {})
        setCustomFonts(fonts)
      } catch (e) {
        console.warn('Could not load saved work', e)
      }
      setLoaded(true)
    })()
  }, [])

  // Save work
  useEffect(() => {
    if (!loaded) return
    const id = setTimeout(() => {
      set(STATE_KEY, { text, settings, templates }).catch((e) => console.warn('Save failed', e))
    }, 400)
    return () => clearTimeout(id)
  }, [loaded, text, settings, templates])

  // Re-layout once the chosen font has actually loaded (so measurements are right)
  useEffect(() => {
    let cancelled = false
    document.fonts.load(`${penWeight(settings)} ${settings.fontSize}px "${settings.font}"`).then(() => !cancelled && setFontTick((t) => t + 1))
    return () => {
      cancelled = true
    }
  }, [settings.font, settings.fontSize, settings.penThickness])

  const update = (patch) => setSettings((s) => ({ ...s, ...patch }))

  const measure = useMemo(
    () => makeMeasure(settings.font, settings.fontSize, settings.letterSpacing, penWeight(settings)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settings.font, settings.fontSize, settings.letterSpacing, settings.penThickness, fontTick],
  )

  const pages = useMemo(() => layoutDocument({ text, templates, settings, measure }), [text, templates, settings, measure])

  const selectedTpl = templates.find((t) => t.id === selectedTplId)
  const calibrationPage = useMemo(() => {
    if (!selectedTpl) return null
    const p = layoutDocument({
      text: 'Sample line written on the first ruled line\nThe second line follows here\n\nAfter a blank line',
      templates: [selectedTpl],
      settings: { ...settings, pageOverrides: {}, firstTemplateId: selectedTpl.id },
      measure,
    })[0]
    return p
  }, [selectedTpl, settings, measure])

  async function onUpload(files) {
    const added = []
    for (const file of files) {
      const base = file.name.replace(/\.[^.]+$/, '')
      const srcs = file.type === 'application/pdf' || /\.pdf$/i.test(file.name) ? await pdfFileToDataUrls(file) : [await imageFileToDataUrl(file)]
      for (let i = 0; i < srcs.length; i++) {
        const d = await detectLines(srcs[i]).catch(() => null)
        added.push({
          id: crypto.randomUUID(),
          name: srcs.length > 1 ? `${base} · p${i + 1}` : base,
          src: srcs[i],
          top: d?.top ?? 110,
          gap: d?.gap ?? 34,
          bottom: d?.bottom ?? 60,
          left: d?.left ?? 70,
          right: 40,
        })
      }
    }
    if (added.length) {
      setTemplates((t) => [...t, ...added])
      setSelectedTplId(added[0].id)
    }
  }

  function onChangeTemplate(id, patch) {
    setTemplates((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)))
  }

  function onDeleteTemplate(id) {
    setTemplates((ts) => ts.filter((t) => t.id !== id))
    setSettings((s) => {
      const pageOverrides = Object.fromEntries(Object.entries(s.pageOverrides).filter(([, v]) => v !== id))
      return {
        ...s,
        pageOverrides,
        firstTemplateId: s.firstTemplateId === id ? DEFAULT_SETTINGS.firstTemplateId : s.firstTemplateId,
        restTemplateId: s.restTemplateId === id ? DEFAULT_SETTINGS.restTemplateId : s.restTemplateId,
      }
    })
    setSelectedTplId(DEFAULT_SETTINGS.firstTemplateId)
  }

  async function onAddFont(file) {
    try {
      const data = await file.arrayBuffer()
      let name = file.name.replace(/\.[^.]+$/, '')
      if (customFonts.some((f) => f.name === name)) name += ' 2'
      await registerFont(name, data)
      const next = [...customFonts, { name, data }]
      setCustomFonts(next)
      await set(FONTS_KEY, next)
      update({ font: name })
    } catch (e) {
      alert('Could not load that font file: ' + e.message)
    }
  }

  async function onRemoveFont(name) {
    const next = customFonts.filter((f) => f.name !== name)
    setCustomFonts(next)
    await set(FONTS_KEY, next)
    if (settings.font === name) update({ font: DEFAULT_SETTINGS.font })
  }

  function setPageTemplate(index, id) {
    setSettings((s) => {
      const pageOverrides = { ...s.pageOverrides }
      if (id) pageOverrides[index] = id
      else delete pageOverrides[index]
      return { ...s, pageOverrides }
    })
  }

  async function onDownloadPdf() {
    setPdfBusy(true)
    try {
      await document.fonts.load(`${settings.fontSize}px "${settings.font}"`)
      const name = [settings.cover.subject, settings.cover.name].filter(Boolean).join(' - ') || 'assignment'
      await downloadPdf(printPages, settings, `${name}.pdf`)
    } catch (e) {
      alert('Could not create the PDF: ' + e.message)
    }
    setPdfBusy(false)
  }

  // Render the pages at print resolution first, then open the print dialog.
  async function onPrint() {
    setPrintBusy(true)
    try {
      await document.fonts.load(`${settings.fontSize}px "${settings.font}"`)
      const urls = []
      for (const p of printPages) urls.push((await renderPageToCanvas(p, settings, 2.5)).toDataURL('image/png'))
      setPrintImages(urls)
      await new Promise((r) => setTimeout(r, 150))
      await Promise.all([...document.querySelectorAll('.print-sheet img')].map((img) => img.decode().catch(() => {})))
      window.print()
    } catch (e) {
      alert('Could not prepare pages for printing: ' + e.message)
    }
    setPrintBusy(false)
  }

  function togglePrint(index) {
    setSkipPrint((s) => {
      const n = new Set(s)
      if (n.has(index)) n.delete(index)
      else n.add(index)
      return n
    })
  }

  const printPages = pages.filter((p) => !skipPrint.has(p.index))
  const defaultName = (i) => templates.find((t) => t.id === (i === 0 ? settings.firstTemplateId : settings.restTemplateId))?.name

  return (
    <>
      <div className="flex h-screen flex-col bg-neutral-100 text-neutral-900 print:hidden">
        <header className="flex flex-wrap items-center gap-3 border-b border-neutral-200 bg-white px-4 py-2.5">
          <h1 className="text-lg font-bold tracking-tight">
            <span className="text-indigo-600">✎</span> Assignment Writer
          </h1>
          <span className="text-sm text-neutral-500">
            {pages.length} page{pages.length > 1 ? 's' : ''}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <label className="flex cursor-pointer items-center gap-1.5 text-sm text-neutral-600">
              <input type="checkbox" checked={showGuides} onChange={(e) => setShowGuides(e.target.checked)} className="accent-indigo-600" />
              Show guides
            </label>
            <Button onClick={onDownloadPdf} disabled={!printPages.length || pdfBusy}>
              {pdfBusy ? 'Making PDF…' : '⬇ Download PDF'}
            </Button>
            <Button variant="primary" onClick={onPrint} disabled={!printPages.length || printBusy}>
              🖨 {printBusy ? 'Preparing…' : 'Print'} {printPages.length !== pages.length ? `(${printPages.length})` : ''}
            </Button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <aside className="flex max-h-[55vh] w-full shrink-0 flex-col border-b border-neutral-200 bg-white lg:max-h-none lg:w-[420px] lg:border-r lg:border-b-0">
            <nav className="flex border-b border-neutral-200">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`flex-1 px-2 py-2.5 text-sm font-medium transition ${
                    tab === t.id ? 'border-b-2 border-indigo-600 text-indigo-700' : 'text-neutral-500 hover:text-neutral-800'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </nav>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {tab === 'write' && (
                <WritePanel text={text} setText={setText} cover={settings.cover} setCover={(patch) => update({ cover: { ...settings.cover, ...patch } })} />
              )}
              {tab === 'templates' && (
                <TemplatesPanel
                  templates={templates}
                  settings={settings}
                  update={update}
                  selectedId={selectedTplId}
                  setSelectedId={setSelectedTplId}
                  onUpload={onUpload}
                  onChangeTemplate={onChangeTemplate}
                  onDeleteTemplate={onDeleteTemplate}
                />
              )}
              {tab === 'style' && (
                <StylePanel settings={settings} update={update} customFonts={customFonts} onAddFont={onAddFont} onRemoveFont={onRemoveFont} />
              )}
            </div>
          </aside>

          <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-8">
            {tab === 'templates' && calibrationPage ? (
              <div className="mx-auto max-w-[794px]">
                <div className="mb-2 text-sm font-medium text-neutral-600">Adjusting: {selectedTpl.name}</div>
                <div className="aspect-[794/1123] w-full bg-white shadow-lg">
                  <Page page={calibrationPage} settings={settings} showGuides />
                </div>
              </div>
            ) : (
              <div className="mx-auto flex max-w-[794px] flex-col gap-8">
                {pages.map((p) => (
                  <div key={p.index}>
                    <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-semibold text-neutral-700">Page {p.index + 1}</span>
                      <select
                        value={settings.pageOverrides[p.index] || ''}
                        onChange={(e) => setPageTemplate(p.index, e.target.value)}
                        className="rounded border border-neutral-300 bg-white px-2 py-1 text-xs"
                      >
                        <option value="">Default ({defaultName(p.index)})</option>
                        {templates.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                      <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-xs text-neutral-600">
                        <input type="checkbox" checked={!skipPrint.has(p.index)} onChange={() => togglePrint(p.index)} className="accent-indigo-600" />
                        Print this page
                      </label>
                    </div>
                    <div className={`aspect-[794/1123] w-full bg-white shadow-lg transition ${skipPrint.has(p.index) ? 'opacity-40' : ''}`}>
                      <Page page={p} settings={settings} showGuides={showGuides} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </main>
        </div>
      </div>

      <div className="hidden print:block">
        {printImages.map((src, i) => (
          <div key={i} className="print-sheet">
            <img src={src} alt="" className="block h-full w-full" />
          </div>
        ))}
      </div>
    </>
  )
}
