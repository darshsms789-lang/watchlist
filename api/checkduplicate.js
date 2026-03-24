import dns from 'dns';
import { promisify } from 'util';

const resolveMx = promisify(dns.resolveMx);

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
    if (err.message === 'timeout') return true;
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const SB_URL = 'https://zuidgbvnyonyxzfsepox.supabase.co';
  const SB_KEY = process.env.SUPABASE_KEY;
  if (!SB_KEY) return res.status(500).json({ status: 'error', message: 'Server misconfigured' });

  const headers = { 'Content-Type': 'application/json', 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}` };

  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ status: 'error', message: 'Email is required' });

    const cleanEmail = email.toLowerCase().trim();
    const emailRegex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(cleanEmail)) return res.status(400).json({ status: 'error', message: 'Invalid email format' });

    // Block obvious spam patterns
    if (/\d{4,}/.test(cleanEmail.split('@')[0])) return res.status(400).json({ status: 'error', message: 'Please use a real email' });

    // Check domain exists
    const domainValid = await isDomainReal(cleanEmail);
    if (!domainValid) return res.status(400).json({ status: 'error', message: 'Email domain does not exist' });

    // Check duplicates
    const checkRes = await fetch(`${SB_URL}/rest/v1/waitlist?email=eq.${encodeURIComponent(cleanEmail)}&select=email`, { headers });
    const existing = await checkRes.json();
    if (existing && existing.length > 0) return res.status(200).json({ exists: true });

    return res.status(200).json({ exists: false, status: 'success' });
  } catch (err) {
    console.error('checkduplicate error:', err);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
}
