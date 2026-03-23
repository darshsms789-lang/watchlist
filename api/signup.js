export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {

    const SB_URL = "https://zuidgbvnyonyxzfsepox.supabase.co";
    const SB_KEY = process.env.SUPABASE_KEY;

    const body = req.body;

    if (!body.email) {
      return res.status(400).json({ error: "Email required" });
    }

    // check if user exists
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

    if (existing.length > 0) {
      return res.status(200).json({
        status: "exists",
        data: existing[0]
      });
    }

    // get total users
    const countRes = await fetch(
      `${SB_URL}/rest/v1/waitlist?select=id`,
      {
        headers: {
          apikey: SB_KEY,
          Authorization: `Bearer ${SB_KEY}`
        }
      }
    );

    const users = await countRes.json();

    const position = users.length + 1000;

    const newUser = {
      ...body,
      position: position,
      refs: 0
    };

    // insert user
    const insert = await fetch(
      `${SB_URL}/rest/v1/waitlist`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SB_KEY,
          Authorization: `Bearer ${SB_KEY}`,
          Prefer: "return=representation"
        },
        body: JSON.stringify(newUser)
      }
    );

    const inserted = await insert.json();

    // handle referral
    if (body.referred_by) {

      const refCheck = await fetch(
        `${SB_URL}/rest/v1/waitlist?code=eq.${body.referred_by}&select=*`,
        {
          headers: {
            apikey: SB_KEY,
            Authorization: `Bearer ${SB_KEY}`
          }
        }
      );

      const refUser = await refCheck.json();

      if (refUser.length > 0) {

        const updatedRefs = refUser[0].refs + 1;
        const updatedPosition = refUser[0].position - 10;

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
              refs: updatedRefs,
              position: updatedPosition
            })
          }
        );

      }

    }

    return res.status(200).json({
      status: "success",
      data: inserted[0]
    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      error: "Server error"
    });

  }

}
