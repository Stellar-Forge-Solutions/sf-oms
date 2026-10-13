// WhatsApp wording (wa.me click-to-send). The email twin lives in api/notify-email.js.
import { stageLabel, inr, orderNo, trackUrl, billUrl, PAY, waNumber } from './orderUtils'

const LINE = {
  received: 'We have received your order and will start working on it shortly.',
  processing: 'Your order is now being processed.',
  ready: 'Good news! Your order is ready and will be dispatched soon.',
  delivered: 'Your order has been delivered. We hope you are happy with it.',
  returned: 'Your order has been marked as returned.',
}

export function statusLine(stageKey, label) {
  return LINE[stageKey] || `Your order status has been updated to "${label}".`
}

export function whatsappText(order, settings, shop) {
  const label = stageLabel(settings.stages, order.stage_key)
  const bill = billUrl(order, settings)
  const out = [
    `Hello ${order.customer_name},`, '',
    `*Order ${orderNo(order, settings)}: ${label}*`,
    statusLine(order.stage_key, label), '',
    `Order total: ${inr(order.total)}`,
    `Payment: ${PAY[order.payment_status]?.label}${order.payment_status === 'partial' ? ` (${inr(order.amount_paid)} received)` : ''}`, '',
    `Track your order: ${trackUrl(order, settings)}`,
  ]
  if (order.tracking_url) out.push(`Courier tracking: ${order.tracking_url}`)
  if (bill) out.push(`Download your bill: ${bill}`)
  out.push('', 'Thank you for choosing us.', `*${shop.name}*`)
  if (shop.mobile) out.push(`Call us: ${shop.mobile}`)
  return out.join('\n')
}

export const whatsappLink = (order, settings, shop) =>
  `https://wa.me/${waNumber(order.customer_whatsapp)}?text=${encodeURIComponent(whatsappText(order, settings, shop))}`
