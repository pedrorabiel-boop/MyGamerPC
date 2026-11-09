import { BUILDING_BY_ID, FOOD_GATHER, MATERIALS, RES_BY_ID, ROLES, type Role } from "../content";
import { engine, useEngine } from "../engine";
import { changeRoleCount } from "../sim/actions";
import { has, isFree, roleUnlocked, staffCount, stageOf } from "../sim/economy";
import { hasJefatura } from "../sim/jefatura";
import type { GameState } from "../sim/state";
import { JefaturaPanel } from "./JefaturaPanel";

/** Texto con lo que hace hoy cada categoría, según las tecnologías conocidas. */
function roleMethod(s: GameState, role: Role): string {
  if (role === "comida") {
    const ways = [
      ...(has(s, "N01") ? ["parcelas"] : []),
      ...(has(s, "N10") ? ["muelle"] : []),
      ...FOOD_GATHER.filter((m) => has(s, m.tech)).map((m) => (m.node === "manada" ? "caza" : "bayas")),
    ];
    return `Ahora: ${ways.join(" → ")}`;
  }
  if (role === "materiales") {
    return `Juntan: ${MATERIALS.filter((m) => has(s, m.tech)).map((m) => RES_BY_ID[m.res].icon + " " + RES_BY_ID[m.res].name.toLowerCase()).join(", ")}`;
  }
  return "Levantan los planos que colocas en 🔨 Construir.";
}

export function VillagersPanel() {
  const { s } = useEngine();
  const adults = s.villagers.filter((v) => stageOf(v) === "adult");
  const children = s.villagers.filter((v) => stageOf(v) === "child").length;
  const elders = s.villagers.filter((v) => stageOf(v) === "elder").length;
  const free = s.villagers.filter(isFree).length;
  const specialistBuildings = s.buildings.filter((b) => b.built && BUILDING_BY_ID[b.type].staff?.by === "especialista");

  return (
    <div>
      <p className="hint">
        {adults.length} {adults.length === 1 ? "adulto" : "adultos"} ({free} {free === 1 ? "libre" : "libres"}) · {children}{" "}
        {children === 1 ? "niño" : "niños"} · {elders} {elders === 1 ? "anciano" : "ancianos"}

      </p>
      {hasJefatura(s) ? (
        <JefaturaPanel />
      ) : !has(s, "P01") ? (
        <p className="hint">
          Sin <b>Lenguaje</b> no hay oficios: solo puedes <b>señalar</b>. Toca un aldeano en el mapa y luego un recurso
          (arbusto, árbol, rocas…) para que haga un viaje.
        </p>
      ) : (
        <div className="list">
          {ROLES.filter((r) => roleUnlocked(s, r.id)).map((r) => {
            const n = adults.filter((v) => v.role === r.id && v.workplace === null).length;
            return (
              <div key={r.id} className="row">
                <span className="big">{r.icon}</span>
                <span className="grow">
                  <b>{r.name}</b>
                  <small>{r.desc}</small>
                  <small className="method">{roleMethod(s, r.id)}</small>
                </span>
                <button className="round" onClick={() => { changeRoleCount(s, r.id, -1); engine.notify(); }} disabled={n === 0}>−</button>
                <span className="count">{n}</span>
                <button className="round" onClick={() => { changeRoleCount(s, r.id, 1); engine.notify(); }} disabled={free === 0}>+</button>
              </div>
            );
          })}
        </div>
      )}

      {!hasJefatura(s) && specialistBuildings.length > 0 && (
        <>
          <h4>Especialistas</h4>
          <p className="hint">Se asignan tocando el edificio en el mapa.</p>
          <div className="list">
            {specialistBuildings.map((b) => {
              const def = BUILDING_BY_ID[b.type];
              const have = staffCount(s, b);
              return (
                <button key={b.id} className="row" onClick={() => { engine.ui.selectedBuilding = b.id; engine.ui.selected = null; engine.notify(); }}>
                  <span className="big">{def.icon}</span>
                  <span className="grow"><b>{def.name}</b><small>{def.staff!.icon} {def.staff!.title}</small></span>
                  <span className={"count" + (have < def.staff!.slots ? " warn" : "")}>{have}/{def.staff!.slots}</span>
                </button>
              );
            })}
          </div>
        </>
      )}

      <h4>La tribu</h4>
      <div className="people">
        {s.villagers.map((v) => {
          const role = v.workplace != null ? BUILDING_BY_ID[s.buildings.find((b) => b.id === v.workplace)?.type ?? "pila"].staff?.icon : v.role ? ROLES.find((r) => r.id === v.role)?.icon : "";
          return (
            <button
              key={v.id}
              className={"person" + (engine.ui.selected === v.id ? " sel" : "")}
              onClick={() => { engine.ui.selected = v.id; engine.ui.selectedBuilding = null; engine.notify(); }}
            >
              {stageOf(v) === "child" ? "🧒" : stageOf(v) === "elder" ? "🧓" : "🧑"} {v.name} · {Math.floor(v.age)} {role}
            </button>
          );
        })}
      </div>
    </div>
  );
}
