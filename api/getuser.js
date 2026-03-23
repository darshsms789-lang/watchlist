import fetch from "node-fetch";

export default async function handler(req, res) {
  try {

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const SB_URL = "https://zuidgbvnyonyxzfsepox.supabase.co";
    const SB_KEY = process.env.SUPABASE_KEY;

    if (!SB_KEY) {
      return res.status(500).json({ error: "Supabase key missing" });
    }

    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ status: "no email" });
    }

    const response = await fetch(
      `${SB_URL}/rest/v1/waitlist?email=eq.${encodeURIComponent(email)}&select=*`,
      {
        method: "GET",
        headers: {
          apikey: SB_KEY,
          Authorization: `Bearer ${SB_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const rows = await response.json();

    if (rows && rows.length > 0) {
      return res.status(200).json({
        status: "found",
        data: rows[0]
      });
    } else {
      return res.status(404).json({
        status: "not found"
      });
    }

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Server error"
    });
  }
}
