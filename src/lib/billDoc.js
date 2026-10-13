// Bill output: PDF (stored + downloadable) and an HTML page for the normal-printer window.
import { calcLine, rs, orderNo, fmtDate, PAY, taxActive, trackUrl, stageLabel } from './orderUtils'

export function totalsList(o, settings) {
  const rows = [['Subtotal', o.subtotal]]
  if (Number(o.cgst_amt) > 0) rows.push(['CGST', o.cgst_amt])
  if (Number(o.sgst_amt) > 0) rows.push(['SGST', o.sgst_amt])
  if (Number(o.igst_amt) > 0) rows.push(['IGST', o.igst_amt])
  if (Number(o.discount_amount) > 0) rows.push([`Discount${Number(o.discount_percent) > 0 ? ` (${Number(o.discount_percent)}%)` : ''}`, -Number(o.discount_amount)])
  if (Number(o.freight) > 0) rows.push(['Freight / delivery', o.freight])
  return rows
}
export const balanceDue = (o) => o.payment_status === 'paid' ? 0 : o.payment_status === 'refunded' ? 0 : Math.max(0, Number(o.total) - Number(o.amount_paid || 0))
const gstLine = (shop) => [shop.gst_no && `GSTIN: ${shop.gst_no}`, shop.mobile && `Ph: ${shop.mobile}`, shop.website].filter(Boolean).join('  |  ')

export async function buildBillPdf({ order, items, shop, settings, logo }) {
  const { jsPDF } = await import('jspdf')
  const autoTable = (await import('jspdf-autotable')).default
  const QRCode = (await import('qrcode')).default
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = 210, M = 14
  const tax = taxActive(settings), unit = settings.fields.unit

  let y = 16
  if (logo) { try { doc.addImage(logo, 'PNG', M, 12, 22, 22); } catch { /* skip logo */ } }
  const x0 = logo ? M + 26 : M
  doc.setFont('helvetica', 'bold').setFontSize(16).text(shop.name || '', x0, y + 2)
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(90)
  const addr = doc.splitTextToSize(shop.address || '', 95)
  doc.text(addr, x0, y + 8)
  doc.text(gstLine(shop), x0, y + 8 + addr.length * 4)
  doc.setTextColor(0).setFont('helvetica', 'bold').setFontSize(18).text('BILL', W - M, y + 2, { align: 'right' })
  doc.setFont('helvetica', 'normal').setFontSize(9)
  doc.text(`No: ${orderNo(order, settings)}`, W - M, y + 9, { align: 'right' })
  doc.text(`Date: ${fmtDate(order.created_at)}`, W - M, y + 14, { align: 'right' })

  y = 46
  doc.setDrawColor(220).line(M, y - 4, W - M, y - 4)
  doc.setFont('helvetica', 'bold').setFontSize(8).setTextColor(120).text('BILL TO', M, y)
  doc.setTextColor(0).setFontSize(11).text(order.customer_name || '', M, y + 6)
  doc.setFont('helvetica', 'normal').setFontSize(9)
  const contact = [order.customer_whatsapp && `WhatsApp: ${order.customer_whatsapp}`, order.customer_email].filter(Boolean)
  contact.forEach((c, i) => doc.text(c, M, y + 11 + i * 4.5))

  const head = ['#', 'Item', ...(unit ? ['Unit'] : []), 'Qty', 'Rate', ...(tax ? ['Tax'] : []), 'Amount']
  const body = items.map((it, i) => {
    const l = calcLine(it)
    const name = [it.name, [settings.fields.category && it.category, settings.fields.description && it.description].filter(Boolean).join(' · ')].filter(Boolean).join('\n')
    return [i + 1, name, ...(unit ? [it.unit || ''] : []), Number(it.quantity), rs(it.unit_price), ...(tax ? [rs(l.tax)] : []), rs(l.base)]
  })
  const right = (n) => ({ halign: 'right', cellWidth: n })
  autoTable(doc, {
    startY: y + 24, head: [head], body, theme: 'striped', margin: { left: M, right: M },
    headStyles: { fillColor: [15, 25, 35], textColor: 255, fontSize: 9 }, styles: { fontSize: 9, cellPadding: 2.2 },
    didParseCell: (d) => { if (d.section === 'head' && d.column.index >= 2) d.cell.styles.halign = 'right' },
    columnStyles: Object.fromEntries(head.map((h, i) => [i, h === '#' ? { cellWidth: 8 } : h === 'Item' ? {} : right(h === 'Unit' ? 16 : h === 'Qty' ? 16 : 28)])),
  })

  let fy = doc.lastAutoTable.finalY + 6
  if (fy > 235) { doc.addPage(); fy = 20 }
  const line = (label, val, bold) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal').setFontSize(bold ? 12 : 9.5)
    doc.text(label, 130, fy); doc.text(rs(val), W - M, fy, { align: 'right' }); fy += bold ? 7 : 5.5
  }
  totalsList(order, settings).forEach(([l, v]) => line(l, v))
  doc.setDrawColor(200).line(130, fy - 3.5, W - M, fy - 3.5)
  line('TOTAL', order.total, true)
  doc.setFont('helvetica', 'normal').setFontSize(9.5)
  doc.text(`Payment: ${PAY[order.payment_status].label}`, 130, fy); fy += 5.5
  if (order.payment_status === 'partial') { line('Received', order.amount_paid); line('Balance due', balanceDue(order), true) }

  const qr = await QRCode.toDataURL(trackUrl(order, settings), { margin: 1, width: 220 })
  const qy = Math.max(fy + 4, 250)
  if (qy > 270) { doc.addPage() }
  const py = qy > 270 ? 20 : qy
  doc.addImage(qr, 'PNG', M, py, 26, 26)
  doc.setFont('helvetica', 'bold').setFontSize(9).text('Track this order', M + 30, py + 8)
  doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(90).text(doc.splitTextToSize(trackUrl(order, settings), 110), M + 30, py + 13)
  doc.setTextColor(0).setFontSize(9).text(shop.thank_you || 'Thank you for your business!', W - M, py + 8, { align: 'right' })
  return doc.output('blob')
}

// ── Normal printer: HTML in a new window, then the browser print dialog ──────
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

export function printNormal({ order, items, shop, settings, logoUrl }) {
  const tax = taxActive(settings), unit = settings.fields.unit
  const rows = items.map((it, i) => { const l = calcLine(it); return `<tr><td>${i + 1}</td><td><b>${esc(it.name)}</b>${(settings.fields.category && it.category) || (settings.fields.description && it.description) ? `<div class="s">${esc([settings.fields.category && it.category, settings.fields.description && it.description].filter(Boolean).join(' · '))}</div>` : ''}</td>${unit ? `<td>${esc(it.unit || '')}</td>` : ''}<td class="r">${Number(it.quantity)}</td><td class="r">${rs(it.unit_price)}</td>${tax ? `<td class="r">${rs(l.tax)}</td>` : ''}<td class="r">${rs(l.base)}</td></tr>` }).join('')
  const totals = totalsList(order, settings).map(([l, v]) => `<tr><td>${l}</td><td class="r">${rs(v)}</td></tr>`).join('')
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(orderNo(order, settings))}</title><style>
  @page{size:A4;margin:14mm}body{font-family:Arial,Helvetica,sans-serif;color:#0f1923;font-size:12px;margin:0}
  .top{display:flex;justify-content:space-between;gap:16px;border-bottom:2px solid #0f1923;padding-bottom:10px}.top img{height:56px;margin-right:12px}
  h1{margin:0;font-size:20px}.s{color:#6b7c93;font-size:11px}.r{text-align:right}table{width:100%;border-collapse:collapse;margin-top:14px}
  th{background:#0f1923;color:#fff;text-align:left;padding:7px;font-size:11px}th.r{text-align:right}td{padding:7px;border-bottom:1px solid #e2e8f0;vertical-align:top}
  .tot{width:260px;margin-left:auto}.tot td{border:0;padding:3px 7px}.grand td{font-size:15px;font-weight:700;border-top:2px solid #0f1923}
  </style></head><body>
  <div class="top"><div style="display:flex;align-items:center">${logoUrl ? `<img src="${esc(logoUrl)}" alt="">` : ''}<div><h1>${esc(shop.name)}</h1><div class="s">${esc(shop.address || '')}</div><div class="s">${esc(gstLine(shop))}</div></div></div>
  <div class="r"><h1>BILL</h1><div>${esc(orderNo(order, settings))}</div><div class="s">${fmtDate(order.created_at)}</div></div></div>
  <p><span class="s">BILL TO</span><br><b>${esc(order.customer_name)}</b><br><span class="s">${esc([order.customer_whatsapp, order.customer_email].filter(Boolean).join(' · '))}</span></p>
  <table><thead><tr><th>#</th><th>Item</th>${unit ? '<th>Unit</th>' : ''}<th class="r">Qty</th><th class="r">Rate</th>${tax ? '<th class="r">Tax</th>' : ''}<th class="r">Amount</th></tr></thead><tbody>${rows}</tbody></table>
  <table class="tot">${totals}<tr class="grand"><td>TOTAL</td><td class="r">${rs(order.total)}</td></tr>
  <tr><td>Payment</td><td class="r">${PAY[order.payment_status].label}</td></tr>${order.payment_status === 'partial' ? `<tr><td>Received</td><td class="r">${rs(order.amount_paid)}</td></tr><tr><td><b>Balance due</b></td><td class="r"><b>${rs(balanceDue(order))}</b></td></tr>` : ''}</table>
  <p style="margin-top:30px;text-align:center" class="s">${esc(shop.thank_you || 'Thank you for your business!')}</p>
  <script>window.onload=function(){setTimeout(function(){window.print()},350)}<\/script></body></html>`
  const w = window.open('', '_blank')
  if (!w) { alert('Please allow pop-ups to print.'); return }
  w.document.open(); w.document.write(html); w.document.close()
}
