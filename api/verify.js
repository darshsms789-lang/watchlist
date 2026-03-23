export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  var token = req.body.token;
  var secret = '0x4AAAAAACuv8xQPBhjuIokqOlGDYFH_Z2U';

  if (!token) {
    return res.status(400).json({ success: false, error: 'No token' });
  }

  var response = await fetch(
    'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: secret, response: token })
    }
  );

  var data = await response.json();

  if (data.success) {
    return res.status(200).json({ success: true });
  } else {
    return res.status(403).json({ success: false, error: 'Captcha failed' });
  }
}
```

5. Scroll down → click **Commit changes**

---

**Step 2 — Create vercel.json**

1. Click **Add file → Create new file**
2. Name it exactly:
```
vercel.json
