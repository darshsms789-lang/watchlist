import crypto from 'crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const SB_URL = 'https://zuidgbvnyonyxzfsepox.supabase.co';
  const SB_KEY = process.env.SUPABASE_KEY;

  if (!SB_KEY) {
    console.error('Missing SUPABASE_KEY');
    return res.status(500).json({ status: 'error', message: 'Server configuration error.' });
  }

  const headers = {
    'Content-Type': 'application/json',
    'apikey': SB_KEY,
    'Authorization': `Bearer ${SB_KEY}`
  };

  const email = (req.body.email || '').trim().toLowerCase();

  if (!email) return res.status(400).json({ status: 'error', message: 'Email is required.' });

  // Strict regex
  const emailRegex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ status: 'error', message: 'Invalid email format.' });
  }

  // Block obvious spam (PB killer 1,2,3 or numbers in name)
  if (/\d{4,}/.test(email.split('@')[0])) {
    return res.status(400).json({ status: 'error', message: 'Please use a real email address.' });
  }

  try {
    const checkRes = await fetch(
      `${SB_URL}/rest/v1/waitlist?email=eq.${encodeURIComponent(email)}&select=*`,
      { headers }
    );

    if (!checkRes.ok) {
      const txt = await checkRes.text();
      console.error('Supabase check duplicate failed:', txt);
      return res.status(500).json({ status: 'error', message: 'Supabase fetch failed.' });
    }

    const existing = await checkRes.json();

    if (existing.length > 0) {
      return res.status(200).json({ exists: true, data: existing[0] });
    }

    return res.status(200).json({ exists: false, status: 'success' });

  } catch (err) {
    console.error('CheckDuplicate error:', err);
    return res.status(500).json({ status: 'error', message: 'Internal server error.' });
  }
}
