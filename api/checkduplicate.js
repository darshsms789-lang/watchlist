// /api/checkduplicate.js

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body;

  // Basic validation
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Email is required and must be a string' });
  }

  try {
    // Use the built-in fetch (Next.js 13+)
    const response = await fetch('https://api.resend.com/email/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({ email: email.trim() }),
    });

    // Check if API itself returned error
    if (!response.ok) {
      const text = await response.text(); // log raw error
      console.error('Resend API error:', text);
      return res.status(502).json({ exists: false, error: 'Resend API returned error', raw: text });
    }

    const data = await response.json();

    // Determine if email exists based on Resend status
    let exists = false;
    if (data.status === 'valid') exists = true;
    if (data.status === 'invalid' || data.status === 'unknown') exists = false;

    // Send result
    return res.status(200).json({ exists, raw: data });
  } catch (err) {
    console.error('Check duplicate error:', err);
    return res.status(500).json({ exists: false, error: 'Verification failed', details: err.message });
  }
}
