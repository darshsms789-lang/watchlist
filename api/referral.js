export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const SB_URL = 'https://zuidgbvnyonyxzfsepox.supabase.co';
  const SB_KEY = process.env.SUPABASE_KEY;
  if (!SB_KEY) return res.status(500).json({ status: 'error', message: 'Server misconfigured' });

  const headers = { 'Content-Type': 'application/json', 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}` };

  try {
    const { code, new_user_email } = req.body;

    if (!code || !new_user_email) return res.status(400).json({ status: 'error' });

    // Get referrer
    const refRes = await fetch(`${SB_URL}/rest/v1/waitlist?code=eq.${encodeURIComponent(code)}&select=*`, { headers });
    const refRows = await refRes.json();
    if (!refRows || refRows.length === 0) return res.status(400).json({ status: 'not found' });
    const referrer = refRows[0];

    // Check new user hasn't already been referred
    const newUserRes = await fetch(`${SB_URL}/rest/v1/waitlist?email=eq.${encodeURIComponent(new_user_email)}&select=referred_by`, { headers });
    const newUserRows = await newUserRes.json();
    if (!newUserRows || newUserRows.length === 0) return res.status(400).json({ status: 'new user not found' });
    if (newUserRows[0].referred_by && newUserRows[0].referred_by !== 'direct') return res.status(400).json({ status: 'already referred' });

    // Dynamic position
    const waitlistRes = await fetch(`${SB_URL}/rest/v1/waitlist?select=email,position&order=created_at.asc`, { headers });
    const waitlist = await waitlistRes.json();
    const refIndex = waitlist.findIndex(u => u.email === referrer.email);
    const newPosition = Math.max(1, refIndex + 1 - 10);

    // Update referrer
    await fetch(`${SB_URL}/rest/v1/waitlist?code=eq.${encodeURIComponent(code)}`, {
      method: 'PATCH',
      headers: { ...headers, 'Prefer': 'return=minimal' },
      body: JSON.stringify({
        refs: (parseInt(referrer.refs) || 0) + 1,
        moved_up: (parseInt(referrer.moved_up) || 0) + 10,
        position: newPosition
      })
    });

    // Mark new user as referred
    await fetch(`${SB_URL}/rest/v1/waitlist?email=eq.${encodeURIComponent(new_user_email)}`, {
      method: 'PATCH',
      headers: { ...headers, 'Prefer': 'return=minimal' },
      body: JSON.stringify({ referred_by: code })
    });

    return res.status(200).json({ status: 'credited', new_position: newPosition });

  } catch (err) {
    console.error('referral error:', err);
    return res.status(500).json({ status: 'error' });
  }
}
