import { BUILDING_BY_ID, ROLES, ROLE_BY_ID } from "../content";
import { engine, useEngine } from "../engine";
import { setRole } from "../sim/actions";
import { has, stageOf } from "../sim/economy";
import { roleUnlocked } from "../sim/step";

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
  const workplace = v.workplace != null ? s.buildings.find((b) => b.id === v.workplace) : null;
  const what = workplace
    ? `${BUILDING_BY_ID[workplace.type].staff?.icon} ${BUILDING_BY_ID[workplace.type].staff?.title} (especialista)`
    : v.role ? `${ROLE_BY_ID[v.role].icon} ${ROLE_BY_ID[v.role].name}` : "Libre";
  return (
    <div className="card">
      <div className="card-top">
        <b>{stage === "child" ? "🧒" : stage === "elder" ? "🧓" : "🧑"} {v.name}</b>
        <span>{Math.floor(v.age)} años · {stage === "child" ? "niño" : stage === "elder" ? "anciano" : "adulto"}</span>
        <button className="x" onClick={() => { engine.ui.selected = null; engine.notify(); }}>✕</button>
      </div>
      <div className="muted">{what} · {v.order ? "cumpliendo tu orden" : doing}</div>
      {stage === "adult" && !has(s, "P01") && (
        <div className="muted">👉 Toca un recurso en el mapa para que haga un viaje.</div>
      )}
      {stage === "adult" && has(s, "P01") && (
        <div className="jobs">
          <button className={!v.role && v.workplace == null ? "sel" : ""} onClick={() => { setRole(s, v.id, null); engine.notify(); }}>Libre</button>
          {ROLES.filter((r) => roleUnlocked(s, r.id)).map((r) => (
            <button key={r.id} className={v.role === r.id && v.workplace == null ? "sel" : ""} onClick={() => { setRole(s, v.id, r.id); engine.notify(); }}>
              {r.icon} {r.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
