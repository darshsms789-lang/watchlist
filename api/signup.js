import crypto from 'crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const SB_URL = process.env.SB_URL;
  const SB_KEY = process.env.SUPABASE_KEY;
  const headers = { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}`, 'Content-Type':'application/json' };
  const { email, exam, referred_by, captcha_token } = req.body;

  if (!email || !exam || !captcha_token) return res.status(400).json({ status:'error', message:'Missing fields' });

  // 1️⃣ Verify captcha
  const captchaRes = await fetch(`${process.env.BASE_URL}/api/verify-captcha`, {
    method:'POST', body: JSON.stringify({ token: captcha_token }), headers
  });
  const captchaData = await captchaRes.json();
  if (!captchaData.success) return res.status(403).json({ status:'error', message:'Captcha failed' });

  // 2️⃣ Check if verified
  const userCheck = await fetch(`${SB_URL}/rest/v1/waitlist?email=eq.${encodeURIComponent(email)}&select=*`, { headers });
  const users = await userCheck.json();
  if (!users[0]?.verified) return res.status(403).json({ status:'error', message:'Email not verified' });

  // 3️⃣ Already signed up?
  if (users[0].position) return res.status(200).json({ status:'exists', position: users[0].position });

  // 4️⃣ Compute position
  const countRes = await fetch(`${SB_URL}/rest/v1/counter?id=eq.total_users&select=value`, { headers });
  const countData = await countRes.json();
  const totalUsers = parseInt(countData[0]?.value || 0);
  const position = 1000 + totalUsers;

  // 5️⃣ Update waitlist
  const sessionToken = crypto.randomBytes(32).toString('hex');
  const code = crypto.randomBytes(4).toString('hex');

  await fetch(`${SB_URL}/rest/v1/waitlist`, {
    method:'PATCH',
    headers: { ...headers, 'Prefer':'return=minimal' },
    body: JSON.stringify({
      position, code, session_token: sessionToken, exam, referred_by: referred_by||'direct'
    })
  });

  // 6️⃣ Increment counter
  await fetch(`${SB_URL}/rest/v1/counter?id=eq.total_users`, {
    method:'PATCH', headers:{ ...headers, 'Prefer':'return=minimal' },
    body: JSON.stringify({ value: totalUsers + 1 })
  });

  return res.status(200).json({ status:'success', position, session_token: sessionToken });
}
