import crypto from 'crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const SB_URL = process.env.SB_URL;
  const SB_KEY = process.env.SUPABASE_KEY;
  if (!SB_KEY || !SB_URL) return res.status(500).json({ status:'error', message:'Server misconfigured' });

  const headers = { 'Content-Type':'application/json', 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}` };

  const { email, exam, code, referred_by, session_token } = req.body;
  if (!email || !exam || !session_token) return res.status(400).json({ status:'error', message:'Missing fields' });

  try {
    // 1. Check duplicate
    const dupRes = await fetch(`${SB_URL}/rest/v1/waitlist?email=eq.${encodeURIComponent(email)}`, { headers });
    const dupData = await dupRes.json();
    if (dupData.length > 0) return res.status(200).json({ status:'exists', data: dupData[0] });

    // 2. Get total users
    const countRes = await fetch(`${SB_URL}/rest/v1/counter?id=eq.total_users&select=value`, { headers });
    const countData = await countRes.json();
    const totalUsers = countData?.[0]?.value ? parseInt(countData[0].value) : 0;

    let position = 1000 + totalUsers; // dynamic rank
    const userCode = code || crypto.randomBytes(4).toString('hex');
    const sessionToken = crypto.randomBytes(32).toString('hex');

    // 3. Insert user
    const insert = {
      email: email.toLowerCase(),
      exam,
      position,
      total: position + 500,
      refs: 0,
      moved_up: 0,
      verified: true, // Mark verified after captcha
      code: userCode,
      referred_by: referred_by || 'direct',
      session_token: sessionToken
    };
    const insertRes = await fetch(`${SB_URL}/rest/v1/waitlist`, {
      method: 'POST',
      headers: { ...headers, 'Prefer':'return=minimal' },
      body: JSON.stringify(insert)
    });
    if (!insertRes.ok) throw new Error('Insert failed');

    // 4. Increment counter
    await fetch(`${SB_URL}/rest/v1/counter?id=eq.total_users`, {
      method: 'PATCH',
      headers: { ...headers, 'Prefer':'return=minimal' },
      body: JSON.stringify({ value: totalUsers + 1 })
    });

    // 5. Credit referral if applicable
    if (referred_by && referred_by !== 'direct') {
      await fetch(`${SB_URL}/api/referral`, {
        method:'POST',
        headers:{ ...headers, 'Content-Type':'application/json' },
        body: JSON.stringify({ referral_code: referred_by })
      });
    }

    return res.status(200).json({ status:'success', position, total: position + 500, code: userCode, session_token: sessionToken });

  } catch (err) {
    console.error('Signup Error:', err);
    return res.status(500).json({ status:'error', message:'Server error' });
  }
}
