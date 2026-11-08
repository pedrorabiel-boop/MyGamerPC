import { describe, expect, it } from "vitest";
import { config } from "../config";
import { BUILDINGS, JOBS } from "../content";
import { TECH_BY_ID, techCost } from "../data/tree";
import { changeJobCount, debugAddVillagers, debugToggleInfinite, place, study, tapBook, techStatus } from "./actions";
import { isTribeLost, pay, stageOf } from "./economy";
import { simulateOffline } from "./save";
import { createState, type GameState } from "./state";
import { step } from "./step";

const run = (s: GameState, seconds: number) => { for (let t = 0; t < seconds; t += 0.1) step(s, 0.1); };

describe("contenido", () => {
  it("todo oficio y edificio apunta a una tecnología real de las Eras 1–2", () => {
    for (const j of JOBS) expect(TECH_BY_ID[j.unlockedBy]?.era, j.id).toBeLessThanOrEqual(2);
    for (const b of BUILDINGS) if (b.unlockedBy) expect(TECH_BY_ID[b.unlockedBy]?.era, b.id).toBeLessThanOrEqual(2);
  });
});

describe("inicio", () => {
  it("empieza con 5 aldeanos, sin ancianos, y es determinista con la misma semilla", () => {
    const a = createState(42), b = createState(42);
    expect(a.villagers).toHaveLength(5);
    expect(a.villagers.some((v) => stageOf(v) === "elder")).toBe(false);
    expect(a.villagers.map((v) => v.name)).toEqual(b.villagers.map((v) => v.name));
  });

  it("tocar el Libro alcanza para estudiar Lenguaje", () => {
    const s = createState(1);
    const cost = techCost(TECH_BY_ID.P01);
    for (let i = 0; i < cost; i++) tapBook(s);
    expect(techStatus(s, "P01")).toBe("estudiable");
    expect(study(s, "P01")).toBe(true);
    expect(s.techs.P01).toBe(true);
    expect(s.inv.comprension).toBe(0);
  });

  it("una tecnología con requisitos pendientes no se puede estudiar", () => {
    const s = createState(1);
    s.inv.comprension = 1000;
    expect(techStatus(s, "P04")).toBe("legible"); // Fuego requiere Piedra tallada
    expect(study(s, "P04")).toBe(false);
  });
});

describe("economía", () => {
  it("los recolectores juntan comida", () => {
    const s = createState(7);
    s.techs.P01 = true;
    s.inv.comida = 5;
    changeJobCount(s, "recolector", 1);
    changeJobCount(s, "recolector", 1);
    run(s, 60);
    expect(s.inv.comida).toBeGreaterThan(5);
  });

  it("los planos se construyen y suman capacidad", () => {
    const s = createState(3);
    s.techs.P01 = s.techs.P02 = s.techs.P03 = s.techs.P06 = true;
    s.inv.ramas = 50; s.inv.fibras = 50; s.inv.comida = 60;
    expect(place(s, "choza", 3, 3)).toBeNull();
    run(s, 60);
    expect(s.buildings.find((b) => b.type === "choza")?.built).toBe(true);
  });

  it("con ∞ los pagos no descuentan", () => {
    const s = createState(1);
    debugToggleInfinite(s, "piedra");
    expect(pay(s, { piedra: 999 })).toBe(true);
    expect(s.inv.piedra).toBe(0);
  });
});

describe("recursos resueltos", () => {
  it("la comida se resuelve con la infraestructura y aldeanos, y se pierde si faltan", () => {
    const s = createState(4);
    s.techs.P01 = s.techs.N01 = s.techs.N07 = true;
    for (let i = 0; i < 4; i++) s.buildings.push({ id: s.nextId++, type: "parcela", x: i, y: 4, progress: 0, built: true });
    s.buildings.push({ id: s.nextId++, type: "granero", x: 4, y: 4, progress: 0, built: true });
    debugAddVillagers(s, 8);
    for (let i = 0; i < 8; i++) changeJobCount(s, "agricultor", 1);
    step(s, 0.1);
    expect(s.resolved.comida).toBe(true);
    expect(pay(s, { comida: 999 })).toBe(true); // no se gasta

    s.villagers.find((v) => v.job === "agricultor")!.job = null;
    step(s, 0.1);
    expect(s.resolved.comida).toBe(false);
  });
});

describe("población", () => {
  it("con comida y espacio, la tribu crece", () => {
    const s = createState(11);
    s.debug.infinite.comida = true;
    for (let i = 0; i < 6; i++) s.buildings.push({ id: s.nextId++, type: "choza", x: i, y: 4, progress: 0, built: true });
    run(s, 300);
    expect(s.stats.births).toBeGreaterThan(0);
  });

  it("con un solo aldeano la tribu está perdida", () => {
    const s = createState(2);
    expect(isTribeLost(s)).toBe(false);
    s.villagers.splice(1);
    expect(isTribeLost(s)).toBe(true);
  });

  it("los aldeanos mueren al cumplir su esperanza de vida", () => {
    const s = createState(5);
    s.debug.infinite.comida = true;
    run(s, (config.ESPERANZA_VIDA + config.VARIACION_VIDA + 1) * config.TIEMPO_POR_AÑO);
    expect(s.stats.deaths).toBeGreaterThanOrEqual(5);
  });
});

describe("offline", () => {
  it("rinde según la eficiencia offline", () => {
    const s = createState(9);
    const sum = simulateOffline(s, 600);
    expect(sum.years).toBeCloseTo((600 * config.EFICIENCIA_OFFLINE) / config.TIEMPO_POR_AÑO, 5);
  });
});
