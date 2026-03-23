export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const SB_URL = "https://zuidgbvnyonyxzfsepox.supabase.co";
  const SB_KEY = process.env.SUPABASE_KEY;

  const body = req.body;

  // check if email already exists
  const check = await fetch(
    SB_URL + "/rest/v1/waitlist?email=eq." + encodeURIComponent(body.email) + "&select=*",
    {
      headers: {
        apikey: SB_KEY,
        Authorization: "Bearer " + SB_KEY
      }
    }
  );

  const existing = await check.json();

  if (existing.length > 0) {
    return res.status(200).json({
      status: "exists",
      data: existing[0]
    });
  }

  // get total users (real index)
  const countRes = await fetch(
    SB_URL + "/rest/v1/waitlist?select=id",
    {
      headers: {
        apikey: SB_KEY,
        Authorization: "Bearer " + SB_KEY
      }
    }
  );

  const users = await countRes.json();

  const index = users.length + 1;
