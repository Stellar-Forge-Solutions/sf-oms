// Sends transactional emails using Brevo (formerly Sendinblue) REST API v3.
// Requires environment secret: BREVO_API_KEY
// Optional environment variable/secret: BREVO_SENDER_EMAIL

export async function sendBrevoMail(env, { to, subject, html, fromName = 'Stellar Forge', replyTo }) {
  if (!env.BREVO_API_KEY) {
    throw new Error('BREVO_API_KEY is not configured on the server')
  }

  const senderEmail = env.BREVO_SENDER_EMAIL || env.GMAIL_SENDER || 'no-reply@stellarforge.in'

  const recipients = (Array.isArray(to) ? to : [to])
    .filter(Boolean)
    .map(email => ({ email: String(email).trim() }))

  if (recipients.length === 0) {
    throw new Error('No recipient email specified')
  }

  const payload = {
    sender: {
      name: fromName,
      email: senderEmail,
    },
    to: recipients,
    subject,
    htmlContent: html,
  }

  if (replyTo) {
    payload.replyTo = { email: String(replyTo).trim() }
  }

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': env.BREVO_API_KEY,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const errorBody = await res.text()
    console.error('Brevo API error:', res.status, errorBody)
    throw new Error(`Brevo send failed: ${res.status}`)
  }
}
