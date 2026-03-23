export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {

    const token = req.body?.token;

    if (!token) {
      return res.status(400).json({ success: false, error: "No captcha token" });
    }

    const secret = process.env.TURNSTILE_SECRET;

    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          secret: secret,
          response: token
        })
      }
    );

    const data = await response.json();

    if (data.success) {
      return res.status(200).json({ success: true });
    }

    return res.status(403).json({
      success: false,
      error: "Captcha failed"
    });

  } catch (error) {

    console.error("VERIFY ERROR:", error);

    return res.status(500).json({
      success: false,
      error: "Server error"
    });

  }
}
