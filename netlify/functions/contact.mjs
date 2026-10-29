/**
 * Seattle Emergency Hubs – Contact form endpoint
 *
 * POST /api/contact with JSON { name, email, subject, message, token, website }.
 * Verifies the Cloudflare Turnstile token, then emails the message through
 * Resend's HTTP API. No npm dependencies: Netlify's Node runtime has fetch.
 *
 * Environment variables (set in Netlify → Site configuration → Environment):
 *   TURNSTILE_SECRET_KEY  Turnstile widget's secret key
 *   RESEND_API_KEY        Resend API key with "sending" access
 *   CONTACT_TO_EMAIL      Where messages are delivered (comma-separate several)
 *   CONTACT_FROM_EMAIL    Sender on a domain verified in Resend,
 *                         e.g. "SEH Website <contact@seattleemergencyhubs.org>"
 */

const LIMITS = { name: 100, email: 254, subject: 150, message: 5000 };

// Deliberately loose: the real check is whether a reply reaches them.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

async function verifyTurnstile(token, ip) {
  const form = new URLSearchParams({ secret: process.env.TURNSTILE_SECRET_KEY, response: token });
  if (ip) form.set('remoteip', ip);

  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: form,
  });
  if (!res.ok) return false;
  const outcome = await res.json();
  return outcome.success === true;
}

async function sendEmail({ name, email, subject, message }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.CONTACT_FROM_EMAIL,
      to: process.env.CONTACT_TO_EMAIL.split(',').map((s) => s.trim()).filter(Boolean),
      reply_to: `${name.replace(/[<>"]/g, '')} <${email}>`,
      subject: `[Website contact] ${subject}`,
      text: `From: ${name} <${email}>\nSubject: ${subject}\n\n${message}\n`,
    }),
  });
  if (!res.ok) {
    console.error('Resend rejected the message:', res.status, await res.text());
    return false;
  }
  return true;
}

export default async (req, context) => {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed.' });

  const missingConfig = ['TURNSTILE_SECRET_KEY', 'RESEND_API_KEY', 'CONTACT_TO_EMAIL', 'CONTACT_FROM_EMAIL']
    .filter((key) => !process.env[key]);
  if (missingConfig.length) {
    console.error('Contact form is missing configuration:', missingConfig.join(', '));
    return json(500, { error: 'The contact form is not configured yet. Please try again later.' });
  }

  let body;
  try {
    body = await req.json();
  } catch (e) {
    return json(400, { error: 'Invalid request.' });
  }

  // Honeypot: a field hidden from people that bots fill in. Pretend it worked.
  if (body.website) return json(200, { ok: true });

  // Collapse line breaks in single-line fields so nothing can smuggle extra
  // lines into the subject or the reply-to address.
  const oneLine = (value) => String(value ?? '').replace(/[\r\n]+/g, ' ').trim();
  const fields = {
    name: oneLine(body.name),
    email: oneLine(body.email),
    subject: oneLine(body.subject),
    message: String(body.message ?? '').trim(),
  };

  for (const [key, value] of Object.entries(fields)) {
    if (!value) return json(400, { error: `Please fill in the ${key} field.` });
    if (value.length > LIMITS[key]) {
      return json(400, { error: `The ${key} field is too long (max ${LIMITS[key]} characters).` });
    }
  }
  if (!EMAIL_PATTERN.test(fields.email)) {
    return json(400, { error: 'Please enter a valid email address.' });
  }

  if (!body.token || !(await verifyTurnstile(body.token, context.ip))) {
    return json(400, { error: 'The spam check failed or expired. Please try it again.' });
  }

  if (!(await sendEmail(fields))) {
    return json(502, { error: 'Your message could not be sent. Please try again later.' });
  }

  return json(200, { ok: true });
};

export const config = { path: '/api/contact' };
