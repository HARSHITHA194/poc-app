import { useEffect, useState } from "react";
import { api } from "./api.js";
import Dashboard from "./pages/Dashboard.jsx";
import Track from "./pages/Track.jsx";
import Report from "./pages/Report.jsx";
import Claim from "./pages/Claim.jsx";
import LostFound from "./pages/LostFound.jsx";

const TABS = [
  ["dash", "Dashboard", Dashboard],
  ["track", "Track Baggage", Track],
  ["report", "Report Missing", Report],
  ["claim", "Baggage Claim", Claim],
  ["lf", "Lost & Found", LostFound],
];

export default function App() {
  const [tab, setTab] = useState("dash");
  const [health, setHealth] = useState(null);
  useEffect(() => { api.get("/health").then(setHealth).catch(() => setHealth(false)); }, []);
  const Page = TABS.find((t) => t[0] === tab)[2];
  return (
    <div className="wrap">
      <header>
        <h1>✈ Smart Baggage Tracking Portal</h1>
        <p className="sub">Track your bag, report problems, find your carousel and recover lost items.</p>
      </header>
      <nav>
        {TABS.map(([k, label]) => (
          <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{label}</button>
        ))}
      </nav>
      <main><Page go={setTab} /></main>
      <footer>
        {health === false ? <span className="bad">● API unreachable</span> :
          health && <>
            <span className={health.db.connected ? "ok" : "bad"}>● {health.db.connected ? "Connected" : "DB down"}</span>
            {" · "}version {health.version}{" · "}pod {health.pod}
          </>}
      </footer>
    </div>
  );
}
