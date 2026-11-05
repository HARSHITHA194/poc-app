import { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";

const FILTERS = ["All", "In transit", "Delivered", "Missing"];
const TRANSIT = ["Checked In", "Security Screening", "Loaded on Aircraft", "In Transit", "Arrived", "On Carousel"];

function Spark({ values, red }) {
  const max = Math.max(...values, 1);
  return <div className={"spark" + (red ? " red" : "")}>{values.map((v, i) => <i key={i} style={{ height: 8 + (v / max) * 32 }} />)}</div>;
}

function Kpi({ label, value, cls, bars, red }) {
  return (
    <div className="card kpi">
      <div><div className="label">{label}</div><div className={"num " + (cls || "")}>{value}</div></div>
      <Spark values={bars} red={red} />
    </div>
  );
}

export default function Dashboard({ go }) {
  const [s, setS] = useState(null);
  const [bags, setBags] = useState([]);
  const [flights, setFlights] = useState([]);
  const [order, setOrder] = useState([]);
  const [filter, setFilter] = useState("All");
  const [pick, setPick] = useState(null);

  useEffect(() => {
    api.get("/stats").then(setS);
    api.get("/baggage").then(setBags);
    api.get("/claim").then((d) => setFlights(d.flights));
    api.get("/meta").then((m) => setOrder(m.statuses));
  }, []);

  const shown = useMemo(() => bags.filter((b) =>
    filter === "All" ? true : filter === "Delivered" ? b.status === "Delivered" :
    filter === "Missing" ? b.status === "Missing" : TRANSIT.includes(b.status)), [bags, filter]);

  if (!s) return <div className="card">Loading…</div>;

  const progress = (st) => st === "Missing" ? 100 : Math.round(((order.indexOf(st) + 1) / (order.length - 1)) * 100);
  const counts = order.slice(0, 7).map((k) => s.by_status[k] || 0);
  const missing = s.by_status.Missing || 0;
  const maxStatus = Math.max(...Object.values(s.by_status), 1);
  const sel = flights.find((f) => f.flight === pick);

  // schematic geometry
  const W = 720, H = 300, xs = flights.map((_, i) => 250 + (i % 2) * 230), ys = flights.map((_, i) => 40 + Math.floor(i / 2) * 120);

  return (
    <>
      <div className="kpis">
        <Kpi label="Bags tracked" value={s.total} bars={counts} />
        <Kpi label="Missing" value={missing} cls={missing ? "bad" : ""} bars={[0, 1, 0, 2, 1, missing]} red />
        <Kpi label="Open reports" value={s.open_reports} cls="warn" bars={[1, 0, 2, 1, 3, s.open_reports]} />
        <Kpi label="Lost & found items" value={s.lost_found} bars={[0, 1, 1, 2, 1, s.lost_found]} />
      </div>

      <div className="dash">
        <aside className="card">
          <h2>Baggage list</h2>
          <div className="chips">
            {FILTERS.map((f) => <button key={f} className={"chip" + (filter === f ? " on" : "")} onClick={() => setFilter(f)}>{f}</button>)}
          </div>
          <div className="baglist">
            {shown.map((b) => (
              <button key={b.tag} className="bag" onClick={() => go("track")} title="Open Track page, then enter this tag">
                <div className="top"><b>{b.tag}</b><span className={"badge " + b.status}>{b.status}</span></div>
                <div className="meta">{b.passenger} · {b.flight} · {b.origin} → {b.destination}</div>
                <div className={"bar" + (b.status === "Missing" ? " red" : "")}><span style={{ width: progress(b.status) + "%" }} /></div>
                <div className="bartxt"><span>Journey</span><span>{b.status === "Missing" ? "Needs attention" : progress(b.status) + "%"}</span></div>
              </button>
            ))}
            {!shown.length && <div className="meta">No bags in this view.</div>}
          </div>
        </aside>

        <div className="stack">
          <div className="card">
            <h2>Baggage hall</h2>
            <div className="hall">
              <svg viewBox={`0 0 ${W} ${H}`}>
                <defs>
                  <pattern id="cells" width="12" height="12" patternUnits="userSpaceOnUse">
                    <rect width="12" height="12" fill="#2fb36a" /><rect x="2" y="2" width="8" height="8" rx="1.5" fill="#12663a" />
                  </pattern>
                </defs>
                {/* check-in node */}
                <rect x="24" y="118" width="96" height="56" rx="12" fill="#fff" stroke="#dfe6ed" />
                <text x="72" y="142" textAnchor="middle" fontSize="12" fontWeight="700" fill="#1b2430">Check-in</text>
                <text x="72" y="160" textAnchor="middle" fontSize="11" fill="#6b7787">{s.total} bags</text>
                {/* lines */}
                {flights.map((f, i) => (
                  <path key={f.flight} d={`M120 146 H190 V${ys[i] + 40} H${xs[i]}`} fill="none"
                    stroke={pick === f.flight ? "#1fa65a" : "#8fd3ae"} strokeWidth="2.5" strokeLinejoin="round" />
                ))}
                {missing > 0 && <>
                  <path d={`M72 174 V${H - 26} H${W - 150}`} fill="none" stroke="#e5484d" strokeWidth="2.5" strokeDasharray="6 5" />
                  <rect x={W - 150} y={H - 52} width="120" height="52" rx="12" fill="#fff" stroke="#f3c2c4" />
                  <text x={W - 90} y={H - 30} textAnchor="middle" fontSize="12" fontWeight="700" fill="#b3262b">Lost &amp; found</text>
                  <text x={W - 90} y={H - 14} textAnchor="middle" fontSize="11" fill="#6b7787">{missing} missing</text>
                </>}
                {/* carousels */}
                {flights.map((f, i) => (
                  <g key={f.flight} className="tile" onClick={() => setPick(f.flight === pick ? null : f.flight)}>
                    <rect x={xs[i]} y={ys[i]} width="150" height="80" rx="14" fill="url(#cells)" stroke={pick === f.flight ? "#0b4d2b" : "none"} strokeWidth="3" />
                    <rect x={xs[i] + 10} y={ys[i] + 50} width="130" height="22" rx="8" fill="#fff" opacity=".95" />
                    <text x={xs[i] + 75} y={ys[i] + 65} textAnchor="middle" fontSize="11" fontWeight="700" fill="#12663a">C{f.carousel} · {f.flight}</text>
                  </g>
                ))}
              </svg>
              {sel && (
                <div className="pop">
                  <b>Carousel {sel.carousel}</b>
                  <div className="row2"><span className="meta">Flight</span><span>{sel.flight}</span></div>
                  <div className="row2"><span className="meta">From → To</span><span>{sel.destination}</span></div>
                  <div className="row2"><span className="meta">ETA</span><span>{sel.eta}</span></div>
                  <div className="row2"><span className="meta">Status</span><span>{sel.status}</span></div>
                </div>
              )}
            </div>
            <div className="legend">
              <span><i style={{ background: "#2fb36a" }} />Carousel (click for details)</span>
              <span><i style={{ background: "#e5484d" }} />Missing-bag route</span>
            </div>
          </div>

          <div className="two">
            <div className="card">
              <h2>Bags by status</h2>
              {order.map((k) => (s.by_status[k] ? (
                <div className="hbar" key={k}><span>{k}</span>
                  <div className={"bar" + (k === "Missing" ? " red" : "")}><span style={{ width: (s.by_status[k] / maxStatus) * 100 + "%" }} /></div>
                  <b>{s.by_status[k]}</b></div>) : null))}
            </div>
            <div className="card">
              <h2>Quick actions</h2>
              <div className="inline" style={{ flexDirection: "column", alignItems: "stretch" }}>
                <button onClick={() => go("track")}>Track a bag</button>
                <button className="ghost" onClick={() => go("report")}>Report a missing bag</button>
                <button className="ghost" onClick={() => go("claim")}>Find my carousel</button>
                <button className="ghost" onClick={() => go("lf")}>Search lost &amp; found</button>
              </div>
              <p className="meta">Demo tag to try: <b>BG100001</b></p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}