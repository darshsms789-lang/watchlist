export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {

    const SB_URL = "https://zuidgbvnyonyxzfsepox.supabase.co";
    const SB_KEY = process.env.SUPABASE_KEY;

    const body = req.body;
    const email = body.email;
    const referredBy = body.referred_by || null;

    if (!email) {
      return res.status(400).json({ error: "Email required" });
    }

    // check if email already exists
    const check = await fetch(
      `${SB_URL}/rest/v1/waitlist?email=eq.${encodeURIComponent(email)}&select=*`,
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

    // STEP 1 — decrease points of everyone by 1
    await fetch(`${SB_URL}/rest/v1/waitlist`, {
      method: "PATCH",
      headers: {
        apikey: SB_KEY,
        Authorization: `Bearer ${SB_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        points: "points-1"
      })
    });

    // STEP 2 — generate random points (500–1000)
    const points = Math.floor(Math.random() * (1000 - 500 + 1)) + 500;

    // STEP 3 — generate referral code
    const code = Math.random().toString(36).substring(2, 8);

    const newUser = {
      email: email,
      points: points,
      refs: 0,
      code: code,
      referred_by: referredBy
    };

    // STEP 4 — insert new user
    const insert = await fetch(`${SB_URL}/rest/v1/waitlist`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SB_KEY,
        Authorization: `Bearer ${SB_KEY}`,
        Prefer: "return=representation"
      },
      body: JSON.stringify(newUser)
    });

    const data = await insert.json();

    // STEP 5 — referral bonus
    if (referredBy) {

      await fetch(
        `${SB_URL}/rest/v1/waitlist?code=eq.${referredBy}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            apikey: SB_KEY,
            Authorization: `Bearer ${SB_KEY}`
          },
          body: JSON.stringify({
            refs: "refs+1",
            points: "points+10"
          })
        }
      );

    }

    return res.status(200).json({
      status: "success",
      user: data[0]
    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      status: "error"
    });

  }

}
