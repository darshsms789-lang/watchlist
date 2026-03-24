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
    return err.message === 'timeout' ? true : false;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const SB_URL = process.env.SB_URL;
  const SB_KEY = process.env.SUPABASE_KEY;
  if (!SB_KEY || !SB_URL) return res.status(500).json({ status: 'error', message: 'Server misconfigured' });

  const { email } = req.body;
  if (!email) return res.status(400).json({ status: 'error', message: 'Email required' });

  const e = email.toLowerCase().trim();

  // Format check
  if (!/^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(e)) {
    return res.status(400).json({ status: 'error', message: 'Invalid email format.' });
  }

  // Block spam patterns
  if (/\d{4,}/.test(e.split('@')[0])) {
    return res.status(400).json({ status: 'error', message: 'Use a real email address.' });
  }

  // Check domain
  const domainValid = await isDomainReal(e);
  if (!domainValid) return res.status(400).json({ status: 'error', message: 'Email domain does not exist.' });

  // Check duplicate
  try {
    const r = await fetch(`${SB_URL}/rest/v1/waitlist?email=eq.${encodeURIComponent(e)}&select=*`, {
      headers: { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}` }
    });
    const existing = await r.json();
    return res.status(200).json({ exists: existing.length > 0 });
  } catch (err) {
    console.error('CheckDuplicate Error:', err);
    return res.status(500).json({ status: 'error', message: 'Server error' });
  }
}
