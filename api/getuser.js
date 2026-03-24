export default async function handler(req, res) {

  if (req.method !== 'POST') return res.status(405).end();

  var SB_URL = 'https://zuidgbvnyonyxzfsepox.supabase.co';
  var SB_KEY = process.env.SUPABASE_KEY;

  if (!SB_KEY) {
    return res.status(500).json({ status: 'error' });
  }

  var headers = {
    'apikey': SB_KEY,
    'Authorization': 'Bearer ' + SB_KEY
  };

  var sessionToken = req.body.session_token;

  if (!sessionToken) {
    return res.status(400).json({ status: 'error', message: 'No session token' });
  }

  try {
    var response = await fetch(
      SB_URL + '/rest/v1/waitlist?session_token=eq.' + sessionToken + '&select=*',
      { headers: headers }
    );

    var rows = await response.json();

    if (rows && rows.length > 0) {
      var row = rows[0];
      delete row.session_token;
      return res.status(200).json({ status: 'found', data: row });
    }

    return res.status(200).json({ status: 'not found', data: null });

  } catch (err) {
    console.error('getuser error:', err);
    return res.status(500).json({ status: 'error' });
  }
}
