import { useEffect, useState } from "react";
import { api } from "../api.js";

export default function Claim() {
  const [d, setD] = useState(null);
  useEffect(() => { api.get("/claim").then(setD); }, []);
  if (!d) return <div className="card">Loading…</div>;
  return (
    <>
      <div className="card">
        <h2>Which carousel is my flight on?</h2>
        <table>
          <thead><tr><th>Flight</th><th>To</th><th>Carousel</th><th>ETA</th><th>Status</th></tr></thead>
          <tbody>{d.flights.map((f) => (
            <tr key={f.flight}><td>{f.flight}</td><td>{f.destination}</td><td>{f.carousel}</td><td>{f.eta}</td><td>{f.status}</td></tr>
          ))}</tbody>
        </table>
      </div>
      <div className="card">
        <h2>How to claim your bag</h2>
        <ol>{d.steps.map((s, i) => <li key={i} style={{ listStyle: "none", marginBottom: 8 }}>{i + 1}. {s}</li>)}</ol>
      </div>
      <div className="card">
        <h2>Baggage services</h2>
        <p style={{ margin: 0 }}>{d.contact.desk}<br />☎ {d.contact.phone} · ✉ {d.contact.email}<br />Open: {d.contact.hours}</p>
      </div>
    </>
  );
}
