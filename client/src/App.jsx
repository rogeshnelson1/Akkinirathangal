import { useEffect, useState, useCallback } from "react";

const api = async (url, opts = {}, token) => {
  const r = await fetch(url, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(d.error || "Something went wrong"), { status: r.status });
  return d;
};
const fmtDate = (d) => new Date(d + "T00:00:00Z").toLocaleDateString("en-IN", { day: "numeric", month: "short", weekday: "short", timeZone: "UTC" });

function Login({ onLogin }) {
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const go = async (e) => {
    e.preventDefault(); setBusy(true); setErr("");
    try { onLogin(await api("/api/login", { method: "POST", body: JSON.stringify({ name }) })); }
    catch (x) { setErr(x.message); setBusy(false); }
  };
  return (
    <main className="login">
      <h1>Akkini Rathangal<br />Prayer Fellowship</h1>
      <p>Bible reading — Sep 1 to Dec 31, 2026</p>
      <form onSubmit={go}>
        <label htmlFor="n">Your name</label>
        <input id="n" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Samuel" autoFocus />
        {err && <div className="err">{err}</div>}
        <button disabled={busy || name.trim().length < 2}>Start reading</button>
        <small>Use the same name every day so your progress stays together.</small>
      </form>
    </main>
  );
}

// status of one day for one person: full | m (morning only) | e (evening only) | none
function dayStatus(d, x) {
  const m = !!x?.morning, e = !!x?.evening;
  if (d.morning) return m && e ? "full" : m ? "m" : e ? "e" : "none";
  return e ? "full" : "none";
}

function MemberView({ member, schedule, today, back }) {
  if (member.loading) return <p className="muted">Loading {member.name}…</p>;
  const map = {}; member.entries.forEach((x) => (map[x.date] = x));
  const past = schedule.filter((d) => d.date <= today);
  const st = past.map((d) => ({ d, s: dayStatus(d, map[d.date]) }));
  const c = (k) => st.filter((x) => x.s === k).length;
  const label = { full: "Both done", m: "Morning only", e: "Evening only", none: "Missed" };
  return (
    <div>
      <button className="link" onClick={back}>← Back to fellowship</button>
      <h3 className="mname">{member.name}</h3>
      <div className="chips">
        <span className="chip full">{c("full")} full days</span>
        <span className="chip m">{c("m")} morning only</span>
        <span className="chip e">{c("e")} evening only</span>
        <span className="chip none">{c("none")} missed</span>
      </div>
      <div className="grid mgrid">
        {st.map(({ d, s }) => (
          <div key={d.date} className={"cell " + s} title={`Day ${d.day}, ${fmtDate(d.date)}: ${label[s]}`}>
            {d.day}<small>{s === "m" ? "M" : s === "e" ? "E" : s === "full" ? "✓" : "–"}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

function Home({ auth, logout }) {
  const [data, setData] = useState(null);
  const [entries, setEntries] = useState({});
  const [sel, setSel] = useState(null);
  const [tab, setTab] = useState("me");
  const [board, setBoard] = useState(null);
  const [err, setErr] = useState("");
  const [member, setMember] = useState(null);

  const openMember = async (r) => {
    setMember({ name: r.name, loading: true });
    try { setMember(await api(`/api/member/${r.id}`, {}, auth.token)); }
    catch (x) { setMember(null); setErr(x.message); }
  };

  useEffect(() => {
    (async () => {
      try {
        const [s, me] = await Promise.all([api("/api/schedule"), api("/api/me", {}, auth.token)]);
        const map = {}; me.forEach((e) => (map[e.date] = e));
        setEntries(map); setData(s);
        const first = s.schedule[0].date, last = s.schedule[s.schedule.length - 1].date;
        setSel(s.today < first ? first : s.today > last ? last : s.today);
      } catch (x) { x.status === 401 ? logout() : setErr(x.message); }
    })();
  }, []);

  const loadBoard = useCallback(async () => {
    if (!sel) return;
    try { setBoard(await api(`/api/board?date=${sel}`, {}, auth.token)); } catch {}
  }, [sel]);
  useEffect(() => { if (tab === "group") loadBoard(); }, [tab, sel]);

  if (err) return <main className="login"><div className="err">{err}</div></main>;
  if (!data) return <main className="login"><p>Loading…</p></main>;

  const { schedule, today } = data;
  const day = schedule.find((d) => d.date === sel);
  const e = entries[sel] || { morning: false, evening: false };
  const future = sel > today;
  const isDone = (d) => { const x = entries[d.date]; return x && (d.morning ? x.morning : true) && (d.evening ? x.evening : true) && (x.morning || x.evening); };
  const doneCount = schedule.filter((d) => d.date <= today && isDone(d)).length;
  let streak = 0;
  for (let i = schedule.findIndex((d) => d.date === today); i >= 0; i--) {
    if (isDone(schedule[i])) streak++; else if (schedule[i].date !== today) break;
  }

  const toggle = async (key) => {
    const next = { ...e, [key]: !e[key] };
    setEntries({ ...entries, [sel]: next });
    try { await api("/api/entry", { method: "PUT", body: JSON.stringify({ date: sel, ...next }) }, auth.token); }
    catch (x) { setEntries({ ...entries, [sel]: e }); setErr(x.message); }
  };
  const both = () => {
    const next = { morning: !!day.morning || e.morning, evening: !!day.evening || e.evening };
    setEntries({ ...entries, [sel]: next });
    api("/api/entry", { method: "PUT", body: JSON.stringify({ date: sel, ...next }) }, auth.token).catch((x) => setErr(x.message));
  };

  const Slot = ({ k, label, text }) => text ? (
    <button className={"slot" + (e[k] ? " on" : "")} disabled={future} onClick={() => toggle(k)} aria-pressed={e[k]}>
      <span className="box">{e[k] ? "✓" : ""}</span>
      <span><b>{label}</b><em>{text}</em></span>
    </button>
  ) : null;

  return (
    <main className="home">
      <header>
        <div><h2>Akkini Rathangal</h2><small>Hi, {auth.name}</small></div>
        <button className="link" onClick={logout}>Change name</button>
      </header>

      <section className="stats">
        <div><strong>{doneCount}</strong><span>days done</span></div>
        <div><strong>{streak}</strong><span>day streak</span></div>
        <div><strong>{Math.max(0, schedule.filter((d) => d.date <= today).length - doneCount)}</strong><span>to catch up</span></div>
      </section>

      <nav className="tabs">
        <button className={tab === "me" ? "act" : ""} onClick={() => setTab("me")}>My reading</button>
        <button className={tab === "group" ? "act" : ""} onClick={() => setTab("group")}>Fellowship</button>
      </nav>

      <section className="card">
        <div className="dayhead">
          <h3>Day {day.day} · {fmtDate(sel)}</h3>
          {sel === today && <span className="pill">Today</span>}
        </div>
        {tab === "me" ? (
          (
            <>
              <Slot k="morning" label={`Morning · ${day.testament}`} text={day.morning} />
              <Slot k="evening" label={`Evening · ${day.testament === "Revision" ? "Revision" : "Old Testament"}`} text={day.evening} />
              {!future && !(e.morning && e.evening) && <button className="primary" onClick={both}>I completed today's reading</button>}
              {future && <p className="muted">This day hasn't started yet.</p>}
            </>
          )
        ) : member ? (
          <MemberView member={member} schedule={schedule} today={today} back={() => setMember(null)} />
        ) : !board ? <p className="muted">Loading…</p> : (
          <ul className="board">
            {board.rows.map((r) => (
              <li key={r.name}>
                <button className="nm link-name" onClick={() => openMember(r)}>{r.name}</button>
                <span className="ticks"><i className={r.morning ? "y" : ""}>M</i><i className={r.evening ? "y" : ""}>E</i></span>
                <span className="tot">{r.fullDays} days</span>
              </li>
            ))}
            <button className="link" onClick={loadBoard}>Refresh</button>
          </ul>
        )}
      </section>

      <section className="grid" aria-label="All days">
        {schedule.map((d) => (
          <button key={d.date} onClick={() => setSel(d.date)}
            className={[d.date === sel ? "sel" : "", isDone(d) ? "full" : entries[d.date]?.morning || entries[d.date]?.evening ? "part" : d.date < today ? "miss" : ""].join(" ")}
            title={fmtDate(d.date)}>{d.day}</button>
        ))}
      </section>
    </main>
  );
}

export default function App() {
  const [auth, setAuth] = useState(() => JSON.parse(localStorage.getItem("akkini") || "null"));
  const login = (a) => { localStorage.setItem("akkini", JSON.stringify(a)); setAuth(a); };
  const logout = () => { localStorage.removeItem("akkini"); setAuth(null); };
  return auth ? <Home auth={auth} logout={logout} /> : <Login onLogin={login} />;
}
