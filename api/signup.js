export default async function handler(req, res) {

  if (req.method !== 'POST') {
    return res.status(405).end();
  }

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

  // basic email check
  if (!body || !body.email) {
    return res.status(400).json({ status: 'error', message: 'No email provided' });
  }

  try {

    // check duplicate email
    var check = await fetch(
      SB_URL + '/rest/v1/waitlist?email=eq.' + encodeURIComponent(body.email) + '&select=*',
      { headers: headers }
    );
    var existing = await check.json();

    if (existing && existing.length > 0) {
      return res.status(200).json({ status: 'exists', data: existing[0] });
    }

    // get total users count for position
    var countRes = await fetch(
      SB_URL + '/rest/v1/counter?id=eq.total_users&select=value',
      { headers: headers }
    );
    var countData = await countRes.json();
    var totalUsers = (countData && countData[0]) ? parseInt(countData[0].value) : 0;

    // position = 1000 + total users
    var position = 1000 + totalUsers;

    // small boost if referred
    if (body.referred_by && body.referred_by !== 'direct') {
      position = Math.max(1000, position - 5);
    }

    // insert new user
    var insertData = {
      email:       body.email,
      exam:        body.exam       || '',
      ai_usage:    body.ai_usage   || '',
      problem:     body.problem    || '',
      position:    position,
      total:       position + 500,
      refs:        0,
      moved_up:    0,
      code:        body.code       || '',
      referred_by: body.referred_by || 'direct'
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

      return res.status(200).json({
        status:   'success',
        position: position,
        total:    position + 500
      });

    } else {
      var errText = await insert.text();
      console.error('Supabase insert error:', errText);
      return res.status(200).json({ status: 'error', message: errText });
    }

  } catch (err) {
    console.error('Signup error:', err);
    return res.status(200).json({ status: 'error', message: err.message });
  }

}
