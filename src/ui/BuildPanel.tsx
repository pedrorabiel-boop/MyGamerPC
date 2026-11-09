import { BUILDINGS, BUILDING_BY_ID, RESOLUTIONS, RES_BY_ID, type ResId } from "../content";
import { TECH_BY_ID } from "../data/tree";
import { engine, useEngine } from "../engine";
import { placeableIn } from "../sim/actions";
import { canAfford, has, resolutionProgress } from "../sim/economy";
import { ZONE_BY_ID } from "../sim/state";
import type { GameState } from "../sim/state";

export function BuildPanel({ onPick }: { onPick: () => void }) {
  const { s, ui } = useEngine();
  const here = (id: string) => placeableIn(s, id, ui.zone);
  // Solo lo que se puede construir en la zona que se está mirando.
  const available = BUILDINGS.filter((b) => b.unlockedBy && has(s, b.unlockedBy) && here(b.id));
  return (
    <div>
      {!available.length && (
        <p className="hint">
          {ui.zone === "valle"
            ? "Todavía no sabes construir nada. Estudia el Libro (Fuego, Refugio…)."
            : `Todavía no hay nada que se pueda construir en ${ZONE_BY_ID[ui.zone].label}.`}
        </p>
      )}
      <div className="list">
        {available.map((b) => {
          const ok = canAfford(s, b.cost) && here(b.id);
          return (
            <button
              key={b.id}
              className={"row" + (ok ? "" : " disabled")}
              onClick={() => {
                if (!here(b.id)) { engine.toast(`Eso no se puede construir en ${ZONE_BY_ID[ui.zone].label}.`); return; }
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
                {!here(b.id) && <small className="warn">No se puede en {ZONE_BY_ID[ui.zone].label}</small>}
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
      {ui.zone === "valle" && <Autosuficiencia s={s} />}
    </div>
  );
}

/** Metas para dejar un recurso "resuelto": edificios + aldeanos asignados de forma fija. */
function Autosuficiencia({ s }: { s: GameState }) {
  return (
    <>
      <h4>✅ Autosuficiencia</h4>
      <p className="hint">
        Con estos edificios y sus puestos ocupados, el recurso queda <b>resuelto</b>: deja de tener cantidad y nunca falta.
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
                {p.near && (
                  <li className={p.near.have >= p.near.n ? "ok" : "no"}>
                    {BUILDING_BY_ID[p.near.type].icon} {BUILDING_BY_ID[p.near.type].name}s junto a un {BUILDING_BY_ID[p.near.near].name.toLowerCase()}: {p.near.have}/{p.near.n}
                  </li>
                )}
                {p.staffed.map((w) => (
                  <li key={w.type} className={w.have >= w.need ? "ok" : "no"}>
                    {BUILDING_BY_ID[w.type].staff?.icon} Puestos ocupados en {BUILDING_BY_ID[w.type].name.toLowerCase()}s: {w.have}/{w.need}
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
