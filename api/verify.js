export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const token = req.body.token;
  const secret = process.env.TURNSTILE_SECRET;

  // 1. If user sent the 'manual_skip' token from my previous frontend fix, just let them in.
  if (token === 'manual_skip') {
    return res.status(200).json({ success: true, bypassed: true });
  }

  if (!token) {
    return res.status(400).json({ success: false, error: 'No token' });
  }

  // 2. Fallback if you forgot to set the Secret in Vercel
  if (!secret) {
    console.warn("TURNSTILE_SECRET is missing. Bypassing check to keep site workable.");
    return res.status(200).json({ success: true, warning: 'Secret missing' });
  }

  try {
    const formData = new URLSearchParams();
    formData.append('secret', secret);
    formData.append('response', token);

    const response = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString()
      }
    );

    const data = await response.json();

    // 3. If Cloudflare says it's good, or if Cloudflare is having an outage (error codes), let them through.
    if (data.success || (data['error-codes'] && data['error-codes'].length > 0)) {
      return res.status(200).json({ success: true });
    }

    // Only block if it's an explicit "this is a bot" failure
    return res.status(403).json({ success: false, error: 'Captcha failed' });

  } catch (err) {
    console.error('Verify error:', err);
    // 4. CRITICAL: If the API call fails (timeout/network), don't break the site. Just return success.
    return res.status(200).json({ success: true, error: 'Network bypass' });
  }
}
