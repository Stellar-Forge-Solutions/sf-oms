import { Link } from 'react-router-dom'
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import LoginShowcase from '../components/LoginShowcase'

export default function LoginPage() {
  const [mode, setMode] = useState('login') // 'login' | 'forgot'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSubmit = async () => {
    setError('')
    setSuccess('')
    if (!email.trim()) return setError('Please enter your email')
    if (mode === 'login' && !password) return setError('Please enter your password')

    setLoading(true)

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) setError(error.message)

    } else if (mode === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin,
      })
      if (error) setError(error.message)
      else setSuccess('Password reset email sent! Check your inbox.')
    }

    setLoading(false)
  }

  const darkInput = { background: 'rgba(255,255,255,0.07)', border: '1.5px solid rgba(255,255,255,0.12)', color: 'var(--white)' }

  return (
    <div className="sf-login">
      <div className="sf-glow" style={{ width: 520, height: 520, left: -120, top: -60 }} />
      <div className="sf-glow" style={{ width: 460, height: 460, right: -100, bottom: 40, animationDelay: '-5s' }} />

      {/* Left / top: brand + animated benefits */}
      <section className="sf-hero">
        <img src="/sf-mark-light.png" alt="" style={{ width: 56 }} />
        <div style={{ color: 'var(--white)', fontSize: '1.15rem', fontWeight: 700, letterSpacing: '0.3em', marginTop: 8 }}>STELLAR FORGE</div>
        <div style={{ color: 'var(--teal)', fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.25em', marginTop: 4 }}>ORDERS</div>
        <div className="sf-badge" style={{ marginTop: 18 }}>Free plan · 100 orders/month · No card needed</div>
        <LoginShowcase />
      </section>

      {/* Right / bottom: signup first, sign in second */}
      <section className="sf-panel">
        <Link to="/signup" className="sf-cta">Get started with Free plan →</Link>
        <p className="sf-note">We review every new shop within 1 hour (9 am – 9 pm IST) and message you on WhatsApp. Your free plan activates when approved.</p>
        <div className="sf-or">Already have an account?</div>

      {/* Card */}
      <div style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '20px',
        padding: '28px',
        width: '100%',
        maxWidth: '380px',
        backdropFilter: 'blur(12px)',
      }}>
        {mode === 'forgot' && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{ color: 'var(--white)', fontWeight: 700, fontSize: '1.1rem', marginBottom: '4px' }}>Reset Password</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}>Enter your email and we'll send a reset link</div>
          </div>
        )}

        {/* Email */}
        <div className="form-group">
          <label className="form-label" style={{ color: 'rgba(255,255,255,0.45)' }}>Email</label>
          <input
            className="form-input"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                        style={{ background: 'rgba(255,255,255,0.07)', border: '1.5px solid rgba(255,255,255,0.12)', color: 'var(--white)' }}
          />
        </div>

        {/* Password — only on sign in */}
        {mode === 'login' && (
          <div className="form-group">
            <label className="form-label" style={{ color: 'rgba(255,255,255,0.45)' }}>Password</label>
            <input
              className="form-input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              style={{ background: 'rgba(255,255,255,0.07)', border: '1.5px solid rgba(255,255,255,0.12)', color: 'var(--white)' }}
            />
          </div>
        )}

        {/* Error / success */}
        {error && (
          <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '10px 14px', color: '#fca5a5', fontSize: '0.85rem', marginBottom: '16px' }}>
            ✕ {error}
          </div>
        )}
        {success && (
          <div style={{ background: 'rgba(0,201,167,0.12)', border: '1px solid rgba(0,201,167,0.25)', borderRadius: '8px', padding: '10px 14px', color: 'var(--teal)', fontSize: '0.85rem', marginBottom: '16px' }}>
            ✓ {success}
          </div>
        )}

        {/* Submit */}
        <button
          className="btn btn-primary btn-full btn-lg"
          onClick={handleSubmit}
          disabled={loading}
          style={{ marginBottom: '16px' }}
        >
          {loading ? '⏳ Please wait…' : mode === 'login' ? 'Sign In →' : 'Send Reset Link →'}
        </button>

        {/* Toggle forgot / back */}
        <div style={{ textAlign: 'center' }}>
          {mode === 'login' ? (
            <button
              onClick={() => { setMode('forgot'); setError(''); setSuccess('') }}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8rem' }}
            >
              Forgot password?
            </button>
          ) : (
            <button
              onClick={() => { setMode('login'); setError(''); setSuccess('') }}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8rem' }}
            >
              ← Back to Sign In
            </button>
          )}
        </div>
      </div>

      <div style={{ marginTop: '24px', fontSize: '0.75rem', textAlign: 'center' }}>
        <a
          href="https://stellarforgetech.in"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'rgba(255,255,255,0.3)', textDecoration: 'none' }}
        >
          Powered by <span style={{ textDecoration: 'underline' }}>Stellar Forge</span>
        </a>
      </div>
      </section>
    </div>
  )
}
