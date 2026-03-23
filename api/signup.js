export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {

    const SB_URL = "https://zuidgbvnyonyxzfsepox.supabase.co";
    const SB_KEY = process.env.SUPABASE_KEY;

    if (!SB_KEY) {
      return res.status(500).json({ error: "Supabase key missing" });
    }

    const body = req.body;

    if (!body.email) {
      return res.status(400).json({ error: "Email required" });
    }

    // detect user IP
    const ip =
      req.headers["x-forwarded-for"] ||
      req.socket?.remoteAddress ||
      "unknown";

    const userAgent = req.headers["user-agent"] || "unknown";

    // 1️⃣ check if email already exists
    const check = await fetch(
      `${SB_URL}/rest/v1/waitlist?email=eq.${encodeURIComponent(body.email)}&select=*`,
      {
        headers: {
          apikey: SB_KEY,
          Authorization: `Bearer ${SB_KEY}`
        }
      }
    );

    const existing = await check.json();

    if (existing && existing.length > 0) {
      return res.status(200).json({
        status: "exists",
        data: existing[0]
      });
    }

    // 2️⃣ limit signups per IP
    const ipCheck = await fetch(
      `${SB_URL}/rest/v1/waitlist?ip_address=eq.${ip}&select=email`,
      {
        headers: {
          apikey: SB_KEY,
          Authorization: `Bearer ${SB_KEY}`
        }
      }
    );

    const ipRows = await ipCheck.json();

    if (ipRows.length >= 3) {
      return res.status(403).json({
        error: "Too many signups from this network"
      });
    }

    // attach IP + device info
    body.ip_address = ip;
    body.user_agent = userAgent;

    // 3️⃣ insert new user
    const insert = await fetch(`${SB_URL}/rest/v1/waitlist`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SB_KEY,
        Authorization: `Bearer ${SB_KEY}`,
        Prefer: "return=minimal"
      },
      body: JSON.stringify(body)
    });

    if (insert.ok || insert.status === 201) {
      return res.status(200).json({
        status: "success"
      });
    }

    return res.status(500).json({
      status: "error"
    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      error: "Server error"
    });

  }
}
