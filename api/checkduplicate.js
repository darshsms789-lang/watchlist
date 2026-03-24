// /api/checkduplicate.js
import fetch from 'node-fetch'; // Only needed if your Node.js version < 18

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    console.log('Wrong method:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body;

  if (!email || typeof email !== 'string') {
    console.log('Invalid email:', email);
    return res.status(400).json({ error: 'Email required' });
  }

  if (!process.env.RESEND_API_KEY) {
    console.log('RESEND_API_KEY missing!');
    return res.status(500).json({ error: 'Server misconfiguration' });
  }

  try {
    console.log('Sending request to Resend with email:', email);

    const response = await fetch('https://api.resend.com/email/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`
      },
      body: JSON.stringify({ email: email.trim() })
    });

    console.log('Resend API status:', response.status);

    const data = await response.json().catch(() => null);

    if (!data) {
      console.log('Failed to parse JSON from Resend API');
      return res.status(502).json({ error: 'Bad response from Resend API' });
    }

    console.log('Resend API response:', data);

    let exists = false;
    if (data.status === 'valid') exists = true;
    if (data.status === 'invalid') exists = false;
    if (data.status === 'unknown') exists = false;

    return res.status(200).json({ exists, raw: data });
  } catch (err) {
    console.error('Error calling Resend API:', err);
    return res.status(502).json({ exists: false, error: 'Verification failed' });
  }
}
