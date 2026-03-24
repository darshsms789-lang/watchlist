// /api/checkduplicate.js
import fetch from 'node-fetch';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body;

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Email required' });
  }

  try {
    // Call Resend email verification API
    const response = await fetch('https://api.resend.com/email/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`  // your env variable
      },
      body: JSON.stringify({ email: email.trim() })
    });

    const data = await response.json();

    // data.status might be: 'valid', 'invalid', 'unknown'
    let exists = false;
    if (data.status === 'valid') exists = true;
    if (data.status === 'invalid') exists = false;
    if (data.status === 'unknown') exists = false; // or handle specially

    return res.status(200).json({ exists, raw: data });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ exists: false, error: 'Verification failed' });
  }
}
