import { config } from "../config";
import { BUILDING_BY_ID, RESOURCES } from "../content";
import { ERAS } from "../data/tree";
import { engine, useEngine } from "../engine";
import { amount, housing } from "../sim/economy";
import { isGatherable } from "../sim/guide";
import { qty } from "./format";

export function TopBar() {
  const { s, speed } = useEngine();
  const era = ERAS.find((e) => e.id === s.erasOpen)!;
  // También en 0: los que se recolectan, el que está en foco y los que produce un edificio ya
  // construido (para poder tocarlos y concentrarse en ellos).
  const made = new Set(s.buildings.filter((b) => b.built).flatMap((b) => Object.keys(BUILDING_BY_ID[b.type]?.staff?.outputs ?? {})));
  const shown = RESOURCES.filter((r) => r.id === "comprension" || r.id === "comida" || amount(s, r.id) > 0 || isGatherable(s, r.id) || s.focus === r.id || made.has(r.id));
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
          <button
            key={r.id}
            className={"res" + (s.resolved[r.id] ? " solved" : s.debug.infinite[r.id] ? " inf" : "") + (s.focus === r.id ? " focus" : "")}
            title={r.name}
            onClick={() => { engine.ui.resMenu = engine.ui.resMenu === r.id ? null : r.id; engine.notify(); }}
          >
            {s.focus === r.id ? "🎯" : ""}{r.icon} {qty(s, r.id)}
          </button>
        ))}
      </div>
    </header>
  );
}
