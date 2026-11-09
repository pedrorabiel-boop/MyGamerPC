// Guía de recursos: de dónde sale cada recurso y para qué se usa. Se calcula desde los datos
// del juego (recolección, edificios y sus entradas/salidas), así que se mantiene sola al día.
import {
  BUILDINGS, FOOD_GATHER, MATERIALS, NODE_DEFS, NODE_UPGRADES, type BuildingDef, type Cost, type NodeType, type ResId,
} from "../content";
import { has, nodeMax, staffCount } from "./economy";
import { ZONE_BY_ID, type GameState, type Tile, type ZoneId } from "./state";

export type Source =
  | { kind: "gather"; who: "materiales" | "comida"; node: NodeType; zones: ZoneId[]; tech: string; extra?: string }
  | { kind: "building"; building: string; inputs: Cost; amount: number; cycle: number; worker: string | null; tech: string | null; zones: ZoneId[] }
  | { kind: "passive"; building: string; rate: number; tech: string | null; zones: ZoneId[] }
  | { kind: "special"; icon: string; text: string; tech: string | null };

const TILE_ZONE: Partial<Record<Tile, ZoneId>> = { pasto: "valle", orilla: "valle", suelo: "cueva", monte: "montanas" };
const NODE_ZONE: Partial<Record<NodeType, ZoneId>> = { veta: "cueva", estano: "montanas" };

/** En qué zonas se puede construir un edificio. */
export function buildingZones(def: BuildingDef): ZoneId[] {
  if (def.onNode && NODE_ZONE[def.onNode]) return [NODE_ZONE[def.onNode]!];
  return [...new Set(def.place.map((t) => TILE_ZONE[t]).filter(Boolean) as ZoneId[])];
}

/** En qué zonas hay de este recurso silvestre. */
export function nodeZones(s: GameState, node: NodeType): ZoneId[] {
  return [...new Set(s.nodes.filter((n) => n.type === node).map((n) => n.zone))];
}

export function sourcesOf(s: GameState, res: ResId): Source[] {
  const out: Source[] = [];
  if (res === "comprension") {
    out.push({ kind: "special", icon: "📖", text: "Tocar el Libro", tech: null });
    out.push({ kind: "special", icon: "🧓", text: "Los ancianos la generan solos", tech: "P01" });
  }
  // Recolección
  for (const m of MATERIALS) if (m.res === res) out.push({ kind: "gather", who: "materiales", node: m.node, zones: nodeZones(s, m.node), tech: m.tech });
  if (res === "comida") {
    for (const m of FOOD_GATHER) out.push({ kind: "gather", who: "comida", node: m.node, zones: nodeZones(s, m.node), tech: m.tech });
  }
  for (const m of FOOD_GATHER) {
    if (m.bonus?.res === res) out.push({ kind: "gather", who: "comida", node: m.node, zones: nodeZones(s, m.node), tech: m.tech, extra: "de yapa al cazar" });
  }
  // Edificios
  for (const def of BUILDINGS) {
    const amount = def.staff?.outputs?.[res];
    if (amount) {
      out.push({
        kind: "building", building: def.id, inputs: def.staff!.inputs ?? {}, amount, cycle: def.staff!.cycle,
        worker: def.staff!.by === "comida" ? "gente de 🍖 Comida" : `${def.staff!.icon} ${def.staff!.title}`,
        tech: def.unlockedBy, zones: buildingZones(def),
      });
    }
    if (def.passive?.res === res) out.push({ kind: "passive", building: def.id, rate: def.passive.rate, tech: def.unlockedBy, zones: buildingZones(def) });
  }
  return out;
}

/** Para qué se usa un recurso: construir edificios o como entrada de un edificio. */
export function usesOf(res: ResId): { building: string; as: "costo" | "entrada" }[] {
  const out: { building: string; as: "costo" | "entrada" }[] = [];
  for (const def of BUILDINGS) {
    if (def.cost[res]) out.push({ building: def.id, as: "costo" });
    if (def.staff?.inputs?.[res]) out.push({ building: def.id, as: "entrada" });
  }
  return out;
}

export const sourceUnlocked = (s: GameState, src: Source) => !("tech" in src) || !src.tech || has(s, src.tech);

export const zonesLabel = (zones: ZoneId[]) => zones.map((z) => `${ZONE_BY_ID[z].icon} ${ZONE_BY_ID[z].name}`).join(", ");

export const nodeName = (node: NodeType) => NODE_DEFS[node].name;

/** ¿Este recurso lo puede juntar la gente de Materiales? (para concentrarla en él) */
export const isGatherable = (s: GameState, res: ResId) => MATERIALS.some((m) => m.res === res && has(s, m.tech));

/**
 * Foco: qué tiene que juntar la gente de Materiales para conseguir un recurso. Si se recolecta
 * a mano, es él mismo; si sale de un edificio, se baja por la cadena (solo por edificios ya
 * desbloqueados) hasta lo que sí se recolecta. `gaps` dice dónde se traba la cadena por otra
 * cosa: un edificio que falta construir o que no tiene trabajador.
 */
export interface FocusPlan { targets: ResId[]; gaps: { building: string; issue: "construir" | "trabajador" }[] }

export function focusPlan(s: GameState, res: ResId, withGaps = true): FocusPlan {
  const plan: FocusPlan = { targets: [], gaps: [] };
  const seen = new Set<ResId>();
  const walk = (r: ResId) => {
    if (seen.has(r)) return;
    seen.add(r);
    if (isGatherable(s, r)) { plan.targets.push(r); return; }
    const makers = BUILDINGS.filter((d) => d.staff?.outputs?.[r] && (!d.unlockedBy || has(s, d.unlockedBy)));
    if (makers.length === 0) return;
    if (withGaps) {
      const built = s.buildings.filter((b) => b.built && makers.some((d) => d.id === b.type));
      if (built.length === 0) plan.gaps.push({ building: makers[0].id, issue: "construir" });
      else if (!built.some((b) => staffCount(s, b) > 0)) plan.gaps.push({ building: built[0].type, issue: "trabajador" });
    }
    for (const d of makers) for (const input of Object.keys(d.staff!.inputs ?? {}) as ResId[]) walk(input);
  };
  walk(res);
  return plan;
}

export const focusTargets = (s: GameState, res: ResId) => focusPlan(s, res, false).targets;
export const isFocusable = (s: GameState, res: ResId) => focusTargets(s, res).length > 0;

/**
 * Qué tan llena está la reserva silvestre de un recurso que se recolecta (0 = agotada, 1 = llena),
 * y cuántos de sus recursos naturales todavía se pueden mejorar. null si no se recolecta a mano.
 */
export function wildState(s: GameState, res: ResId): { fill: number; unimproved: number; upgrade: string | null; node: NodeType } | null {
  const types = MATERIALS.filter((m) => m.res === res && has(s, m.tech)).map((m) => m.node);
  const nodes = s.nodes.filter((n) => types.includes(n.type) && nodeMax(n, res) > 0);
  if (nodes.length === 0) return null;
  const stock = nodes.reduce((a, n) => a + (n.stock[res] ?? 0), 0);
  const max = nodes.reduce((a, n) => a + nodeMax(n, res), 0);
  const upgradable = nodes.filter((n) => !n.improved && n.improving == null && NODE_UPGRADES[n.type]
    && (!NODE_UPGRADES[n.type]!.needs || has(s, NODE_UPGRADES[n.type]!.needs!)));
  const main = types[types.length - 1]; // el último desbloqueado suele ser el mejor (ocre > rocas)
  return { fill: stock / max, unimproved: upgradable.length, upgrade: NODE_UPGRADES[main]?.name ?? null, node: main };
}

/** Por debajo de esto, el menú del 🎯 avisa que lo silvestre se está agotando. */
export const WILD_LOW = 0.3;
