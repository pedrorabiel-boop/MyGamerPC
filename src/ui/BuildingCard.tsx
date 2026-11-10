import { useState } from "react";
import { config } from "../config";
import { BUILDING_BY_ID, RES_BY_ID, type ResId } from "../content";
import { engine, useEngine } from "../engine";
import { cancelUpgrade, changeSpecialists, demolish, startUpgrade, upgradeCost, upgradeTarget } from "../sim/actions";
import { canAfford, outputsFull, stageOf, staffCount } from "../sim/economy";
import { hasJefatura, specialtyTarget } from "../sim/jefatura";
import { missingText } from "./format";
import { MarketOrder } from "./MarketOrder";
import { loungeCount } from "../sim/step";

const fmtCost = (c: Partial<Record<ResId, number>>) =>
  Object.entries(c).map(([r, n]) => `${RES_BY_ID[r as ResId].icon}${n}`).join(" ");

/** Filósofo → Filósofos, Agricultor → Agricultores. */
const plural = (w: string) => (/[aeiou]$/i.test(w) ? w + "s" : w + "es");

export function BuildingCard() {
  const { s, ui } = useEngine();
  const [confirm, setConfirm] = useState<number | null>(null);
  const b = s.buildings.find((x) => x.id === ui.selectedBuilding);
  if (!b) return null;
  const def = BUILDING_BY_ID[b.type];
  const upTo = upgradeTarget(s, b.id);
  const staff = def.staff;
  const have = staffCount(s, b);
  // Quienes trabajan aquí (no cuenta a los ancianos libres que vienen de tertulia).
  const workers = s.villagers.filter((v) => v.workplace === b.id || ((v.task.kind === "toBuilding" || v.task.kind === "work") && v.task.bId === b.id && !(v.workplace == null && stageOf(v) === "elder")));

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
      {def.onNode === "arbol" && (() => {
        const tree = s.nodes.find((n) => n.zone === b.zone && n.x === b.x && n.y === b.y);
        if (!tree) return null;
        return (
          <div className="inline">
            <span className="muted">{tree.improved2 ? "Sobre una Plantación: rinden ×" + String(config.BONO_LENADOR_PLANTACION).replace(".", ",") : "Sobre una Arboleda"}</span>
            <button className="chip" onClick={() => { engine.ui.selectedNode = tree.id; engine.ui.selectedBuilding = null; engine.notify(); }}>🌳 Ver el árbol</button>
          </div>
        );
      })()}
      {staff && (
        <div className="staff">
          <div className="staff-row">
            <span>{staff.icon} {staff.slots > 1 ? plural(staff.title) : staff.title}</span>
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
          {staff.by === "especialista" && hasJefatura(s) && b.built && (
            <div className="muted">🏛️ Meta de la Jefatura para esta especialidad: {specialtyTarget(s, b.type)}. Con − / + la cambias.</div>
          )}
          {b.type === "mercado" && b.built && <MarketOrder />}
          {staff.by === "comida" && <div className="muted">Lo ocupa sola la gente de 🍖 Comida (más gente en Comida = más puestos llenos).</div>}
          {(staff.inputs || staff.outputs) && (
            <div className="muted">
              Cada {staff.cycle} s: {staff.inputs ? `${fmtCost(staff.inputs)} → ` : ""}{staff.outputs ? fmtCost(staff.outputs) : ""}
            </div>
          )}
          {workers.length > 0 && <div className="muted">Trabajan aquí: {workers.map((w) => w.name).join(", ")}</div>}
        </div>
      )}
      {staff && b.built && outputsFull(s, staff.outputs) && (
        <div className="paused">
          ⏸️ En pausa: no cabe más {outputsFull(s, staff.outputs)!.map((r) => `${RES_BY_ID[r].icon} ${RES_BY_ID[r].name.toLowerCase()}`).join(" ni ")}
          {staff.inputs ? `, así que no gasta ${Object.keys(staff.inputs).map((r) => `${RES_BY_ID[r as ResId].icon} ${RES_BY_ID[r as ResId].name.toLowerCase()}`).join(" ni ")}` : ""}. Sigue solo cuando se use o haya más almacén.
        </div>
      )}
      {def.lounge && b.built && (
        <div className="muted">🧓 En tertulia: {loungeCount(s, b.id)}/{def.lounge} ancianos libres (adentro, sin verse en el mapa; piensan ×{config.BONO_TERTULIA}).</div>
      )}
      {def.school && b.built && (
        <div className="muted">🧒 Niños estudiando: {s.villagers.filter((v) => v.task.kind === "work" && v.task.bId === b.id).length}/{def.school}</div>
      )}
      {b.upgradeTo && (
        <div className="upgrade">
          <span>⬆️ Mejorando a {BUILDING_BY_ID[b.upgradeTo].name}: {Math.floor(((b.upgradeProgress ?? 0) / (BUILDING_BY_ID[b.upgradeTo].buildTime * (1 - config.DESCUENTO_MEJORA))) * 100)}%</span>
          <button onClick={() => { cancelUpgrade(s, b.id); engine.notify(); }}>Cancelar mejora</button>
        </div>
      )}
      {upTo && (
        <div className="upgrade">
          <button
            className={"primary" + (canAfford(s, upgradeCost(upTo)) ? "" : " short")}
            onClick={() => {
              const missing = missingText(s, upgradeCost(upTo));
              if (missing) { engine.toast(`Faltan materiales para la mejora: ${missing}`); return; }
              const err = startUpgrade(s, b.id); if (err) engine.toast(err); engine.notify();
            }}
          >
            ⬆️ Mejorar a {BUILDING_BY_ID[upTo].icon} {BUILDING_BY_ID[upTo].name}
          </button>
          <span className="muted">{fmtCost(upgradeCost(upTo))} · {Math.round(config.DESCUENTO_MEJORA * 100)}% de descuento{canAfford(s, upgradeCost(upTo)) ? "" : ` · faltan ${missingText(s, upgradeCost(upTo))}`}</span>
        </div>
      )}
      {def.unlockedBy && (
        <div className="demolish">
          {confirm === b.id ? (
            <>
              <span className="muted">
                {b.built
                  ? `¿Demoler? Recuperas ${Math.round(config.DEVOLUCION_DEMOLER * 100)}% de los materiales (${fmtCost(Object.fromEntries(Object.entries(def.cost).map(([r, n]) => [r, Math.floor((n ?? 0) * config.DEVOLUCION_DEMOLER)])))}).`
                  : "¿Cancelar la obra? Se devuelven todos los materiales."}
              </span>
              <button className="danger" onClick={() => { demolish(s, b.id); engine.ui.selectedBuilding = null; setConfirm(null); engine.notify(); }}>Sí</button>
              <button onClick={() => setConfirm(null)}>No</button>
            </>
          ) : (
            <button className="danger" onClick={() => setConfirm(b.id)}>{b.built ? "🗑️ Demoler" : "✖ Cancelar obra"}</button>
          )}
        </div>
      )}
    </div>
  );
}
