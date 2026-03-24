export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body;

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  const trimmedEmail = email.trim().toLowerCase();

  try {
    // 1️⃣ Call Resend API
    const response = await fetch('https://api.resend.com/email/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`
      },
      body: JSON.stringify({ email: trimmedEmail })
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('Resend API failed:', text);
      return res.status(502).json({ error: 'Email verification service failed' });
    }

    const data = await response.json();

    if (data.status !== 'valid') {
      return res.status(400).json({ error: 'Email is invalid or unverified' });
    }

    // 2️⃣ Insert into DB (PostgREST / Supabase style)
    const insertRes = await fetch(`${process.env.NEXT_PUBLIC_DB_URL}/waitlist`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.NEXT_PUBLIC_DB_ANON_KEY
      },
      body: JSON.stringify({
        email: trimmedEmail
        // Only include fields allowed by RLS policies
      })
    });

    if (insertRes.status >= 400) {
      const errorJson = await insertRes.json().catch(() => ({}));
      console.error('DB insert failed:', errorJson);
      return res.status(insertRes.status).json({ error: 'Failed to join waitlist', details: errorJson });
    }

    const inserted = await insertRes.json();
    return res.status(200).json({ message: 'Successfully joined waitlist', data: inserted });

  } catch (err) {
    console.error('Unexpected error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
