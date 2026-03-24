export default async function handler(req, res) {

  if (req.method !== 'POST') return res.status(405).end();

  var SB_URL = 'https://zuidgbvnyonyxzfsepox.supabase.co';
  var SB_KEY = process.env.SUPABASE_KEY;

  if (!SB_KEY) return res.status(200).json({ exists: false });

  var email = req.body && req.body.email;
  if (!email) return res.status(400).json({ exists: false });

  email = email.toLowerCase().trim();

  try {
    var response = await fetch(
      SB_URL + '/rest/v1/waitlist?email=eq.' + encodeURIComponent(email) + '&select=email',
      {
        headers: {
          'apikey': SB_KEY,
          'Authorization': 'Bearer ' + SB_KEY
        }
      }
    );
    var rows = await response.json();
    return res.status(200).json({ exists: rows && rows.length > 0 });
  } catch (e) {
    console.error('checkduplicate error:', e);
    return res.status(200).json({ exists: false });
  }
}
