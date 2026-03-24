import crypto from 'crypto';

export default async function handler(req, res) {

  if (req.method !== 'POST') return res.status(405).end();

  var SB_URL     = 'https://zuidgbvnyonyxzfsepox.supabase.co';
  var SB_KEY     = process.env.SUPABASE_KEY;
  var RESEND_KEY = process.env.RESEND_API_KEY;
  var BASE_URL   = process.env.BASE_URL || 'https://phiprep.com';

  if (!SB_KEY)     return res.status(500).json({ status: 'error', message: 'Missing SUPABASE_KEY' });
  if (!RESEND_KEY) return res.status(500).json({ status: 'error', message: 'Missing RESEND_API_KEY' });

  var email = req.body && req.body.email;

  // validate
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ status: 'error', message: 'No email provided' });
  }
  email = email.toLowerCase().trim().slice(0, 200);
  if (!/^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(email)) {
    return res.status(400).json({ status: 'error', message: 'Invalid email' });
  }

  var headers = {
    'Content-Type': 'application/json',
    'apikey': SB_KEY,
    'Authorization': 'Bearer ' + SB_KEY
  };

  try {
    // look up user
    var lookup = await fetch(
      SB_URL + '/rest/v1/waitlist?email=eq.' + encodeURIComponent(email) + '&select=*',
      { headers: headers }
    );
    var rows = await lookup.json();

    if (!rows || rows.length === 0) {
      // don't reveal whether email exists — just return ok
      return res.status(200).json({ status: 'ok' });
    }

    var user = rows[0];

    // already verified — no need to resend
    if (user.email_verified) {
      return res.status(200).json({ status: 'already_verified' });
    }

    // generate a fresh verify token
    var newToken = crypto.randomBytes(32).toString('hex');

    // update token in db
    await fetch(
      SB_URL + '/rest/v1/waitlist?email=eq.' + encodeURIComponent(email),
      {
        method: 'PATCH',
        headers: Object.assign({}, headers, { 'Prefer': 'return=minimal' }),
        body: JSON.stringify({ verify_token: newToken })
      }
    );

    // send fresh email
    var verifyUrl = BASE_URL + '/api/verify-email?token=' + newToken + '&email=' + encodeURIComponent(email);
    await sendVerificationEmail(RESEND_KEY, email, verifyUrl, user.position, user.total);

    return res.status(200).json({ status: 'sent' });

  } catch (err) {
    console.error('resend-verify error:', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
}

async function sendVerificationEmail(apiKey, toEmail, verifyUrl, position, total) {
  var html = [
    '<div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#ffffff;">',
    '  <div style="margin-bottom:28px;">',
    '    <span style="font-family:Georgia,serif;font-size:1.5rem;font-weight:700;color:#1a1a1a;">Phi</span>',
    '    <span style="font-family:Georgia,serif;font-size:1.5rem;font-weight:700;color:#2a5c3f;">Prep</span>',
    '  </div>',
    '  <h1 style="font-family:Georgia,serif;font-size:1.4rem;color:#1a1a1a;margin-bottom:8px;">Here\'s your new confirmation link.</h1>',
    '  <p style="color:#6b6560;font-size:0.95rem;line-height:1.7;margin-bottom:8px;">',
    '    Your waitlist position: <strong style="color:#2a5c3f;">#' + (position || '—') + '</strong> out of ' + (total || '—') + ' people.',
    '  </p>',
    '  <p style="color:#6b6560;font-size:0.95rem;line-height:1.7;margin-bottom:28px;">',
    '    Click below to confirm your email and lock in your spot.',
    '  </p>',
    '  <a href="' + verifyUrl + '" style="display:inline-block;background:#2a5c3f;color:#ffffff;font-size:0.9rem;font-weight:600;padding:13px 28px;border-radius:3px;text-decoration:none;letter-spacing:0.02em;">',
    '    Confirm my spot →',
    '  </a>',
    '  <p style="margin-top:28px;font-size:0.78rem;color:#9e9892;line-height:1.6;">',
    '    This link expires in 48 hours. If you didn\'t sign up for PhiPrep, ignore this email.',
    '  </p>',
    '  <hr style="border:none;border-top:1px solid #e8e4de;margin:24px 0;"/>',
    '  <p style="font-size:0.75rem;color:#b0aba4;">',
    '    Every friend you refer moves you up 10 spots.',
    '  </p>',
    '</div>'
  ].join('\n');

  var response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + apiKey
    },
    body: JSON.stringify({
      from:    'PhiPrep <noreply@phiprep.com>', // update to your verified Resend domain
      to:      [toEmail],
      subject: 'Your new PhiPrep confirmation link',
      html:    html
    })
  });

  if (!response.ok) {
    var errText = await response.text();
    throw new Error('Resend API error: ' + errText);
  }
}
