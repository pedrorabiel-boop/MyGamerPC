// Ficha de un recurso natural (árbol, rocas, arcilla…): cuánto tiene, cuánto se regenera y,
// con N12 Técnicas de recolección, el botón para mejorarlo en su lugar (Barrero, Cantera…).
import { config } from "../config";
import { NODE_DEFS, NODE_UPGRADES, RES_BY_ID, type ResId } from "../content";
import { engine, useEngine } from "../engine";
import { cancelImproveNode, nodeUpgradeBlock, startImproveNode } from "../sim/actions";
import { canAfford, nodeMax, nodeRegen } from "../sim/economy";

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
  const res = Object.keys(def.stocks) as ResId[];

  return (
    <div className="card">
      <div className="card-top">
        <b>{n.improved && up ? `🌱 ${up.name}` : def.name}</b>
        <span>{n.improved ? "mejorado" : n.improving != null && up ? `mejorando (${Math.floor((n.improving / up.buildTime) * 100)}%)` : "silvestre"}</span>
        <button className="x" onClick={close}>✕</button>
      </div>
      {res.map((r) => (
        <div key={r} className="muted">
          {RES_BY_ID[r].icon} {RES_BY_ID[r].name}: {Math.floor(n.stock[r] ?? 0)}/{nodeMax(n, r)} · se regenera {(nodeRegen(n, r) * 60).toFixed(1)} por minuto
        </div>
      ))}
      <div className="muted">Para recolectar a mano: toca un aldeano y luego toca aquí.</div>
      {up && !n.improved && n.improving == null && (
        block ? (
          <div className="muted">🌱 Mejorable a {up.name} — {block}</div>
        ) : (
          <div className="inline">
            <button
              className="chip"
              disabled={!canAfford(s, up.cost)}
              onClick={() => { const err = startImproveNode(s, n.id); if (err) engine.toast(err); engine.notify(); }}
            >
              🌱 Mejorar a {up.name} ({fmtCost(up.cost)})
            </button>
          </div>
        )
      )}
      {up && !n.improved && n.improving == null && !block && (
        <div className="muted">Se regenera ×{config[up.regen]} y guarda ×{config.MEJORA_RESERVA}. Lo hacen los 🔨 constructores; mientras tanto se sigue recolectando.</div>
      )}
      {n.improving != null && (
        <div className="inline">
          <button className="chip" onClick={() => { cancelImproveNode(s, n.id); engine.notify(); }}>Cancelar mejora (se devuelve todo)</button>
        </div>
      )}
    </div>
  );
}
