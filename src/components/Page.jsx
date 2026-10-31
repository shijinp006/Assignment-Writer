import { memo, useEffect, useMemo, useRef } from 'react'
import { renderPageToCanvas } from '../lib/render'

/** A cheap fingerprint of what is on the page, so unchanged pages are not redrawn. */
function signature(page) {
  const t = page.tpl
  return JSON.stringify([page.index, t.id, t.src.length, t.top, t.gap, t.left, t.right, t.bottom, page.lines])
}

/**
 * Draws a page on a canvas. The same renderer is used for screen, print and PDF,
 * so what you see is exactly what you get. Print and PDF re-render at a higher scale.
 */
function Page({ page, settings, showGuides, scale = 1.6 }) {
  const ref = useRef(null)
  const sig = useMemo(() => signature(page), [page])

  useEffect(() => {
    let cancelled = false
    const id = setTimeout(async () => {
      try {
        const c = await renderPageToCanvas(page, settings, scale, { guides: showGuides })
        const el = ref.current
        if (cancelled || !el) return
        el.width = c.width
        el.height = c.height
        el.getContext('2d').drawImage(c, 0, 0)
      } catch (e) {
        console.warn('Page render failed', e)
      }
    }, 80)
    return () => {
      cancelled = true
      clearTimeout(id)
    }
    // `page` is captured through its signature
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, settings, showGuides, scale])

  return <canvas ref={ref} className="block h-full w-full bg-white" />
}

export default memo(Page)
