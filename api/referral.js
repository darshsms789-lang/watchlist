import crypto from 'crypto';

const SB_URL = 'https://zuidgbvnyonyxzfsepox.supabase.co';
const SB_KEY = process.env.SUPABASE_KEY;

if (!SB_KEY) {
  console.error("Supabase key missing!");
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { code, new_user_email } = req.body;

    // 1️⃣ Validate inputs
    if (!code || !/^[a-zA-Z0-9]{4,30}$/.test(code)) {
      return res.status(400).json({ status: 'invalid code' });
    }
    if (!new_user_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(new_user_email)) {
      return res.status(400).json({ status: 'invalid new user email' });
    }

    const headers = {
      'Content-Type': 'application/json',
      'apikey': SB_KEY,
      'Authorization': `Bearer ${SB_KEY}`
    };

    // 2️⃣ Fetch the referrer by code
    const getRef = await fetch(
      `${SB_URL}/rest/v1/waitlist?code=eq.${code}&select=*`,
      { headers }
    );
    const refRows = await getRef.json();

    if (!refRows || refRows.length === 0) {
      return res.status(200).json({ status: 'not found' });
    }

    const referrer = refRows[0];

    // 3️⃣ Check if this new user already used a referral
    const checkNewUser = await fetch(
      `${SB_URL}/rest/v1/waitlist?email=eq.${encodeURIComponent(new_user_email)}&select=referred_by`,
      { headers }
    );
    const newUserRows = await checkNewUser.json();
    if (!newUserRows || newUserRows.length === 0) {
      return res.status(400).json({ status: 'new user not found' });
    }

    const newUser = newUserRows[0];
    if (newUser.referred_by && newUser.referred_by !== 'direct') {
      return res.status(400).json({ status: 'already referred' });
    }

    // 4️⃣ Dynamic position calculation
    // Fetch waitlist ordered by created_at to determine rank
    const waitlistRes = await fetch(
      `${SB_URL}/rest/v1/waitlist?select=id,email,position&order=created_at.asc`,
      { headers }
    );
    const waitlist = await waitlistRes.json();

    // Find current position of referrer
    const refIndex = waitlist.findIndex(u => u.email === referrer.email);
    const currentPosition = refIndex >= 0 ? refIndex + 1 : 1000;

    // Referral boost: move up 10 positions (cap at position 1)
    const newPosition = Math.max(1, currentPosition - 10);

    // 5️⃣ Update referrer: increment refs, moved_up, and position
    const patchRefRes = await fetch(
      `${SB_URL}/rest/v1/waitlist?code=eq.${code}`,
      {
        method: 'PATCH',
        headers: { ...headers, 'Prefer': 'return=minimal' },
        body: JSON.stringify({
          refs: (parseInt(referrer.refs) || 0) + 1,
          moved_up: (parseInt(referrer.moved_up) || 0) + 10,
          position: newPosition
        })
      }
    );

    if (!patchRefRes.ok) {
      const errText = await patchRefRes.text();
      console.error('Error patching referrer:', errText);
      return res.status(500).json({ status: 'error', message: 'Failed to update referrer.' });
    }

    // 6️⃣ Update new user: mark that they were referred
    const patchNewUserRes = await fetch(
      `${SB_URL}/rest/v1/waitlist?email=eq.${encodeURIComponent(new_user_email)}`,
      {
        method: 'PATCH',
        headers: { ...headers, 'Prefer': 'return=minimal' },
        body: JSON.stringify({ referred_by: code })
      }
    );

    if (!patchNewUserRes.ok) {
      const errText = await patchNewUserRes.text();
      console.error('Error patching new user:', errText);
      return res.status(500).json({ status: 'error', message: 'Failed to mark new user as referred.' });
    }

    return res.status(200).json({ status: 'credited', new_position: newPosition });

  } catch (err) {
    console.error('Referral API Error:', err);
    return res.status(500).json({ status: 'error', message: 'Internal server error.' });
  }
}
