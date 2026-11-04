import { useEffect, useState, useCallback } from "react";
import { api } from "../api.js";

const STATUSES = ["Found", "Under Review", "Claimed", "Disposed"];
const empty = { item: "", description: "", found_at: "" };

export default function LostFound() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [f, setF] = useState(empty);
  const [error, setError] = useState("");
  const load = useCallback((query = "") => api.get("/lostfound?q=" + encodeURIComponent(query)).then(setItems), []);
  useEffect(() => { load(); }, [load]);

  async function add(e) {
    e.preventDefault(); setError("");
    try { await api.post("/lostfound", f); setF(empty); load(q); } catch (x) { setError(x.message); }
  }
  async function setStatus(id, status) { await api.patch("/lostfound/" + id, { status }); load(q); }

  return (
    <>
      <div className="card">
        <h2>Search lost &amp; found</h2>
        <form className="inline" onSubmit={(e) => { e.preventDefault(); load(q); }}>
          <input placeholder="Search by item, colour, location…" value={q} onChange={(e) => setQ(e.target.value)} />
          <button>Search</button>
        </form>
      </div>
      <div className="card">
        <h2>Items ({items.length})</h2>
        <ul>
          {items.map((i) => (
            <li key={i.id}>
              <div className="inline"><b>{i.item}</b> <span className="meta">{i.id}</span>
                <span className={"badge " + i.status}>{i.status}</span></div>
              <div>{i.description}</div>
              <div className="meta">Found at: {i.found_at} · {new Date(i.created_at).toLocaleDateString()}</div>
              <div className="inline" style={{ marginTop: 8 }}>
                <span className="meta">Staff action:</span>
                <select style={{ width: "auto" }} value={i.status} onChange={(e) => setStatus(i.id, e.target.value)}>
                  {STATUSES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
            </li>
          ))}
          {!items.length && <li>No items match.</li>}
        </ul>
      </div>
      <div className="card">
        <h2>Log a found item (staff)</h2>
        <form onSubmit={add}>
          <div className="row">
            <input placeholder="Item *" value={f.item} onChange={(e) => setF({ ...f, item: e.target.value })} required />
            <input placeholder="Where found *" value={f.found_at} onChange={(e) => setF({ ...f, found_at: e.target.value })} required />
          </div>
          <textarea rows="3" placeholder="Description *" value={f.description}
            onChange={(e) => setF({ ...f, description: e.target.value })} required />
          <button>Add item</button>
        </form>
        {error && <div className="msg err" style={{ marginTop: 12 }}>{error}</div>}
      </div>
    </>
  );
}
