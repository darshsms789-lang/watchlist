export default async function handler(req, res) {
  const SB_URL = process.env.SB_URL;
  const SB_KEY = process.env.SUPABASE_KEY;
  const token = req.query.token;

  if (!token) return res.status(400).send('Invalid link');

  const headers = { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}`, 'Content-Type':'application/json' };

  try {
    const resp = await fetch(`${SB_URL}/rest/v1/waitlist?verification_token=eq.${token}`, { headers });
    const users = await resp.json();
    if (!users || users.length === 0) return res.status(404).send('Token invalid or expired');

    await fetch(`${SB_URL}/rest/v1/waitlist?verification_token=eq.${token}`, {
      method: 'PATCH',
      headers: { ...headers, 'Prefer':'return=minimal' },
      body: JSON.stringify({ verified: true })
    });

    return res.status(200).send('Email verified! You can now continue.');
  } catch(err) {
    console.error('verify-email error', err);
    return res.status(500).send('Server error');
  }
}
