import { config } from "../config";
import { RESOURCES } from "../content";
import { step } from "./step";
import { createState, type GameState } from "./state";

const KEY = "mygamerpc-save-v1";

export function save(s: GameState) {
  s.savedAt = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* sin espacio o modo privado */ }
}

export function exportSave(s: GameState): string {
  s.savedAt = Date.now();
  return JSON.stringify(s);
}

export function parseSave(text: string): GameState | null {
  try {
    const s = JSON.parse(text) as GameState;
    if (s?.version !== 1 || !Array.isArray(s.villagers)) return null;
    // Recursos agregados después de que se creó la partida.
    for (const r of RESOURCES) s.inv[r.id] ??= 0;
    s.debug ??= { infinite: {}, unlockOnTap: false };
    s.resolved ??= {};
    return s;
  } catch {
    return null;
  }
}

export function loadOrCreate(): GameState {
  const raw = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null;
  return (raw && parseSave(raw)) || createState();
}

export function clearSave() {
  localStorage.removeItem(KEY);
}

export interface OfflineSummary {
  realSeconds: number;
  years: number;
  births: number;
  deaths: number;
  gained: Partial<Record<string, number>>;
}

/** Simula `realSeconds` sin jugar, con la eficiencia offline. Usa la misma simulación que el juego. */
export function simulateOffline(s: GameState, realSeconds: number): OfflineSummary {
  const capped = Math.min(realSeconds, config.OFFLINE_MAX_HORAS * 3600);
  const simSeconds = capped * config.EFICIENCIA_OFFLINE;
  const before = { ...s.inv };
  const b0 = s.stats.births, d0 = s.stats.deaths;
  const STEP = 0.5;
  for (let t = 0; t < simSeconds; t += STEP) step(s, Math.min(STEP, simSeconds - t));
  const gained: Record<string, number> = {};
  for (const r of RESOURCES) {
    const diff = s.inv[r.id] - before[r.id];
    if (Math.abs(diff) >= 1) gained[r.id] = diff;
  }
  return {
    realSeconds: capped,
    years: simSeconds / config.TIEMPO_POR_AÑO,
    births: s.stats.births - b0,
    deaths: s.stats.deaths - d0,
    gained,
  };
}
