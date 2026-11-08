import { config } from "../config";
import { BUILDING_BY_ID, type Cost, type ResId, type ResolutionDef } from "../content";
import type { GameState, Villager } from "./state";

export const has = (s: GameState, techId: string) => !!s.techs[techId];

export function storageCap(s: GameState, res: ResId): number {
  if (res === "comprension") return Infinity;
  let cap = config.ALMACEN_BASE;
  if (has(s, "N03")) cap += config.ALMACEN_VASIJAS;
  cap += s.buildings.filter((b) => b.built && b.type === "granero").length * config.ALMACEN_GRANERO;
  return cap;
}

/** Recurso sin límite: ∞ del modo debug, o resuelto por infraestructura. */
export function unlimited(s: GameState, res: ResId): boolean {
  return !!s.debug.infinite[res] || !!s.resolved[res];
}

export function amount(s: GameState, res: ResId): number {
  return unlimited(s, res) ? Infinity : s.inv[res];
}

export function add(s: GameState, res: ResId, amt: number) {
  if (unlimited(s, res)) return;
  s.inv[res] = Math.max(0, Math.min(storageCap(s, res), s.inv[res] + amt));
}

export function canAfford(s: GameState, cost: Cost): boolean {
  return Object.entries(cost).every(([r, a]) => amount(s, r as ResId) >= (a ?? 0));
}

export function pay(s: GameState, cost: Cost): boolean {
  if (!canAfford(s, cost)) return false;
  for (const [r, a] of Object.entries(cost)) {
    if (!unlimited(s, r as ResId)) s.inv[r as ResId] -= a ?? 0;
  }
  return true;
}

export type Stage = "child" | "adult" | "elder";
export function stageOf(v: Villager): Stage {
  if (v.age < config.EDAD_ADULTO) return "child";
  if (v.age >= v.lifespan * (1 - config.FRACCION_ANCIANO)) return "elder";
  return "adult";
}

export function housing(s: GameState): number {
  let cap = config.CAPACIDAD_BASE;
  for (const b of s.buildings) if (b.built) cap += BUILDING_BY_ID[b.type]?.housing ?? 0;
  return cap;
}

/** Con 1 aldeano o ninguno, la tribu ya no puede tener hijos: la partida está perdida. */
export const isTribeLost = (s: GameState) => s.villagers.length <= 1;

export const countBuilt = (s: GameState, type: string) => s.buildings.filter((b) => b.built && b.type === type).length;

export const countWorkers = (s: GameState, job: string) =>
  s.villagers.filter((v) => v.job === job && stageOf(v) === "adult").length;

/** Qué tanto se cumple cada condición de una resolución (para mostrar el progreso). */
export function resolutionProgress(s: GameState, def: ResolutionDef) {
  return {
    tech: has(s, def.tech),
    buildings: Object.entries(def.buildings).map(([type, need]) => ({ type, need, have: countBuilt(s, type) })),
    workers: Object.entries(def.workers).map(([job, need]) => ({ job, need, have: countWorkers(s, job) })),
  };
}

export function isResolutionMet(s: GameState, def: ResolutionDef): boolean {
  const p = resolutionProgress(s, def);
  return p.tech && p.buildings.every((b) => b.have >= b.need) && p.workers.every((w) => w.have >= w.need);
}
