import dns from 'dns';
import { promisify } from 'util';

const resolveMx = promisify(dns.resolveMx);

// Safe DNS verification to check if the domain actually exists
async function isDomainReal(email) {
  const domain = email.split('@')[1];
  try {
    const mxPromise = resolveMx(domain);
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2500));
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

  if (!SB_KEY) return res.status(500).json({ status: 'error', message: 'Server error' });

  const body = req.body;
  if (!body || !body.email) {
    return res.status(400).json({ status: 'error', message: 'Email is required.' });
  }

  const email = body.email.toLowerCase().trim();
  const customErrorMsg = 'Your email is invalid, please put a valid one.';

  // 1. Strict Format Check
  const emailRegex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ status: 'error', message: customErrorMsg });
  }

  // 2. Block spam patterns (e.g., test123456@gmail.com)
  if (/\d{4,}/.test(email.split('@')[0])) {
    return res.status(400).json({ status: 'error', message: customErrorMsg });
  }

  // 3. Check if the domain is a real, working website
  const domainIsValid = await isDomainReal(email);
  if (!domainIsValid) {
    return res.status(400).json({ status: 'error', message: customErrorMsg });
  }

  // 4. If all checks pass, check Supabase to see if they are already on the list
  try {
    const checkRes = await fetch(`${SB_URL}/rest/v1/waitlist?email=eq.${encodeURIComponent(email)}&select=email`, {
      headers: {
        'Content-Type': 'application/json',
        'apikey': SB_KEY,
        'Authorization': `Bearer ${SB_KEY}`
      }
    });
    const existing = await checkRes.json();

    if (existing && existing.length > 0) {
      return res.status(200).json({ exists: true });
    }
    
    // Everything is good, allow them to Step 2
    return res.status(200).json({ exists: false, status: 'success' });

  } catch (err) {
    console.error('CheckDuplicate Error:', err);
    return res.status(500).json({ status: 'error', message: 'Server error' });
  }
}
