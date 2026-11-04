import { useEffect, useState } from "react";
import { api } from "../api.js";

export default function Dashboard({ go }) {
  const [s, setS] = useState(null);
  const [bags, setBags] = useState([]);
  useEffect(() => { api.get("/stats").then(setS); api.get("/baggage").then(setBags); }, []);
  if (!s) return <div className="card">Loading…</div>;
  return (
    <>
      <div className="grid">
        <div className="card"><div className="label">Bags tracked</div><div className="value">{s.total}</div></div>
        <div className="card"><div className="label">Missing</div><div className="value bad">{s.by_status.Missing || 0}</div></div>
        <div className="card"><div className="label">Open reports</div><div className="value warn">{s.open_reports}</div></div>
        <div className="card"><div className="label">Items in lost &amp; found</div><div className="value">{s.lost_found}</div></div>
      </div>
      <div className="card">
        <h2>Recent baggage</h2>
        <table>
          <thead><tr><th>Tag</th><th>Passenger</th><th>Flight</th><th>Route</th><th>Status</th></tr></thead>
          <tbody>{bags.map((b) => (
            <tr key={b.tag}><td>{b.tag}</td><td>{b.passenger}</td><td>{b.flight}</td>
              <td>{b.origin} → {b.destination}</td><td><span className={"badge " + b.status}>{b.status}</span></td></tr>
          ))}</tbody>
        </table>
        <p className="meta">Try tracking <b>BG100001</b>.</p>
      </div>
      <div className="inline">
        <button onClick={() => go("track")}>Track a bag</button>
        <button className="ghost" onClick={() => go("report")}>Report missing bag</button>
      </div>
    </>
  );
}
