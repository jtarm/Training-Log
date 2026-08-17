// This function runs on Netlify's servers, never in the browser — so your
// Anthropic API key stays private. Set it in Netlify under:
// Site settings → Environment variables → ANTHROPIC_API_KEY

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "The server is missing ANTHROPIC_API_KEY. Add it in Netlify: Site settings → Environment variables, then redeploy.",
      }),
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid request body." }) };
  }

  const focusLabel = typeof payload.focusLabel === "string" ? payload.focusLabel.slice(0, 100) : "general strength";
  const absIncluded = !!payload.absIncluded;
  const recentWorkouts = Array.isArray(payload.recentWorkouts) ? payload.recentWorkouts.slice(0, 15) : [];

  const prompt = `You are a strength coach helping an experienced lifter pick today's exercises.
Today's focus: ${focusLabel}.
${absIncluded ? "Also include exactly one ab/core finisher exercise." : "Do not include any ab/core exercises."}
Here is their recent lift history, most recent first (exercise name, weight, sets, reps): ${JSON.stringify(recentWorkouts)}

Pick 4 to 6 exercises for today that make sense for this focus. Prefer variety compared to the recent history where reasonable, while still covering the main movement patterns for this focus (e.g. a horizontal push, a vertical push, isolation work, etc. — adapt to whatever the focus actually is). For each exercise, give a sensible sets and reps target for an experienced lifter training for strength.

Respond with ONLY raw JSON, no markdown formatting, no code fences, no extra commentary, in exactly this shape:
{"summary":"one sentence, under 25 words","exercises":[{"name":"Exercise name","sets":3,"reps":"6-8","note":"reason in under 12 words"}]}`;

  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 700,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return { statusCode: 502, body: JSON.stringify({ error: "Anthropic API error: " + errText.slice(0, 400) }) };
    }

    const data = await resp.json();
    const text = (data.content || []).map((b) => b.text || "").join("");
    const clean = text.replace(/```json|```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch (e) {
      return { statusCode: 502, body: JSON.stringify({ error: "Couldn't parse the AI's response. Try again." }) };
    }

    if (!Array.isArray(parsed.exercises)) {
      return { statusCode: 502, body: JSON.stringify({ error: "AI response was missing exercises." }) };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed),
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: String((e && e.message) || e) }) };
  }
};
