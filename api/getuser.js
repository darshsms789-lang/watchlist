export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const SB_URL = 'https://zuidgbvnyonyxzfsepox.supabase.co';
  const SB_KEY = process.env.SUPABASE_KEY;
  if (!SB_KEY) return res.status(500).json({ status: 'error', message: 'Server misconfigured' });

  const headers = { 'Content-Type': 'application/json', 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}` };
  const { session_token } = req.body;

  if (!session_token) return res.status(400).json({ status: 'error', message: 'No session token' });

  try {
    const resUser = await fetch(`${SB_URL}/rest/v1/waitlist?session_token=eq.${encodeURIComponent(session_token)}&select=*`, { headers });
    const rows = await resUser.json();
    if (!rows || rows.length === 0) return res.status(200).json({ status: 'not found', data: null });

    const user = rows[0];
    delete user.session_token;

    // Dynamic position
    const waitlistRes = await fetch(`${SB_URL}/rest/v1/waitlist?select=email,position&order=created_at.asc`, { headers });
    const waitlist = await waitlistRes.json();
    const dynamicPosition = waitlist.findIndex(u => u.email === user.email) + 1 || user.position;
    user.position = dynamicPosition;

    return res.status(200).json({ status: 'found', data: user });

  } catch (err) {
    console.error('getuser error:', err);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
}
