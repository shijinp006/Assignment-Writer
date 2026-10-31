import { PAGE_H, PAGE_W } from './constants'
import { loadImage } from './templates'

function rand(a, b, c, d) {
  let h = Math.imul(a + 1, 73856093) ^ Math.imul(b + 1, 19349663) ^ Math.imul(c + 1, 83492791) ^ Math.imul(d + 1, 2654435761)
  h = Math.imul(h ^ (h >>> 16), 2246822507)
  h = Math.imul(h ^ (h >>> 13), 3266489909)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296 - 0.5 // -0.5 .. 0.5
}

/**
 * Turns a laid-out page into simple drawing operations shared by the
 * on-screen SVG and the PDF canvas renderer.
 */
export function pageOps(page, settings) {
  const { tpl } = page
  const m = settings.messiness
  const texts = []
  const underlines = []
  const lineW = Math.max(1, settings.fontSize / 18)

  page.lines.forEach((line) => {
    const base = tpl.top + line.row * tpl.gap - settings.baseline
    const lineDy = rand(page.index, line.row, 0, 7) * m * 2
    line.words.forEach((w, wi) => {
      texts.push({
        x: line.x0 + w.x,
        y: base + lineDy + rand(page.index, line.row, wi, 1) * m * 3,
        rot: rand(page.index, line.row, wi, 2) * m * 3,
        text: w.text,
        size: settings.fontSize,
      })
    })
    const runs = []
    line.words.forEach((w) =>
      w.segs.forEach((s) => {
        if (!s.u) return
        const a = line.x0 + w.x + s.dx
        const b = a + s.w
        const last = runs[runs.length - 1]
        if (last && a - last[1] <= line.space + 1) last[1] = b
        else runs.push([a, b])
      }),
    )
    runs.forEach(([a, b], ri) => {
      const y = base + lineDy + settings.fontSize * 0.2
      underlines.push({
        a,
        b,
        y,
        cy: y + rand(page.index, line.row, ri, 3) * m * 4,
        y2: y + rand(page.index, line.row, ri, 4) * m * 2,
        width: lineW,
      })
    })
  })

  // Handwritten cover fields (Student name, Program, ...)
  ;(tpl.fields || []).forEach((f, fi) => {
    const value = settings.cover?.[f.key]
    if (!value) return
    texts.push({
      x: f.x,
      y: f.y + rand(99, fi, 0, 1) * m * 2,
      rot: rand(99, fi, 0, 2) * m * 2,
      text: value,
      size: settings.fontSize * 0.9,
    })
  })
  return { texts, underlines }
}

export async function renderPageToCanvas(page, settings, scale = 2) {
  const c = document.createElement('canvas')
  c.width = PAGE_W * scale
  c.height = PAGE_H * scale
  const ctx = c.getContext('2d')
  ctx.scale(scale, scale)
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, PAGE_W, PAGE_H)
  const img = await loadImage(page.tpl.src)
  ctx.drawImage(img, 0, 0, PAGE_W, PAGE_H)

  const { texts, underlines } = pageOps(page, settings)
  ctx.globalAlpha = 0.93
  ctx.fillStyle = settings.color
  ctx.strokeStyle = settings.color
  ctx.textBaseline = 'alphabetic'
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${settings.letterSpacing}px`
  for (const t of texts) {
    ctx.save()
    ctx.translate(t.x, t.y)
    if (t.rot) ctx.rotate((t.rot * Math.PI) / 180)
    ctx.font = `${t.size}px "${settings.font}", cursive`
    ctx.fillText(t.text, 0, 0)
    ctx.restore()
  }
  ctx.lineCap = 'round'
  for (const u of underlines) {
    ctx.lineWidth = u.width
    ctx.beginPath()
    ctx.moveTo(u.a, u.y)
    ctx.quadraticCurveTo((u.a + u.b) / 2, u.cy, u.b, u.y2)
    ctx.stroke()
  }
  return c
}

export async function downloadPdf(pages, settings, fileName) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true })
  for (let i = 0; i < pages.length; i++) {
    const canvas = await renderPageToCanvas(pages[i], settings, 2)
    if (i > 0) doc.addPage('a4', 'portrait')
    doc.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 210, 297, undefined, 'FAST')
  }
  doc.save(fileName)
}
