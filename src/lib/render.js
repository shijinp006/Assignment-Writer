import { PAGE_H, PAGE_W } from './constants'
import { makeMeasure, penWeight } from './layout'
import { lineCapacity, loadImage } from './templates'

/** Deterministic noise in -0.5 .. 0.5, so a page looks the same on every render. */
function rand(a, b, c, d) {
  let h = Math.imul(a + 1, 73856093) ^ Math.imul(b + 1, 19349663) ^ Math.imul(c + 1, 83492791) ^ Math.imul(d + 1, 2654435761)
  h = Math.imul(h ^ (h >>> 16), 2246822507)
  h = Math.imul(h ^ (h >>> 13), 3266489909)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296 - 0.5
}

/**
 * Turns a laid-out page into drawing operations.
 * glyphs:     one per letter { ch, x, y, rot, skew, sx, sy, size, alpha, stroke }
 * underlines: { a, y, cx, cy, b, y2, width }
 */
export function pageOps(page, settings) {
  const { tpl } = page
  const m = settings.messiness ?? 0.5 // word wobble
  const lv = settings.letterVariation ?? 0.7
  const drift = settings.lineDrift ?? 0.6
  const pressure = settings.pressure ?? 0.5
  const slant = settings.slant ?? 0
  const P = page.index + (settings.seed ?? 1) * 7919
  const glyphs = []
  const underlines = []
  const lineW = Math.max(1, settings.fontSize / 18)

  /**
   * Places the letters of one word.
   * tight:  letter-spacing factor for this word (people squeeze some words, stretch others)
   * yAt:    baseline at a given x (lets the line waver under the word)
   */
  const addWord = (chars, x, yOff, size, k, word, yAt) => {
    let jitter = 0
    chars.forEach((c, ci) => {
      if (c.ch === ' ') return
      const r = (n) => rand(P, k, ci, n)
      // spacing errors build up a little inside a word, like a real hand
      jitter += r(1) * lv * 0.9
      const gx = x + c.dx * (size / settings.fontSize) * word.tight + jitter
      const isCap = c.ch !== c.ch.toLowerCase()
      glyphs.push({
        ch: c.ch,
        x: gx,
        y: yAt(gx) + yOff + r(2) * lv * 2,
        rot: word.rot + r(3) * lv * 6,
        skew: -(slant + word.skew + r(4) * lv * 5),
        sx: (1 + r(5) * lv * 0.14) * word.wide,
        sy: 1 + r(6) * lv * (isCap ? 0.24 : 0.15),
        size,
        alpha: word.alpha * (1 - (r(7) + 0.5) * pressure * 0.22),
        stroke: Math.max(0, word.stroke + r(8) * pressure * 0.15),
      })
    })
  }

  /** Per-word "hand state": pressure, slant, width, letter spacing. */
  const wordStyle = (W) => ({
    tight: 1 + W(6) * lv * 0.12,
    wide: 1 + W(7) * lv * 0.08,
    rot: W(3) * m * 2.5,
    skew: W(4) * m * 4,
    alpha: 1 - (W(8) + 0.5) * pressure * 0.18,
    stroke: (W(9) + 0.5) * pressure * 0.2,
  })

  page.lines.forEach((line) => {
    const L = (n) => rand(P, line.row, 9999, n)
    const base = tpl.top + line.row * tpl.gap - settings.baseline + L(1) * m * 2
    const slope = L(2) * drift * 0.012 // the line rises or falls a little
    const x0 = line.x0 + L(3) * drift * 4 // left edge is never perfectly straight
    // the baseline wanders smoothly along the line instead of being ruler-straight
    const p1 = L(4) * 12
    const p2 = L(5) * 12
    const w1 = 70 + (L(6) + 0.5) * 60
    const yAt = (x) => {
      const t = x - x0
      return base + slope * t + drift * (1.3 * Math.sin(t / w1 + p1) + 0.6 * Math.sin(t / 23 + p2))
    }

    // uneven gaps between words; never push the line past the right margin
    const maxRight = PAGE_W - tpl.right + 4
    const lastW = line.words[line.words.length - 1]
    const room = lastW ? Math.max(0, maxRight - (x0 + lastW.x + lastW.w)) : 0
    const styles = line.words.map((_, wi) => wordStyle((n) => rand(P, line.row, wi, n)))
    const shifts = []
    let acc = 0
    line.words.forEach((w, wi) => {
      // mostly wider, sometimes a bit tighter — but never so tight that words touch
      if (wi > 0) acc += (rand(P, line.row, wi, 10) + 0.3) * m * line.space * 1.1 + line.space * 0.15
      shifts.push(acc)
      acc += (styles[wi].tight - 1) * w.w // tighter/looser words change their own width
    })
    const over = Math.max(0, ...shifts.map((s, i) => s + (styles[i].tight - 1) * line.words[i].w)) - room
    if (over > 0) shifts.forEach((s, i) => (shifts[i] = s - (over * i) / Math.max(1, shifts.length - 1)))

    line.words.forEach((w, wi) => {
      const W = (n) => rand(P, line.row, wi, n)
      const size = settings.fontSize * (1 + W(1) * m * 0.07)
      const x = x0 + w.x + shifts[wi]
      addWord(w.chars || [{ ch: w.text, dx: 0 }], x, W(2) * m * 2, size, line.row * 1000 + wi, styles[wi], yAt)
    })

    const runs = []
    line.words.forEach((w, wi) =>
      w.segs.forEach((s) => {
        if (!s.u) return
        const a = x0 + w.x + shifts[wi] + s.dx * styles[wi].tight
        const b = a + s.w * styles[wi].tight
        const last = runs[runs.length - 1]
        if (last && a - last[1] <= line.space * 3 + 2) last[1] = b
        else runs.push([a, b])
      }),
    )
    runs.forEach(([a, b], ri) => {
      const U = (n) => rand(P, line.row, ri, 50 + n)
      const off = settings.fontSize * 0.2
      underlines.push({
        a: a - 2 + U(1) * 4,
        y: yAt(a) + off + U(2) * m * 2,
        cx: (a + b) / 2 + U(3) * 20,
        cy: yAt((a + b) / 2) + off + U(4) * m * 5,
        b: b + U(5) * 6,
        y2: yAt(b) + off + U(6) * m * 3,
        width: lineW * (1 + U(7) * 0.3),
      })
    })
  })

  // Handwritten cover fields (Student name, Program, ...)
  ;(tpl.fields || []).forEach((f, fi) => {
    const value = settings.cover?.[f.key]
    if (!value) return
    const size = settings.fontSize * 0.9
    const measure = makeMeasure(settings.font, settings.fontSize, settings.letterSpacing, penWeight(settings))
    const chars = []
    let prefix = ''
    for (const ch of value) {
      chars.push({ ch, dx: prefix ? measure(prefix) : 0 })
      prefix += ch
    }
    const slope = rand(P, 77, fi, 1) * drift * 0.01
    const yAt = (x) => f.y + slope * (x - f.x)
    const style = wordStyle((n) => rand(P, 77, fi, 10 + n))
    addWord(chars, f.x, rand(P, 77, fi, 2) * m * 2, size, 500000 + fi, style, yAt)
  })
  return { glyphs, underlines }
}

/* ------------------------------------------------------------------ */
/* Ink distortion: bends every letter's outline with smooth noise so   */
/* no two copies of a letter have the same shape, and adds ink grain.  */
/* ------------------------------------------------------------------ */

const latticeCache = new Map()
function lattice(seed, cell, ch) {
  const key = `${seed}|${cell}|${ch}`
  let L = latticeCache.get(key)
  if (!L) {
    const cols = Math.ceil(PAGE_W / cell) + 3
    const rows = Math.ceil(PAGE_H / cell) + 3
    const data = new Float32Array(cols * rows)
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) data[j * cols + i] = rand(seed, i, j, ch * 131 + Math.round(cell * 10)) * 2
    L = { data, cols, rows, cell }
    if (latticeCache.size > 60) latticeCache.clear()
    latticeCache.set(key, L)
  }
  return L
}

/** Smooth value noise in -1 .. 1 at page position (u, v). */
function noise(L, u, v) {
  const fx = Math.max(0, u) / L.cell
  const fy = Math.max(0, v) / L.cell
  const ix = Math.min(L.cols - 2, fx | 0)
  const iy = Math.min(L.rows - 2, fy | 0)
  const tx = fx - ix
  const ty = fy - iy
  const sx = tx * tx * (3 - 2 * tx)
  const sy = ty * ty * (3 - 2 * ty)
  const i = iy * L.cols + ix
  const d = L.data
  const a = d[i]
  const b = d[i + 1]
  const c = d[i + L.cols]
  const e = d[i + L.cols + 1]
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + e) * sx * sy
}

function hexToRgb(hex) {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.replace(/./g, '$&$&') : h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Page-unit rectangles that contain ink, so we only process those pixels. */
function inkBands(glyphs, underlines, pad) {
  const minX = new Float32Array(PAGE_H).fill(Infinity)
  const maxX = new Float32Array(PAGE_H).fill(-Infinity)
  const mark = (x0, x1, y0, y1) => {
    for (let v = Math.max(0, Math.floor(y0)); v <= Math.min(PAGE_H - 1, Math.ceil(y1)); v++) {
      if (x0 < minX[v]) minX[v] = x0
      if (x1 > maxX[v]) maxX[v] = x1
    }
  }
  for (const g of glyphs) mark(g.x - g.size * 0.4, g.x + g.size * 1.3, g.y - g.size * 1.15, g.y + g.size * 0.55)
  for (const u of underlines) mark(Math.min(u.a, u.b) - 4, Math.max(u.a, u.b) + 4, Math.min(u.y, u.y2, u.cy) - 4, Math.max(u.y, u.y2, u.cy) + 4)
  const bands = []
  let cur = null
  for (let v = 0; v < PAGE_H; v++) {
    if (maxX[v] === -Infinity) {
      cur = null
      continue
    }
    if (!cur) {
      cur = { y0: v, y1: v, x0: minX[v], x1: maxX[v] }
      bands.push(cur)
    } else {
      cur.y1 = v
      cur.x0 = Math.min(cur.x0, minX[v])
      cur.x1 = Math.max(cur.x1, maxX[v])
    }
  }
  return bands.map((b) => ({ x0: b.x0 - pad, x1: b.x1 + pad, y0: b.y0 - pad, y1: b.y1 + pad }))
}

function distortInk(layer, scale, settings, pageIndex, glyphs, underlines) {
  const amp = (settings.shapeVariation ?? 0.9) * 1.5 // page units
  const grain = settings.inkTexture ?? 0.5
  const thin = Math.max(0, -(settings.penThickness ?? -0.5))
  const [R, G, B] = hexToRgb(settings.color)
  const seed = ((settings.seed ?? 1) * 7919 + pageIndex * 131) | 0
  // Large, smooth cells bend whole letters (shape changes) without making strokes shaky.
  const N1x = lattice(seed, 10, 0)
  const N1y = lattice(seed, 10, 1)
  const N2x = lattice(seed, 5, 2)
  const N2y = lattice(seed, 5, 3)
  const NG = lattice(seed, 2.2, 4)
  const NG2 = lattice(seed, 6, 5)

  const W = layer.width
  const H = layer.height
  const sctx = layer.getContext('2d', { willReadFrequently: true })
  const out = document.createElement('canvas')
  out.width = W
  out.height = H
  const octx = out.getContext('2d')

  for (const band of inkBands(glyphs, underlines, amp * 2 + 2)) {
    const rx = Math.max(0, Math.floor(band.x0 * scale))
    const ry = Math.max(0, Math.floor(band.y0 * scale))
    const rw = Math.min(W, Math.ceil(band.x1 * scale)) - rx
    const rh = Math.min(H, Math.ceil(band.y1 * scale)) - ry
    if (rw <= 0 || rh <= 0) continue
    const src = sctx.getImageData(rx, ry, rw, rh).data
    const dst = octx.createImageData(rw, rh)
    const o = dst.data
    for (let y = 0; y < rh; y++) {
      const v = (ry + y + 0.5) / scale
      for (let x = 0; x < rw; x++) {
        const u = (rx + x + 0.5) / scale
        // where this pixel's ink "comes from" in the clean letter
        const dx = amp * (noise(N1x, u, v) + 0.2 * noise(N2x, u, v))
        const dy = amp * (noise(N1y, u, v) + 0.2 * noise(N2y, u, v))
        const sx = x + dx * scale
        const sy = y + dy * scale
        const x0 = Math.floor(sx)
        const y0 = Math.floor(sy)
        if (x0 < 0 || y0 < 0 || x0 >= rw - 1 || y0 >= rh - 1) continue
        const fx = sx - x0
        const fy = sy - y0
        const i = (y0 * rw + x0) * 4 + 3
        const a00 = src[i]
        const a10 = src[i + 4]
        const a01 = src[i + rw * 4]
        const a11 = src[i + rw * 4 + 4]
        let a = a00 + (a10 - a00) * fx + (a01 - a00) * fy + (a00 - a10 - a01 + a11) * fx * fy
        if (a < 1) continue
        // thinner pen: fade the soft outer edge of every stroke
        if (thin > 0) a = 255 * Math.pow(a / 255, 1 + thin * 1.6)
        if (grain > 0) a *= 1 - grain * 0.14 * (noise(NG, u, v) + 1) - grain * 0.1 * (noise(NG2, u, v) + 1)
        const j = (y * rw + x) * 4
        o[j] = R
        o[j + 1] = G
        o[j + 2] = B
        o[j + 3] = a
      }
    }
    octx.putImageData(dst, rx, ry)
  }
  return out
}

/* ------------------------------------------------------------------ */

const imageCache = new Map()
function cachedImage(src) {
  let p = imageCache.get(src)
  if (!p) {
    p = loadImage(src)
    if (imageCache.size > 30) imageCache.clear()
    imageCache.set(src, p)
  }
  return p
}

function drawGlyphLayer(ctx, glyphs, underlines, settings) {
  const weight = penWeight(settings)
  const thick = settings.penThickness ?? -0.5
  ctx.fillStyle = settings.color
  ctx.strokeStyle = settings.color
  ctx.textBaseline = 'alphabetic'
  ctx.lineJoin = 'round'
  for (const g of glyphs) {
    ctx.save()
    ctx.globalAlpha = g.alpha
    ctx.translate(g.x, g.y)
    if (g.rot) ctx.rotate((g.rot * Math.PI) / 180)
    if (g.skew) ctx.transform(1, 0, Math.tan((g.skew * Math.PI) / 180), 1, 0, 0)
    ctx.scale(g.sx, g.sy)
    ctx.font = `${weight} ${g.size}px "${settings.font}", cursive`
    ctx.fillText(g.ch, 0, 0)
    const sw = g.stroke + Math.max(0, thick) * 0.9
    if (sw > 0.05) {
      ctx.lineWidth = sw
      ctx.strokeText(g.ch, 0, 0)
    }
    ctx.restore()
  }
  ctx.globalAlpha = 0.95
  ctx.lineCap = 'round'
  for (const u of underlines) {
    ctx.lineWidth = u.width * (1 + Math.min(0, thick) * 0.35)
    ctx.beginPath()
    ctx.moveTo(u.a, u.y)
    ctx.quadraticCurveTo(u.cx, u.cy, u.b, u.y2)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}

function drawGuides(ctx, tpl) {
  ctx.save()
  ctx.fillStyle = 'rgba(59,130,246,0.05)'
  ctx.fillRect(tpl.left, 0, PAGE_W - tpl.left - tpl.right, PAGE_H)
  ctx.strokeStyle = '#2563eb'
  ctx.lineWidth = 1.5
  ctx.setLineDash([6, 4])
  for (const x of [tpl.left, PAGE_W - tpl.right]) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, PAGE_H)
    ctx.stroke()
  }
  ctx.setLineDash([])
  ctx.strokeStyle = 'rgba(239,68,68,0.7)'
  const cap = lineCapacity(tpl)
  for (let i = 0; i < cap; i++) {
    const y = tpl.top + i * tpl.gap
    ctx.lineWidth = i === 0 ? 2 : 1
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(PAGE_W, y)
    ctx.stroke()
  }
  ctx.restore()
}

/** Renders one complete page (sheet + handwriting) to a new canvas. */
export async function renderPageToCanvas(page, settings, scale = 2, { guides = false } = {}) {
  const W = Math.round(PAGE_W * scale)
  const H = Math.round(PAGE_H * scale)
  const { glyphs, underlines } = pageOps(page, settings)

  // 1) clean handwriting on a transparent layer
  let ink = document.createElement('canvas')
  ink.width = W
  ink.height = H
  const ictx = ink.getContext('2d', { willReadFrequently: true })
  ictx.scale(scale, scale)
  drawGlyphLayer(ictx, glyphs, underlines, settings)

  // 2) bend letter shapes + ink grain
  if ((settings.shapeVariation ?? 0.9) > 0 || (settings.inkTexture ?? 0.5) > 0 || (settings.penThickness ?? -0.5) < 0) {
    ink = distortInk(ink, scale, settings, page.index, glyphs, underlines)
  }

  // 3) sheet, then ink on top (multiply = looks like real ink over printed lines)
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, W, H)
  ctx.drawImage(await cachedImage(page.tpl.src), 0, 0, W, H)
  ctx.globalCompositeOperation = 'multiply'
  ctx.drawImage(ink, 0, 0)
  ctx.globalCompositeOperation = 'source-over'
  if (guides) {
    ctx.save()
    ctx.scale(scale, scale)
    drawGuides(ctx, page.tpl)
    ctx.restore()
  }
  return c
}

export async function downloadPdf(pages, settings, fileName) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true })
  for (let i = 0; i < pages.length; i++) {
    const canvas = await renderPageToCanvas(pages[i], settings, 2.5)
    if (i > 0) doc.addPage('a4', 'portrait')
    doc.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 210, 297, undefined, 'FAST')
  }
  doc.save(fileName)
}
