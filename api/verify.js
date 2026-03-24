export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const token = req.body.token;
  const secret = process.env.TURNSTILE_SECRET;
  if (!token) return res.status(400).json({ success: false, error: 'No token' });
  if (!secret) return res.status(500).json({ success: false, error: 'Secret missing' });

  try {
    const body = new URLSearchParams();
    body.append('secret', secret);
    body.append('response', token);

    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString()
    });
    const data = await r.json();
    return data.success
      ? res.status(200).json({ success: true })
      : res.status(403).json({ success: false, error: 'Captcha failed' });
  } catch (err) {
    console.error('Verify Error:', err);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
}
