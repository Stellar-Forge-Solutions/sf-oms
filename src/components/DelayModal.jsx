import { useState } from 'react'
import { fmtDate } from '../lib/orderUtils'

export default function DelayModal({ order, onSave, onClose }) {
  const tomorrow = new Date(Date.now() + 864e5).toISOString().split('T')[0]
  const [date, setDate] = useState(order.delivery_date || tomorrow)
  const [reason, setReason] = useState('')
  const [err, setErr] = useState('')

  const submit = (e) => {
    e?.preventDefault()
    if (!date) return setErr('Please select a new delivery date')
    onSave({ deliveryDate: date, reason: reason.trim() })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">⏰ Reschedule / Delay Order</div>
        <div className="modal-subtitle">
          Update the expected delivery date for {order.customer_name}. You can notify them immediately after saving.
        </div>

        {order.delivery_date && (
          <div className="hint-box" style={{ marginBottom: 12, fontSize: '.82rem' }}>
            Current expected delivery: <b>{fmtDate(order.delivery_date)}</b>
          </div>
        )}

        <form onSubmit={submit}>
          {err && <div className="hint-box" style={{ background: '#fee2e2', color: '#991b1b', borderColor: '#fca5a5', marginBottom: 12 }}>{err}</div>}

          <div className="form-group">
            <label className="form-label">New Expected Delivery Date</label>
            <input
              className="form-input"
              type="date"
              value={date}
              min={new Date().toISOString().split('T')[0]}
              onChange={e => { setDate(e.target.value); setErr('') }}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">Reason or note for customer (optional)</label>
            <input
              className="form-input"
              type="text"
              placeholder="e.g. Quality check in progress, material transit delay"
              value={reason}
              onChange={e => setReason(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2 mt-4">
            <button type="submit" className="btn btn-primary btn-full btn-lg">
              Update Date & Notify Customer →
            </button>
            <button type="button" className="btn btn-ghost btn-full" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
