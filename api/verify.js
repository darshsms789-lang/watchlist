export const config = {
  api: {
    bodyParser: true,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  // handle both JSON and form-encoded body
  var token = (req.body && req.body.token) || null;

  if (!token) {
    console.log('No token received. Body:', JSON.stringify(req.body));
    return res.status(400).json({ success: false, error: 'No token' });
  }

  var secret = process.env.TURNSTILE_SECRET;

  if (!secret) {
    return res.status(500).json({ success: false, error: 'Secret missing' });
  }

  try {
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
    console.log('Turnstile response:', JSON.stringify(data));

    if (data.success) {
      return res.status(200).json({ success: true });
    }

    return res.status(403).json({ success: false, error: 'Captcha failed', details: data });

  } catch (err) {
    console.error('Verify error:', err);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
}
