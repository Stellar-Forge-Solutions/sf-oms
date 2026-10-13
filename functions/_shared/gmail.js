// Sends mail through the Gmail API using an OAuth refresh token (scope: gmail.send only).
// Env (secrets): GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, GMAIL_SENDER
import { b64, b64url } from './common.js'
let cached = { token: null, exp: 0 }

async function accessToken(env) {
  if (cached.token && Date.now() < cached.exp - 60_000) return cached.token
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: env.GMAIL_CLIENT_ID, client_secret: env.GMAIL_CLIENT_SECRET, refresh_token: env.GMAIL_REFRESH_TOKEN, grant_type: 'refresh_token' }),
  })
  const j = await r.json()
  if (!r.ok) throw new Error('Gmail token refresh failed: ' + (j.error || r.status))
  cached = { token: j.access_token, exp: Date.now() + j.expires_in * 1000 }
  return cached.token
}

const clean = (s) => String(s).replace(/[\r\n]+/g, ' ')   // block header injection

export async function sendMail(env, { to, subject, html, fromName = 'Stellar Forge', replyTo }) {
  const recipients = [].concat(to).map(clean).join(', ')
  const mime = [
    `From: =?UTF-8?B?${b64(clean(fromName))}?= <${clean(env.GMAIL_SENDER)}>`,
    ...(replyTo ? [`Reply-To: ${clean(replyTo)}`] : []),
    `To: ${recipients}`,
    `Subject: =?UTF-8?B?${b64(clean(subject))}?=`,
    'MIME-Version: 1.0', 'Content-Type: text/html; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', b64(html),
  ].join('\r\n')
  const r = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST', headers: { Authorization: `Bearer ${await accessToken(env)}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw: b64url(mime) }),
  })
  if (!r.ok) throw new Error('Gmail send failed: ' + r.status)
}
