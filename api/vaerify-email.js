export default async function handler(req, res) {

  if (req.method !== 'GET') return res.status(405).end();

  var SB_URL  = 'https://zuidgbvnyonyxzfsepox.supabase.co';
  var SB_KEY  = process.env.SUPABASE_KEY;
  var BASE_URL = process.env.BASE_URL || 'https://phiprep.com';

  if (!SB_KEY) return res.status(500).send('Server error');

  var token = req.query.token;
  var email = req.query.email;

  // validate inputs
  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    return res.redirect(BASE_URL + '/?verified=invalid');
  }
  if (!email || email.length > 200) {
    return res.redirect(BASE_URL + '/?verified=invalid');
  }

  var headers = {
    'Content-Type': 'application/json',
    'apikey': SB_KEY,
    'Authorization': 'Bearer ' + SB_KEY
  };

  try {
    // look up user by verify_token + email (both must match)
    var lookup = await fetch(
      SB_URL + '/rest/v1/waitlist?verify_token=eq.' + token +
      '&email=eq.' + encodeURIComponent(email) + '&select=*',
      { headers: headers }
    );
    var rows = await lookup.json();

    if (!rows || rows.length === 0) {
      // token not found or already used
      return res.redirect(BASE_URL + '/?verified=invalid');
    }

    var user = rows[0];

    if (user.email_verified) {
      // already verified — just redirect them to dashboard with their session
      return res.redirect(BASE_URL + '/?verified=already&session=' + encodeURIComponent(user.session_token));
    }

    // mark as verified, clear verify_token so link can't be reused
    var patch = await fetch(
      SB_URL + '/rest/v1/waitlist?verify_token=eq.' + token +
      '&email=eq.' + encodeURIComponent(email),
      {
        method: 'PATCH',
        headers: Object.assign({}, headers, { 'Prefer': 'return=minimal' }),
        body: JSON.stringify({
          email_verified: true,
          verify_token:   null  // invalidate the token after use
        })
      }
    );

    if (!patch.ok && patch.status !== 204) {
      console.error('Patch failed:', patch.status);
      return res.redirect(BASE_URL + '/?verified=error');
    }

    // redirect to frontend with session token so they land on dashboard
    return res.redirect(
      BASE_URL + '/?verified=success&session=' + encodeURIComponent(user.session_token)
    );

  } catch (err) {
    console.error('verify-email error:', err);
    return res.redirect(BASE_URL + '/?verified=error');
  }
}
