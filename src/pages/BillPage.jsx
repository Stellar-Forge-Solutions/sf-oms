import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { buildBillPdf } from '../lib/billDoc'
import { inr, rs, fmtDate, fmtDateTime, PAY, taxActive, orderNo } from '../lib/orderUtils'

export default function BillPage() {
  const { token } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    fetch(`/api/track?t=${encodeURIComponent(token)}`)
      .then(async r => {
        if (!r.ok) {
          const j = await r.json().catch(() => ({}))
          throw new Error(j.error || 'Invoice not found')
        }
        return r.json()
      })
      .then(d => {
        setData(d)
        setLoading(false)
      })
      .catch(e => {
        setErr(e.message)
        setLoading(false)
      })
  }, [token])

  const handleDownloadPdf = async () => {
    if (!data) return
    setDownloading(true)
    try {
      const { order, items, shop, brand, stages, category_label, fields } = data
      const settings = {
        stages,
        category_label,
        fields,
        tax: {
          cgst: { on: Number(order.cgst_amt) > 0 },
          sgst: { on: Number(order.sgst_amt) > 0 },
          igst: { on: Number(order.igst_amt) > 0 },
        },
        order_prefix: '',
      }

      const blob = await buildBillPdf({
        order: {
          ...order,
          order_no: order.no,
          token,
        },
        items: items || [],
        shop,
        settings,
        logo: shop.logo,
      })

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Bill-${order.no}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      alert('Could not download PDF: ' + e.message)
    } finally {
      setDownloading(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  if (loading) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Loading invoice…</div>
      </div>
    )
  }

  if (err || !data) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div className="card" style={{ maxWidth: 400, textAlign: 'center', padding: 32 }}>
          <div style={{ fontSize: '2rem', marginBottom: 12 }}>🧾</div>
          <h2 style={{ fontSize: '1.2rem', marginBottom: 8 }}>Invoice Not Found</h2>
          <p className="text-muted" style={{ fontSize: '.88rem', marginBottom: 16 }}>{err || 'This bill link may be invalid or expired.'}</p>
        </div>
      </div>
    )
  }

  const { shop, brand, order, items, fields } = data
  const tax = Number(order.cgst_amt) > 0 || Number(order.sgst_amt) > 0 || Number(order.igst_amt) > 0
  const balanceDue = order.payment_status === 'paid' ? 0 : Math.max(0, Number(order.total) - Number(order.amount_paid || 0))

  return (
    <div className="bill-container" style={{ maxWidth: 640, margin: '0 auto', padding: '16px 14px 40px' }}>
      {/* Top Action Bar (hidden in print) */}
      <div className="no-print" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
        gap: 8,
        flexWrap: 'wrap'
      }}>
        <Link to={`/track/${token}`} className="btn btn-secondary btn-sm">
          ← Order Tracking
        </Link>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleDownloadPdf}
            disabled={downloading}
          >
            {downloading ? 'Preparing PDF…' : '⬇️ Download PDF'}
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handlePrint}
          >
            🖨️ Print
          </button>
        </div>
      </div>

      {/* Invoice Document Card */}
      <div className="card invoice-card" style={{
        padding: '24px 20px',
        boxShadow: '0 4px 14px rgba(0,0,0,0.06)',
        borderRadius: 14,
        background: '#fff'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          borderBottom: '2px solid #0f1923',
          paddingBottom: 16,
          gap: 16
        }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {shop.logo && (
              <img src={shop.logo} alt="" style={{ height: 52, maxWidth: 80, objectFit: 'contain' }} />
            )}
            <div>
              <h1 style={{ fontSize: '1.25rem', margin: 0, fontWeight: 800, color: '#0f1923' }}>
                {shop.name}
              </h1>
              {shop.tagline && <div style={{ fontSize: '.78rem', color: '#64748b', marginTop: 2 }}>{shop.tagline}</div>}
              {shop.address && <div style={{ fontSize: '.75rem', color: '#64748b', marginTop: 2 }}>{shop.address}</div>}
              {shop.gst_no && <div style={{ fontSize: '.72rem', color: '#64748b', marginTop: 2 }}>GSTIN: <b>{shop.gst_no}</b></div>}
              {shop.mobile && <div style={{ fontSize: '.72rem', color: '#64748b' }}>Ph: {shop.mobile}</div>}
            </div>
          </div>

          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{
              fontSize: '1.1rem',
              fontWeight: 800,
              letterSpacing: '0.05em',
              color: '#0f1923'
            }}>
              INVOICE
            </div>
            <div style={{ fontWeight: 700, fontSize: '.9rem', color: 'var(--teal-dark, #0d9488)', marginTop: 2 }}>
              {order.no}
            </div>
            <div style={{ fontSize: '.75rem', color: '#64748b', marginTop: 2 }}>
              {fmtDate(order.created_at)}
            </div>
            {order.delivery_date && (
              <div style={{ fontSize: '.72rem', color: '#64748b', marginTop: 2 }}>
                Delivery: <b>{fmtDate(order.delivery_date)}</b>
              </div>
            )}
          </div>
        </div>

        {/* Billed To */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          padding: '14px 0',
          borderBottom: '1px solid #e2e8f0'
        }}>
          <div>
            <div style={{ fontSize: '.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', fontWeight: 600 }}>
              Billed To
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0f1923', marginTop: 2 }}>
              {order.customer_name}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', fontWeight: 600 }}>
              Payment Status
            </div>
            <div style={{
              fontSize: '.82rem',
              fontWeight: 700,
              display: 'inline-block',
              padding: '2px 8px',
              borderRadius: 6,
              marginTop: 4,
              background: order.payment_status === 'paid' ? '#dcfce7' : order.payment_status === 'partial' ? '#fef9c3' : '#fee2e2',
              color: order.payment_status === 'paid' ? '#166534' : order.payment_status === 'partial' ? '#854d0e' : '#991b1b',
            }}>
              {PAY[order.payment_status]?.label || order.payment_status}
            </div>
          </div>
        </div>

        {/* Line Items Table */}
        <div style={{ overflowX: 'auto', margin: '14px 0' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.84rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #cbd5e1' }}>
                <th style={{ padding: '8px 6px', textAlign: 'left', fontWeight: 700 }}>#</th>
                <th style={{ padding: '8px 6px', textAlign: 'left', fontWeight: 700 }}>Item</th>
                <th style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 700 }}>Qty</th>
                <th style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 700 }}>Rate</th>
                {tax && <th style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 700 }}>Tax</th>}
                <th style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 700 }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {(items || []).map((it, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '8px 6px', color: '#64748b' }}>{idx + 1}</td>
                  <td style={{ padding: '8px 6px' }}>
                    <b>{it.name}</b>
                    {(it.category || it.description) && (
                      <div style={{ fontSize: '.72rem', color: '#64748b', marginTop: 1 }}>
                        {[it.category, it.description].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '8px 6px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {Number(it.quantity)}{it.unit ? ` ${it.unit}` : ''}
                  </td>
                  <td style={{ padding: '8px 6px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {rs(it.unit_price)}
                  </td>
                  {tax && (
                    <td style={{ padding: '8px 6px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {Number(it.tax_amt) > 0 ? rs(it.tax_amt) : '–'}
                    </td>
                  )}
                  <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {rs(it.line_total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals Summary */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
          <div style={{ width: '100%', maxWidth: 280, fontSize: '.84rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
              <span style={{ color: '#64748b' }}>Subtotal</span>
              <span>{inr(order.subtotal)}</span>
            </div>
            {Number(order.cgst_amt) > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                <span style={{ color: '#64748b' }}>CGST</span>
                <span>{inr(order.cgst_amt)}</span>
              </div>
            )}
            {Number(order.sgst_amt) > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                <span style={{ color: '#64748b' }}>SGST</span>
                <span>{inr(order.sgst_amt)}</span>
              </div>
            )}
            {Number(order.igst_amt) > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                <span style={{ color: '#64748b' }}>IGST</span>
                <span>{inr(order.igst_amt)}</span>
              </div>
            )}
            {Number(order.discount_amount) > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', color: 'var(--success, #16a34a)', fontWeight: 600 }}>
                <span>Discount{Number(order.discount_percent) > 0 ? ` (${Number(order.discount_percent)}%)` : ''}</span>
                <span>- {inr(order.discount_amount)}</span>
              </div>
            )}
            {Number(order.freight) > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                <span style={{ color: '#64748b' }}>Freight / Delivery</span>
                <span>{inr(order.freight)}</span>
              </div>
            )}

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '8px 0',
              marginTop: 6,
              borderTop: '2px solid #0f1923',
              fontSize: '1.05rem',
              fontWeight: 800,
              color: '#0f1923'
            }}>
              <span>Total</span>
              <span>{inr(order.total)}</span>
            </div>

            {order.payment_status === 'partial' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', color: '#166534' }}>
                  <span>Amount Paid</span>
                  <span>{inr(order.amount_paid)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontWeight: 700, color: '#b91c1c' }}>
                  <span>Balance Due</span>
                  <span>{inr(balanceDue)}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer Note */}
        <div style={{
          marginTop: 28,
          paddingTop: 16,
          borderTop: '1px solid #e2e8f0',
          textAlign: 'center',
          fontSize: '.8rem',
          color: '#64748b'
        }}>
          {shop.thank_you || 'Thank you for your business!'}
        </div>
      </div>

      <style>{`
        @media print {
          .no-print, nav, .app-shell > nav, .btn, a.btn {
            display: none !important;
          }
          body {
            background: #fff !important;
            color: #000 !important;
          }
          .bill-container {
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .invoice-card {
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
          }
        }
      `}</style>
    </div>
  )
}
