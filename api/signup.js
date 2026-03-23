export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).end();
  }

  const SB_URL = "https://zuidgbvnyonyxzfsepox.supabase.co";
  const SB_KEY = process.env.SUPABASE_KEY;

  const body = req.body;
  const email = body.email;
  const ref = body.referred_by;

  if (!email) {
    return res.status(400).json({ error: "Email required" });
  }

  try {

    // check existing email
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

    if (existing.length > 0) {
      return res.status(200).json({
        status: "exists",
        data: existing[0]
      });
    }

    // get total users
    const totalRes = await fetch(
      `${SB_URL}/rest/v1/waitlist?select=id`,
      {
        headers: {
          apikey: SB_KEY,
          Authorization: `Bearer ${SB_KEY}`
        }
      }
    );

    const totalUsers = await totalRes.json();
    const position = totalUsers.length + 1;

    // insert user
    const insert = await fetch(`${SB_URL}/rest/v1/waitlist`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SB_KEY,
        Authorization: `Bearer ${SB_KEY}`,
        Prefer: "return=minimal"
      },
      body: JSON.stringify({
        ...body,
        position: position
      })
    });

    if (!insert.ok) {
      return res.status(500).json({ error: "Insert failed" });
    }

    // referral logic
    if (ref) {

      const refRes = await fetch(
        `${SB_URL}/rest/v1/waitlist?code=eq.${ref}&select=*`,
        {
          headers: {
            apikey: SB_KEY,
            Authorization: `Bearer ${SB_KEY}`
          }
        }
      );

      const refUser = await refRes.json();

      if (refUser.length > 0) {

        const currentPos = refUser[0].position;
        const newPos = Math.max(1, currentPos - 10);

        // shift users down
        await fetch(
          `${SB_URL}/rest/v1/waitlist?position=gte.${newPos}&position=lt.${currentPos}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              apikey: SB_KEY,
              Authorization: `Bearer ${SB_KEY}`
            },
            body: JSON.stringify({
              position: currentPos + 1
            })
          }
        );

        // update referrer
        await fetch(
          `${SB_URL}/rest/v1/waitlist?id=eq.${refUser[0].id}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              apikey: SB_KEY,
              Authorization: `Bearer ${SB_KEY}`
            },
            body: JSON.stringify({
              position: newPos
            })
          }
        );

      }

    }

    return res.status(200).json({
      status: "success"
    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      error: "Server error"
    });

  }

}
