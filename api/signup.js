import crypto from 'crypto';

export default async function handler(req, res) {
  // 1. Only allow POST
  if (req.method !== 'POST') return res.status(405).end();

  const SB_URL = 'https://zuidgbvnyonyxzfsepox.supabase.co';
  const SB_KEY = process.env.SUPABASE_KEY;

  if (!SB_KEY) {
    console.error("CRITICAL: Missing SUPABASE_KEY in environment variables.");
    return res.status(500).json({ status: 'error', message: 'Server configuration error' });
  }

  const headers = {
    'Content-Type': 'application/json',
    'apikey': SB_KEY,
    'Authorization': 'Bearer ' + SB_KEY
  };

  try {
    const body = req.body;
    if (!body || !body.email) {
      return res.status(400).json({ status: 'error', message: 'Email is required' });
    }

    const email = body.email.toLowerCase().trim();

    // 2. Validation (Simplified for better reliability)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ status: 'error', message: 'Invalid email format' });
    }

    // 3. Check Duplicate in Supabase
    const checkRes = await fetch(
      `${SB_URL}/rest/v1/waitlist?email=eq.${encodeURIComponent(email)}&select=*`,
      { headers }
    );
    const existing = await checkRes.json();

    if (existing && existing.length > 0) {
      const returnToken = crypto.randomBytes(32).toString('hex');
      // Update session token for existing user
      await fetch(`${SB_URL}/rest/v1/waitlist?email=eq.${encodeURIComponent(email)}`, {
        method: 'PATCH',
        headers: { ...headers, 'Prefer': 'return=minimal' },
        body: JSON.stringify({ session_token: returnToken })
      });

      return res.status(200).json({
        status: 'exists',
        session_token: returnToken,
        data: existing[0]
      });
    }

    // 4. Get Counter (Current Position)
    const countRes = await fetch(`${SB_URL}/rest/v1/counter?id=eq.total_users&select=value`, { headers });
    const countData = await countRes.json();
    const totalUsers = (countData && countData[0]) ? parseInt(countData[0].value) : 0;

    const position = 1000 + totalUsers;
    const sessionToken = crypto.randomBytes(32).toString('hex');

    // 5. Insert New User
    const insertData = {
      email: email,
      exam: body.exam || '',
      ai_usage: body.ai_usage || '',
      problem: body.problem || '',
      position: position,
      total: position + 500,
      refs: 0,
      moved_up: 0,
      code: body.code || `user${Math.floor(Math.random() * 10000)}`,
      referred_by: body.referred_by || 'direct',
      session_token: sessionToken
    };

    const insert = await fetch(`${SB_URL}/rest/v1/waitlist`, {
      method: 'POST',
      headers: { ...headers, 'Prefer': 'return=minimal' },
      body: JSON.stringify(insertData)
    });

    if (insert.ok || insert.status === 201) {
      // 6. Increment Counter
      await fetch(`${SB_URL}/rest/v1/counter?id=eq.total_users`, {
        method: 'PATCH',
        headers: { ...headers, 'Prefer': 'return=minimal' },
        body: JSON.stringify({ value: totalUsers + 1 })
      });

      return res.status(200).json({
        status: 'success',
        session_token: sessionToken,
        position: position,
        total: position + 500
      });
    } else {
      const errorMsg = await insert.text();
      console.error("Supabase Insert Error:", errorMsg);
      return res.status(500).json({ status: 'error', message: 'Database insert failed' });
    }

  } catch (err) {
    console.error("Global Signup Handler Error:", err);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
}
