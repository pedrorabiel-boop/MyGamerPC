import { JOBS } from "../content";
import { engine, useEngine } from "../engine";
import { changeJobCount } from "../sim/actions";
import { has, stageOf } from "../sim/economy";
import { jobUnlocked } from "../sim/step";

export function VillagersPanel() {
  const { s } = useEngine();
  const adults = s.villagers.filter((v) => stageOf(v) === "adult");
  const children = s.villagers.filter((v) => stageOf(v) === "child").length;
  const elders = s.villagers.filter((v) => stageOf(v) === "elder").length;
  const idle = adults.filter((v) => !v.job).length;

  return (
    <div>
      <p className="hint">
        {adults.length} adultos ({idle} sin oficio) · {children} niños · {elders} ancianos
        {has(s, "N11") ? " · 👑 Jefatura: la tribu mantiene sola estas cantidades." : ""}
      </p>
      {!has(s, "P01") ? (
        <p className="hint">
          Sin <b>Lenguaje</b> no hay oficios: solo puedes <b>señalar</b>. Toca un aldeano en el mapa y luego un recurso
          (arbusto, árbol, rocas…) para que haga un viaje.
        </p>
      ) : (
        <div className="list">
          {JOBS.filter((j) => jobUnlocked(s, j.id)).map((j) => {
            const n = adults.filter((v) => v.job === j.id).length;
            return (
              <div key={j.id} className="row">
                <span className="big">{j.icon}</span>
                <span className="grow"><b>{j.name}</b></span>
                <button className="round" onClick={() => { changeJobCount(s, j.id, -1); engine.notify(); }} disabled={n === 0}>−</button>
                <span className="count">{n}</span>
                <button className="round" onClick={() => { changeJobCount(s, j.id, 1); engine.notify(); }} disabled={idle === 0}>+</button>
              </div>
            );
          })}
        </div>
      )}
      <h4>La tribu</h4>
      <div className="people">
        {s.villagers.map((v) => (
          <button
            key={v.id}
            className={"person" + (engine.ui.selected === v.id ? " sel" : "")}
            onClick={() => { engine.ui.selected = v.id; engine.notify(); }}
          >
            {stageOf(v) === "child" ? "🧒" : stageOf(v) === "elder" ? "🧓" : "🧑"} {v.name} · {Math.floor(v.age)}
            {v.job ? ` · ${JOBS.find((j) => j.id === v.job)?.icon}` : ""}
          </button>
        ))}
      </div>
    </div>
  );
}
