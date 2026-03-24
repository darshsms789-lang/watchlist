import crypto from 'crypto';
import dns from 'dns';
import { promisify } from 'util';

const resolveMx = promisify(dns.resolveMx);

const SB_URL = 'https://zuidgbvnyonyxzfsepox.supabase.co';
const SB_KEY = process.env.SUPABASE_KEY;

if (!SB_KEY) {
  console.error("Supabase key missing!");
}

// DNS MX check (fails if domain is invalid)
async function isDomainReal(email) {
  const domain = email.split('@')[1];
  try {
    const mxPromise = resolveMx(domain);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 2500)
    );
    const mxRecords = await Promise.race([mxPromise, timeoutPromise]);
    return mxRecords && mxRecords.length > 0;
  } catch (err) {
    return false; // fail if DNS fails or times out
  }
}

// Username spam filter
function isUsernameValid(username) {
  if (!username) return false;
  if (username.length < 3) return false;                  // too short
  if (/[^a-z0-9._%-]/i.test(username)) return false;     // invalid chars
  if (/(?:test|dummy|abc|pbkiller|spam)/i.test(username)) return false; // blacklist
  if (/\d{4,}/.test(username)) return false;             // too many digits
  if (/\s/.test(username)) return false;                 // no spaces
  return true;
}

// Get current waitlist count atomically
async function getWaitlistPosition(email) {
  const res = await fetch(`${SB_URL}/rest/v1/waitlist?select=id,email&order=created_at.asc`, {
    headers: {
      'Content-Type': 'application/json',
      'apikey': SB_KEY,
      'Authorization': `Bearer ${SB_KEY}`
    }
  });
  const data = await res.json();
  const position = data.findIndex(u => u.email === email) + 1;
  return { position, total: data.length };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const body = req.body;
    if (!body || !body.email) {
      return res.status(400).json({ status: 'error', message: 'Email is required.' });
    }

    const email = body.email.toLowerCase().trim();
    const username = email.split('@')[0];

    // 1️⃣ Validate email format
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email) || !isUsernameValid(username)) {
      return res.status(400).json({ status: 'error', message: 'Invalid email address.' });
    }

    // 2️⃣ Validate MX records
    const domainValid = await isDomainReal(email);
    if (!domainValid) {
      return res.status(400).json({ status: 'error', message: 'Email domain does not exist.' });
    }

    // 3️⃣ Check duplicate
    const checkRes = await fetch(`${SB_URL}/rest/v1/waitlist?email=eq.${encodeURIComponent(email)}&select=*`, {
      headers: {
        'Content-Type': 'application/json',
        'apikey': SB_KEY,
        'Authorization': `Bearer ${SB_KEY}`
      }
    });
    const existing = await checkRes.json();
    if (existing && existing.length > 0) {
      return res.status(200).json({ status: 'exists', data: existing[0] });
    }

    // 4️⃣ Generate session token and unique code
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const code = crypto.randomBytes(4).toString('hex');

    // 5️⃣ Insert new user
    const insertData = {
      email: email,
      exam: body.exam || '',
      ai_usage: body.ai_usage || '',
      problem: body.problem || '',
      code: code,
      referred_by: body.referred_by || 'direct',
      session_token: sessionToken,
      refs: 0,
      moved_up: 0,
      created_at: new Date().toISOString()
    };

    const insertRes = await fetch(`${SB_URL}/rest/v1/waitlist`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SB_KEY,
        'Authorization': `Bearer ${SB_KEY}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(insertData)
    });

    if (!insertRes.ok) {
      const errText = await insertRes.text();
      console.error('Supabase Insert Error:', errText);
      return res.status(500).json({ status: 'error', message: 'Failed to insert user.' });
    }

    // 6️⃣ Get position and total
    const { position, total } = await getWaitlistPosition(email);

    // 7️⃣ Apply referral bump if applicable
    let finalPosition = position;
    if (body.referred_by && body.referred_by !== 'direct') {
      finalPosition = Math.max(1, position - 5); // moves up 5 places
    }

    return res.status(200).json({
      status: 'success',
      session_token: sessionToken,
      code: code,
      position: finalPosition,
      total: total
    });

  } catch (err) {
    console.error('Signup Error:', err);
    return res.status(500).json({ status: 'error', message: 'Internal server error.' });
  }
}
