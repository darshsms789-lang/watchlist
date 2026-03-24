import dns from 'dns';
import { promisify } from 'util';

const resolveMx = promisify(dns.resolveMx);

const SB_URL = 'https://zuidgbvnyonyxzfsepox.supabase.co';
const SB_KEY = process.env.SUPABASE_KEY;

if (!SB_KEY) {
  console.error('Supabase key missing');
}

// MX record check – fail if no valid MX records or timeout
async function isDomainReal(email) {
  const domain = email.split('@')[1];
  try {
    const mxPromise = resolveMx(domain);
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2500));
    const mxRecords = await Promise.race([mxPromise, timeoutPromise]);
    return mxRecords && mxRecords.length > 0;
  } catch (err) {
    // Fail on timeout or error
    return false;
  }
}

// Strong username validation
function isUsernameValid(username) {
  if (!username) return false;
  if (username.length < 3) return false;                  // too short
  if (/[^a-z0-9._%-]/i.test(username)) return false;     // invalid characters
  if (/(?:test|dummy|abc|pbkiller|spam)/i.test(username)) return false; // blacklist
  if (/\d{4,}/.test(username)) return false;             // excessive numbers
  if (/\s/.test(username)) return false;                 // spaces
  return true;
}

// Main handler
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const body = req.body;
  if (!body || !body.email) {
    return res.status(400).json({ status: 'error', message: 'Email is required.' });
  }

  const email = body.email.toLowerCase().trim();
  const customErrorMsg = 'Your email is invalid, please put a valid one.';

  // 1️⃣ Strict format check
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ status: 'error', message: customErrorMsg });
  }

  // 2️⃣ Username check
  const username = email.split('@')[0];
  if (!isUsernameValid(username)) {
    return res.status(400).json({ status: 'error', message: customErrorMsg });
  }

  // 3️⃣ Domain MX check
  const domainValid = await isDomainReal(email);
  if (!domainValid) {
    return res.status(400).json({ status: 'error', message: customErrorMsg });
  }

  // 4️⃣ Duplicate check in Supabase
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

    // ✅ Passed all checks
    return res.status(200).json({ exists: false, status: 'success' });

  } catch (err) {
    console.error('CheckDuplicate Error:', err);
    return res.status(500).json({ status: 'error', message: 'Server error' });
  }
}
