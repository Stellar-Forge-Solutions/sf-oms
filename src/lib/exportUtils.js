// Orders export: CSV, Excel, PDF. All use the same rows so they always match.
import { guardWrite } from './shop'
import { orderNo, stageLabel, PAY, fmtDate, r2 } from './orderUtils'

export function exportRows(orders, settings) {
  const head = ['Order No', 'Date', 'Customer', 'WhatsApp', 'Email', 'Status', 'Payment', 'Subtotal', 'Tax', 'Freight', 'Total', 'Paid']
  const body = orders.map(o => [orderNo(o, settings), fmtDate(o.created_at), o.customer_name, o.customer_whatsapp || '', o.customer_email || '',
    stageLabel(settings.stages, o.stage_key), PAY[o.payment_status].label, r2(o.subtotal), r2(o.tax_total), r2(o.freight), r2(o.total), r2(o.amount_paid)])
  return { head, body }
}

function save(blob, name) {
  const url = URL.createObjectURL(blob); const a = document.createElement('a')
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
const cell = (v) => { let s = v ?? ''; s = String(s); if (/^[=+\-@\t\r]/.test(s) && isNaN(Number(s))) s = "'" + s; return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s }

export async function exportOrders(kind, orders, settings, label = 'orders') {
  if (!guardWrite('Export')) return
  const { head, body } = exportRows(orders, settings)
  const name = `${label}-${new Date().toISOString().slice(0, 10)}`
  if (kind === 'csv') save(new Blob(['\uFEFF' + [head, ...body].map(r => r.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }), name + '.csv')
  if (kind === 'xlsx') {
    const XLSX = await import('xlsx'); const ws = XLSX.utils.aoa_to_sheet([head, ...body]); const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Orders'); XLSX.writeFile(wb, name + '.xlsx')
  }
  if (kind === 'pdf') {
    const { jsPDF } = await import('jspdf'); const autoTable = (await import('jspdf-autotable')).default
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    doc.setFontSize(14).text(`Orders: ${label}`, 14, 14)
    const sum = (i) => r2(body.reduce((t, r) => t + Number(r[i]), 0))
    autoTable(doc, {
      startY: 20, head: [['Order', 'Date', 'Customer', 'Status', 'Payment', 'Subtotal', 'Tax', 'Freight', 'Total']],
      body: body.map(r => [r[0], r[1], r[2], r[5], r[6], r[7], r[8], r[9], r[10]]),
      foot: [['', '', '', '', `${body.length} orders`, sum(7), sum(8), sum(9), sum(10)]],
      headStyles: { fillColor: [15, 25, 35] }, footStyles: { fillColor: [226, 232, 240], textColor: 0 }, styles: { fontSize: 8.5 },
    })
    doc.save(name + '.pdf')
  }
}

// ── Products: sample + import ─────────────────────────────
export const productHeaders = (catLabel) => ['Product Name', catLabel, 'CGST %', 'SGST %', 'IGST %', 'Unit', 'Unit Price', 'Total Price']

export async function downloadSample(catLabel) {
  const XLSX = await import('xlsx')
  const ws = XLSX.utils.aoa_to_sheet([productHeaders(catLabel),
    ['Garam Masala 100g', 'Masala', 2.5, 2.5, 0, 'pack', 80, 84], ['Turmeric Powder 200g', 'Masala', 2.5, 2.5, 0, 'pack', 60, 63]])
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Products'); XLSX.writeFile(wb, 'products-sample.xlsx')
}

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '')
const num = (v) => (v === '' || v === null || v === undefined || isNaN(Number(v)) ? null : Number(v))

// Returns { rows, skipped } ready for order_products. Header names are matched loosely; the category column may use the shop's own label.
export async function readProductsFile(file, catLabel) {
  const XLSX = await import('xlsx')
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' })
  const raw = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' })
  const cat = norm(catLabel)
  const rows = []; let skipped = 0
  for (const r of raw) {
    const m = {}; for (const k of Object.keys(r)) m[norm(k)] = r[k]
    const name = String(m.productname ?? m.name ?? m.product ?? '').trim()
    const price = num(m.unitprice ?? m.price ?? m.rate)
    if (!name || price === null) { skipped++; continue }
    const cg = num(m.cgst ?? m.cgstpct ?? m.cgstpercent), sg = num(m.sgst ?? m.sgstpct ?? m.sgstpercent), ig = num(m.igst ?? m.igstpct ?? m.igstpercent)
    rows.push({
      name, category: String(m[cat] ?? m.category ?? '').trim() || null, unit: String(m.unit ?? '').trim() || null, unit_price: price,
      cgst: cg, sgst: sg, igst: ig,
      total_price: r2(price * (1 + ((cg || 0) + (sg || 0) + (ig || 0)) / 100)),   // always recomputed: price + product tax
    })
  }
  return { rows, skipped }
}
