import { env } from '../config/env.js';

// Sends transactional email via Brevo's HTTP API (no SMTP, works on serverless).
// If Brevo isn't configured, it no-ops gracefully (returns { skipped: true })
// so the app keeps working in local/dev without keys.
export async function sendEmail({ to, toName, subject, html, text }) {
  if (!env.BREVO_API_KEY || !env.BREVO_SENDER_EMAIL) {
    console.warn('[email] Brevo not configured — skipping send to', to);
    return { skipped: true };
  }

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': env.BREVO_API_KEY,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { email: env.BREVO_SENDER_EMAIL, name: env.BREVO_SENDER_NAME },
      to: [{ email: to, name: toName || to }],
      subject,
      htmlContent: html,
      ...(text ? { textContent: text } : {}),
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Brevo send failed (${res.status}): ${detail}`);
  }
  return { ok: true, messageId: (await res.json().catch(() => ({}))).messageId };
}

// Escape user-supplied text (names, item titles) before putting it into email
// HTML, so nobody can inject links or markup into emails sent to other users.
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Simple branded wrapper so all emails look consistent.
export function brandedEmail(title, bodyHtml) {
  return `
  <div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;color:#1c1b1a">
    <div style="background:#e2622c;color:#fff;padding:16px 20px;border-radius:14px 14px 0 0">
      <strong style="font-size:18px">FoundIt · SMVDU</strong>
    </div>
    <div style="border:1px solid #eee;border-top:none;border-radius:0 0 14px 14px;padding:20px">
      <h2 style="margin:0 0 12px;font-size:18px">${title}</h2>
      ${bodyHtml}
      <p style="color:#8a857d;font-size:12px;margin-top:24px">
        FoundIt — Smart Campus Lost &amp; Found for SMVDU.
      </p>
    </div>
  </div>`;
}
