import { Link } from 'react-router-dom'
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import LoginShowcase from '../components/LoginShowcase'

export default function LoginPage() {
  const [mode, setMode] = useState('login') // 'login' | 'forgot_email' | 'forgot_otp'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSubmit = async () => {
    setError('')
    setSuccess('')
    const cleanEmail = email.trim().toLowerCase()

    if (!cleanEmail) return setError('Please enter your email')

    if (mode === 'login') {
      if (!password) return setError('Please enter your password')
      setLoading(true)
      const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password })
      if (error) setError(error.message)
      setLoading(false)
      return
    }

    if (mode === 'forgot_email') {
      setLoading(true)
      try {
        const res = await fetch('/api/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'request', email: cleanEmail }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to send reset code')
        setSuccess(data.message || 'Verification code sent to your email.')
        setMode('forgot_otp')
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
      return
    }

    if (mode === 'forgot_otp') {
      if (!otp.trim() || otp.trim().length !== 6) return setError('Enter the 6-digit code received on your email')
      if (!newPassword || newPassword.length < 6) return setError('Password must be at least 6 characters')

      setLoading(true)
      try {
        const res = await fetch('/api/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'verify_and_update', email: cleanEmail, otp: otp.trim(), newPassword }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to reset password')
        setSuccess('Password updated successfully! Signing you in…')
        // Automatically sign in with the new password
        const { error: loginErr } = await supabase.auth.signInWithPassword({ email: cleanEmail, password: newPassword })
        if (loginErr) {
          setSuccess('Password updated! Please enter your new password to sign in.')
          setMode('login')
          setPassword('')
        }
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
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
        {mode.startsWith('forgot') && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{ color: 'var(--white)', fontWeight: 700, fontSize: '1.1rem', marginBottom: '4px' }}>Reset Password</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}>
              {mode === 'forgot_email' ? "Enter your email to receive a 6-digit verification code" : "Enter the code sent to your email and your new password"}
            </div>
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
            disabled={mode === 'forgot_otp'}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            style={{ ...darkInput, opacity: mode === 'forgot_otp' ? 0.7 : 1 }}
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
              style={darkInput}
            />
          </div>
        )}

        {/* OTP and New Password — only on forgot_otp */}
        {mode === 'forgot_otp' && (
          <>
            <div className="form-group">
              <label className="form-label" style={{ color: 'rgba(255,255,255,0.45)' }}>6-Digit Verification Code</label>
              <input
                className="form-input"
                type="text"
                maxLength={6}
                inputMode="numeric"
                placeholder="123456"
                value={otp}
                onChange={e => setOtp(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                style={{ ...darkInput, letterSpacing: '0.25em', fontSize: '1.15rem', textAlign: 'center', fontWeight: 700 }}
                autoFocus
              />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ color: 'rgba(255,255,255,0.45)' }}>New Password (min 6 characters)</label>
              <input
                className="form-input"
                type="password"
                placeholder="••••••••"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                style={darkInput}
              />
            </div>
          </>
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
          {loading
            ? '⏳ Please wait…'
            : mode === 'login'
              ? 'Sign In →'
              : mode === 'forgot_email'
                ? 'Send Verification Code →'
                : 'Update Password & Sign In →'}
        </button>

        {/* Toggle forgot / back */}
        <div style={{ textAlign: 'center' }}>
          {mode === 'login' ? (
            <button
              onClick={() => { setMode('forgot_email'); setError(''); setSuccess('') }}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8rem' }}
            >
              Forgot password?
            </button>
          ) : mode === 'forgot_otp' ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <button
                onClick={() => { setMode('forgot_email'); setOtp(''); setNewPassword(''); setError(''); setSuccess('') }}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8rem' }}
              >
                Resend code
              </button>
              <button
                onClick={() => { setMode('login'); setError(''); setSuccess('') }}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8rem' }}
              >
                Back to Sign In
              </button>
            </div>
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
