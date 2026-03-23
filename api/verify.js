export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = req.body.token;
  const secret = process.env.TURNSTILE_SECRET;

  if (!token) {
    return res.status(400).json({ success: false, error: "No token" });
  }

  try {
    const formData = new URLSearchParams();
    formData.append("secret", secret);
    formData.append("response", token);

    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        body: formData
      }
    );

    const data = await response.json();

    if (data.success) {
      return res.status(200).json({ success: true });
    } else {
      return res.status(403).json({ success: false, error: "Captcha failed" });
    }

  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, error: "Server error" });
  }
}
