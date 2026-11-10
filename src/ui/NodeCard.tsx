// Ficha de un recurso natural (árbol, rocas, arcilla…): cuánto tiene, cuánto se regenera y,
// con N12 Técnicas de recolección, el botón para mejorarlo en su lugar (Barrero, Cantera…).
import { config } from "../config";
import { BUILDING_BY_ID, NODE_DEFS, NODE_UPGRADES, RES_BY_ID, type ResId } from "../content";
import { engine, useEngine } from "../engine";
import { cancelImproveNode, nodeNextUpgrade, nodeUpgradeBlock, startImproveNode } from "../sim/actions";
import { canAfford, nodeMax, nodeRegen } from "../sim/economy";
import { missingText } from "./format";

const fmtCost = (c: Partial<Record<ResId, number>>) =>
  Object.entries(c).map(([r, n]) => `${RES_BY_ID[r as ResId].icon}${n}`).join(" ");

export function NodeCard() {
  const { s, ui } = useEngine();
  const n = s.nodes.find((x) => x.id === ui.selectedNode);
  if (!n) return null;
  const def = NODE_DEFS[n.type];
  const up = NODE_UPGRADES[n.type];
  const close = () => { engine.ui.selectedNode = null; engine.notify(); };
  const block = nodeUpgradeBlock(s, n);
  const next = nodeNextUpgrade(n);
  const title = n.improved2 && up?.next ? `🌳 ${up.next.name}` : n.improved && up ? `🌱 ${up.name}` : def.name;
  const res = Object.keys(def.stocks) as ResId[];

  return (
    <div className="card">
      <div className="card-top">
        <b>{title}</b>
        <span>{n.improving != null && next ? `mejorando (${Math.floor((n.improving / next.buildTime) * 100)}%)` : n.improved ? "mejorado" : "silvestre"}</span>
        <button className="x" onClick={close}>✕</button>
      </div>
      {res.map((r) => (
        <div key={r} className="muted">
          {RES_BY_ID[r].icon} {RES_BY_ID[r].name}: {Math.floor(n.stock[r] ?? 0)}/{nodeMax(n, r)} · se regenera {(nodeRegen(n, r) * 60).toFixed(1)} por minuto
        </div>
      ))}
      <div className="muted">Para recolectar a mano: toca un aldeano y luego toca aquí.</div>
      {(() => {
        const hut = s.buildings.find((b) => b.zone === n.zone && b.x === n.x && b.y === n.y);
        if (!hut) return null;
        return (
          <div className="inline">
            <button className="chip" onClick={() => { engine.ui.selectedBuilding = hut.id; engine.ui.selectedNode = null; engine.notify(); }}>
              {BUILDING_BY_ID[hut.type].icon} Ver {BUILDING_BY_ID[hut.type].name}
            </button>
          </div>
        );
      })()}
      {n.type === "arbol" && n.improved && !s.buildings.some((b) => b.zone === n.zone && b.x === n.x && b.y === n.y) && s.techs.B02 && (
        <div className="muted">🪓 Puedes poner un Leñador encima (🔨 Construir): dos leñadores dan madera a ritmo fijo.</div>
      )}
      {up && next && n.improving == null && (
        block ? (
          <div className="muted">🌱 Mejorable a {next.name} — {block}</div>
        ) : (
          <div className="inline">
            {/* Nunca desactivado en silencio: si faltan materiales, avisa qué falta. */}
            <button
              className={"chip" + (canAfford(s, next.cost) ? "" : " short")}
              onClick={() => {
                const missing = missingText(s, next.cost);
                if (missing) { engine.toast(`Faltan materiales para ${next.name}: ${missing}`); return; }
                const err = startImproveNode(s, n.id); if (err) engine.toast(err); engine.notify();
              }}
            >
              🌱 Mejorar a {next.name} ({fmtCost(next.cost)})
            </button>
            {!canAfford(s, next.cost) && <span className="warn">Faltan {missingText(s, next.cost)}</span>}
          </div>
        )
      )}
      {up && next && n.improving == null && !block && (
        <div className="muted">
          {next.second
            ? `Se regenera ×${config.MEJORA_PLANTACION} más. `
            : `Se regenera ×${config[up.regen]} y guarda ×${config.MEJORA_RESERVA}. `}
          Lo hacen los 🔨 constructores; mientras tanto se sigue recolectando.
        </div>
      )}
      {n.improving != null && (
        <div className="inline">
          <button className="chip" onClick={() => { cancelImproveNode(s, n.id); engine.notify(); }}>Cancelar mejora (se devuelve todo)</button>
        </div>
      )}
    </div>
  );
}
