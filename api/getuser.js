export default async function handler(req, res) {

  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  var SB_URL = 'https://zuidgbvnyonyxzfsepox.supabase.co';
  var SB_KEY = process.env.SUPABASE_KEY;

  if (!SB_KEY) {
    return res.status(500).json({ status: 'error', message: 'Missing SUPABASE_KEY env var' });
  }

  var email = req.body.email;

  if (!email) {
    return res.status(400).json({ status: 'error', message: 'No email' });
  }

  try {
    var response = await fetch(
      SB_URL + '/rest/v1/waitlist?email=eq.' + encodeURIComponent(email) + '&select=*',
      {
        headers: {
          'apikey': SB_KEY,
          'Authorization': 'Bearer ' + SB_KEY
        }
      }
    );

    var rows = await response.json();

    if (rows && rows.length > 0) {
      return res.status(200).json({ status: 'found', data: rows[0] });
    }

    return res.status(200).json({ status: 'not found', data: null });

  } catch (err) {
    console.error('getuser error:', err);
    return res.status(500).json({ status: 'error' });
  }

}
