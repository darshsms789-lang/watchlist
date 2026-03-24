import crypto from 'crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const SB_URL = process.env.SB_URL;
  const SB_KEY = process.env.SUPABASE_KEY;
  if (!SB_KEY) return res.status(500).json({ status: 'error', message: 'Server misconfigured' });

  const headers = { 'Content-Type':'application/json', 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}` };
  const { referral_code } = req.body;

  if (!referral_code || !/^[a-zA-Z0-9]{4,30}$/.test(referral_code)) {
    return res.status(400).json({ status: 'invalid', message: 'Invalid referral code' });
  }

  try {
    // 1️⃣ Fetch the referrer
    const refRes = await fetch(`${SB_URL}/rest/v1/waitlist?code=eq.${referral_code}&select=*`, { headers });
    const refData = await refRes.json();
    if (!refData || refData.length === 0) return res.status(404).json({ status:'not found', message:'Referral not found' });

    const referrer = refData[0];

    // 2️⃣ Only verified users count
    if (!referrer.verified) return res.status(403).json({ status:'error', message:'Referrer not verified' });

    // 3️⃣ Calculate new position boost
    const newRefs = (parseInt(referrer.refs) || 0) + 1;
    const newMoved = (parseInt(referrer.moved_up) || 0) + 10;
    const newPosition = Math.max(1, (parseInt(referrer.position) || 1000) - 10); // Move up 10 ranks

    // 4️⃣ Update referrer
    await fetch(`${SB_URL}/rest/v1/waitlist?code=eq.${referral_code}`, {
      method:'PATCH',
      headers: { ...headers, 'Prefer':'return=minimal' },
      body: JSON.stringify({
        refs: newRefs,
        moved_up: newMoved,
        position: newPosition
      })
    });

    return res.status(200).json({ status: 'credited', refs: newRefs, moved_up: newMoved, position: newPosition });

  } catch (err) {
    console.error('Referral error:', err);
    return res.status(500).json({ status:'error', message:'Server error' });
  }
}
