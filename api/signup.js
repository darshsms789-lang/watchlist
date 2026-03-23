export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).end();
  }

  try {

    const SB_URL = "https://zuidgbvnyonyxzfsepox.supabase.co";
    const SB_KEY = process.env.SUPABASE_KEY;

    const body = req.body;

    // 1️⃣ check if email already exists
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

    if (existing && existing.length > 0) {
      return res.status(200).json({
        status: "exists",
        data: existing[0]
      });
    }

    // 2️⃣ count total users to generate index
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

    // 3️⃣ fake waitlist position logic (your friend's idea)
    let position;

    if (index < 100) {
      position = index;
    } 
    else if (index < 2000) {
      position = index * 100 * 10;
    } 
    else {
      position = index * 100;
    }

    // 4️⃣ insert new user
    const insert = await fetch(SB_URL + "/rest/v1/waitlist", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SB_KEY,
        Authorization: "Bearer " + SB_KEY,
        Prefer: "return=representation"
      },
      body: JSON.stringify({
        ...body,
        position: position
      })
    });

    const data = await insert.json();

    if (insert.ok) {

      return res.status(200).json({
        status: "success",
        position: position,
        data: data[0]
      });

    } else {

      return res.status(500).json({
        status: "error"
      });

    }

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      error: "Server error"
    });

  }

}
