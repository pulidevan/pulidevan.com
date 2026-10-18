import { useEffect, useState } from "react";
import { profile } from "../content.js";

export default function Clock() {
  const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: profile.timeZone, hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const [t, setT] = useState(fmt.format(new Date()));
  useEffect(() => { const i = setInterval(() => setT(fmt.format(new Date())), 1000); return () => clearInterval(i); }, []);
  return <div className="clock">{profile.city.toUpperCase()} {t} {profile.tzLabel} · {profile.coords}</div>;
}
