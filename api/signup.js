import crypto from 'crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const SB_URL = 'https://zuidgbvnyonyxzfsepox.supabase.co';
  const SB_KEY = process.env.SUPABASE_KEY;

  if (!SB_KEY) return res.status(500).json({ status: 'error', message: 'Server config error' });

  const headers = {
    'Content-Type': 'application/json',
    'apikey': SB_KEY,
    'Authorization': `Bearer ${SB_KEY}`
  };

  const body = req.body;
  const email = (body.email || '').trim().toLowerCase();
  const exam = body.exam || '';
  const referred_by = body.referred_by || 'direct';

  if (!email) return res.status(400).json({ status: 'error', message: 'Email required' });

  try {
    // Check duplicate again
    const dupRes = await fetch(`${SB_URL}/rest/v1/waitlist?email=eq.${encodeURIComponent(email)}&select=*`, { headers });
    if (!dupRes.ok) return res.status(500).json({ status:'error', message:'Supabase fetch failed' });
    const dup = await dupRes.json();
    if (dup.length > 0) return res.status(200).json({ status:'exists', data: dup[0] });

    // Get current total users (for ranking)
    const countRes = await fetch(`${SB_URL}/rest/v1/counter?id=eq.total_users&select=value`, { headers });
    if (!countRes.ok) return res.status(500).json({ status:'error', message:'Supabase fetch failed' });
    const countData = await countRes.json();
    const totalUsers = countData[0] ? parseInt(countData[0].value) : 0;

    const position = totalUsers + 1; // rank increments automatically
    const code = crypto.randomBytes(4).toString('hex');
    const session_token = crypto.randomBytes(32).toString('hex');

    // Insert new user
    const insertData = {
      email, exam, referred_by, position,
      total: position + 500,
      refs: 0, moved_up: 0, code, session_token
    };

    const insertRes = await fetch(`${SB_URL}/rest/v1/waitlist`, {
      method: 'POST',
      headers: { ...headers, 'Prefer':'return=minimal' },
      body: JSON.stringify(insertData)
    });

    if (!insertRes.ok) {
      const txt = await insertRes.text();
      console.error('Supabase insert failed:', txt);
      return res.status(500).json({ status:'error', message:'Insert failed' });
    }

    // Update global counter
    await fetch(`${SB_URL}/rest/v1/counter?id=eq.total_users`, {
      method: 'PATCH',
      headers: { ...headers, 'Prefer':'return=minimal' },
      body: JSON.stringify({ value: totalUsers + 1 })
    });

    return res.status(200).json({ status:'success', position, total: position + 500, code, session_token });

  } catch(err) {
    console.error('Signup error:', err);
    return res.status(500).json({ status:'error', message:'Internal server error' });
  }
}
