import coverSheetUrl from '../assets/sgvu-cover.png'
import ruledSheetUrl from '../assets/sgvu-ruled.png'
import { PAGE_H, PAGE_W } from './constants'

function svgUrl(body) {
  const s = `<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE_W}" height="${PAGE_H}" viewBox="0 0 ${PAGE_W} ${PAGE_H}"><rect width="${PAGE_W}" height="${PAGE_H}" fill="#fff"/>${body}</svg>`
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s)
}

function ruled(margin) {
  let body = `<line x1="0" x2="${PAGE_W}" y1="70" y2="70" stroke="#9fb6d9" stroke-width="2.4"/>`
  for (let y = 110; y <= 1062; y += 34) {
    body += `<line x1="0" x2="${PAGE_W}" y1="${y}" y2="${y}" stroke="#9fb6d9" stroke-width="1.2"/>`
  }
  if (margin) body += `<line x1="78" x2="78" y1="0" y2="${PAGE_H}" stroke="#e08a8a" stroke-width="1.4"/>`
  return svgUrl(body)
}

/**
 * Baselines of the handwritten answers on the response sheet (page units).
 * Rows of the official form: 139.4 / 166.5 / 193.5 / 220.4 / 247.3
 */
const COVER_FIELDS = [
  { key: 'name', label: 'Student Name', x: 148, y: 161 },
  { key: 'program', label: 'Program', x: 115, y: 188 },
  { key: 'specialization', label: 'Specialization', x: 562, y: 188 },
  { key: 'enrollment', label: 'Enrollment / Ref. No.', x: 188, y: 215 },
  { key: 'subject', label: 'Subject', x: 108, y: 242 },
  { key: 'semester', label: 'Semester', x: 690, y: 242 },
]

// Bump when built-in page geometry changes, so old saved calibrations are replaced.
export const BUILTIN_REV = 3

export function builtinTemplates() {
  return [
    // Pages 1 and 2 of the official "Assignment-Format.pdf", rendered at 300 dpi.
    { id: 'sgvu-cover', name: 'Response sheet (page 1)', builtin: true, rev: BUILTIN_REV, src: coverSheetUrl, fields: COVER_FIELDS, top: 423.1, gap: 30.25, left: 40, right: 30, bottom: 34 },
    { id: 'sgvu-ruled', name: 'Ruled sheet', builtin: true, rev: BUILTIN_REV, src: ruledSheetUrl, top: 120.5, gap: 30.25, left: 40, right: 30, bottom: 34 },
    { id: 'ruled-margin', name: 'Ruled + margin', builtin: true, src: ruled(true), top: 110, gap: 34, left: 90, right: 36, bottom: 61 },
    { id: 'ruled', name: 'Ruled', builtin: true, src: ruled(false), top: 110, gap: 34, left: 40, right: 36, bottom: 61 },
    { id: 'blank', name: 'Blank', builtin: true, src: svgUrl(''), top: 90, gap: 34, left: 60, right: 60, bottom: 60 },
  ]
}

export function lineCapacity(t) {
  return Math.max(1, Math.floor((PAGE_H - t.bottom - t.top) / t.gap) + 1)
}

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.onerror = reject
    r.readAsDataURL(file)
  })
}

const MAX_W = 1240 // ~150 dpi for A4, enough for print and small to store

export async function imageFileToDataUrl(file) {
  const img = await loadImage(await readAsDataUrl(file))
  const scale = Math.min(1, MAX_W / img.naturalWidth)
  const c = document.createElement('canvas')
  c.width = Math.round(img.naturalWidth * scale)
  c.height = Math.round(img.naturalHeight * scale)
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, c.width, c.height)
  ctx.drawImage(img, 0, 0, c.width, c.height)
  return c.toDataURL('image/jpeg', 0.9)
}

export async function pdfFileToDataUrls(file, maxPages = 20) {
  const pdfjs = await import('pdfjs-dist')
  const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
  const out = []
  for (let i = 1; i <= Math.min(pdf.numPages, maxPages); i++) {
    const page = await pdf.getPage(i)
    const base = page.getViewport({ scale: 1 })
    const viewport = page.getViewport({ scale: MAX_W / base.width })
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(viewport.width)
    canvas.height = Math.round(viewport.height)
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvasContext: ctx, canvas, viewport }).promise
    out.push(canvas.toDataURL('image/jpeg', 0.9))
  }
  return out
}

/**
 * Finds the ruled writing lines on a scanned page.
 * Returns { top, gap, bottom, left? } in page units, or null.
 */
export async function detectLines(src) {
  const img = await loadImage(src)
  const c = document.createElement('canvas')
  c.width = PAGE_W
  c.height = PAGE_H
  const ctx = c.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(img, 0, 0, PAGE_W, PAGE_H)
  const { data } = ctx.getImageData(0, 0, PAGE_W, PAGE_H)
  const lum = new Uint8Array(PAGE_W * PAGE_H)
  const hist = new Uint32Array(256)
  for (let i = 0; i < lum.length; i++) {
    const v = (data[i * 4] * 299 + data[i * 4 + 1] * 587 + data[i * 4 + 2] * 114) / 1000
    lum[i] = v
    hist[lum[i]]++
  }
  let acc = 0
  let median = 255
  for (let v = 0; v < 256; v++) {
    acc += hist[v]
    if (acc >= lum.length / 2) {
      median = v
      break
    }
  }
  const thr = Math.min(215, median - 30)

  // Horizontal lines: rows with many dark pixels across the middle of the page.
  const x0 = Math.round(PAGE_W * 0.12)
  const x1 = Math.round(PAGE_W * 0.88)
  const rows = []
  for (let y = 0; y < PAGE_H; y++) {
    let dark = 0
    for (let x = x0; x < x1; x++) if (lum[y * PAGE_W + x] < thr) dark++
    if (dark / (x1 - x0) > 0.3) rows.push(y)
  }
  const lines = []
  for (let i = 0; i < rows.length; ) {
    let j = i
    while (j + 1 < rows.length && rows[j + 1] - rows[j] <= 2) j++
    lines.push((rows[i] + rows[j]) / 2)
    i = j + 1
  }
  if (lines.length < 3) return null

  // Longest run of evenly spaced lines (tolerates one missing line).
  let best = null
  for (let i = 0; i < lines.length - 1; i++) {
    const d0 = lines[i + 1] - lines[i]
    if (d0 < 14 || d0 > 120) continue
    let steps = 1
    let last = i + 1
    let count = 2
    for (let k = i + 2; k < lines.length; k++) {
      const n = (lines[k] - lines[last]) / d0
      const r = Math.round(n)
      if (r >= 1 && r <= 2 && Math.abs(n - r) < 0.2) {
        steps += r
        last = k
        count++
      } else if (n > 2.5) break
    }
    if (!best || count > best.count) best = { first: lines[i], last: lines[last], steps, count }
  }
  if (!best || best.count < 4) return null
  const gap = (best.last - best.first) / best.steps

  // Optional vertical margin line in the left third.
  let left
  const y0 = Math.round(best.first)
  const y1 = Math.round(best.last)
  let bestCol = -1
  for (let x = 20; x < PAGE_W * 0.3; x++) {
    let dark = 0
    for (let y = y0; y < y1; y++) if (lum[y * PAGE_W + x] < thr) dark++
    if (dark / (y1 - y0) > 0.6) bestCol = x
  }
  if (bestCol > 0) left = bestCol + 10

  return {
    top: Math.round(best.first * 10) / 10,
    gap: Math.round(gap * 10) / 10,
    bottom: Math.max(0, Math.round(PAGE_H - best.last - 1)),
    left,
  }
}
