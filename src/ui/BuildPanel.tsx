import { BUILDINGS, BUILDING_BY_ID, JOB_BY_ID, RESOLUTIONS, RES_BY_ID, type ResId } from "../content";
import { TECH_BY_ID } from "../data/tree";
import { engine, useEngine } from "../engine";
import { canAfford, has, resolutionProgress } from "../sim/economy";
import type { GameState } from "../sim/state";

export function BuildPanel({ onPick }: { onPick: () => void }) {
  const { s } = useEngine();
  const available = BUILDINGS.filter((b) => b.unlockedBy && has(s, b.unlockedBy));
  return (
    <div>
      {!available.length && <p className="hint">Todavía no sabes construir nada. Estudia el Libro (Fuego, Refugio…).</p>}
      <div className="list">
        {available.map((b) => {
          const ok = canAfford(s, b.cost);
          return (
            <button
              key={b.id}
              className={"row" + (ok ? "" : " disabled")}
              onClick={() => {
                if (!ok) { engine.toast("No alcanzan los materiales."); return; }
                engine.ui.placing = b.id;
                engine.toast(`Toca una casilla marcada para colocar: ${b.name}.`);
                onPick();
              }}
            >
              <span className="big">{b.icon}</span>
              <span className="grow">
                <b>{b.name}</b>
                <small>{b.desc}</small>
              </span>
              <span className="cost">
                {Object.entries(b.cost).map(([r, a]) => (
                  <span key={r}>{RES_BY_ID[r as ResId].icon}{a} </span>
                ))}
              </span>
            </button>
          );
        })}
      </div>
      <Autosuficiencia s={s} />
    </div>
  );
}

/** Metas para dejar un recurso "resuelto": edificios + aldeanos asignados de forma fija. */
function Autosuficiencia({ s }: { s: GameState }) {
  return (
    <>
      <h4>✅ Autosuficiencia</h4>
      <p className="hint">
        Con estos edificios y aldeanos asignados, el recurso queda <b>resuelto</b>: deja de tener cantidad y nunca falta.
      </p>
      <div className="list">
        {RESOLUTIONS.map((def) => {
          const p = resolutionProgress(s, def);
          const r = RES_BY_ID[def.res];
          const done = !!s.resolved[def.res];
          return (
            <div key={def.res} className={"solve" + (done ? " done" : "")}>
              <b>{r.icon} {r.name}</b> {done ? "— resuelta" : ""}
              <ul>
                <li className={p.tech ? "ok" : "no"}>📖 {TECH_BY_ID[def.tech].name}</li>
                {p.buildings.map((b) => (
                  <li key={b.type} className={b.have >= b.need ? "ok" : "no"}>
                    {BUILDING_BY_ID[b.type].icon} {BUILDING_BY_ID[b.type].name}: {b.have}/{b.need}
                  </li>
                ))}
                {p.workers.map((w) => (
                  <li key={w.job} className={w.have >= w.need ? "ok" : "no"}>
                    {JOB_BY_ID[w.job].icon} {JOB_BY_ID[w.job].name}: {w.have}/{w.need}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </>
  );
}
