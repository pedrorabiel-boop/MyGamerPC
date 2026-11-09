import { config } from "../config";
import { BUILDING_BY_ID, ROLE_BY_ID, type Cost, type ResId, type ResolutionDef, type Role } from "../content";
import type { Building, GameState, Villager } from "./state";

export const has = (s: GameState, techId: string) => !!s.techs[techId];

export const roleUnlocked = (s: GameState, role: Role) => has(s, ROLE_BY_ID[role].unlockedBy);

// Durante la simulación offline la Comprensión rinde menos (ver config.COMPRENSION_OFFLINE).
let comprensionScale = 1;
export function setComprensionScale(x: number) { comprensionScale = x; }

export function storageCap(s: GameState, res: ResId): number {
  if (res === "comprension") return Infinity;
  let cap = config.ALMACEN_BASE;
  if (has(s, "N03")) cap += config.ALMACEN_VASIJAS;
  cap += countBuilt(s, "granero") * config.ALMACEN_GRANERO;
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
  if (res === "comprension" && amt > 0) amt *= comprensionScale;
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
/** Edad a la que un aldeano llega a adulto (antes si fue a la escuela). */
export const adultAge = (v: Villager) => v.adultAge ?? config.EDAD_ADULTO;

/** Años de adulto que le quedan antes de volverse anciano. */
export const workYearsLeft = (v: Villager) => v.lifespan * (1 - config.FRACCION_ANCIANO) - v.age;

/** Ordena de más joven (más años de trabajo por delante) a más viejo. */
export const youngestFirst = <T extends Villager>(list: T[]) => [...list].sort((a, b) => workYearsLeft(b) - workYearsLeft(a));

export function stageOf(v: Villager): Stage {
  if (v.age < adultAge(v)) return "child";
  if (v.age >= v.lifespan * (1 - config.FRACCION_ANCIANO)) return "elder";
  return "adult";
}

export const isFree = (v: Villager) => stageOf(v) === "adult" && v.role === null && v.workplace === null;

export function housing(s: GameState): number {
  let cap = config.CAPACIDAD_BASE;
  for (const b of s.buildings) if (b.built) cap += BUILDING_BY_ID[b.type]?.housing ?? 0;
  return cap;
}

/** Con 1 aldeano o ninguno, la tribu ya no puede tener hijos: la partida está perdida. */
export const isTribeLost = (s: GameState) => s.villagers.length <= 1;

export const countBuilt = (s: GameState, type: string) => s.buildings.filter((b) => b.built && b.type === type).length;

/** Cuántas personas ocupan los puestos de un edificio ahora mismo. */
export function staffCount(s: GameState, b: Building): number {
  const staff = BUILDING_BY_ID[b.type]?.staff;
  if (!staff) return 0;
  if (staff.by === "especialista") return s.villagers.filter((v) => v.workplace === b.id).length;
  return s.villagers.filter((v) => (v.task.kind === "toBuilding" || v.task.kind === "work") && v.task.bId === b.id).length;
}

export const staffedTotal = (s: GameState, type: string) =>
  s.buildings.filter((b) => b.built && b.type === type).reduce((acc, b) => acc + staffCount(s, b), 0);

/** Cuántos edificios `type` tienen al lado (8 vecinas) uno `near` construido. */
export function countNear(s: GameState, type: string, near: string): number {
  return s.buildings.filter((b) => b.built && b.type === type && s.buildings.some(
    (o) => o.built && o.type === near && o.zone === b.zone && Math.abs(o.x - b.x) <= 1 && Math.abs(o.y - b.y) <= 1,
  )).length;
}

/** Qué tanto se cumple cada condición de una resolución (para mostrar el progreso). */
export function resolutionProgress(s: GameState, def: ResolutionDef) {
  return {
    tech: has(s, def.tech),
    buildings: Object.entries(def.buildings).map(([type, need]) => ({ type, need, have: countBuilt(s, type) })),
    staffed: Object.entries(def.staffed).map(([type, need]) => ({ type, need, have: staffedTotal(s, type) })),
    near: def.near ? { ...def.near, have: countNear(s, def.near.type, def.near.near) } : null,
  };
}

export function isResolutionMet(s: GameState, def: ResolutionDef): boolean {
  const p = resolutionProgress(s, def);
  return p.tech && p.buildings.every((b) => b.have >= b.need) && p.staffed.every((w) => w.have >= w.need)
    && (!p.near || p.near.have >= p.near.n);
}
