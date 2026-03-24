export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const SB_URL = process.env.SB_URL;
  const SB_KEY = process.env.SUPABASE_KEY;
  if (!SB_KEY || !SB_URL) return res.status(500).json({ status:'error' });

  const { referral_code } = req.body;
  if (!referral_code) return res.status(400).json({ status:'invalid' });

  const headers = { 'Content-Type':'application/json', 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}` };

  try {
    const r = await fetch(`${SB_URL}/rest/v1/waitlist?code=eq.${referral_code}`, { headers });
    const data = await r.json();
    if (!data?.length) return res.status(404).json({ status:'not found' });

    const ref = data[0];
    if (!ref.verified) return res.status(403).json({ status:'error', message:'Referrer not verified' });

    const newRefs = (parseInt(ref.refs) || 0) + 1;
    const newMoved = (parseInt(ref.moved_up) || 0) + 10;
    const newPosition = Math.max(1, (parseInt(ref.position) || 1000) - 10);

    await fetch(`${SB_URL}/rest/v1/waitlist?code=eq.${referral_code}`, {
      method:'PATCH',
      headers:{ ...headers, 'Prefer':'return=minimal' },
      body: JSON.stringify({ refs:newRefs, moved_up:newMoved, position:newPosition })
    });

    return res.status(200).json({ status:'credited', refs:newRefs, moved_up:newMoved, position:newPosition });
  } catch (err) {
    console.error('Referral Error:', err);
    return res.status(500).json({ status:'error' });
  }
}
