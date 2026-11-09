import { describe, expect, it } from "vitest";
import { config } from "../config";
import { BUILDINGS, MATERIALS, ROLES, TECH_INTRO } from "../content";
import { TECHS, TECH_BY_ID, techCost } from "../data/tree";
import {
  changeRoleCount, changeSpecialists, debugAddVillagers, debugToggleInfinite, place, study, tapBook, techStatus,
} from "./actions";
import { isTribeLost, pay, staffCount, stageOf } from "./economy";
import { simulateOffline } from "./save";
import { createState, type Building, type GameState } from "./state";
import { step } from "./step";

const run = (s: GameState, seconds: number) => { for (let t = 0; t < seconds; t += 0.1) step(s, 0.1); };
const addBuilding = (s: GameState, type: string, x: number, y: number): Building => {
  const b = { id: s.nextId++, type, x, y, progress: 0, built: true, wanted: 0 };
  s.buildings.push(b);
  return b;
};

describe("contenido", () => {
  it("todo lo jugable apunta a tecnologías reales de las Eras 1–2", () => {
    for (const r of ROLES) expect(TECH_BY_ID[r.unlockedBy]?.era, r.id).toBeLessThanOrEqual(2);
    for (const m of MATERIALS) expect(TECH_BY_ID[m.tech]?.era, m.res).toBeLessThanOrEqual(2);
    for (const b of BUILDINGS) if (b.unlockedBy) expect(TECH_BY_ID[b.unlockedBy]?.era, b.id).toBeLessThanOrEqual(2);
  });

  it("cada tecnología de las Eras 1–2 tiene tarjeta de novedad", () => {
    for (const t of TECHS.filter((x) => x.era <= 2)) expect(TECH_INTRO[t.id], t.id).toBeTruthy();
  });

  it("los costos crecen de forma exponencial dentro de la era", () => {
    const era1 = TECHS.filter((t) => t.era === 1).sort((a, b) => a.order - b.order).map(techCost);
    for (let i = 1; i < era1.length; i++) expect(era1[i] / era1[i - 1]).toBeCloseTo(config.G, 1);
  });
});

describe("inicio", () => {
  it("empieza con 5 aldeanos, sin ancianos, y es determinista con la misma semilla", () => {
    const a = createState(42), b = createState(42);
    expect(a.villagers).toHaveLength(5);
    expect(a.villagers.some((v) => stageOf(v) === "elder")).toBe(false);
    expect(a.villagers.map((v) => v.name)).toEqual(b.villagers.map((v) => v.name));
  });

  it("tocar el Libro alcanza para estudiar Lenguaje, y aparece su tarjeta", () => {
    const s = createState(1);
    const cost = techCost(TECH_BY_ID.P01);
    for (let i = 0; i < cost; i++) tapBook(s);
    expect(study(s, "P01")).toBe(true);
    expect(s.introQueue).toEqual(["P01"]);
  });

  it("una tecnología con requisitos pendientes no se puede estudiar", () => {
    const s = createState(1);
    s.inv.comprension = 1e6;
    expect(techStatus(s, "P04")).toBe("legible"); // Fuego requiere Herramientas de piedra
    expect(study(s, "P04")).toBe(false);
  });
});

describe("categorías", () => {
  it("la gente de Comida junta comida", () => {
    const s = createState(7);
    s.techs.P01 = true;
    s.inv.comida = 5;
    changeRoleCount(s, "comida", 1);
    changeRoleCount(s, "comida", 1);
    run(s, 60);
    expect(s.inv.comida).toBeGreaterThan(5);
  });

  it("con Agricultura, la gente de Comida ocupa sola las parcelas", () => {
    const s = createState(8);
    s.techs.P01 = s.techs.P02 = s.techs.N01 = true;
    s.debug.infinite.comida = true;
    const p = addBuilding(s, "parcela", 3, 3);
    changeRoleCount(s, "comida", 1);
    changeRoleCount(s, "comida", 1);
    run(s, 20);
    expect(staffCount(s, p)).toBe(2);
  });

  it("la gente de Materiales junta el material que más falta", () => {
    const s = createState(9);
    s.techs.P01 = true;
    s.debug.infinite.comida = true;
    s.inv.ramas = 50; s.inv.piedra = 50; s.inv.fibras = 0;
    changeRoleCount(s, "materiales", 1);
    run(s, 30);
    expect(s.inv.fibras).toBeGreaterThan(0);
  });

  it("los especialistas se asignan desde su edificio", () => {
    const s = createState(10);
    s.techs.P01 = s.techs.P11 = true;
    const c = addBuilding(s, "circulo", 3, 3);
    expect(changeSpecialists(s, c.id, 1)).toBeNull();
    expect(staffCount(s, c)).toBe(1);
    expect(changeSpecialists(s, c.id, 1)).not.toBeNull(); // solo hay 1 puesto
    const before = s.inv.comprension;
    s.debug.infinite.comida = true;
    run(s, 20);
    expect(s.inv.comprension).toBeGreaterThan(before);
  });

  it("los planos se construyen", () => {
    const s = createState(3);
    s.techs.P01 = s.techs.P02 = s.techs.P06 = true;
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
  it("la comida se resuelve con 4 parcelas llenas + granero, y se pierde si faltan", () => {
    const s = createState(4);
    s.techs.P01 = s.techs.P02 = s.techs.N01 = true;
    for (let i = 0; i < 4; i++) addBuilding(s, "parcela", i, 4);
    addBuilding(s, "granero", 4, 4);
    debugAddVillagers(s, 8);
    for (let i = 0; i < 8; i++) changeRoleCount(s, "comida", 1);
    run(s, 15);
    expect(s.resolved.comida).toBe(true);
    expect(pay(s, { comida: 999 })).toBe(true); // no se gasta

    for (let i = 0; i < 8; i++) changeRoleCount(s, "comida", -1);
    run(s, 1);
    expect(s.resolved.comida).toBe(false);
  });
});

describe("población", () => {
  it("con comida y espacio, la tribu crece", () => {
    const s = createState(11);
    s.debug.infinite.comida = true;
    for (let i = 0; i < 6; i++) addBuilding(s, "choza", i, 4);
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

  it("la Comprensión offline rinde mucho menos que jugando", () => {
    const mk = () => {
      const s = createState(12);
      s.techs.P01 = s.techs.P11 = true;
      s.debug.infinite.comida = true;
      const c = addBuilding(s, "circulo", 3, 3);
      changeSpecialists(s, c.id, 1);
      return s;
    };
    const online = mk();
    run(online, 60);
    const offline = mk();
    simulateOffline(offline, 60 / config.EFICIENCIA_OFFLINE); // mismo tiempo de juego simulado
    expect(offline.inv.comprension).toBeLessThan(online.inv.comprension * 0.5);
  });
});
