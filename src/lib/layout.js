import { PAGE_W } from './constants'
import { lineCapacity } from './templates'

const ctx = document.createElement('canvas').getContext('2d')

export function makeMeasure(font, size, letterSpacing) {
  const cache = new Map()
  const fontStr = `${size}px "${font}"`
  return (t) => {
    let w = cache.get(t)
    if (w === undefined) {
      ctx.font = fontStr
      w = ctx.measureText(t).width + letterSpacing * [...t].length
      cache.set(t, w)
    }
    return w
  }
}

/** Splits text into words; each word is a list of segments { t, u } (u = underlined). */
function parseWords(s, forceU) {
  const words = []
  let cur = null
  let u = false
  const re = /__|\s+|[^_\s]+|_/g
  let m
  while ((m = re.exec(s))) {
    const tok = m[0]
    if (tok === '__') {
      u = !u
      continue
    }
    if (/^\s+$/.test(tok)) {
      cur = null
      continue
    }
    if (!cur) {
      cur = []
      words.push(cur)
    }
    const uu = forceU || u
    const last = cur[cur.length - 1]
    if (last && last.u === uu) last.t += tok
    else cur.push({ t: tok, u: uu })
  }
  return words
}

const wordText = (segs) => segs.map((s) => s.t).join('')

function splitWord(segs, avail, measure) {
  const chars = segs.flatMap((s) => [...s.t].map((ch) => ({ ch, u: s.u })))
  let k = 1
  while (k < chars.length && measure(chars.slice(0, k + 1).map((c) => c.ch).join('')) <= avail) k++
  const toSegs = (arr) => {
    const out = []
    for (const c of arr) {
      const last = out[out.length - 1]
      if (last && last.u === c.u) last.t += c.ch
      else out.push({ t: c.ch, u: c.u })
    }
    return out
  }
  return [toSegs(chars.slice(0, k)), toSegs(chars.slice(k))]
}

/**
 * Flows the text onto pages.
 * Returns pages: [{ index, tpl, lines: [{ row, x0, space, words: [{ x, w, text, segs: [{t,u,dx,w}] }] }] }]
 */
export function layoutDocument({ text, templates, settings, measure }) {
  const byId = new Map(templates.map((t) => [t.id, t]))
  const getTpl = (i) =>
    byId.get(settings.pageOverrides?.[i]) ||
    byId.get(i === 0 ? settings.firstTemplateId : settings.restTemplateId) ||
    templates[0]

  const pages = []
  let page
  let cap
  let row
  const newPage = () => {
    const tpl = getTpl(pages.length)
    page = { index: pages.length, tpl, lines: [] }
    pages.push(page)
    cap = lineCapacity(tpl)
    row = 0
  }
  newPage()

  const space = Math.max(1, measure(' ') + settings.wordSpacing)
  const place = (segs) => {
    let dx = 0
    const placed = segs.map((s) => {
      const w = measure(s.t)
      const o = { ...s, dx, w }
      dx += w
      return o
    })
    return { segs: placed, text: wordText(segs), w: measure(wordText(segs)) }
  }

  for (const raw of text.replace(/\r/g, '').replace(/\t/g, '    ').split('\n')) {
    const trimmed = raw.trim()
    if (trimmed === '===') {
      if (row > 0) newPage()
      continue
    }
    if (trimmed === '') {
      if (row > 0) row++
      continue
    }

    let align = 'left'
    let content = raw
    let forceU = false
    let indentW = 0
    if (/^##\s/.test(trimmed)) {
      content = trimmed.slice(3)
      forceU = true
    } else if (/^#\s/.test(trimmed)) {
      content = trimmed.slice(2)
      forceU = true
      align = 'center'
    } else if (/^>>\s/.test(trimmed)) {
      content = trimmed.slice(3)
      align = 'right'
    } else {
      indentW = (raw.length - raw.trimStart().length) * space
    }

    const words = parseWords(content, forceU)
    let first = true
    let wi = 0
    while (wi < words.length) {
      if (row >= cap) newPage()
      const tpl = page.tpl
      const ind = first ? indentW : 0
      const avail = Math.max(20, PAGE_W - tpl.left - tpl.right - ind)
      const lineWords = []
      let x = 0
      while (wi < words.length) {
        const w = place(words[wi])
        const start = lineWords.length ? x + space : 0
        if (start + w.w <= avail) {
          lineWords.push({ ...w, x: start })
          x = start + w.w
          wi++
        } else if (lineWords.length === 0) {
          const [head, tail] = splitWord(words[wi], avail, measure)
          const h = place(head)
          lineWords.push({ ...h, x: 0 })
          x = h.w
          words[wi] = tail
          break
        } else break
      }
      let x0 = tpl.left + ind
      if (align === 'center') x0 += (avail - x) / 2
      if (align === 'right') x0 += avail - x
      page.lines.push({ row, x0, space, words: lineWords })
      row++
      first = false
    }
  }
  return pages
}
