// Pestaña "Recursos" del Libro: tocas un recurso y ves cómo se consigue, como diagrama
// (entradas → edificio → salida), y para qué se usa. Las entradas se pueden tocar para seguir la cadena.
import { config } from "../config";
import { BUILDING_BY_ID, NODE_UPGRADE_TECH, NODE_UPGRADES, RESOURCES, RES_BY_ID, ROLE_BY_ID, type ResId } from "../content";
import { TECH_BY_ID } from "../data/tree";
import { engine, useEngine } from "../engine";
import { nodeName, sourceUnlocked, sourcesOf, usesOf, zonesLabel, type Source } from "../sim/guide";
import type { GameState } from "../sim/state";
import { qty } from "./format";
import { FocusControls } from "./ResourceMenu";

function Chip({ res, onPick }: { res: ResId; onPick: (r: ResId) => void }) {
  const r = RES_BY_ID[res];
  return <button className="gchip" onClick={() => onPick(res)}>{r.icon} {r.name}</button>;
}

function Lock({ s, tech }: { s: GameState; tech: string | null }) {
  if (!tech || s.techs[tech]) return null;
  return <div className="glock">🔒 Necesitas estudiar: {TECH_BY_ID[tech]?.name}</div>;
}

function SourceCard({ s, src, res, onPick }: { s: GameState; src: Source; res: ResId; onPick: (r: ResId) => void }) {
  const out = RES_BY_ID[res];
  const cls = "gsrc" + (sourceUnlocked(s, src) ? "" : " locked");
  if (src.kind === "special") {
    return <div className={cls}><div className="gflow"><span className="gbox">{src.icon} {src.text}</span><span className="garrow">→</span><span className="gout">{out.icon}</span></div><Lock s={s} tech={src.tech} /></div>;
  }
  if (src.kind === "gather") {
    const who = src.who === "comida" ? `${ROLE_BY_ID.comida.icon} Comida` : `${ROLE_BY_ID.materiales.icon} Materiales`;
    return (
      <div className={cls}>
        <div className="gflow">
          <span className="gbox">🌿 {nodeName(src.node)}</span>
          <span className="garrow">→ {who} →</span>
          <span className="gout">{out.icon}</span>
        </div>
        <div className="gmeta">Recolección{src.extra ? ` (${src.extra})` : ""} · {zonesLabel(src.zones) || "—"}</div>
        {NODE_UPGRADES[src.node] && (
          <div className="gmeta">
            🌱 Mejorable a {NODE_UPGRADES[src.node]!.name} (×{config[NODE_UPGRADES[src.node]!.regen]}) tocándolo en el mapa
            {s.techs[NODE_UPGRADE_TECH] ? "" : ` · con ${TECH_BY_ID[NODE_UPGRADE_TECH].name}`}
          </div>
        )}
        <Lock s={s} tech={src.tech} />
      </div>
    );
  }
  const def = BUILDING_BY_ID[src.building];
  const inputs = Object.keys(src.kind === "building" ? src.inputs : {}) as ResId[];
  return (
    <div className={cls}>
      <div className="gflow">
        {inputs.length > 0 && (
          <>
            <span className="gins">{inputs.map((r) => <Chip key={r} res={r} onPick={onPick} />)}</span>
            <span className="garrow">→</span>
          </>
        )}
        <span className="gbox">{def.icon} {def.name}</span>
        <span className="garrow">→</span>
        <span className="gout">{out.icon}</span>
      </div>
      <div className="gmeta">
        {src.kind === "building"
          ? `${src.worker} · cada ${src.cycle} s: ${inputs.map((r) => `${(src.inputs[r] ?? 0)}${RES_BY_ID[r].icon}`).join(" + ") || "nada"} → ${src.amount}${out.icon}`
          : `solo, sin trabajadores · ${src.rate}${out.icon}/s`}
        {" · "}{zonesLabel(src.zones)}
      </div>
      <Lock s={s} tech={src.tech} />
    </div>
  );
}

export function ResourceGuide() {
  const { s, ui } = useEngine();
  const pick = (r: ResId) => { engine.ui.guideRes = r; engine.notify(); };
  const res = ui.guideRes;

  if (!res) {
    return (
      <div className="guide">
        <p className="hint">Toca un recurso para ver cómo se consigue.</p>
        <div className="gall">
          {RESOURCES.map((r) => (
            <button key={r.id} className="gchip big" onClick={() => pick(r.id)}>
              <span>{r.icon}</span> {r.name} <small>{qty(s, r.id)}</small>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const r = RES_BY_ID[res];
  const sources = sourcesOf(s, res);
  const uses = usesOf(res);
  return (
    <div className="guide">
      <button className="gback" onClick={() => { engine.ui.guideRes = null; engine.notify(); }}>← Todos los recursos</button>
      <h3>{r.icon} {r.name} <small className="muted">· tienes {qty(s, res)}</small></h3>
      <FocusControls s={s} res={res} />
      <h4>Cómo se consigue</h4>
      {sources.length === 0 ? <p className="hint">Todavía no hay forma de conseguirlo en el prototipo.</p> : (
        <div className="list">{sources.map((src, i) => <SourceCard key={i} s={s} src={src} res={res} onPick={pick} />)}</div>
      )}
      {uses.length > 0 && (
        <>
          <h4>Para qué sirve</h4>
          <div className="guses">
            {uses.map((u, i) => (
              <span key={i} className="gchip">{BUILDING_BY_ID[u.building].icon} {BUILDING_BY_ID[u.building].name}{u.as === "entrada" ? " (entrada)" : ""}</span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
