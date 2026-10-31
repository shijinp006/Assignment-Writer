import { PAGE_H, PAGE_W } from '../lib/constants'
import { pageOps } from '../lib/render'
import { lineCapacity } from '../lib/templates'

function Guides({ tpl }) {
  const cap = lineCapacity(tpl)
  return (
    <g pointerEvents="none">
      <rect x={tpl.left} y={0} width={PAGE_W - tpl.left - tpl.right} height={PAGE_H} fill="#3b82f6" opacity="0.05" />
      <line x1={tpl.left} x2={tpl.left} y1={0} y2={PAGE_H} stroke="#2563eb" strokeWidth="1.5" strokeDasharray="6 4" />
      <line x1={PAGE_W - tpl.right} x2={PAGE_W - tpl.right} y1={0} y2={PAGE_H} stroke="#2563eb" strokeWidth="1.5" strokeDasharray="6 4" />
      {Array.from({ length: cap }, (_, i) => {
        const y = tpl.top + i * tpl.gap
        return <line key={i} x1={0} x2={PAGE_W} y1={y} y2={y} stroke="#ef4444" strokeWidth={i === 0 ? 2 : 1} opacity="0.7" />
      })}
    </g>
  )
}

export default function Page({ page, settings, showGuides }) {
  const { texts, underlines } = pageOps(page, settings)
  return (
    <svg viewBox={`0 0 ${PAGE_W} ${PAGE_H}`} className="block h-full w-full" xmlns="http://www.w3.org/2000/svg">
      <image href={page.tpl.src} x="0" y="0" width={PAGE_W} height={PAGE_H} preserveAspectRatio="none" />
      {showGuides && <Guides tpl={page.tpl} />}
      <g fill={settings.color} fontFamily={`"${settings.font}", cursive`} letterSpacing={settings.letterSpacing} opacity="0.93">
        {texts.map((t, i) => (
          <text key={i} x={t.x} y={t.y} fontSize={t.size} transform={t.rot ? `rotate(${t.rot.toFixed(2)} ${t.x} ${t.y})` : undefined}>
            {t.text}
          </text>
        ))}
        {underlines.map((u, i) => (
          <path
            key={'u' + i}
            d={`M ${u.a} ${u.y} Q ${(u.a + u.b) / 2} ${u.cy} ${u.b} ${u.y2}`}
            stroke={settings.color}
            strokeWidth={u.width}
            strokeLinecap="round"
            fill="none"
          />
        ))}
      </g>
    </svg>
  )
}
