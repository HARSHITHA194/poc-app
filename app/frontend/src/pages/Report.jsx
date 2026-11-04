import { useState } from "react";
import { api } from "../api.js";

const empty = { passenger: "", email: "", phone: "", flight: "", tag: "", description: "" };

export default function Report() {
  const [f, setF] = useState(empty);
  const [done, setDone] = useState(null);
  const [error, setError] = useState("");
  const [lookup, setLookup] = useState("");
  const [status, setStatus] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault(); setError("");
    try { const r = await api.post("/reports", f); setDone(r.id); setF(empty); }
    catch (x) { setError(x.message); }
  }
  async function check(e) {
    e.preventDefault(); setStatus(null);
    try { setStatus(await api.get("/reports/" + encodeURIComponent(lookup.trim()))); }
    catch (x) { setStatus({ error: x.message }); }
  }
  return (
    <>
      <div className="card">
        <h2>Report missing baggage</h2>
        <form onSubmit={submit}>
          <div className="row">
            <input placeholder="Full name *" value={f.passenger} onChange={set("passenger")} required />
            <input type="email" placeholder="Email *" value={f.email} onChange={set("email")} required />
            <input placeholder="Phone" value={f.phone} onChange={set("phone")} />
          </div>
          <div className="row">
            <input placeholder="Flight number *" value={f.flight} onChange={set("flight")} required />
            <input placeholder="Baggage tag (if known)" value={f.tag} onChange={set("tag")} />
          </div>
          <textarea rows="4" placeholder="Describe the bag: colour, brand, size, contents, distinguishing marks *"
            value={f.description} onChange={set("description")} required />
          <button>Submit report</button>
        </form>
        {done && <div className="msg good" style={{ marginTop: 12 }}>Report filed. Your reference number is <b>{done}</b>. Keep it to check progress.</div>}
        {error && <div className="msg err" style={{ marginTop: 12 }}>{error}</div>}
      </div>
      <div className="card">
        <h2>Check a report</h2>
        <form className="inline" onSubmit={check}>
          <input placeholder="Reference number, e.g. PIR-AB12CD" value={lookup} onChange={(e) => setLookup(e.target.value)} required />
          <button>Check</button>
        </form>
        {status && (status.error ? <div className="msg err" style={{ marginTop: 12 }}>{status.error}</div> :
          <div className="msg" style={{ marginTop: 12 }}>{status.id} · flight {status.flight} · <span className={"badge " + status.status}>{status.status}</span></div>)}
      </div>
    </>
  );
}
