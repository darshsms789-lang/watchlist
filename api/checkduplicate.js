import dns from 'dns';
import { promisify } from 'util';

const resolveMx = promisify(dns.resolveMx);

async function isDomainReal(email) {
  const domain = email.split('@')[1];
  try {
    const mxRecords = await Promise.race([
      resolveMx(domain),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2500))
    ]);
    return mxRecords && mxRecords.length > 0;
  } catch (err) {
    if (err.message === 'timeout') return true;
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const SB_URL = process.env.SB_URL;
  const SB_KEY = process.env.SUPABASE_KEY;
  if (!SB_KEY) return res.status(500).json({ status:'error', message:'Server misconfigured' });

  const { email } = req.body;
  if (!email) return res.status(400).json({ status:'error', message:'Email required' });

  const cleanEmail = email.toLowerCase().trim();
  const regex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
  if (!regex.test(cleanEmail) || /\d{4,}/.test(cleanEmail.split('@')[0])) {
    return res.status(400).json({ status:'error', message:'Invalid email' });
  }

  const validDomain = await isDomainReal(cleanEmail);
  if (!validDomain) return res.status(400).json({ status:'error', message:'Email domain does not exist' });

  // Check if already exists
  const check = await fetch(`${SB_URL}/rest/v1/waitlist?email=eq.${encodeURIComponent(cleanEmail)}&select=*`, {
    headers:{ 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}`, 'Content-Type':'application/json' }
  });
  const existing = await check.json();
  if (existing.length > 0) return res.status(200).json({ exists: true });

  // Everything OK
  return res.status(200).json({ exists: false, status:'success' });
}
