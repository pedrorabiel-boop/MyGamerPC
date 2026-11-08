import { JOBS, JOB_BY_ID } from "../content";
import { engine, useEngine } from "../engine";
import { setJob } from "../sim/actions";
import { has, stageOf } from "../sim/economy";
import { jobUnlocked } from "../sim/step";

const TASK_LABEL: Record<string, string> = {
  idle: "dando vueltas", toNode: "yendo a recolectar", gather: "recolectando", toBuilding: "yendo a trabajar",
  work: "trabajando", toSite: "yendo a una obra", build: "construyendo",
};

export function VillagerCard() {
  const { s, ui } = useEngine();
  const v = s.villagers.find((x) => x.id === ui.selected);
  if (!v) return null;
  const stage = stageOf(v);
  const doing = v.carry ? "llevando cosas a la pila" : TASK_LABEL[v.task.kind];
  return (
    <div className="card">
      <div className="card-top">
        <b>{stage === "child" ? "🧒" : stage === "elder" ? "🧓" : "🧑"} {v.name}</b>
        <span>{Math.floor(v.age)} años · {stage === "child" ? "niño" : stage === "elder" ? "anciano" : "adulto"}</span>
        <button className="x" onClick={() => { engine.ui.selected = null; engine.notify(); }}>✕</button>
      </div>
      <div className="muted">
        {v.job ? `${JOB_BY_ID[v.job].icon} ${JOB_BY_ID[v.job].name}` : "Sin oficio"} · {v.order ? "cumpliendo tu orden" : doing}
      </div>
      {stage === "adult" && !has(s, "P01") && (
        <div className="muted">👉 Toca un recurso en el mapa para que haga un viaje.</div>
      )}
      {stage === "adult" && has(s, "P01") && (
        <div className="jobs">
          <button className={!v.job ? "sel" : ""} onClick={() => { setJob(s, v.id, null); engine.notify(); }}>Ninguno</button>
          {JOBS.filter((j) => jobUnlocked(s, j.id)).map((j) => (
            <button key={j.id} className={v.job === j.id ? "sel" : ""} onClick={() => { setJob(s, v.id, j.id); engine.notify(); }}>
              {j.icon} {j.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
