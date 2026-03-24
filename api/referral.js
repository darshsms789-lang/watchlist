export default async function handler(req, res) {

  if (req.method !== 'POST') return res.status(405).end();

  var SB_URL = 'https://zuidgbvnyonyxzfsepox.supabase.co';
  var SB_KEY = process.env.SUPABASE_KEY;
  if (!SB_KEY) return res.status(500).json({ status: 'error' });

  var headers = {
    'Content-Type': 'application/json',
    'apikey': SB_KEY,
    'Authorization': 'Bearer ' + SB_KEY
  };

  var code = req.body && req.body.code;
  if (!code || !/^[a-zA-Z0-9]{6,30}$/.test(code)) {
    return res.status(400).json({ status: 'invalid code' });
  }

  try {
    var get = await fetch(
      SB_URL + '/rest/v1/waitlist?code=eq.' + code + '&select=*',
      { headers: headers }
    );
    var rows = await get.json();

    if (!rows || rows.length === 0) {
      return res.status(200).json({ status: 'not found' });
    }

    var ref      = rows[0];
    var newRefs  = (parseInt(ref.refs)     || 0) + 1;
    var newPos   = Math.max(1, (parseInt(ref.position) || 1000) - 10); // 1 referral = 10 spots
    var newMoved = (parseInt(ref.moved_up) || 0) + 10;

    await fetch(SB_URL + '/rest/v1/waitlist?code=eq.' + code, {
      method: 'PATCH',
      headers: Object.assign({}, headers, { 'Prefer': 'return=minimal' }),
      body: JSON.stringify({
        refs:     newRefs,
        position: newPos,
        moved_up: newMoved
      })
    });

    return res.status(200).json({ status: 'credited', newPosition: newPos });

  } catch (err) {
    console.error('Referral error:', err);
    return res.status(500).json({ status: 'error' });
  }
}
