import { useEffect, useState } from 'react'

// Animated list of real advantages shown on the sign-in page. Every claim matches what the app does today.
const SLIDES = [
  { k: 'stages', h: 'Your own order steps', p: 'Received, Processing, Ready, Delivered, Returned. Rename them to fit your shop.' },
  { k: 'wa', h: 'Keep customers updated', p: 'Send status updates on WhatsApp or email in one tap after every change.' },
  { k: 'brand', h: 'Tracking link and bill', p: 'Customers see their order timeline and download the bill. No login needed.' },
  { k: 'excel', h: 'Import products from Excel', p: 'Name, price, unit and tax. Tax is calculated automatically.' },
  { k: 'print', h: 'Print on any printer', p: 'Bluetooth thermal printer (2 or 3 inch) or your normal printer.' },
]

function Visual({ k }) {
  if (k === 'stages') return (
    <div className="sf-taps">{['Received', 'Processing', 'Ready', 'Delivered'].map((t, i) => (
      <div key={t} className="sf-tap" style={{ '--d': `${i * 0.7}s` }}><span>{i + 1}</span><small>{t}</small></div>))}</div>)
  if (k === 'brand') return (
    <div className="sf-receipt"><b>ORDER ORD-00012</b><i style={{ '--d': '0.2s' }} /><i style={{ '--d': '0.5s' }} /><i style={{ '--d': '0.8s', width: '60%' }} /><em>Track · Download bill</em></div>)
  if (k === 'print') return <div className="sf-paper"><div style={{ '--d': '0s' }}>2 inch</div><div style={{ '--d': '1.4s' }}>3 inch</div></div>
  if (k === 'wa') return <div className="sf-wa">💬 Your order is ready!</div>
  return <div className="sf-sync"><div>Excel</div><span /><div>Products</div></div>
}

export default function LoginShowcase() {
  const [i, setI] = useState(0)
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  useEffect(() => { if (reduced) return; const t = setInterval(() => setI(n => (n + 1) % SLIDES.length), 3600); return () => clearInterval(t) }, [reduced])

  if (reduced) return <ul className="sf-static">{SLIDES.map(s => <li key={s.k}><b>{s.h}</b><span>{s.p}</span></li>)}</ul>

  const s = SLIDES[i]
  return (
    <div className="sf-show" aria-live="polite">
      <div key={'v' + i} className="sf-vis"><Visual k={s.k} /></div>
      <h2 key={'h' + i} className="sf-h">{s.h.split(' ').map((w, n) => <span key={n} className="sf-word" style={{ '--i': n }}>{w}</span>)}</h2>
      <p key={'p' + i} className="sf-p">{s.p}</p>
      <div className="sf-dots">{SLIDES.map((_, n) => <button key={n} aria-label={`Show benefit ${n + 1}`} className={n === i ? 'on' : ''} onClick={() => setI(n)} />)}</div>
    </div>)
}
