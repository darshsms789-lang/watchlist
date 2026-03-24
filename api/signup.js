import crypto from 'crypto';
import dns from 'dns';
import { promisify } from 'util';

const resolveMx = promisify(dns.resolveMx);

// 1. Safe DNS verification with a 2.5-second timeout to prevent Vercel crashes
async function isDomainReal(email) {
  const domain = email.split('@')[1];
  try {
    const mxPromise = resolveMx(domain);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 2500)
    );
    
    // Race the DNS lookup against the timeout
    const mxRecords = await Promise.race([mxPromise, timeoutPromise]);
    return mxRecords && mxRecords.length > 0;
  } catch (err) {
    // If it times out, we let it pass to avoid blocking real users on slow networks.
    // If it returns an actual DNS error, the domain is fake.
    if (err.message === 'timeout') return true;
    return false; 
  }
}

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') return res.status(405).end();

  const SB_URL = 'https://zuidgbvnyonyxzfsepox.supabase.co';
  const SB_KEY = process.env.SUPABASE_KEY;

  if (!SB_KEY) {
    console.error("CRITICAL: Missing SUPABASE_KEY environment variable.");
    return res.status(500).json({ status: 'error', message: 'Server configuration error.' });
  }

  const headers = {
    'Content-Type': 'application/json',
    'apikey': SB_KEY,
    'Authorization': 'Bearer ' + SB_KEY
  };

  try {
    const body = req.body;

    if (!body || !body.email) {
      return res.status(400).json({ status: 'error', message: 'Email is required.' });
    }

    const email = body.email.toLowerCase().trim();

    // 2. Strict Regex Format Check
    const emailRegex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ status: 'error', message: 'Invalid email format.' });
    }

    // 3. Block obvious spam patterns (e.g., test12345@gmail.com)
    if (/\d{4,}/.test(email.split('@')[0])) {
      return res.status(400).json({ status: 'error', message: 'Please use a real email address.' });
    }

    // 4. Check if the email domain actually exists (fixes your friend's issue)
    const domainIsValid = await isDomainReal(email);
    if (!domainIsValid) {
      return res.status(400).json({ status: 'error', message: 'This email domain does not exist.' });
    }

    // 5. Check for Duplicate Email in Supabase
    const checkRes = await fetch(
      `${SB_URL}/rest/v1/waitlist?email=eq.${encodeURIComponent(email)}&select=*`,
      { headers }
    );
    const existing = await checkRes.json();

    if (existing && existing.length > 0) {
      const returnToken = crypto.randomBytes(32).toString('hex');
      await fetch(
        `${SB_URL}/rest/v1/waitlist?email=eq.${encodeURIComponent(email)}`,
        {
          method: 'PATCH',
          headers: { ...headers, 'Prefer': 'return=minimal' },
          body: JSON.stringify({ session_token: returnToken })
        }
      );
      return res.status(200).json({
        status: 'exists',
        session_token: returnToken,
        data: existing[0]
      });
    }

    // 6. Get Total Users for Waitlist Position
    const countRes = await fetch(
      `${SB_URL}/rest/v1/counter?id=eq.total_users&select=value`,
      { headers }
    );
    const countData = await countRes.json();
    const totalUsers = (countData && countData[0]) ? parseInt(countData[0].value) : 0;

    // Calculate Position (bump up by 5 if they used a referral link)
    let position = 1000 + totalUsers;
    if (body.referred_by && body.referred_by !== 'direct') {
      position = Math.max(1000, position - 5);
    }

    const sessionToken = crypto.randomBytes(32).toString('hex');

    // 7. Insert New User
    const insertData = {
      email: email,
      exam: body.exam || '',
      ai_usage: body.ai_usage || '',
      problem: body.problem || '',
      position: position,
      total: position + 500,
      refs: 0,
      moved_up: 0,
      code: body.code || crypto.randomBytes(4).toString('hex'), // Safe fallback code
      referred_by: body.referred_by || 'direct',
      session_token: sessionToken
    };

    const insertRes = await fetch(`${SB_URL}/rest/v1/waitlist`, {
      method: 'POST',
      headers: { ...headers, 'Prefer': 'return=minimal' },
      body: JSON.stringify(insertData)
    });

    if (insertRes.ok || insertRes.status === 201) {
      // 8. Increment the Global Counter
      await fetch(`${SB_URL}/rest/v1/counter?id=eq.total_users`, {
        method: 'PATCH',
        headers: { ...headers, 'Prefer': 'return=minimal' },
        body: JSON.stringify({ value: totalUsers + 1 })
      });

      return res.status(200).json({
        status: 'success',
        session_token: sessionToken,
        position: position,
        total: position + 500
      });
    } else {
      const errText = await insertRes.text();
      console.error('Supabase Insert Error:', errText);
      return res.status(500).json({ status: 'error', message: 'Database insert failed.' });
    }

  } catch (err) {
    console.error('Signup Handler Error:', err);
    return res.status(500).json({ status: 'error', message: 'Internal server error.' });
  }
}
