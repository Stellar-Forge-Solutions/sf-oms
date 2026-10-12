import { PAY, stageColor } from '../lib/orderUtils'

export function StageBadge({ stages, k }) {
  const label = stages.find(s => s.key === k)?.label || k
  const c = stageColor(k)
  return <span className="badge" style={{ background: c + '22', color: c, border: `1px solid ${c}55` }}>{label}</span>
}
export function PayBadge({ status }) {
  const p = PAY[status] || PAY.unpaid
  return <span className="badge" style={{ background: p.bg, color: p.fg }}>{p.label}</span>
}
