// Generic chat proxy: forwards the conversation + tool definitions to Claude.
// The actual tools (logging a workout, editing the schedule) are executed in
// the browser, not here — this function never sees or touches the user's
// saved data. Set your key in Netlify: Site settings → Environment variables
// → ANTHROPIC_API_KEY

const DAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const LIFT_FOCUS_KEYS = ["none", "back_bi", "chest_tri_shoulders", "legs"];

const TOOLS = [
  {
    name: "log_workout",
    description: "Log a completed run or lift workout for the user.",
    input_schema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["run", "lift"] },
        date: { type: "string", description: "YYYY-MM-DD, defaults to today if omitted" },
        distance: { type: "number", description: "Miles, required for type=run" },
        duration: { type: "number", description: "Minutes, required for type=run" },
        exercise: { type: "string", description: "Exercise name, required for type=lift" },
        sets: { type: "number", description: "Required for type=lift" },
        reps: { type: "number", description: "Reps per set, required for type=lift" },
        weight: { type: "number", description: "Weight in lb, required for type=lift (0 for bodyweight)" },
        notes: { type: "string" },
      },
      required: ["type"],
    },
  },
  {
    name: "update_schedule_day",
    description: "Change what's scheduled on a given day of the week (run, abs finisher, lift focus).",
    input_schema: {
      type: "object",
      properties: {
        day: { type: "string", enum: DAY_ORDER },
        run: { type: "boolean" },
        abs: { type: "boolean" },
        lift: { type: "string", enum: LIFT_FOCUS_KEYS },
      },
      required: ["day"],
    },
  },
  {
    name: "delete_last_workout",
    description: "Delete the most recently logged workout entry (undo).",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "create_strength_plan",
    description: "Start a new 5/3/1-style strength plan for a lift.",
    input_schema: {
      type: "object",
      properties: {
        exercise: { type: "string", description: "e.g. 'Back squat', 'Bench press'" },
        liftType: { type: "string", enum: ["upper", "lower"], description: "Determines how much the training max grows each cycle (+5lb upper, +10lb lower)" },
        trainingMax: { type: "number", description: "Training max in lb, roughly 90% of a true 1-rep max" },
        roundingIncrement: { type: "number", description: "Round weights to the nearest this many lb, defaults to 5" },
      },
      required: ["exercise", "liftType", "trainingMax"],
    },
  },
  {
    name: "log_plan_week",
    description: "Log the current week of an existing 5/3/1 plan (the next incomplete week in its latest cycle).",
    input_schema: {
      type: "object",
      properties: {
        exercise: { type: "string", description: "Must match an existing plan's exercise name" },
        actualReps: { type: "number", description: "Reps achieved on the AMRAP top set, required unless this week is a deload" },
      },
      required: ["exercise"],
    },
  },
  {
    name: "set_training_max",
    description: "Manually reset a plan's training max and start a fresh cycle at that number — use when the user wants to reset down after missed lifts, or adjust up/down for any reason.",
    input_schema: {
      type: "object",
      properties: {
        exercise: { type: "string", description: "Must match an existing plan's exercise name" },
        newTrainingMax: { type: "number" },
      },
      required: ["exercise", "newTrainingMax"],
    },
  },
];

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

  const messages = Array.isArray(payload.messages) ? payload.messages : [];
  const ctx = payload.context || {};

  const system = `You are a knowledgeable, encouraging strength and running coach inside the user's personal training log app.

Today is ${ctx.todayLabel || "unknown"}. Their weekly schedule (day: run?/lift focus/abs?): ${JSON.stringify(ctx.schedule || {})}.
Recent logged workouts, most recent first: ${JSON.stringify(ctx.recentWorkouts || [])}.
Current 5/3/1 strength plans: ${JSON.stringify(ctx.plans || [])}.

You can take actions using the provided tools: log_workout, update_schedule_day, delete_last_workout, create_strength_plan, log_plan_week, and set_training_max. Use them whenever the user describes something they did or asks you to change their schedule or plans — don't just describe what you'd do, actually call the tool. Every tool call is shown to the user as a confirmation prompt before it takes effect, so it's fine to act on a reasonable interpretation rather than over-clarifying; ask a brief question first only if a required detail is genuinely missing (e.g. they say "log my lift" with no exercise or numbers at all). After a tool result comes back, give a short, natural response — don't repeat the raw numbers back mechanically, and don't say "confirmed" since the user already saw that. For general questions (advice, how a lift felt, programming questions), just answer directly without using a tool. Keep responses conversational and concise.`;

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
        max_tokens: 1024,
        system,
        messages,
        tools: TOOLS,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return { statusCode: 502, body: JSON.stringify({ error: "Anthropic API error: " + errText.slice(0, 400) }) };
    }

    const data = await resp.json();
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: data.content, stop_reason: data.stop_reason }),
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: String((e && e.message) || e) }) };
  }
};
