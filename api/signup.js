import crypto from 'crypto';
import dns from 'dns';
import { promisify } from 'util';

var resolveMx = promisify(dns.resolveMx);

// Realistic base — makes total always look healthy
var WAITLIST_BASE = 847;

export default async function handler(req, res) {

  if (req.method !== 'POST') return res.status(405).end();

  var SB_URL     = 'https://zuidgbvnyonyxzfsepox.supabase.co';
  var SB_KEY     = process.env.SUPABASE_KEY;
  var RESEND_KEY = process.env.RESEND_API_KEY;
  var BASE_URL   = process.env.BASE_URL || 'https://phiprep.com'; // set this in Vercel env vars

  if (!SB_KEY) {
    return res.status(500).json({ status: 'error', message: 'Missing SUPABASE_KEY' });
  }

  var headers = {
    'Content-Type': 'application/json',
    'apikey': SB_KEY,
    'Authorization': 'Bearer ' + SB_KEY
  };

  var body = req.body;

  if (!body || !body.email) {
    return res.status(400).json({ status: 'error', message: 'No email' });
  }

  // strict email format check
  var emailRegex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(body.email)) {
    return res.status(400).json({ status: 'error', message: 'Invalid email format' });
  }

  // block spam patterns
  if (/\d{4,}/.test(body.email.split('@')[0])) {
    return res.status(400).json({ status: 'error', message: 'Invalid email' });
  }

  // check email domain has real MX records
  try {
    var domain = body.email.split('@')[1];
    var mx = await resolveMx(domain);
    if (!mx || mx.length === 0) {
      return res.status(400).json({ status: 'error', message: 'Email domain does not exist' });
    }
  } catch (e) {
    return res.status(400).json({ status: 'error', message: 'Email domain invalid' });
  }

  try {

    // check duplicate
    var check = await fetch(
      SB_URL + '/rest/v1/waitlist?email=eq.' + encodeURIComponent(body.email) + '&select=*',
      { headers: headers }
    );
    var existing = await check.json();

    if (existing && existing.length > 0) {
      var returnToken = crypto.randomBytes(32).toString('hex');
      await fetch(
        SB_URL + '/rest/v1/waitlist?email=eq.' + encodeURIComponent(body.email),
        {
          method: 'PATCH',
          headers: Object.assign({}, headers, { 'Prefer': 'return=minimal' }),
          body: JSON.stringify({ session_token: returnToken })
        }
      );

      var row = existing[0];
      // Fix total for returning users too
      var realTotal = WAITLIST_BASE + (parseInt(row.position) || 1000);

      return res.status(200).json({
        status:        'exists',
        session_token: returnToken,
        data:          Object.assign({}, row, { total: realTotal })
      });
    }

    // get total users for position
    var countRes = await fetch(
      SB_URL + '/rest/v1/counter?id=eq.total_users&select=value',
      { headers: headers }
    );
    var countData = await countRes.json();
    var totalUsers = (countData && countData[0]) ? parseInt(countData[0].value) : 0;

    var position = 1000 + totalUsers;
    if (body.referred_by && body.referred_by !== 'direct') {
      position = Math.max(1, position - 10); // fixed: referral = 10 spots, not 5
    }

    // total = real signups + base padding, always looks healthy
    var realTotal = WAITLIST_BASE + position;

    var sessionToken  = crypto.randomBytes(32).toString('hex');
    var verifyToken   = crypto.randomBytes(32).toString('hex');

    var insertData = {
      email:          body.email,
      exam:           body.exam        || '',
      ai_usage:       body.ai_usage    || '',
      problem:        body.problem     || '',
      position:       position,
      total:          realTotal,
      refs:           0,
      moved_up:       0,
      code:           body.code        || '',
      referred_by:    body.referred_by || 'direct',
      session_token:  sessionToken,
      verify_token:   verifyToken,
      email_verified: false
    };

    var insert = await fetch(SB_URL + '/rest/v1/waitlist', {
      method: 'POST',
      headers: Object.assign({}, headers, { 'Prefer': 'return=minimal' }),
      body: JSON.stringify(insertData)
    });

    if (insert.ok || insert.status === 201) {
      // increment counter
      await fetch(SB_URL + '/rest/v1/counter?id=eq.total_users', {
        method: 'PATCH',
        headers: Object.assign({}, headers, { 'Prefer': 'return=minimal' }),
        body: JSON.stringify({ value: totalUsers + 1 })
      });

      // send verification email via Resend (non-blocking — don't fail signup if this fails)
      if (RESEND_KEY) {
        var verifyUrl = BASE_URL + '/api/verify-email?token=' + verifyToken + '&email=' + encodeURIComponent(body.email);
        sendVerificationEmail(RESEND_KEY, body.email, verifyUrl, position, realTotal).catch(function(e) {
          console.error('Resend error (non-fatal):', e);
        });
      }

      return res.status(200).json({
        status:        'success',
        session_token: sessionToken,
        position:      position,
        total:         realTotal
      });

    } else {
      var errText = await insert.text();
      console.error('Insert error:', errText);
      return res.status(200).json({ status: 'error', message: 'Insert failed' });
    }

  } catch (err) {
    console.error('Signup error:', err);
    return res.status(200).json({ status: 'error', message: err.message });
  }
}

async function sendVerificationEmail(apiKey, toEmail, verifyUrl, position, total) {
  var html = [
    '<div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#ffffff;">',
    '  <div style="margin-bottom:28px;">',
    '    <span style="font-family:Georgia,serif;font-size:1.5rem;font-weight:700;color:#1a1a1a;">Phi</span>',
    '    <span style="font-family:Georgia,serif;font-size:1.5rem;font-weight:700;color:#2a5c3f;">Prep</span>',
    '  </div>',
    '  <h1 style="font-family:Georgia,serif;font-size:1.5rem;color:#1a1a1a;margin-bottom:8px;">You\'re on the list.</h1>',
    '  <p style="color:#6b6560;font-size:0.95rem;line-height:1.7;margin-bottom:8px;">',
    '    Your waitlist position: <strong style="color:#2a5c3f;">#' + position + '</strong> out of ' + total + ' people.',
    '  </p>',
    '  <p style="color:#6b6560;font-size:0.95rem;line-height:1.7;margin-bottom:28px;">',
    '    Confirm your email to lock in your spot and get your referral link.',
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

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + apiKey
    },
    body: JSON.stringify({
      from:    'PhiPrep <noreply@phiprep.com>', // change to your verified Resend domain
      to:      [toEmail],
      subject: 'Confirm your PhiPrep waitlist spot (#' + position + ')',
      html:    html
    })
  });
}
