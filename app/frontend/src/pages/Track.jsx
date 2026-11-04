import { useState } from "react";
import { api } from "../api.js";

export default function Track() {
  const [tag, setTag] = useState("");
  const [res, setRes] = useState(null);
  const [error, setError] = useState("");
  async function search(e) {
    e.preventDefault(); setError(""); setRes(null);
    try { setRes(await api.get("/baggage/" + encodeURIComponent(tag.trim()))); }
    catch (x) { setError(x.message); }
  }
  return (
    <>
      <div className="card">
        <h2>Track baggage status</h2>
        <form className="inline" onSubmit={search}>
          <input placeholder="Enter tag number, e.g. BG100001" value={tag} onChange={(e) => setTag(e.target.value)} required />
          <button>Track</button>
        </form>
      </div>
      {error && <div className="msg err">{error}</div>}
      {res && (
        <div className="card">
          <div className="inline"><h2 style={{ margin: 0 }}>{res.bag.tag}</h2>
            <span className={"badge " + res.bag.status}>{res.bag.status}</span></div>
          <div className="grid" style={{ marginTop: 12 }}>
            <div><div className="label">Passenger</div>{res.bag.passenger}</div>
            <div><div className="label">Flight</div>{res.bag.flight}</div>
            <div><div className="label">Route</div>{res.bag.origin} → {res.bag.destination}</div>
            <div><div className="label">Current location</div>{res.bag.location}</div>
            {res.bag.carousel && <div><div className="label">Carousel</div>{res.bag.carousel}</div>}
          </div>
          <h3>History</h3>
          <div className="timeline">
            {res.events.slice().reverse().map((e, i) => (
              <div className="dot" key={i}><b>{e.status}</b> — {e.location}
                <div className="meta">{new Date(e.at).toLocaleString()}</div></div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
