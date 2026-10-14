import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const dark = { background: 'rgba(255,255,255,0.07)', border: '1.5px solid rgba(255,255,255,0.12)', color: 'var(--white)' }
const lbl = { color: 'rgba(255,255,255,0.45)' }

export default function SignupPage() {
  const nav = useNavigate()
  const [f, setF] = useState({ name: '', owner_name: '', mobile: '', whatsapp: '', email: '', password: '', city: '', business_type: '', ref_link: '', company_site: '' })
  const [same, setSame] = useState(true)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const field = (label, k, props = {}) => (
    <div className="form-group"><label className="form-label" style={lbl}>{label}</label>
      <input className="form-input" style={dark} value={f[k]} onChange={set(k)} {...props} /></div>)

  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true)
    const r = await fetch('/api/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...f, whatsapp: same ? f.mobile : f.whatsapp }) })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) { setBusy(false); return setErr(j.error || 'Could not sign up') }
    const { error } = await supabase.auth.signInWithPassword({ email: f.email.trim(), password: f.password })
    setBusy(false)
    if (error) setErr(error.message); else nav('/')
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--ink)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 24 }}>
      <img src="/sf-mark-light.png" alt="" style={{ width: 64, marginTop: 12 }} />
      <h1 style={{ color: 'var(--white)', margin: '8px 0 2px' }}>Stellar Forge</h1>
      <div style={{ color: 'var(--teal)', fontSize: '0.78rem', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 20 }}>Start your 15-day free trial</div>
      <form onSubmit={submit} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: 28, width: '100%', maxWidth: 400 }}>
        {field('Shop name', 'name', { required: true, maxLength: 80 })}
        {field('Owner name', 'owner_name', { required: true, maxLength: 80 })}
        {field('Mobile number', 'mobile', { required: true, inputMode: 'numeric', maxLength: 14 })}
        <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem' }}><input type="checkbox" checked={same} onChange={e => setSame(e.target.checked)} /> WhatsApp number is the same</label>
        {!same && field('WhatsApp number', 'whatsapp', { required: true, inputMode: 'numeric', maxLength: 14 })}
        {field('Email', 'email', { type: 'email', required: true })}
        {field('Password (8+ characters)', 'password', { type: 'password', required: true, minLength: 8 })}
        {field('City', 'city')}
        {field('Type of business', 'business_type', { placeholder: 'e.g. masala shop, car dealer, kitchen products' })}
        {field('Google Maps / Instagram / website (optional)', 'ref_link', { placeholder: 'https://' })}
        <input name="company_site" value={f.company_site} onChange={set('company_site')} tabIndex={-1} autoComplete="off" style={{ position: 'absolute', left: '-9999px' }} aria-hidden="true" />
        {err && <div style={{ color: '#ff8a8a', margin: '8px 0' }}>{err}</div>}
        <button className="btn btn-primary btn-full btn-lg" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.78rem' }}>We review every new shop within 1 hour (9 am – 9 pm IST) and message you on WhatsApp. Your trial starts when you are approved.</p>
      </form>
      <Link to="/login" style={{ color: 'rgba(255,255,255,0.5)', marginTop: 16, fontSize: '0.85rem' }}>Already have an account? Sign in</Link>
      <div style={{ marginTop: 24, fontSize: '0.75rem' }}>
        <a
          href="https://stellarforgetech.in"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'rgba(255,255,255,0.3)', textDecoration: 'none' }}
        >
          Powered by <span style={{ textDecoration: 'underline' }}>Stellar Forge</span>
        </a>
      </div>
    </div>)
}
