// Menú al tocar un recurso en la barra de arriba: concentrar a la gente de Materiales en él
// (o en lo que lo alimenta, si sale de un edificio) y ver cómo se consigue (pestaña Recursos del Libro).
import { BUILDING_BY_ID, NODE_UPGRADE_TECH, RES_BY_ID, type ResId } from "../content";
import { TECH_BY_ID } from "../data/tree";
import { has } from "../sim/economy";
import { engine, useEngine } from "../engine";
import { focusPlan, isGatherable, WILD_LOW, wildState } from "../sim/guide";
import type { GameState } from "../sim/state";
import { qty } from "./format";

/** Botón 🎯 y explicación de qué juntará Materiales (lo usan el menú y la guía del Libro). */
export function FocusControls({ s, res, after }: { s: GameState; res: ResId; after?: () => void }) {
  const plan = focusPlan(s, res);
  const direct = isGatherable(s, res);
  if (plan.targets.length === 0) {
    return <div className="muted">La gente de Materiales no junta nada de su cadena: mira cómo se consigue.</div>;
  }
  const on = s.focus === res;
  return (
    <div className="focusctl">
      <button className={"chip" + (on ? " sel" : "")} onClick={() => { s.focus = on ? null : res; engine.notify(); after?.(); }}>
        🎯 {on ? "Dejar de concentrar" : direct ? "Concentrar Materiales en esto" : "Concentrar Materiales en lo que necesita"}
      </button>
      {!direct && (
        <div className="muted">
          Materiales juntará: {plan.targets.map((t) => `${RES_BY_ID[t].icon} ${RES_BY_ID[t].name}`).join(" · ")}
        </div>
      )}
      {plan.targets.map((t) => <WildWarning key={t} s={s} res={t} />)}
      {plan.gaps.map((g) => {
        const d = BUILDING_BY_ID[g.building];
        return (
          <div key={g.building + g.issue} className="warn">
            ⚠️ {g.issue === "construir" ? `Falta construir ${d.icon} ${d.name}` : `${d.icon} ${d.name} sin ${d.staff?.icon ?? ""} ${d.staff?.title ?? "trabajador"}`}
          </div>
        );
      })}
    </div>
  );
}

/** Aviso: la reserva silvestre se está agotando, así que más gente no ayuda. */
function WildWarning({ s, res }: { s: GameState; res: ResId }) {
  const w = wildState(s, res);
  if (!w || w.fill >= WILD_LOW) return null;
  const name = RES_BY_ID[res].name.toLowerCase();
  const fix = !has(s, NODE_UPGRADE_TECH)
    ? `Con 🌱 ${TECH_BY_ID[NODE_UPGRADE_TECH].name} se pueden mejorar.`
    : w.unimproved > 0 && w.upgrade
      ? `Tócalos en el mapa para mejorarlos a ${w.upgrade} (quedan ${w.unimproved} sin mejorar).`
      : "Ya están todos mejorados.";
  return <div className="warn">🌿 La {name} silvestre se está agotando: más gente no ayuda. {fix}</div>;
}

export function ResourceMenu() {
  const { s, ui } = useEngine();
  const res = ui.resMenu;
  if (!res) return null;
  const r = RES_BY_ID[res];
  const close = () => { engine.ui.resMenu = null; engine.notify(); };
  return (
    <div className="resmenu">
      <div className="card-top">
        <b>{r.icon} {r.name}</b>
        <span>{qty(s, res)}</span>
        <button className="x" onClick={close}>✕</button>
      </div>
      <FocusControls s={s} res={res} after={close} />
      <div className="inline">
        <button
          className="chip"
          onClick={() => { engine.ui.tab = "libro"; engine.ui.bookTab = "recursos"; engine.ui.guideRes = res; close(); }}
        >
          📖 ¿Cómo se consigue?
        </button>
      </div>
    </div>
  );
}
