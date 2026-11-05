import { useEffect, useState } from "react";
import { api } from "./api.js";
import Dashboard from "./pages/Dashboard.jsx";
import Track from "./pages/Track.jsx";
import Report from "./pages/Report.jsx";
import Claim from "./pages/Claim.jsx";
import LostFound from "./pages/LostFound.jsx";

const TABS = [
  ["dash", "Overview", "Baggage operations", "Live view of every bag, carousel and open case.", Dashboard],
  ["track", "Track", "Track baggage", "Enter a tag number to see where your bag is.", Track],
  ["report", "Report missing", "Report missing baggage", "Tell us about your bag and we will start the search.", Report],
  ["claim", "Baggage claim", "Baggage claim", "Find your carousel and how to collect your bag.", Claim],
  ["lf", "Lost & found", "Lost & found", "Search found items and manage the storeroom.", LostFound],
];

export default function App() {
  const [tab, setTab] = useState("dash");
  const [health, setHealth] = useState(null);
  useEffect(() => { api.get("/health").then(setHealth).catch(() => setHealth(false)); }, []);
  const [, , title, sub, Page] = TABS.find((t) => t[0] === tab);
  const up = health && health.db.connected;
  return (
    <div className="wrap">
      <div className="topbar">
        <div className="brand">
          <div className="logo">✈</div>
          <div>SkyTrack<small>SMART BAGGAGE PORTAL</small></div>
        </div>
        <nav className="tabs">
          {TABS.map(([k, label]) => (
            <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{label}</button>
          ))}
        </nav>
        <div className="live">
          <span className={"dot" + (up ? "" : " bad")} />
          {up ? "System online" : health === false ? "API unreachable" : "Connecting…"}
        </div>
      </div>
      <div className="pagehead"><h1>{title}</h1><p className="sub">{sub}</p></div>
      <main><Page go={setTab} /></main>
      <footer>{health && <>Version {health.version} · pod {health.pod} · {health.db.detail}</>}</footer>
    </div>
  );
}