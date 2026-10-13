import { useState } from 'react'

export default function TrackingModal({ order, onSave, onSkip, onClose }) {
  const [url, setUrl] = useState(order.tracking_url || '')

  const submit = (e) => {
    e?.preventDefault()
    onSave(url.trim())
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">📦 Add courier tracking link?</div>
        <div className="modal-subtitle">
          Add a tracking URL from Delhivery, Shiprocket, BlueDart, DTDC, or India Post so the customer can track their parcel directly.
        </div>

        <form onSubmit={submit}>
          <div className="form-group">
            <label className="form-label">Tracking Link / URL</label>
            <input
              className="form-input"
              type="url"
              placeholder="e.g. https://shiprocket.co/tracking/..."
              value={url}
              onChange={e => setUrl(e.target.value)}
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-2 mt-3">
            <button type="submit" className="btn btn-primary btn-full btn-lg">
              {url.trim() ? 'Save & Notify customer →' : 'Continue & Notify customer →'}
            </button>
            <button type="button" className="btn btn-ghost btn-full" onClick={onSkip}>
              Skip for now
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
