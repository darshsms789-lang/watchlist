import crypto from 'crypto';

const SB_URL = 'https://zuidgbvnyonyxzfsepox.supabase.co';
const SB_KEY = process.env.SUPABASE_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!SB_KEY) return res.status(500).json({ status: 'error', message: 'Server misconfigured' });

  const headers = { 'Content-Type': 'application/json', 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}` };

  try {
    const { email, exam, referred_by } = req.body;
    if (!email) return res.status(400).json({ status: 'error', message: 'Email required' });

    const cleanEmail = email.toLowerCase().trim();

    // 1️⃣ Check duplicates
    const checkRes = await fetch(`${SB_URL}/rest/v1/waitlist?email=eq.${encodeURIComponent(cleanEmail)}&select=*`, { headers });
    const existing = await checkRes.json();
    if (existing && existing.length > 0) return res.status(200).json({ exists: true });

    // 2️⃣ Determine dynamic position
    const waitlistRes = await fetch(`${SB_URL}/rest/v1/waitlist?select=id,email&order=created_at.asc`, { headers });
    const waitlist = await waitlistRes.json();
    const position = waitlist.length + 1;

    // 3️⃣ Generate code & session token
    const userCode = cleanEmail.split('@')[0].replace(/[^a-z0-9]/gi, '') + Math.floor(1000 + Math.random() * 9000);
    const sessionToken = crypto.randomBytes(32).toString('hex');

    const insertData = {
      email: cleanEmail,
      exam: exam || '',
      position,
      total: position,
      refs: 0,
      moved_up: 0,
      code: userCode,
      referred_by: referred_by || 'direct',
      session_token: sessionToken
    };

    const insertRes = await fetch(`${SB_URL}/rest/v1/waitlist`, { method: 'POST', headers: { ...headers, 'Prefer': 'return=minimal' }, body: JSON.stringify(insertData) });
    if (!insertRes.ok && insertRes.status !== 201) return res.status(500).json({ status: 'error', message: 'Failed to insert user' });

    return res.status(200).json({ status: 'success', position, total: position, code: userCode, session_token: sessionToken });
  } catch (err) {
    console.error('signup error:', err);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
}
