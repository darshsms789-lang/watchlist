import crypto from 'crypto';

var WAITLIST_BASE = 847;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  var SB_URL     = 'https://zuidgbvnyonyxzfsepox.supabase.co';
  var SB_KEY     = process.env.SUPABASE_KEY;
  // Note: Removed DNS and Resend logic to ensure it NEVER hangs or fails

  if (!SB_KEY) {
    return res.status(500).json({ status: 'error', message: 'Missing API Key' });
  }

  var headers = {
    'Content-Type': 'application/json',
    'apikey': SB_KEY,
    'Authorization': 'Bearer ' + SB_KEY
  };

  var body = req.body;
  if (!body || !body.email) return res.status(400).json({ status: 'error', message: 'No email' });

  try {
    // 1. Check for existing user
    var check = await fetch(
      SB_URL + '/rest/v1/waitlist?email=eq.' + encodeURIComponent(body.email) + '&select=*',
      { headers: headers }
    );
    var existing = await check.json();

    if (existing && existing.length > 0) {
      var row = existing[0];
      return res.status(200).json({
        status: 'exists',
        session_token: row.session_token,
        data: Object.assign({}, row, { total: WAITLIST_BASE + (parseInt(row.position) || 1000) })
      });
    }

    // 2. Get current counter
    var countRes = await fetch(SB_URL + '/rest/v1/counter?id=eq.total_users&select=value', { headers: headers });
    var countData = await countRes.json();
    var totalUsers = (countData && countData[0]) ? parseInt(countData[0].value) : 0;

    // 3. Calculate Position
    var position = 1000 + totalUsers;
    if (body.referred_by && body.referred_by !== 'direct') {
      position = Math.max(1, position - 10);
    }
    var realTotal = WAITLIST_BASE + position;
    var sessionToken = crypto.randomBytes(32).toString('hex');

    // 4. Insert into Supabase (Set email_verified to TRUE immediately)
    var insertData = {
      email:          body.email,
      exam:           body.exam        || '',
      ai_usage:       body.ai_usage    || '',
      problem:        body.problem     || '',
      position:       position,
      total:          realTotal,
      refs:           0,
      moved_up:       0,
      code:           body.code        || ('PHI' + Math.floor(Math.random()*9000)),
      referred_by:    body.referred_by || 'direct',
      session_token:  sessionToken,
      email_verified: true // SET TO TRUE AUTOMATICALLY
    };

    var insert = await fetch(SB_URL + '/rest/v1/waitlist', {
      method: 'POST',
      headers: Object.assign({}, headers, { 'Prefer': 'return=minimal' }),
      body: JSON.stringify(insertData)
    });

    if (insert.ok || insert.status === 201) {
      // Update the counter
      await fetch(SB_URL + '/rest/v1/counter?id=eq.total_users', {
        method: 'PATCH',
        headers: Object.assign({}, headers, { 'Prefer': 'return=minimal' }),
        body: JSON.stringify({ value: totalUsers + 1 })
      });

      return res.status(200).json({
        status:        'success',
        session_token: sessionToken,
        position:      position,
        total:         realTotal
      });
    } else {
      return res.status(500).json({ status: 'error', message: 'Database Write Failed' });
    }

  } catch (err) {
    console.error('Signup error:', err);
    return res.status(500).json({ status: 'error', message: 'Server Error' });
  }
}
