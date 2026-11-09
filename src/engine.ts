// Motor: hace avanzar la simulación en tiempo real, guarda la partida y avisa a la interfaz.
import { useEffect, useState } from "react";
import { loadOrCreate, save, simulateOffline, type OfflineSummary } from "./sim/save";
import { isTribeLost } from "./sim/economy";
import { step } from "./sim/step";
import { createState, type GameState, type ZoneId } from "./sim/state";

const MAX_SUBSTEP = 0.1; // segundos de juego por sub-paso
const UI_INTERVAL_MS = 200;
const AUTOSAVE_MS = 10_000;

/**
 * Modo debug: en desarrollo siempre. En la versión publicada se activa con ?debug y queda
 * recordado (así funciona también en la app instalada en el celular); ?nodebug lo apaga.
 */
export const DEBUG_ENABLED = (() => {
  if (import.meta.env.DEV) return true;
  const params = new URLSearchParams(location.search);
  try {
    if (params.has("debug")) localStorage.setItem("mygamerpc-debug", "1");
    if (params.has("nodebug")) localStorage.removeItem("mygamerpc-debug");
    return localStorage.getItem("mygamerpc-debug") === "1";
  } catch {
    return params.has("debug");
  }
})();

class Engine {
  s: GameState;
  speed = 1;
  ui = {
    selected: null as number | null, // aldeano
    selectedBuilding: null as number | null,
    placing: null as string | null,
    zone: "valle" as ZoneId, // zona que se está mirando
    zoneModal: null as ZoneId | null, // ventana de traslado abierta
    toast: null as { msg: string; at: number } | null,
  };
  offlineSummary: OfflineSummary | null = null;
  private listeners = new Set<() => void>();
  private last = 0;
  private lastUi = 0;
  private lastSave = 0;

  constructor() {
    this.s = loadOrCreate();
    const away = (Date.now() - this.s.savedAt) / 1000;
    if (away > 30 && this.s.time > 0 && !isTribeLost(this.s)) this.offlineSummary = simulateOffline(this.s, away);
  }

  start() {
    const loop = (now: number) => {
      this.frame(now);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    document.addEventListener("visibilitychange", () => { if (document.hidden) save(this.s); });
    window.addEventListener("pagehide", () => save(this.s));
  }

  private frame(now: number) {
    const realDt = this.last ? Math.min(0.25, (now - this.last) / 1000) : 0;
    this.last = now;
    let gameDt = realDt * this.speed;
    while (gameDt > 0) {
      const d = Math.min(MAX_SUBSTEP, gameDt);
      step(this.s, d);
      gameDt -= d;
    }
    if (now - this.lastUi > UI_INTERVAL_MS) { this.lastUi = now; this.notify(); }
    if (now - this.lastSave > AUTOSAVE_MS) { this.lastSave = now; save(this.s); }
  }

  toast(msg: string) {
    this.ui.toast = { msg, at: Date.now() };
    this.notify();
  }

  replaceState(s: GameState) {
    this.s = s;
    this.offlineSummary = null;
    this.ui.selected = null;
    this.ui.selectedBuilding = null;
    this.ui.placing = null;
    this.ui.zone = "valle";
    this.ui.zoneModal = null;
    save(s);
    this.notify();
  }

  newGame() {
    this.replaceState(createState());
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  notify() {
    for (const fn of this.listeners) fn();
  }
}

export const engine = new Engine();

/** Hook: re-renderiza el componente cuando cambia el estado (≈ 5 veces por segundo). */
export function useEngine() {
  const [, setTick] = useState(0);
  useEffect(() => engine.subscribe(() => setTick((t) => t + 1)), []);
  return engine;
}
