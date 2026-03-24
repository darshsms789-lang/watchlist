import crypto from 'crypto';
import dns from 'dns';
import { promisify } from 'util';

var resolveMx = promisify(dns.resolveMx);

export default async function handler(req, res) {

  if (req.method !== 'POST') return res.status(405).end();

  var SB_URL = 'https://zuidgbvnyonyxzfsepox.supabase.co';
  var SB_KEY = process.env.SUPABASE_KEY;

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
      return res.status(200).json({
        status:        'exists',
        session_token: returnToken,
        data:          existing[0]
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
      position = Math.max(1000, position - 5);
    }

    var sessionToken = crypto.randomBytes(32).toString('hex');

    var insertData = {
      email:         body.email,
      exam:          body.exam        || '',
      ai_usage:      body.ai_usage    || '',
      problem:       body.problem     || '',
      position:      position,
      total:         position + 500,
      refs:          0,
      moved_up:      0,
      code:          body.code        || '',
      referred_by:   body.referred_by || 'direct',
      session_token: sessionToken
    };

    var insert = await fetch(SB_URL + '/rest/v1/waitlist', {
      method: 'POST',
      headers: Object.assign({}, headers, { 'Prefer': 'return=minimal' }),
      body: JSON.stringify(insertData)
    });

    if (insert.ok || insert.status === 201) {
      await fetch(SB_URL + '/rest/v1/counter?id=eq.total_users', {
        method: 'PATCH',
        headers: Object.assign({}, headers, { 'Prefer': 'return=minimal' }),
        body: JSON.stringify({ value: totalUsers + 1 })
      });

      return res.status(200).json({
        status:        'success',
        session_token: sessionToken,
        position:      position,
        total:         position + 500
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
