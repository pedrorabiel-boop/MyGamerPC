// Ficha del Mercado: el jugador elige qué comprar; el mercader paga con lo que sobra,
// un cambio cada MERCADO_CICLO segundos, al precio de la complejidad del recurso.
import { config } from "../config";
import { RES_BY_ID, type ResId } from "../content";
import { engine, useEngine } from "../engine";
import { buyableRes, marketQuote, resTier } from "../sim/market";

const label = (r: ResId) => `${RES_BY_ID[r].icon} ${RES_BY_ID[r].name}`;

export function MarketOrder() {
  const { s } = useEngine();
  const order = s.marketOrder;
  const set = (r: ResId | null) => { s.marketOrder = r; engine.notify(); };
  const options = buyableRes(s).sort((a, b) => resTier(a) - resTier(b));
  const q = order ? marketQuote(s, order) : null;

  return (
    <div className="market">
      <div className="muted">
        ⚖️ Pídele algo al mercader: paga con lo que sobra, <b>un cambio cada {config.MERCADO_CICLO} s</b>.
        Lo más complejo cuesta más ({config.MERCADO_TASA} por 1 en el mismo nivel, el doble por cada nivel que sube).
      </div>
      <div className="inline">
        <select value={order ?? ""} onChange={(e) => set((e.target.value || null) as ResId | null)}>
          <option value="">— Sin pedido (no cambia nada) —</option>
          {options.map((r) => (
            <option key={r} value={r}>{label(r)} · nivel {resTier(r)}{s.focus === r ? " · 🎯" : ""}</option>
          ))}
        </select>
        {!order && s.focus && s.focus !== "comprension" && options.includes(s.focus) && (
          <button className="chip" onClick={() => set(s.focus)}>Comprar 🎯 {label(s.focus)}</button>
        )}
      </div>
      {order && q && (q.ok
        ? <div className="okc">Próximo cambio: {q.price} {RES_BY_ID[q.from].icon} → 1 {RES_BY_ID[order].icon}</div>
        : <div className="warn">⏸️ No puede comprar {label(order)}: {q.why}.</div>)}
      {s.lastTrade && (
        <div className="muted">
          Último cambio: {s.lastTrade.price} {RES_BY_ID[s.lastTrade.from].icon} → 1 {RES_BY_ID[s.lastTrade.to].icon}
        </div>
      )}
    </div>
  );
}
