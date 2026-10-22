// Password reset API using Gmail API + Supabase Auth admin
import { admin, json, readJson, hmacHex } from '../_shared/common.js'
import { sendMail } from '../_shared/gmail.js'

function generateOTP() {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return String(100000 + (buf[0] % 900000)) // 6-digit number string
}

export async function onRequestPost({ request, env }) {
  const body = await readJson(request)
  const action = body.action || 'request'
  const email = String(body.email || '').trim().toLowerCase()

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return json({ error: 'Please enter a valid email address.' }, 400)
  }

  const sb = admin(env)

  // ─────────────────────────────────────────────────────────────
  // 1. ACTION: REQUEST RESET OTP
  // ─────────────────────────────────────────────────────────────
  if (action === 'request') {
    // Look up user by email in Supabase auth
    const { data: userData, error: userErr } = await sb.auth.admin.listUsers()
    if (userErr) {
      console.error('List users error:', userErr)
      return json({ error: 'Unable to process request.' }, 500)
    }

    const user = (userData?.users || []).find(u => u.email?.toLowerCase() === email)
    if (!user) {
      // Don't leak whether an account exists, or return friendly generic message
      return json({ ok: true, message: 'If an account exists with this email, you will receive a reset code shortly.' })
    }

    const otp = generateOTP()
    const secret = env.SUPABASE_SERVICE_ROLE_KEY || 'sf-reset-secret'
    const otpHash = await hmacHex(secret, `${email}:${otp}`)
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString() // 15 mins

    // Save to password_reset_tokens table (create table on the fly if not exists via RPC / insert)
    try {
      await sb.from('password_reset_tokens').insert({
        email,
        otp_hash: otpHash,
        expires_at: expiresAt,
        used: false,
      })
    } catch (dbErr) {
      console.warn('Could not save to password_reset_tokens table:', dbErr)
    }

    // Send email via Gmail API
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; color: #1e293b; line-height: 1.6;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #0f172a; margin: 0 0 4px;">Stellar Forge Orders</h2>
          <p style="color: #64748b; font-size: 0.9rem; margin: 0;">Password Reset Request</p>
        </div>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; text-align: center;">
          <p style="margin: 0 0 12px; font-size: 0.95rem; color: #334155;">
            Use the following 6-digit verification code to reset your password:
          </p>
          <div style="font-size: 2.2rem; font-weight: 800; letter-spacing: 0.25em; color: #00a88c; margin: 16px 0; font-family: monospace;">
            ${otp}
          </div>
          <p style="margin: 0; font-size: 0.8rem; color: #64748b;">
            This code expires in <b>15 minutes</b> and can only be used once.
          </p>
        </div>
        <p style="font-size: 0.82rem; color: #94a3b8; margin-top: 24px; text-align: center;">
          If you didn't request a password reset, you can safely ignore this email.
        </p>
      </div>
    `

    try {
      await sendMail(env, {
        to: email,
        subject: `Your Stellar Forge password reset code: ${otp}`,
        html,
        fromName: 'Stellar Forge Orders',
      })
    } catch (mailErr) {
      console.error('Failed to send reset email via Gmail:', mailErr)
      return json({ error: 'Failed to send reset email. Please try again later.' }, 502)
    }

    return json({ ok: true, message: 'Verification code sent to your email.' })
  }

  // ─────────────────────────────────────────────────────────────
  // 2. ACTION: VERIFY OTP AND UPDATE PASSWORD
  // ─────────────────────────────────────────────────────────────
  if (action === 'verify_and_update') {
    const otp = String(body.otp || '').trim()
    const newPassword = String(body.newPassword || '')

    if (!otp || otp.length !== 6) {
      return json({ error: 'Please enter the 6-digit verification code.' }, 400)
    }
    if (!newPassword || newPassword.length < 6) {
      return json({ error: 'Password must be at least 6 characters long.' }, 400)
    }

    const secret = env.SUPABASE_SERVICE_ROLE_KEY || 'sf-reset-secret'
    const expectedHash = await hmacHex(secret, `${email}:${otp}`)

    // Query password_reset_tokens
    const { data: tokens, error: tokenErr } = await sb
      .from('password_reset_tokens')
      .select('id, expires_at, used, otp_hash')
      .eq('email', email)
      .eq('used', false)
      .order('created_at', { ascending: false })
      .limit(5)

    let validTokenId = null
    if (!tokenErr && tokens?.length) {
      const match = tokens.find(t => t.otp_hash === expectedHash && new Date(t.expires_at) > new Date())
      if (match) validTokenId = match.id
    }

    if (!validTokenId) {
      return json({ error: 'Invalid or expired verification code. Please request a new one.' }, 400)
    }

    // Find the user ID
    const { data: userData } = await sb.auth.admin.listUsers()
    const user = (userData?.users || []).find(u => u.email?.toLowerCase() === email)
    if (!user) {
      return json({ error: 'User account not found.' }, 404)
    }

    // Update user password
    const { error: updateErr } = await sb.auth.admin.updateUserById(user.id, {
      password: newPassword,
    })

    if (updateErr) {
      return json({ error: updateErr.message || 'Failed to update password.' }, 500)
    }

    // Mark token as used
    await sb.from('password_reset_tokens').update({ used: true }).eq('id', validTokenId)

    return json({ ok: true, message: 'Password has been updated successfully. You can now sign in.' })
  }

  return json({ error: 'Invalid action' }, 400)
}
