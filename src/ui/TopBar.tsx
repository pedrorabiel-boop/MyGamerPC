import { config } from "../config";
import { RESOURCES } from "../content";
import { ERAS } from "../data/tree";
import { useEngine } from "../engine";
import { amount, housing } from "../sim/economy";
import { qty } from "./format";

export function TopBar() {
  const { s, speed } = useEngine();
  const era = ERAS.find((e) => e.id === s.erasOpen)!;
  const shown = RESOURCES.filter((r) => r.id === "comprension" || r.id === "comida" || amount(s, r.id) > 0);
  return (
    <header className="topbar">
      <div className="topline">
        <span className="era">📜 {era.name}</span>
        <span title="Población / capacidad">👥 {s.villagers.length}/{housing(s)}</span>
        <span title="Ánimo">{s.animo >= 1.1 ? "😄" : s.animo >= 0.9 ? "🙂" : "😟"} {Math.round(s.animo * 100)}%</span>
        <span title="Años transcurridos">⏳ {Math.floor(s.time / config.TIEMPO_POR_AÑO)} años</span>
        {speed !== 1 && <span className="speed">{speed === 0 ? "⏸" : `×${speed}`}</span>}
      </div>
      <div className="resources">
        {shown.map((r) => (
          <span key={r.id} className={"res" + (s.resolved[r.id] ? " solved" : s.debug.infinite[r.id] ? " inf" : "")} title={r.name}>
            {r.icon} {qty(s, r.id)}
          </span>
        ))}
      </div>
    </header>
  );
}
