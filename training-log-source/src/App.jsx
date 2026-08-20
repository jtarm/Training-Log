import { useState, useEffect, useCallback } from "react";
import { Plus, Dumbbell, Footprints, Calendar, TrendingUp, Trash2, ChevronRight, ChevronDown, Check, X, Loader2, ListChecks, ArrowRight, RefreshCw, MessageCircle, Send, Maximize2, Minimize2 } from "lucide-react";

const UNIT = "lb";

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(d) {
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

const DAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_LABEL = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };
const DAY_SHORT = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };

function todayKey() {
  return DAY_ORDER[(new Date().getDay() + 6) % 7]; // getDay(): 0=Sun..6=Sat -> shift so mon=0
}

const LIFT_FOCUS_META = {
  none: { label: "Rest", categories: [] },
  back_bi: {
    label: "Back / biceps",
    categories: [
      { name: "Vertical pull", options: ["Pull-ups", "Lat pulldown", "Chin-ups"] },
      { name: "Horizontal pull", options: ["Barbell row", "Seated cable row", "Chest-supported row", "Single-arm dumbbell row"] },
      { name: "Posterior chain", options: ["Deadlift", "Rack pull"] },
      { name: "Rear delt", options: ["Face pull", "Reverse fly"] },
      { name: "Biceps", options: ["Barbell curl", "Dumbbell curl", "Hammer curl", "Preacher curl", "Cable curl"] },
    ],
  },
  chest_tri_shoulders: {
    label: "Chest / triceps / shoulders",
    categories: [
      { name: "Horizontal push", options: ["Bench press", "Incline dumbbell press", "Dumbbell bench press", "Machine chest press"] },
      { name: "Vertical push", options: ["Overhead press", "Dumbbell shoulder press", "Push press"] },
      { name: "Chest isolation", options: ["Cable fly", "Pec deck", "Dumbbell fly"] },
      { name: "Shoulder isolation", options: ["Lateral raise", "Front raise"] },
      { name: "Triceps", options: ["Tricep pushdown", "Skull crushers", "Overhead tricep extension", "Close-grip bench press"] },
    ],
  },
  legs: {
    label: "Legs",
    categories: [
      { name: "Squat pattern", options: ["Back squat", "Front squat", "Goblet squat"] },
      { name: "Hip hinge", options: ["Romanian deadlift", "Good morning"] },
      { name: "Unilateral", options: ["Bulgarian split squat", "Walking lunge", "Step-up"] },
      { name: "Hamstrings", options: ["Leg curl", "Nordic curl"] },
      { name: "Quads", options: ["Leg extension", "Leg press"] },
      { name: "Calves", options: ["Standing calf raise", "Seated calf raise"] },
    ],
  },
};

// Picks one exercise per movement-pattern category, preferring options that
// haven't shown up in your recent lift log, so the suggestions rotate.
function generateFromCategories(categories, workouts) {
  if (!categories || categories.length === 0) return [];

  const RECENT_WINDOW = 10; // most recent lift sessions to treat as "recently done"
  const recentExerciseNames = new Set(
    workouts
      .filter((w) => w.type === "lift")
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, RECENT_WINDOW)
      .map((w) => w.exercise)
  );

  return categories.map((cat) => {
    const fresh = cat.options.filter((o) => !recentExerciseNames.has(o));
    const pool = fresh.length > 0 ? fresh : cat.options;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    return { category: cat.name, exercise: pick };
  });
}

function generateSuggestions(focusKey, workouts) {
  const meta = LIFT_FOCUS_META[focusKey];
  if (!meta) return [];
  return generateFromCategories(meta.categories, workouts);
}

const ABS_CATEGORIES = [
  { name: "Anti-extension", options: ["Plank", "Ab wheel rollout", "Dead bug"] },
  { name: "Flexion", options: ["Cable crunch", "Hanging leg raise", "Decline sit-up", "Reverse crunch"] },
  { name: "Anti-rotation", options: ["Pallof press", "Side plank"] },
];

function generateAbsSuggestions(workouts) {
  return generateFromCategories(ABS_CATEGORIES, workouts);
}

const DEFAULT_SCHEDULE = {
  mon: { run: true, lift: "chest_tri_shoulders", abs: true },
  tue: { run: true, lift: "back_bi", abs: true },
  wed: { run: true, lift: "chest_tri_shoulders", abs: false },
  thu: { run: true, lift: "back_bi", abs: true },
  fri: { run: false, lift: "legs", abs: true },
  sat: { run: false, lift: "none", abs: false },
  sun: { run: false, lift: "none", abs: false },
};

export default function WorkoutTracker() {
  const [tab, setTab] = useState("schedule");
  const [workouts, setWorkouts] = useState([]);
  const [plans, setPlans] = useState([]);
  const [schedule, setSchedule] = useState(DEFAULT_SCHEDULE);
  const [loaded, setLoaded] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [prefill, setPrefill] = useState(null);

  // load on mount
  useEffect(() => {
    (async () => {
      try {
        const w = await window.storage.get("workouts");
        setWorkouts(w ? JSON.parse(w.value) : []);
      } catch (e) {
        setWorkouts([]);
      }
      try {
        const p = await window.storage.get("strength-plans");
        setPlans(p ? JSON.parse(p.value) : []);
      } catch (e) {
        setPlans([]);
      }
      try {
        const s = await window.storage.get("schedule");
        setSchedule(s ? JSON.parse(s.value) : DEFAULT_SCHEDULE);
      } catch (e) {
        setSchedule(DEFAULT_SCHEDULE);
      }
      setLoaded(true);
    })();
  }, []);

  const persistWorkouts = useCallback(async (next) => {
    setWorkouts(next);
    try {
      const res = await window.storage.set("workouts", JSON.stringify(next));
      if (!res) setSaveError(true);
    } catch (e) {
      setSaveError(true);
    }
  }, []);

  const persistPlans = useCallback(async (next) => {
    setPlans(next);
    try {
      const res = await window.storage.set("strength-plans", JSON.stringify(next));
      if (!res) setSaveError(true);
    } catch (e) {
      setSaveError(true);
    }
  }, []);

  const persistSchedule = useCallback(async (next) => {
    setSchedule(next);
    try {
      const res = await window.storage.set("schedule", JSON.stringify(next));
      if (!res) setSaveError(true);
    } catch (e) {
      setSaveError(true);
    }
  }, []);

  function goLogExercise(exercise, extra = {}) {
    setPrefill({ type: "lift", exercise, ...extra });
    setTab("log");
  }

  if (!loaded) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300, color: "#5b6b82", fontFamily: "system-ui, sans-serif" }}>
        <Loader2 size={20} style={{ animation: "spin 1s linear infinite", marginRight: 8 }} />
        Loading your log…
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif", background: "#ffffff", color: "#0f172a", minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <Header tab={tab} setTab={setTab} />
      {saveError && (
        <div style={{ background: "#fee2e2", color: "#dc2626", fontSize: 12, padding: "8px 20px", borderBottom: "1px solid #dbe4f0" }}>
          Couldn't save changes — your data may not persist. Try again in a moment.
        </div>
      )}
      <div style={{ padding: "20px 20px 28px", flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        {tab === "schedule" && <Schedule schedule={schedule} workouts={workouts} onSave={persistSchedule} onLogExercise={goLogExercise} />}
        {tab === "log" && <LogForm workouts={workouts} onSave={persistWorkouts} prefill={prefill} onConsumePrefill={() => setPrefill(null)} />}
        {tab === "history" && <History workouts={workouts} onSave={persistWorkouts} />}
        {tab === "plan" && <StrengthPlan plans={plans} onSave={persistPlans} />}
        {tab === "coach" && (
          <Coach
            workouts={workouts}
            schedule={schedule}
            plans={plans}
            onSaveWorkouts={persistWorkouts}
            onSaveSchedule={persistSchedule}
            onSavePlans={persistPlans}
          />
        )}
      </div>
    </div>
  );
}

function Header({ tab, setTab }) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }

  const tabs = [
    { id: "schedule", label: "Schedule", icon: ListChecks },
    { id: "coach", label: "Coach", icon: MessageCircle },
    { id: "log", label: "Log workout", icon: Plus },
    { id: "history", label: "History", icon: Calendar },
    { id: "plan", label: "Strength plan", icon: TrendingUp },
  ];
  return (
    <div style={{ borderBottom: "1px solid #dbe4f0", padding: "18px 20px 0" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: "-0.02em" }}>Training log</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 12, color: "#5b6b82", fontFamily: "'JetBrains Mono', monospace" }}>{formatDate(todayStr())}</div>
          {typeof document !== "undefined" && document.documentElement.requestFullscreen && (
            <button
              onClick={toggleFullscreen}
              title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: 6, border: "1px solid #dbe4f0", background: "transparent", color: "#5b6b82", cursor: "pointer" }}
            >
              {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </button>
          )}
        </div>
      </div>
      <div style={{ display: "flex", gap: 4 }}>
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "9px 14px",
                fontSize: 13,
                fontWeight: 500,
                background: "transparent",
                border: "none",
                borderBottom: active ? "2px solid #2563eb" : "2px solid transparent",
                color: active ? "#0f172a" : "#5b6b82",
                cursor: "pointer",
                transition: "color 0.15s",
              }}
            >
              <Icon size={15} />
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SegButton({ options, value, onChange }) {
  return (
    <div style={{ display: "flex", background: "#f4f7fb", borderRadius: 10, padding: 3, gap: 3 }}>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            padding: "9px 0",
            borderRadius: 8,
            border: "none",
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
            background: value === opt.value ? "#dbeafe" : "transparent",
            color: value === opt.value ? "#0f172a" : "#5b6b82",
          }}
        >
          {opt.icon}
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function field(label) {
  return { fontSize: 12, color: "#5b6b82", marginBottom: 6, display: "block", fontWeight: 500 };
}

const inputStyle = {
  width: "100%",
  background: "#f4f7fb",
  border: "1px solid #c7d5e8",
  borderRadius: 8,
  padding: "10px 12px",
  color: "#0f172a",
  fontSize: 14,
  boxSizing: "border-box",
  outline: "none",
};

function LogForm({ workouts, onSave, prefill, onConsumePrefill }) {
  const [type, setType] = useState("run");
  const [date, setDate] = useState(todayStr());
  const [distance, setDistance] = useState("");
  const [duration, setDuration] = useState("");
  const [exercise, setExercise] = useState("");
  const [sets, setSets] = useState("");
  const [reps, setReps] = useState("");
  const [weight, setWeight] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    if (!prefill) return;
    setType(prefill.type);
    setExercise(prefill.exercise || "");
    if (prefill.sets) setSets(String(prefill.sets));
    if (prefill.notes) setNotes(prefill.notes);
    if (onConsumePrefill) onConsumePrefill();
  }, [prefill, onConsumePrefill]);

  function reset() {
    setDistance(""); setDuration(""); setExercise(""); setSets(""); setReps(""); setWeight(""); setNotes("");
  }

  function handleSubmit() {
    if (type === "run") {
      if (!distance || Number(distance) <= 0) return setError("Enter a distance greater than 0.");
      if (!duration || Number(duration) <= 0) return setError("Enter a duration greater than 0.");
    } else {
      if (!exercise.trim()) return setError("Enter an exercise name.");
      if (!sets || Number(sets) <= 0) return setError("Enter number of sets.");
      if (!reps || Number(reps) <= 0) return setError("Enter reps per set.");
      if (weight === "" || Number(weight) < 0) return setError("Enter a weight (0 for bodyweight).");
    }
    setError("");
    const entry = type === "run"
      ? { id: uid(), type: "run", date, distance: Number(distance), duration: Number(duration), notes }
      : { id: uid(), type: "lift", date, exercise: exercise.trim(), sets: Number(sets), reps: Number(reps), weight: Number(weight), notes };
    onSave([entry, ...workouts]);
    reset();
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1800);
  }

  return (
    <div>
      <SegButton
        value={type}
        onChange={(v) => { setType(v); setError(""); }}
        options={[
          { value: "run", label: "Run", icon: <Footprints size={15} /> },
          { value: "lift", label: "Lift", icon: <Dumbbell size={15} /> },
        ]}
      />

      <div style={{ marginTop: 18 }}>
        <label style={field()}>Date</label>
        <input type="date" style={inputStyle} value={date} max={todayStr()} onChange={(e) => setDate(e.target.value)} />
      </div>

      {type === "run" ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
          <div>
            <label style={field()}>Distance (miles)</label>
            <input type="number" min="0" step="0.01" style={inputStyle} placeholder="3.1" value={distance} onChange={(e) => setDistance(e.target.value)} />
          </div>
          <div>
            <label style={field()}>Duration (minutes)</label>
            <input type="number" min="0" step="0.5" style={inputStyle} placeholder="28" value={duration} onChange={(e) => setDuration(e.target.value)} />
          </div>
        </div>
      ) : (
        <>
          <div style={{ marginTop: 14 }}>
            <label style={field()}>Exercise</label>
            <input type="text" style={inputStyle} placeholder="Back squat" value={exercise} onChange={(e) => setExercise(e.target.value)} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 14 }}>
            <div>
              <label style={field()}>Sets</label>
              <input type="number" min="0" style={inputStyle} placeholder="3" value={sets} onChange={(e) => setSets(e.target.value)} />
            </div>
            <div>
              <label style={field()}>Reps</label>
              <input type="number" min="0" style={inputStyle} placeholder="5" value={reps} onChange={(e) => setReps(e.target.value)} />
            </div>
            <div>
              <label style={field()}>Weight ({UNIT})</label>
              <input type="number" min="0" style={inputStyle} placeholder="135" value={weight} onChange={(e) => setWeight(e.target.value)} />
            </div>
          </div>
        </>
      )}

      <div style={{ marginTop: 14 }}>
        <label style={field()}>Notes (optional)</label>
        <input type="text" style={inputStyle} placeholder="How it felt, conditions, etc." value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      {error && <div style={{ color: "#dc2626", fontSize: 13, marginTop: 12 }}>{error}</div>}

      <button
        onClick={handleSubmit}
        style={{
          marginTop: 18,
          width: "100%",
          padding: "12px 0",
          borderRadius: 8,
          border: "none",
          background: justSaved ? "#16a34a" : "#2563eb",
          color: "#ffffff",
          fontSize: 14,
          fontWeight: 600,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          transition: "background 0.2s",
        }}
      >
        {justSaved ? <><Check size={16} /> Saved</> : "Log workout"}
      </button>
    </div>
  );
}

function Schedule({ schedule, workouts, onSave, onLogExercise }) {
  const [editingDay, setEditingDay] = useState(null);
  const today = todayKey();
  const todayEntry = schedule[today];
  const todayFocus = LIFT_FOCUS_META[todayEntry.lift];
  const [suggestions, setSuggestions] = useState(() => generateSuggestions(todayEntry.lift, workouts));
  const [absSuggestions, setAbsSuggestions] = useState(() => (todayEntry.abs ? generateAbsSuggestions(workouts) : []));

  useEffect(() => {
    setSuggestions(generateSuggestions(todayEntry.lift, workouts));
    setAbsSuggestions(todayEntry.abs ? generateAbsSuggestions(workouts) : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayEntry.lift, todayEntry.abs]);

  function updateDay(day, patch) {
    onSave({ ...schedule, [day]: { ...schedule[day], ...patch } });
  }

  return (
    <div>
      <div style={{ fontSize: 12, color: "#5b6b82", fontWeight: 500, marginBottom: 8, letterSpacing: "0.02em", textTransform: "uppercase" }}>
        Today · {DAY_LABEL[today]}
      </div>
      <div style={{ background: "#f4f7fb", border: "1px solid #dbe4f0", borderRadius: 10, padding: 16, marginBottom: 22 }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 14 }}>
          {todayEntry.run && (
            <span style={{ display: "flex", alignItems: "center", gap: 6, background: "#dcfce7", color: "#16a34a", fontSize: 12.5, fontWeight: 500, padding: "5px 11px", borderRadius: 999 }}>
              <Footprints size={13} /> Run
            </span>
          )}
          <span style={{ display: "flex", alignItems: "center", gap: 6, background: todayEntry.lift === "none" ? "#f1f5f9" : "#dbeafe", color: todayEntry.lift === "none" ? "#5b6b82" : "#d97706", fontSize: 12.5, fontWeight: 500, padding: "5px 11px", borderRadius: 999 }}>
            <Dumbbell size={13} /> {todayFocus.label}
          </span>
          {todayEntry.abs && (
            <span style={{ display: "flex", alignItems: "center", gap: 6, background: "#eef2ff", color: "#4f46e5", fontSize: 12.5, fontWeight: 500, padding: "5px 11px", borderRadius: 999 }}>
              Abs
            </span>
          )}
          {suggestions.length > 0 && (
            <button
              onClick={() => { setSuggestions(generateSuggestions(todayEntry.lift, workouts)); if (todayEntry.abs) setAbsSuggestions(generateAbsSuggestions(workouts)); }}
              style={{ display: "flex", alignItems: "center", gap: 5, marginLeft: "auto", background: "none", border: "1px solid #c7d5e8", borderRadius: 999, padding: "5px 11px", color: "#5b6b82", fontSize: 12, cursor: "pointer" }}
            >
              <RefreshCw size={12} /> Shuffle
            </button>
          )}
        </div>

        {suggestions.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {suggestions.map((s) => (
              <button
                key={s.category}
                onClick={() => onLogExercise(s.exercise)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  width: "100%", textAlign: "left", background: "#ffffff", border: "1px solid #e2e8f3",
                  borderRadius: 8, padding: "10px 12px", color: "#0f172a", fontSize: 13.5, cursor: "pointer",
                }}
              >
                <span>
                  {s.exercise}
                  <span style={{ color: "#8595ab", fontSize: 11.5, marginLeft: 8 }}>{s.category}</span>
                </span>
                <ArrowRight size={14} color="#8595ab" />
              </button>
            ))}
          </div>
        )}

        {absSuggestions.length > 0 && (
          <div style={{ marginTop: suggestions.length > 0 ? 14 : 0 }}>
            <div style={{ fontSize: 11.5, color: "#4f46e5", fontWeight: 500, marginBottom: 6, letterSpacing: "0.02em", textTransform: "uppercase" }}>
              Abs finisher
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {absSuggestions.map((s) => (
                <button
                  key={s.category}
                  onClick={() => onLogExercise(s.exercise)}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    width: "100%", textAlign: "left", background: "#ffffff", border: "1px solid #e2e8f3",
                    borderRadius: 8, padding: "10px 12px", color: "#0f172a", fontSize: 13.5, cursor: "pointer",
                  }}
                >
                  <span>
                    {s.exercise}
                    <span style={{ color: "#8595ab", fontSize: 11.5, marginLeft: 8 }}>{s.category}</span>
                  </span>
                  <ArrowRight size={14} color="#8595ab" />
                </button>
              ))}
            </div>
          </div>
        )}

        {suggestions.length === 0 && absSuggestions.length === 0 && !todayEntry.run && (
          <div style={{ fontSize: 13, color: "#5b6b82" }}>Rest day. Recovery is part of the plan.</div>
        )}

        <AiSuggest focusLabel={todayFocus.label} absIncluded={todayEntry.abs} workouts={workouts} onLogExercise={onLogExercise} />
      </div>

      <div style={{ fontSize: 12, color: "#5b6b82", fontWeight: 500, marginBottom: 8, letterSpacing: "0.02em", textTransform: "uppercase" }}>
        This week
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {DAY_ORDER.map((day) => {
          const entry = schedule[day];
          const focus = LIFT_FOCUS_META[entry.lift];
          const isToday = day === today;
          const isEditing = editingDay === day;
          return (
            <div key={day} style={{ background: isToday ? "#eff6ff" : "#f4f7fb", border: "1px solid " + (isToday ? "#93c5fd" : "#dbe4f0"), borderRadius: 10, padding: "10px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => setEditingDay(isEditing ? null : day)}>
                <div style={{ width: 40, fontSize: 13, fontWeight: 500, color: isToday ? "#d97706" : "#0f172a" }}>{DAY_SHORT[day]}</div>
                <div style={{ flex: 1, fontSize: 13, color: "#64748b" }}>
                  {entry.run ? "Run · " : ""}{focus.label}{entry.abs ? " · Abs" : ""}
                </div>
                {isEditing ? <ChevronDown size={15} color="#8595ab" /> : <ChevronRight size={15} color="#8595ab" />}
              </div>

              {isEditing && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #dbe4f0" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#64748b", marginBottom: 10, cursor: "pointer" }}>
                    <input type="checkbox" checked={entry.run} onChange={(e) => updateDay(day, { run: e.target.checked })} />
                    Run this day
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#64748b", marginBottom: 12, cursor: "pointer" }}>
                    <input type="checkbox" checked={entry.abs} onChange={(e) => updateDay(day, { abs: e.target.checked })} />
                    Abs finisher this day
                  </label>
                  <label style={field()}>Lift focus</label>
                  <select
                    value={entry.lift}
                    onChange={(e) => updateDay(day, { lift: e.target.value })}
                    style={{ ...inputStyle, cursor: "pointer" }}
                  >
                    {Object.entries(LIFT_FOCUS_META).map(([key, meta]) => (
                      <option key={key} value={key}>{meta.label}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Calls a backend function (not included in this artifact preview — see the
// deployed project's netlify/functions/suggest-workout.js) which holds the
// Anthropic API key server-side and asks Claude for a workout suggestion.
function AiSuggest({ focusLabel, absIncluded, workouts, onLogExercise }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  async function ask() {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const recentWorkouts = workouts
        .filter((w) => w.type === "lift")
        .sort((a, b) => (a.date < b.date ? 1 : -1))
        .slice(0, 15)
        .map((w) => ({ exercise: w.exercise, weight: w.weight, sets: w.sets, reps: w.reps, date: w.date }));

      const resp = await fetch("/.netlify/functions/suggest-workout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ focusLabel, absIncluded, recentWorkouts }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Something went wrong.");
      if (!Array.isArray(data.exercises)) throw new Error("Unexpected response from the AI.");
      setResult(data);
    } catch (e) {
      setError(e.message || "Couldn't reach the AI suggester.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #dbe4f0" }}>
      <button
        onClick={ask}
        disabled={loading}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 7, width: "100%",
          padding: "10px 0", borderRadius: 8, border: "1px solid #c7d2fe", background: "#eef2ff",
          color: "#4f46e5", fontSize: 13, fontWeight: 600, cursor: loading ? "default" : "pointer", opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : "✨"}
        {loading ? "Asking Claude…" : "Ask AI for today's workout"}
      </button>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {error && (
        <div style={{ marginTop: 10, fontSize: 12.5, color: "#d97706", lineHeight: 1.5 }}>
          {error}
        </div>
      )}

      {result && (
        <div style={{ marginTop: 12 }}>
          {result.summary && <div style={{ fontSize: 12.5, color: "#5b6b82", marginBottom: 10, lineHeight: 1.5 }}>{result.summary}</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {result.exercises.map((ex, i) => (
              <button
                key={i}
                onClick={() => onLogExercise(ex.name, { sets: ex.sets, notes: `AI suggested ${ex.reps} reps${ex.note ? " — " + ex.note : ""}` })}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  width: "100%", textAlign: "left", background: "#ffffff", border: "1px solid #e0e7ff",
                  borderRadius: 8, padding: "10px 12px", color: "#0f172a", fontSize: 13.5, cursor: "pointer",
                }}
              >
                <span>
                  {ex.name}
                  <span style={{ color: "#8595ab", fontSize: 11.5, marginLeft: 8 }}>{ex.sets}×{ex.reps}</span>
                </span>
                <ArrowRight size={14} color="#8595ab" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function executeTool(name, input, ctx) {
  const { workouts, schedule, plans, onSaveWorkouts, onSaveSchedule, onSavePlans } = ctx;

  if (name === "log_workout") {
    const type = input.type;
    if (type !== "run" && type !== "lift") return { ok: false, error: "type must be 'run' or 'lift'." };
    const date = input.date || todayStr();

    if (type === "run") {
      const distance = Number(input.distance);
      const duration = Number(input.duration);
      if (!distance || distance <= 0) return { ok: false, error: "distance must be greater than 0." };
      if (!duration || duration <= 0) return { ok: false, error: "duration must be greater than 0." };
      const entry = { id: uid(), type: "run", date, distance, duration, notes: input.notes || "" };
      onSaveWorkouts([entry, ...workouts]);
      return { ok: true, logged: entry };
    } else {
      const exercise = (input.exercise || "").trim();
      const sets = Number(input.sets);
      const reps = Number(input.reps);
      const weight = Number(input.weight);
      if (!exercise) return { ok: false, error: "exercise name is required." };
      if (!sets || sets <= 0) return { ok: false, error: "sets must be greater than 0." };
      if (!reps || reps <= 0) return { ok: false, error: "reps must be greater than 0." };
      if (input.weight === undefined || isNaN(weight) || weight < 0) return { ok: false, error: "weight must be 0 or greater." };
      const entry = { id: uid(), type: "lift", date, exercise, sets, reps, weight, notes: input.notes || "" };
      onSaveWorkouts([entry, ...workouts]);
      return { ok: true, logged: entry };
    }
  }

  if (name === "update_schedule_day") {
    const day = input.day;
    if (!DAY_ORDER.includes(day)) return { ok: false, error: "day must be one of " + DAY_ORDER.join(", ") };
    if (input.lift !== undefined && !Object.keys(LIFT_FOCUS_META).includes(input.lift)) {
      return { ok: false, error: "lift must be one of " + Object.keys(LIFT_FOCUS_META).join(", ") };
    }
    const patch = {};
    if (input.run !== undefined) patch.run = !!input.run;
    if (input.abs !== undefined) patch.abs = !!input.abs;
    if (input.lift !== undefined) patch.lift = input.lift;
    const updated = { ...schedule[day], ...patch };
    onSaveSchedule({ ...schedule, [day]: updated });
    return { ok: true, day, updated };
  }

  if (name === "delete_last_workout") {
    if (workouts.length === 0) return { ok: false, error: "No workouts logged yet." };
    const [removed, ...rest] = workouts;
    onSaveWorkouts(rest);
    return { ok: true, deleted: removed };
  }

  if (name === "create_strength_plan") {
    const exercise = (input.exercise || "").trim();
    const liftType = input.liftType;
    const trainingMax = Number(input.trainingMax);
    const roundingIncrement = Number(input.roundingIncrement) || 5;
    if (!exercise) return { ok: false, error: "exercise name is required." };
    if (liftType !== "upper" && liftType !== "lower") return { ok: false, error: "liftType must be 'upper' or 'lower'." };
    if (!trainingMax || trainingMax <= 0) return { ok: false, error: "trainingMax must be greater than 0." };
    const tm = roundTo(trainingMax, roundingIncrement);
    const plan = {
      id: uid(),
      exercise,
      liftType,
      roundingIncrement,
      cycleIncrement: liftType === "lower" ? 10 : 5,
      createdDate: todayStr(),
      cycles: [buildCycle(1, tm, roundingIncrement)],
    };
    onSavePlans([plan, ...plans]);
    return { ok: true, exercise, tm };
  }

  if (name === "log_plan_week") {
    const exercise = (input.exercise || "").trim().toLowerCase();
    const plan = plans.find((p) => p.exercise.trim().toLowerCase() === exercise);
    if (!plan) return { ok: false, error: `No strength plan found for "${input.exercise}". Existing plans: ${plans.map((p) => p.exercise).join(", ") || "none"}.` };
    const currentCycle = plan.cycles[plan.cycles.length - 1];
    const week = currentCycle.weeks.find((w) => !w.completed);
    if (!week) return { ok: false, error: `${plan.exercise}'s current cycle is already complete. Start the next cycle or reset the training max.` };
    if (week.amrap && (input.actualReps === undefined || input.actualReps === null)) {
      return { ok: false, error: "actualReps is required to log this week (it has an AMRAP top set)." };
    }
    const patch = week.amrap ? { actualReps: Number(input.actualReps), completed: true } : { completed: true };
    const cycles = plan.cycles.map((c) =>
      c.cycleNum !== currentCycle.cycleNum ? c : { ...c, weeks: c.weeks.map((w) => (w.week === week.week ? { ...w, ...patch } : w)) }
    );
    onSavePlans(plans.map((p) => (p.id === plan.id ? { ...p, cycles } : p)));
    const topTarget = week.sets[week.sets.length - 1];
    const hit = week.amrap ? Number(input.actualReps) >= minTarget(topTarget.targetReps) : null;
    return { ok: true, exercise: plan.exercise, weekLabel: week.label, amrap: week.amrap, actualReps: week.amrap ? Number(input.actualReps) : null, hit };
  }

  if (name === "set_training_max") {
    const exercise = (input.exercise || "").trim().toLowerCase();
    const plan = plans.find((p) => p.exercise.trim().toLowerCase() === exercise);
    if (!plan) return { ok: false, error: `No strength plan found for "${input.exercise}". Existing plans: ${plans.map((p) => p.exercise).join(", ") || "none"}.` };
    const newMax = Number(input.newTrainingMax);
    if (!newMax || newMax <= 0) return { ok: false, error: "newTrainingMax must be greater than 0." };
    const lastCycle = plan.cycles[plan.cycles.length - 1];
    const tm = roundTo(newMax, plan.roundingIncrement);
    const newCycle = buildCycle(lastCycle.cycleNum + 1, tm, plan.roundingIncrement);
    onSavePlans(plans.map((p) => (p.id === plan.id ? { ...p, cycles: [...p.cycles, newCycle] } : p)));
    return { ok: true, exercise: plan.exercise, newCycleNum: newCycle.cycleNum, newTm: tm };
  }

  return { ok: false, error: "Unknown tool: " + name };
}

function describeToolResult(name, input, result) {
  if (!result.ok) return "⚠️ " + result.error;
  if (name === "log_workout") {
    const l = result.logged;
    return l.type === "run"
      ? `✓ Logged: ${l.distance} mi run, ${l.duration} min`
      : `✓ Logged: ${l.exercise} — ${l.sets}×${l.reps} @ ${l.weight}${UNIT}`;
  }
  if (name === "update_schedule_day") {
    return `✓ Updated ${DAY_LABEL[result.day]}: ${result.updated.run ? "run · " : ""}${LIFT_FOCUS_META[result.updated.lift].label}${result.updated.abs ? " · abs" : ""}`;
  }
  if (name === "delete_last_workout") {
    const d = result.deleted;
    return `✓ Removed: ${d.type === "run" ? d.distance + " mi run" : d.exercise} (${formatDate(d.date)})`;
  }
  if (name === "create_strength_plan") {
    return `✓ Created 5/3/1 plan: ${result.exercise} at ${result.tm}${UNIT} TM`;
  }
  if (name === "log_plan_week") {
    return `✓ Logged ${result.exercise} ${result.weekLabel}${result.amrap ? ` — ${result.actualReps} reps (${result.hit ? "hit target" : "missed target"})` : ""}`;
  }
  if (name === "set_training_max") {
    return `✓ ${result.exercise}: new cycle ${result.newCycleNum} at ${result.newTm}${UNIT} TM`;
  }
  return "✓ Done";
}

function describeProposedAction(name, input) {
  if (name === "log_workout") {
    return input.type === "run"
      ? `Log: ${input.distance ?? "?"} mi run, ${input.duration ?? "?"} min`
      : `Log: ${input.exercise || "?"} — ${input.sets ?? "?"}×${input.reps ?? "?"} @ ${input.weight ?? "?"}${UNIT}`;
  }
  if (name === "update_schedule_day") {
    const parts = [];
    if (input.run !== undefined) parts.push(input.run ? "run" : "no run");
    if (input.lift !== undefined) parts.push(LIFT_FOCUS_META[input.lift]?.label || input.lift);
    if (input.abs !== undefined) parts.push(input.abs ? "abs" : "no abs");
    return `Update ${DAY_LABEL[input.day] || input.day}: ${parts.join(" · ") || "no changes"}`;
  }
  if (name === "delete_last_workout") return "Delete your most recently logged workout";
  if (name === "create_strength_plan") return `Create a 5/3/1 plan: ${input.exercise || "?"} at ${input.trainingMax ?? "?"}${UNIT} TM`;
  if (name === "log_plan_week") return `Log this week for ${input.exercise || "?"}${input.actualReps !== undefined ? ` — ${input.actualReps} reps` : ""}`;
  if (name === "set_training_max") return `Reset ${input.exercise || "?"} training max to ${input.newTrainingMax ?? "?"}${UNIT}`;
  return `Run ${name}`;
}

function Coach({ workouts, schedule, plans, onSaveWorkouts, onSaveSchedule, onSavePlans }) {
  const [apiMessages, setApiMessages] = useState([]); // full Anthropic-format history, sent to the API
  const [chatLog, setChatLog] = useState([]); // simplified list for display
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(null); // { toolUses, messages } awaiting user confirmation
  const [loadedChat, setLoadedChat] = useState(false);

  // Load saved chat history on mount.
  useEffect(() => {
    (async () => {
      try {
        const saved = await window.storage.get("coach-chat");
        if (saved) {
          const parsed = JSON.parse(saved.value);
          setApiMessages(parsed.apiMessages || []);
          setChatLog(parsed.chatLog || []);
        }
      } catch (e) {
        // no saved chat yet
      }
      setLoadedChat(true);
    })();
  }, []);

  // Persist chat history whenever it changes (after the initial load).
  useEffect(() => {
    if (!loadedChat) return;
    window.storage.set("coach-chat", JSON.stringify({ apiMessages, chatLog })).catch(() => {});
  }, [apiMessages, chatLog, loadedChat]);

  function buildContext() {
    const today = todayKey();
    const recentWorkouts = workouts
      .slice()
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, 15);
    const planSummaries = plans.map((p) => {
      const c = p.cycles[p.cycles.length - 1];
      const nextWeek = c.weeks.find((w) => !w.completed);
      return `${p.exercise}: cycle ${c.cycleNum}, TM ${c.tm}${UNIT}, ${nextWeek ? nextWeek.label + " next" : "cycle complete"}`;
    });
    return {
      todayKey: today,
      todayLabel: DAY_LABEL[today],
      schedule,
      recentWorkouts,
      plans: planSummaries,
    };
  }

  async function callBackend(messages) {
    const resp = await fetch("/.netlify/functions/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, context: buildContext() }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || "Something went wrong.");
    return data; // { content: [...], stop_reason }
  }

  // Runs backend turns until Claude either finishes with plain text or asks
  // to use a tool — in which case we pause and show a confirmation prompt
  // instead of executing it right away.
  async function runLoop(startMessages) {
    setLoading(true);
    setError("");
    try {
      let messages = startMessages;
      let iterations = 0;
      while (iterations < 5) {
        iterations++;
        const data = await callBackend(messages);
        const content = data.content || [];

        const textBlocks = content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
        if (textBlocks) setChatLog((log) => [...log, { role: "assistant", text: textBlocks }]);

        const toolUses = content.filter((b) => b.type === "tool_use");
        messages = [...messages, { role: "assistant", content }];
        setApiMessages(messages);

        if (toolUses.length === 0) return;

        setPending({ toolUses, messages });
        return; // wait for confirm/cancel
      }
    } catch (e) {
      setError(e.message || "Couldn't reach the coach.");
    } finally {
      setLoading(false);
    }
  }

  async function send() {
    const text = input.trim();
    if (!text || loading || pending) return;
    setInput("");
    const messages = [...apiMessages, { role: "user", content: text }];
    setApiMessages(messages);
    setChatLog((log) => [...log, { role: "user", text }]);
    await runLoop(messages);
  }

  async function resolvePending(confirmed) {
    if (!pending) return;
    const { toolUses, messages } = pending;
    setPending(null);

    const toolResults = toolUses.map((tu) => {
      if (!confirmed) {
        setChatLog((log) => [...log, { role: "system", text: "✗ Skipped: " + describeProposedAction(tu.name, tu.input || {}) }]);
        return { type: "tool_result", tool_use_id: tu.id, content: JSON.stringify({ ok: false, error: "The user declined this action." }) };
      }
      const result = executeTool(tu.name, tu.input || {}, { workouts, schedule, plans, onSaveWorkouts, onSaveSchedule, onSavePlans });
      setChatLog((log) => [...log, { role: "system", text: describeToolResult(tu.name, tu.input, result) }]);
      return { type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(result) };
    });

    const nextMessages = [...messages, { role: "user", content: toolResults }];
    setApiMessages(nextMessages);
    await runLoop(nextMessages);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontSize: 12, color: "#5b6b82", lineHeight: 1.5 }}>
          Ask questions or tell it what you did — it'll check with you before logging or changing anything.
        </div>
        {chatLog.length > 0 && (
          <button
            onClick={() => { setApiMessages([]); setChatLog([]); setError(""); setPending(null); }}
            style={{ background: "none", border: "1px solid #c7d5e8", borderRadius: 6, padding: "4px 9px", color: "#5b6b82", fontSize: 11.5, cursor: "pointer", whiteSpace: "nowrap", marginLeft: 10 }}
          >
            Clear chat
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, paddingRight: 2 }}>
        {chatLog.length === 0 && (
          <div style={{ fontSize: 12.5, color: "#8595ab", lineHeight: 1.6, padding: "10px 0" }}>
            Try: "I just did bench 3x8 at 185" or "swap Friday to legs and add abs" or "start a 5/3/1 plan for deadlift, TM 315"
          </div>
        )}
        {chatLog.map((m, i) => {
          if (m.role === "system") {
            return (
              <div key={i} style={{ alignSelf: "center", fontSize: 11.5, color: "#16a34a", background: "#dcfce7", border: "1px solid #dcfce7", borderRadius: 999, padding: "4px 12px" }}>
                {m.text}
              </div>
            );
          }
          const isUser = m.role === "user";
          return (
            <div
              key={i}
              style={{
                alignSelf: isUser ? "flex-end" : "flex-start",
                maxWidth: "85%",
                background: isUser ? "#dbeafe" : "#f4f7fb",
                border: "1px solid " + (isUser ? "#93c5fd" : "#dbe4f0"),
                borderRadius: 12,
                padding: "9px 13px",
                fontSize: 13.5,
                lineHeight: 1.5,
                whiteSpace: "pre-wrap",
              }}
            >
              {m.text}
            </div>
          );
        })}

        {pending && (
          <div style={{ alignSelf: "stretch", background: "#eff6ff", border: "1px solid #93c5fd", borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: "#0f172a", marginBottom: 6 }}>
              {pending.toolUses.length > 1 ? "Confirm these actions:" : "Confirm this action:"}
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: "#0f172a", lineHeight: 1.7 }}>
              {pending.toolUses.map((tu) => (
                <li key={tu.id}>{describeProposedAction(tu.name, tu.input || {})}</li>
              ))}
            </ul>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button
                onClick={() => resolvePending(true)}
                style={{ flex: 1, padding: "8px 0", borderRadius: 7, border: "none", background: "#2563eb", color: "#ffffff", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
              >
                Confirm
              </button>
              <button
                onClick={() => resolvePending(false)}
                style={{ flex: 1, padding: "8px 0", borderRadius: 7, border: "1px solid #c7d5e8", background: "transparent", color: "#5b6b82", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {loading && (
          <div style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 6, color: "#8595ab", fontSize: 12.5, padding: "4px 2px" }}>
            <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> thinking…
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}
        {error && <div style={{ fontSize: 12.5, color: "#d97706" }}>{error}</div>}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") send(); }}
          placeholder={pending ? "Confirm or cancel above first…" : "Message your coach…"}
          disabled={!!pending}
          style={{ ...inputStyle, flex: 1, opacity: pending ? 0.6 : 1 }}
        />
        <button
          onClick={send}
          disabled={loading || !input.trim() || !!pending}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", width: 42,
            borderRadius: 8, border: "none", background: "#2563eb", color: "#ffffff",
            cursor: loading || !input.trim() || pending ? "default" : "pointer", opacity: loading || !input.trim() || pending ? 0.5 : 1,
          }}
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}

function History({ workouts, onSave }) {
  const [filter, setFilter] = useState("all");

  const filtered = workouts.filter((w) => filter === "all" || w.type === filter);
  const sorted = [...filtered].sort((a, b) => (a.date < b.date ? 1 : -1));

  function remove(id) {
    onSave(workouts.filter((w) => w.id !== id));
  }

  if (workouts.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "40px 0", color: "#5b6b82" }}>
        <Dumbbell size={28} style={{ opacity: 0.4, marginBottom: 10 }} />
        <div style={{ fontSize: 14 }}>No workouts logged yet.</div>
        <div style={{ fontSize: 13, marginTop: 4 }}>Log your first run or lift to see it here.</div>
      </div>
    );
  }

  return (
    <div>
      <SegButton
        value={filter}
        onChange={setFilter}
        options={[
          { value: "all", label: "All" },
          { value: "run", label: "Runs" },
          { value: "lift", label: "Lifts" },
        ]}
      />
      <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
        {sorted.map((w) => (
          <div key={w.id} style={{ background: "#f4f7fb", border: "1px solid #dbe4f0", borderRadius: 10, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: w.type === "run" ? "#dcfce7" : "#dbeafe", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {w.type === "run" ? <Footprints size={15} color="#16a34a" /> : <Dumbbell size={15} color="#d97706" />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 500 }}>
                {w.type === "run" ? `${w.distance} mi run` : `${w.exercise}`}
              </div>
              <div style={{ fontSize: 12, color: "#5b6b82", marginTop: 2 }}>
                {formatDate(w.date)}
                {w.type === "run"
                  ? ` · ${w.duration} min · ${(w.duration / w.distance).toFixed(1)} min/mi`
                  : ` · ${w.sets} × ${w.reps} @ ${w.weight}${UNIT}`}
                {w.notes ? ` · ${w.notes}` : ""}
              </div>
            </div>
            <button onClick={() => remove(w.id)} style={{ background: "none", border: "none", color: "#8595ab", cursor: "pointer", padding: 4 }} aria-label="Delete entry">
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

const CYCLE_SCHEME = [
  { label: "Week 1 · 5s", pcts: [65, 75, 85], reps: ["5", "5", "5+"], amrap: true },
  { label: "Week 2 · 3s", pcts: [70, 80, 90], reps: ["3", "3", "3+"], amrap: true },
  { label: "Week 3 · 5/3/1", pcts: [75, 85, 95], reps: ["5", "3", "1+"], amrap: true },
  { label: "Week 4 · Deload", pcts: [40, 50, 60], reps: ["5", "5", "5"], amrap: false },
];

function roundTo(value, increment) {
  return Math.round(value / increment) * increment;
}

function buildCycle(cycleNum, tm, increment) {
  return {
    cycleNum,
    tm,
    weeks: CYCLE_SCHEME.map((w, i) => ({
      week: i + 1,
      label: w.label,
      amrap: w.amrap,
      sets: w.pcts.map((pct, j) => ({
        pct,
        weight: roundTo(tm * (pct / 100), increment),
        targetReps: w.reps[j],
      })),
      actualReps: null,
      completed: false,
    })),
  };
}

function minTarget(targetReps) {
  return parseInt(targetReps, 10);
}

function hitTarget(week) {
  if (!week.amrap || !week.completed) return null;
  const topSet = week.sets[week.sets.length - 1];
  return week.actualReps >= minTarget(topSet.targetReps);
}

function StrengthPlan({ plans, onSave }) {
  const [creating, setCreating] = useState(plans.length === 0);
  const [expanded, setExpanded] = useState(plans[0]?.id || null);

  return (
    <div>
      {!creating && (
        <button
          onClick={() => setCreating(true)}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "#f4f7fb", border: "1px solid #c7d5e8", borderRadius: 8, padding: "9px 14px", color: "#0f172a", fontSize: 13, fontWeight: 500, cursor: "pointer", marginBottom: 16 }}
        >
          <Plus size={15} /> New 5/3/1 plan
        </button>
      )}

      {creating && (
        <NewPlanForm
          onCancel={() => setCreating(false)}
          onCreate={(plan) => {
            onSave([plan, ...plans]);
            setExpanded(plan.id);
            setCreating(false);
          }}
        />
      )}

      {plans.length === 0 && !creating && (
        <div style={{ textAlign: "center", padding: "40px 0", color: "#5b6b82" }}>
          <TrendingUp size={28} style={{ opacity: 0.4, marginBottom: 10 }} />
          <div style={{ fontSize: 14 }}>No strength plans yet.</div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {plans.map((p) => (
          <PlanCard
            key={p.id}
            plan={p}
            expanded={expanded === p.id}
            onToggle={() => setExpanded(expanded === p.id ? null : p.id)}
            onUpdate={(next) => onSave(plans.map((pl) => (pl.id === p.id ? next : pl)))}
            onDelete={() => onSave(plans.filter((pl) => pl.id !== p.id))}
          />
        ))}
      </div>
    </div>
  );
}

const COMMON_LIFTS = [
  { name: "Back squat", type: "lower" },
  { name: "Deadlift", type: "lower" },
  { name: "Bench press", type: "upper" },
  { name: "Overhead press", type: "upper" },
];

function NewPlanForm({ onCreate, onCancel }) {
  const [exercise, setExercise] = useState("");
  const [liftType, setLiftType] = useState("upper");
  const [maxType, setMaxType] = useState("training"); // "training" or "true1rm"
  const [maxValue, setMaxValue] = useState("");
  const [increment, setIncrement] = useState("5");
  const [error, setError] = useState("");

  function pickCommon(lift) {
    setExercise(lift.name);
    setLiftType(lift.type);
  }

  function handleCreate() {
    if (!exercise.trim()) return setError("Enter an exercise name.");
    if (maxValue === "" || Number(maxValue) <= 0) return setError("Enter your max greater than 0.");
    if (!increment || Number(increment) <= 0) return setError("Enter a rounding increment greater than 0.");

    const inc = Number(increment);
    const entered = Number(maxValue);
    const tm = maxType === "true1rm" ? roundTo(entered * 0.9, inc) : roundTo(entered, inc);
    const cycleIncrement = liftType === "lower" ? 10 : 5;

    onCreate({
      id: uid(),
      exercise: exercise.trim(),
      liftType,
      roundingIncrement: inc,
      cycleIncrement,
      createdDate: todayStr(),
      cycles: [buildCycle(1, tm, inc)],
    });
  }

  return (
    <div style={{ background: "#f4f7fb", border: "1px solid #dbe4f0", borderRadius: 10, padding: 16, marginBottom: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>New 5/3/1 plan</div>
      <div style={{ fontSize: 12, color: "#8595ab", marginBottom: 14, lineHeight: 1.5 }}>
        Built around a training max — a weight you could lift for several reps with room to spare, not your true one-rep max.
      </div>

      <label style={field()}>Exercise</label>
      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
        {COMMON_LIFTS.map((l) => (
          <button
            key={l.name}
            onClick={() => pickCommon(l)}
            style={{
              padding: "6px 11px",
              borderRadius: 6,
              border: "1px solid " + (exercise === l.name ? "#2563eb" : "#c7d5e8"),
              background: exercise === l.name ? "#dbeafe" : "transparent",
              color: exercise === l.name ? "#d97706" : "#5b6b82",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            {l.name}
          </button>
        ))}
      </div>
      <input type="text" style={inputStyle} placeholder="Or type a custom lift" value={exercise} onChange={(e) => setExercise(e.target.value)} />

      <div style={{ marginTop: 14 }}>
        <label style={field()}>Lift type (sets how much your training max grows each cycle)</label>
        <SegButton
          value={liftType}
          onChange={setLiftType}
          options={[
            { value: "upper", label: "Upper body (+5" + UNIT + "/cycle)" },
            { value: "lower", label: "Lower body (+10" + UNIT + "/cycle)" },
          ]}
        />
      </div>

      <div style={{ marginTop: 14 }}>
        <label style={field()}>What are you entering?</label>
        <SegButton
          value={maxType}
          onChange={setMaxType}
          options={[
            { value: "training", label: "Training max" },
            { value: "true1rm", label: "True 1-rep max" },
          ]}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
        <div>
          <label style={field()}>{maxType === "true1rm" ? `True 1RM (${UNIT})` : `Training max (${UNIT})`}</label>
          <input type="number" min="0" style={inputStyle} placeholder={maxType === "true1rm" ? "225" : "205"} value={maxValue} onChange={(e) => setMaxValue(e.target.value)} />
        </div>
        <div>
          <label style={field()}>Round to nearest ({UNIT})</label>
          <input type="number" min="1" style={inputStyle} placeholder="5" value={increment} onChange={(e) => setIncrement(e.target.value)} />
        </div>
      </div>

      {maxType === "true1rm" && maxValue && Number(maxValue) > 0 && (
        <div style={{ fontSize: 12, color: "#8595ab", marginTop: 10 }}>
          Training max will be set to {roundTo(Number(maxValue) * 0.9, Number(increment) || 5)}{UNIT} (90% of your 1RM).
        </div>
      )}

      {error && <div style={{ color: "#dc2626", fontSize: 13, marginTop: 10 }}>{error}</div>}

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button onClick={handleCreate} style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "none", background: "#2563eb", color: "#ffffff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          Create plan
        </button>
        <button onClick={onCancel} style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid #c7d5e8", background: "transparent", color: "#5b6b82", fontSize: 13, cursor: "pointer" }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function PlanCard({ plan, expanded, onToggle, onUpdate, onDelete }) {
  const currentCycle = plan.cycles[plan.cycles.length - 1];
  const currentWeekIdx = currentCycle.weeks.findIndex((w) => !w.completed);
  const cycleDone = currentWeekIdx === -1;
  const displayWeekNum = cycleDone ? 4 : currentWeekIdx + 1;

  // Flatten AMRAP weeks across all cycles, in chronological order, to check for a miss streak.
  const amrapHistory = plan.cycles
    .flatMap((c) => c.weeks.filter((w) => w.amrap && w.completed))
    .map((w) => hitTarget(w));
  let missStreak = 0;
  for (let i = amrapHistory.length - 1; i >= 0; i--) {
    if (amrapHistory[i] === false) missStreak++;
    else break;
  }
  const showResetWarning = missStreak >= 2;

  function updateWeek(cycleNum, weekNum, patch) {
    const cycles = plan.cycles.map((c) => {
      if (c.cycleNum !== cycleNum) return c;
      return {
        ...c,
        weeks: c.weeks.map((w) => (w.week === weekNum ? { ...w, ...patch } : w)),
      };
    });
    onUpdate({ ...plan, cycles });
  }

  function startNextCycle() {
    const nextTm = currentCycle.tm + plan.cycleIncrement;
    const newCycle = buildCycle(currentCycle.cycleNum + 1, nextTm, plan.roundingIncrement);
    onUpdate({ ...plan, cycles: [...plan.cycles, newCycle] });
  }

  return (
    <div style={{ background: "#f4f7fb", border: "1px solid #dbe4f0", borderRadius: 10, overflow: "hidden" }}>
      <div onClick={onToggle} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", cursor: "pointer" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{plan.exercise}</div>
          <div style={{ fontSize: 12, color: "#5b6b82", marginTop: 2 }}>
            Cycle {currentCycle.cycleNum} · week {displayWeekNum} of 4 · TM {currentCycle.tm}{UNIT}
          </div>
        </div>
        {expanded ? <ChevronDown size={16} color="#8595ab" /> : <ChevronRight size={16} color="#8595ab" />}
      </div>

      {expanded && (
        <div style={{ padding: "0 16px 16px" }}>
          {showResetWarning && (
            <div style={{ background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 8, padding: "10px 12px", marginBottom: 14, fontSize: 12.5, color: "#d97706", lineHeight: 1.5 }}>
              You've missed your AMRAP target {missStreak} weeks in a row on {plan.exercise}. That's usually a sign the training max is set too high — consider resetting it down about 10% (to roughly {roundTo(currentCycle.tm * 0.9, plan.roundingIncrement)}{UNIT}) on the next cycle instead of pushing through.
            </div>
          )}
          {plan.cycles.slice().reverse().map((cycle) => (
            <div key={cycle.cycleNum} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: "#8595ab", marginBottom: 8, fontWeight: 500 }}>
                Cycle {cycle.cycleNum} · training max {cycle.tm}{UNIT}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {cycle.weeks.map((w) => (
                  <WeekRow key={w.week} week={w} onLog={(patch) => updateWeek(cycle.cycleNum, w.week, patch)} />
                ))}
              </div>
            </div>
          ))}

          {cycleDone && (
            <button
              onClick={startNextCycle}
              style={{ width: "100%", marginTop: 4, padding: "10px 0", borderRadius: 8, border: "1px solid #bbf7d0", background: "#dcfce7", color: "#16a34a", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
            >
              Start cycle {currentCycle.cycleNum + 1} at {currentCycle.tm + plan.cycleIncrement}{UNIT} TM
            </button>
          )}

          <button
            onClick={onDelete}
            style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#b91c1c", fontSize: 12, cursor: "pointer", padding: 0 }}
          >
            <Trash2 size={13} /> Delete plan
          </button>
        </div>
      )}
    </div>
  );
}

function WeekRow({ week, onLog }) {
  const [editing, setEditing] = useState(false);
  const [repsVal, setRepsVal] = useState("");
  const topSet = week.sets[week.sets.length - 1];
  const hit = hitTarget(week);

  function submit() {
    if (week.amrap) {
      if (repsVal === "" || Number(repsVal) < 0) return;
      onLog({ actualReps: Number(repsVal), completed: true });
    } else {
      onLog({ completed: true });
    }
    setEditing(false);
    setRepsVal("");
  }

  return (
    <div style={{ padding: "10px 12px", background: "#ffffff", borderRadius: 8, border: "1px solid #e2e8f3" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <div style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{week.label}</div>
        {week.completed && (
          <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
            {week.amrap && (
              <span style={{ color: hit ? "#16a34a" : "#d97706" }}>{week.actualReps} reps</span>
            )}
            {week.amrap ? (
              hit ? <Check size={13} color="#16a34a" /> : <X size={13} color="#d97706" />
            ) : (
              <Check size={13} color="#16a34a" />
            )}
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 14, fontSize: 12.5, color: "#64748b", fontFamily: "'JetBrains Mono', monospace", marginBottom: week.completed ? 0 : 8 }}>
        {week.sets.map((s, i) => (
          <span key={i}>{s.weight}{UNIT}×{s.targetReps}</span>
        ))}
      </div>

      {!week.completed && (
        editing ? (
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4 }}>
            {week.amrap ? (
              <>
                <span style={{ fontSize: 12, color: "#5b6b82" }}>Reps on top set ({topSet.weight}{UNIT}):</span>
                <input
                  type="number"
                  autoFocus
                  min="0"
                  value={repsVal}
                  onChange={(e) => setRepsVal(e.target.value)}
                  style={{ width: 56, background: "#f4f7fb", border: "1px solid #c7d5e8", borderRadius: 6, padding: "5px 8px", color: "#0f172a", fontSize: 12.5 }}
                />
              </>
            ) : (
              <span style={{ fontSize: 12, color: "#5b6b82" }}>Mark deload week as done</span>
            )}
            <button onClick={submit} style={{ background: "#2563eb", border: "none", borderRadius: 6, padding: "5px 10px", color: "#ffffff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              Save
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            style={{ background: "none", border: "1px solid #c7d5e8", borderRadius: 6, padding: "4px 10px", color: "#5b6b82", fontSize: 12, cursor: "pointer" }}
          >
            {week.amrap ? "Log AMRAP set" : "Mark done"}
          </button>
        )
      )}
    </div>
  );
}
