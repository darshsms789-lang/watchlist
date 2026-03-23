export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  var SB_URL = 'https://zuidgbvnyonyxzfsepox.supabase.co';
  var SB_KEY = process.env.SUPABASE_KEY;

  var body = req.body;

  // check if email already exists
  var check = await fetch(
    SB_URL + '/rest/v1/waitlist?email=eq.' + encodeURIComponent(body.email) + '&select=*',
    { headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY } }
  );
  var existing = await check.json();

  if (existing && existing.length > 0) {
    return res.status(200).json({ status: 'exists', data: existing[0] });
  }

  // insert new user
  var insert = await fetch(SB_URL + '/rest/v1/waitlist', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SB_KEY,
      'Authorization': 'Bearer ' + SB_KEY,
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify(body)
  });

  if (insert.ok || insert.status === 201) {
    return res.status(200).json({ status: 'success' });
  } else {
    return res.status(500).json({ status: 'error' });
  }
}
