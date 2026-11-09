import { BUILDING_BY_ID, RES_BY_ID, type ResId } from "../content";
import { engine, useEngine } from "../engine";
import { changeSpecialists } from "../sim/actions";
import { staffCount } from "../sim/economy";

const fmtCost = (c: Partial<Record<ResId, number>>) =>
  Object.entries(c).map(([r, n]) => `${RES_BY_ID[r as ResId].icon}${n}`).join(" ");

export function BuildingCard() {
  const { s, ui } = useEngine();
  const b = s.buildings.find((x) => x.id === ui.selectedBuilding);
  if (!b) return null;
  const def = BUILDING_BY_ID[b.type];
  const staff = def.staff;
  const have = staffCount(s, b);
  const workers = s.villagers.filter((v) => v.workplace === b.id || ((v.task.kind === "toBuilding" || v.task.kind === "work") && v.task.bId === b.id));

  const change = (d: 1 | -1) => {
    const err = changeSpecialists(s, b.id, d);
    if (err) engine.toast(err);
    engine.notify();
  };

  return (
    <div className="card">
      <div className="card-top">
        <b>{def.icon} {def.name}</b>
        <span>{b.built ? "" : `en construcción (${Math.floor((b.progress / def.buildTime) * 100)}%)`}</span>
        <button className="x" onClick={() => { engine.ui.selectedBuilding = null; engine.notify(); }}>✕</button>
      </div>
      <div className="muted">{def.desc}</div>
      {staff && (
        <div className="staff">
          <div className="staff-row">
            <span>{staff.icon} {staff.title}{staff.slots > 1 ? "es" : ""}</span>
            <span className="dots">
              {Array.from({ length: staff.slots }, (_, i) => <span key={i} className={i < have ? "dot on" : "dot off"} />)}
            </span>
            <b className={have < staff.slots ? "warn" : "okc"}>{have}/{staff.slots}</b>
            {staff.by === "especialista" && b.built && (
              <>
                <button className="round" onClick={() => change(-1)} disabled={have === 0}>−</button>
                <button className="round" onClick={() => change(1)} disabled={have >= staff.slots}>+</button>
              </>
            )}
          </div>
          {staff.by === "comida" && <div className="muted">Lo ocupa sola la gente de 🍖 Comida (más gente en Comida = más puestos llenos).</div>}
          {(staff.inputs || staff.outputs) && (
            <div className="muted">
              Cada {staff.cycle} s: {staff.inputs ? `${fmtCost(staff.inputs)} → ` : ""}{staff.outputs ? fmtCost(staff.outputs) : ""}
            </div>
          )}
          {workers.length > 0 && <div className="muted">Trabajan aquí: {workers.map((w) => w.name).join(", ")}</div>}
        </div>
      )}
    </div>
  );
}
