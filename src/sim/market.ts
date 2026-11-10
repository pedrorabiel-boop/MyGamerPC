// Mercado (H07): el jugador pide qué comprar y el mercader paga con lo que sobra, un cambio por
// ciclo (config.MERCADO_CICLO). El precio depende de la complejidad del recurso: cuántos pasos de
// fabricación tiene detrás, calculado de las recetas de los edificios.
import { config } from "../config";
import { BUILDINGS, RESOURCES, type ResId } from "../content";
import { storageCap, unlimited, add } from "./economy";
import { sourcesOf, sourceUnlocked } from "./guide";
import type { GameState } from "./state";

let tiers: Partial<Record<ResId, number>> | null = null;

/** Complejidad: 1 si se junta o sale de un edificio sin insumos; si no, 1 + la del insumo más complejo (camino más barato). */
export function resTier(res: ResId): number {
  if (!tiers) {
    const t: Partial<Record<ResId, number>> = {};
    const visit = (r: ResId, stack: Set<ResId>): number => {
      if (t[r] != null) return t[r]!;
      if (stack.has(r)) return 1;
      stack.add(r);
      let best = Infinity;
      let produced = false;
      for (const def of BUILDINGS) {
        if (!def.staff?.outputs?.[r]) continue;
        produced = true;
        const ins = Object.keys(def.staff.inputs ?? {}) as ResId[];
        const tier = ins.length === 0 ? 1 : 1 + Math.max(...ins.map((i) => visit(i, stack)));
        best = Math.min(best, tier);
      }
      stack.delete(r);
      const v = produced ? best : 1;
      t[r] = v;
      return v;
    };
    for (const r of RESOURCES) visit(r.id, new Set());
    tiers = t;
  }
  return tiers[res] ?? 1;
}

/** Cuánto de `from` cuesta 1 de `to`: MERCADO_TASA en el mismo nivel, ×2 por nivel que sube, mínimo 1. */
export function marketPrice(from: ResId, to: ResId): number {
  const d = resTier(to) - resTier(from);
  return Math.max(1, Math.round(config.MERCADO_TASA * 2 ** d));
}

const fill = (s: GameState, r: ResId) => s.inv[r] / storageCap(s, r);

/** Lo que se le puede pedir al mercader: recursos que la tribu conoce (ya tuvo o puede conseguir). */
export function buyableRes(s: GameState): ResId[] {
  return RESOURCES.map((r) => r.id).filter((r) => r !== "comprension" && !unlimited(s, r)
    && (s.inv[r] > 0 || sourcesOf(s, r).some((src) => sourceUnlocked(s, src))));
}

export type Quote =
  | { ok: true; from: ResId; price: number }
  | { ok: false; why: string };

/** Con qué pagaría ahora 1 de `to`: lo que sobra (almacén a la mitad o más) y, de eso, lo más barato. */
export function marketQuote(s: GameState, to: ResId): Quote {
  if (fill(s, to) >= 1) return { ok: false, why: "el almacén ya está lleno de eso" };
  let best: { from: ResId; price: number } | null = null;
  for (const { id: r } of RESOURCES) {
    if (r === to || r === "comprension" || unlimited(s, r) || fill(s, r) < 0.5) continue;
    const price = marketPrice(r, to);
    if (s.inv[r] < price) continue;
    if (!best || price < best.price || (price === best.price && fill(s, r) > fill(s, best.from))) best = { from: r, price };
  }
  return best ? { ok: true, ...best } : { ok: false, why: "no sobra nada que alcance para pagarlo (hace falta tener el almacén a la mitad o más)" };
}

/** Un cambio del mercader: compra 1 del pedido. null si no hay pedido o no alcanza. */
export function trade(s: GameState): { from: ResId; to: ResId; price: number } | null {
  const to = s.marketOrder;
  if (!to) return null;
  const q = marketQuote(s, to);
  if (!q.ok) return null;
  s.inv[q.from] -= q.price;
  add(s, to, 1);
  s.lastTrade = { from: q.from, to, price: q.price };
  return s.lastTrade;
}
