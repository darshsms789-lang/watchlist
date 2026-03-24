import crypto from 'crypto';

var WAITLIST_BASE = 847;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  var SB_URL     = 'https://zuidgbvnyonyxzfsepox.supabase.co';
  var SB_KEY     = process.env.SUPABASE_KEY;

  if (!SB_KEY) return res.status(500).json({ status: 'error', message: 'Missing API Key' });

  var headers = {
    'Content-Type': 'application/json',
    'apikey': SB_KEY,
    'Authorization': 'Bearer ' + SB_KEY
  };

  var body = req.body;
  if (!body || !body.email) return res.status(400).json({ status: 'error', message: 'No email' });

  try {
    // 1. Check for existing user
    var check = await fetch(SB_URL + '/rest/v1/waitlist?email=eq.' + encodeURIComponent(body.email) + '&select=*', { headers });
    var existing = await check.json();

    if (existing && existing.length > 0) {
      return res.status(200).json({
        status: 'exists',
        session_token: existing[0].session_token, // Critical for persistence
        data: Object.assign({}, existing[0], { total: WAITLIST_BASE + (parseInt(existing[0].position) || 1000) })
      });
    }

    // 2. Get current counter
    var countRes = await fetch(SB_URL + '/rest/v1/counter?id=eq.total_users&select=value', { headers });
    var countData = await countRes.json();
    var totalUsers = (countData && countData[0]) ? parseInt(countData[0].value) : 0;

    // 3. Calculate Position
    var position = 1000 + totalUsers;
    var sessionToken = crypto.randomBytes(32).toString('hex');
    var userCode = body.code || ('PHI' + Math.floor(Math.random()*9000));

    // 4. Insert New User
    var insertData = {
      email: body.email,
      exam: body.exam || '',
      ai_usage: body.ai_usage || '',
      problem: body.problem || '',
      position: position,
      total: WAITLIST_BASE + position,
      refs: 0,
      moved_up: 0,
      code: userCode,
      referred_by: body.referred_by || 'direct',
      session_token: sessionToken,
      email_verified: true
    };

    var insert = await fetch(SB_URL + '/rest/v1/waitlist', {
      method: 'POST',
      headers: Object.assign({}, headers, { 'Prefer': 'return=minimal' }),
      body: JSON.stringify(insertData)
    });

    if (insert.ok || insert.status === 201) {
      // A. Increment Global Counter
      await fetch(SB_URL + '/rest/v1/counter?id=eq.total_users', {
        method: 'PATCH',
        headers: headers,
        body: JSON.stringify({ value: totalUsers + 1 })
      });

      // B. THE REFERRAL TRIGGER: Move the referrer up 10 spots
      if (body.referred_by && body.referred_by !== 'direct') {
        await fetch(SB_URL + '/rest/v1/rpc/increment_referral', {
          method: 'POST',
          headers: headers,
          body: JSON.stringify({ user_code: body.referred_by })
        }).catch(e => console.error("Referral RPC failed", e));
      }

      return res.status(200).json({
        status: 'success',
        session_token: sessionToken,
        position: position,
        total: WAITLIST_BASE + position
      });
    }
    return res.status(500).json({ status: 'error', message: 'DB Write Failed' });

  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
}
