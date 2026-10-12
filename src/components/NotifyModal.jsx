import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { stageLabel, orderNo } from '../lib/orderUtils'
import { whatsappLink } from '../lib/messages'
import { guardWrite } from '../lib/shop'
import { useToast } from './Toast'

// Pops up after every status change. Shows only the channel(s) chosen in Settings.
export default function NotifyModal({ order, settings, shop, onClose }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const ch = settings.notify_channel
  const label = stageLabel(settings.stages, order.stage_key)
  const hasWa = !!order.customer_whatsapp, hasMail = !!order.customer_email

  const sendEmail = async () => {
    if (!guardWrite('Sending email')) return
    setBusy(true)
    const { data: { session } } = await supabase.auth.getSession()
    const r = await fetch('/api/notify-email', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` }, body: JSON.stringify({ id: order.id }) })
    const j = await r.json().catch(() => ({}))
    setBusy(false)
    if (!r.ok) return toast(j.error || 'Could not send the email', 'error')
    toast('Email sent to ' + order.customer_email); onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Notify {order.customer_name}?</div>
        <div className="modal-subtitle">{orderNo(order, settings)} is now <b>{label}</b>. The message includes the tracking link{order.bill_path ? ' and the bill download link' : ''}.</div>

        {(ch === 'whatsapp' || ch === 'both') && (hasWa
          ? <a className="btn btn-primary btn-full btn-lg" style={{ marginBottom: 10, background: '#25D366', color: '#fff' }} target="_blank" rel="noopener noreferrer" href={whatsappLink(order, settings, shop)} onClick={() => setTimeout(onClose, 400)}>💬 Send on WhatsApp</a>
          : <div className="hint-box">No WhatsApp number for this customer: edit the order to add one.</div>)}

        {(ch === 'email' || ch === 'both') && (hasMail
          ? <button className="btn btn-dark btn-full btn-lg" style={{ marginBottom: 10 }} disabled={busy} onClick={sendEmail}>{busy ? 'Sending…' : '✉️ Send email'}</button>
          : <div className="hint-box">No email for this customer: edit the order to add one.</div>)}

        <button className="btn btn-ghost btn-full" onClick={onClose}>Skip for now</button>
      </div>
    </div>
  )
}
