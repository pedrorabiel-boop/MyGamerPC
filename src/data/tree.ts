// Acceso tipado a data/tech-tree.json (generado con `npm run tree`).
import raw from "../../data/tech-tree.json";
import { config } from "../config";

export interface Manifestation { type: string; name: string | null }
export interface Tech {
  id: string;
  name: string;
  era: number;
  order: number;
  optional: boolean;
  requires: string[];
  requiresPopulation: number | string | null;
  manifestations: Manifestation[];
  effect: string;
  unlocksZone?: string;
  completesPcPiece?: string;
  advancesPcPieces?: string[];
}
export interface Era {
  id: number;
  key: string;
  name: string;
  milestone: { name: string | null; requires: string[]; population: number | null };
}
interface TechTree {
  version: string;
  manifestationTypes: Record<string, string>;
  eras: Era[];
  techs: Tech[];
}

const tree = raw as unknown as TechTree;

export const TREE_VERSION = tree.version;
export const MANIFESTATION_ICONS = tree.manifestationTypes;
export const ERAS = tree.eras;
export const TECHS = tree.techs;
export const TECH_BY_ID: Record<string, Tech> = Object.fromEntries(TECHS.map((t) => [t.id, t]));

/** Eras que el prototipo implementa de verdad. Las demás se ven en el Libro, pero sus efectos no existen todavía. */
export const IMPLEMENTED_ERAS = 4;

/** Tecnologías con costo fijo (perilla propia en config), fuera de la fórmula. */
const COST_OVERRIDES: Record<string, keyof typeof config> = { P11: "COSTO_ARTE_Y_RITOS", N12: "COSTO_TECNICAS_RECOLECCION" };

export function techCost(t: Tech): number {
  const override = COST_OVERRIDES[t.id];
  if (override) return Math.round(config[override]);
  const eraFactor = t.era === 1 ? config.FACTOR_ERA_1 : 1;
  return Math.round(config.C0 * Math.pow(config.R, t.era - 1) * Math.pow(config.G, t.order) * eraFactor);
}
