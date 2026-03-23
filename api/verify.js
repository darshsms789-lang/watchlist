export default async function handler(req, res) {

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {

    var token = req.body.token;

    if (!token) {
      return res.status(400).json({ success: false, error: 'No captcha token' });
    }

    var secret = process.env.TURNSTILE_SECRET;

    if (!secret) {
      return res.status(500).json({ success: false, error: 'Secret missing' });
    }

    var body = new URLSearchParams();
    body.append('secret', secret);
    body.append('response', token);

    var response = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
      }
    );

    var data = await response.json();

    if (data.success) {
      return res.status(200).json({ success: true });
    }

    return res.status(403).json({ success: false, error: 'Captcha failed' });

  } catch (error) {
    console.error('Verify error:', error);
    return res.status(500).json({ success: false, error: 'Server error' });
  }

}
