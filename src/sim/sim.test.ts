import { describe, expect, it } from "vitest";
import { config } from "../config";
import { BUILDINGS, MATERIALS, RESOURCES, ROLES, TECH_INTRO } from "../content";
import { IMPLEMENTED_ERAS, TECHS, TECH_BY_ID, techCost } from "../data/tree";
import {
  changeRoleCount, changeSpecialists, debugAddVillagers, demolish, debugToggleInfinite, place, setRole, study, tapBook, techStatus,
  transferVillager, adultsIn, startUpgrade, startImproveNode, cancelImproveNode,
} from "./actions";
import { movePriority, returnToJefatura, setSpecialtyFull, specialtyShortZones, zipfTargets } from "./jefatura";
import { housing, isTribeLost, nodeMax, nodeRegen, pay, staffCount, stageOf } from "./economy";
import { parseSave, simulateOffline } from "./save";
import { changeZoneQuota, zoneCount } from "./zones";
import { focusPlan, isFocusable, sourcesOf, usesOf, WILD_LOW, wildState } from "./guide";
import { createState, type Building, type GameState } from "./state";
import { step, trade } from "./step";

const run = (s: GameState, seconds: number) => { for (let t = 0; t < seconds; t += 0.1) step(s, 0.1); };
const addBuilding = (s: GameState, type: string, x: number, y: number): Building => {
  const b: Building = { id: s.nextId++, type, zone: "valle", x, y, progress: 0, built: true };
  s.buildings.push(b);
  return b;
};

describe("contenido", () => {
  it("todo lo jugable apunta a tecnologías de las eras implementadas", () => {
    for (const r of ROLES) expect(TECH_BY_ID[r.unlockedBy]?.era, r.id).toBeLessThanOrEqual(IMPLEMENTED_ERAS);
    for (const m of MATERIALS) expect(TECH_BY_ID[m.tech]?.era, m.res).toBeLessThanOrEqual(IMPLEMENTED_ERAS);
    for (const b of BUILDINGS) if (b.unlockedBy) expect(TECH_BY_ID[b.unlockedBy]?.era, b.id).toBeLessThanOrEqual(IMPLEMENTED_ERAS);
  });

  it("cada tecnología de las eras implementadas tiene tarjeta de novedad", () => {
    for (const t of TECHS.filter((x) => x.era <= IMPLEMENTED_ERAS)) expect(TECH_INTRO[t.id], t.id).toBeTruthy();
  });

  it("los costos crecen de forma exponencial dentro de la era", () => {
    const era2 = TECHS.filter((t) => t.era === 2 && t.id !== "N12").sort((a, b) => a.order - b.order).map(techCost); // N12: costo fijo
    for (let i = 1; i < era2.length; i++) expect(era2[i] / era2[i - 1]).toBeCloseTo(config.G, 1);
  });

  it("Arte y ritos (el chamán) tiene costo fijo", () => {
    expect(techCost(TECH_BY_ID.P11)).toBe(config.COSTO_ARTE_Y_RITOS);
  });

  it("Técnicas de recolección tiene costo fijo", () => {
    expect(techCost(TECH_BY_ID.N12)).toBe(config.COSTO_TECNICAS_RECOLECCION);
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

  it("demoler libera a los especialistas y devuelve la mitad; cancelar una obra devuelve todo", () => {
    const s = createState(13);
    s.techs.P01 = s.techs.P11 = true;
    const c = addBuilding(s, "circulo", 3, 3);
    changeSpecialists(s, c.id, 1);
    s.inv.piedra = 0;
    expect(demolish(s, c.id)).toBeNull();
    expect(s.buildings.includes(c)).toBe(false);
    expect(s.villagers.some((v) => v.workplace === c.id)).toBe(false);
    expect(s.inv.piedra).toBe(Math.floor(10 * config.DEVOLUCION_DEMOLER));

    s.inv.piedra = 20;
    expect(place(s, "circulo", 4, 4)).toBeNull();
    const obra = s.buildings[s.buildings.length - 1];
    demolish(s, obra.id);
    expect(s.inv.piedra).toBe(20);
    expect(demolish(s, s.buildings.find((b) => b.type === "pila")!.id)).not.toBeNull(); // la pila no se demuele
  });

  it("con ∞ los pagos no descuentan", () => {
    const s = createState(1);
    debugToggleInfinite(s, "piedra");
    expect(pay(s, { piedra: 999 })).toBe(true);
    expect(s.inv.piedra).toBe(0);
  });
});

describe("Jefatura", () => {
  const withJefatura = (seed: number, adults: number) => {
    const s = createState(seed);
    s.techs.P01 = s.techs.P06 = s.techs.N11 = true;
    s.debug.infinite.comida = true;
    debugAddVillagers(s, adults);
    return s;
  };

  it("Zipf: reparte por prioridad y no manda gente a donde no hay trabajo", () => {
    const s = withJefatura(20, 0);
    const t = zipfTargets(s, 6); // sin planos: Construcción no tiene trabajo
    expect(t.get("construccion")).toBe(0);
    expect((t.get("comida") ?? 0) + (t.get("materiales") ?? 0)).toBe(6);
    expect(t.get("comida")!).toBeGreaterThan(t.get("materiales")!);
  });

  it("con una obra pendiente, al menos una persona construye aunque haya poca gente", () => {
    const s = withJefatura(27, 0);
    s.inv.ramas = 50; s.inv.fibras = 50;
    expect(place(s, "choza", 3, 3)).toBeNull();
    const t = zipfTargets(s, 1);
    expect(t.get("construccion")).toBe(1);
  });

  it("cada zona tiene sus propias prioridades", () => {
    const s = withJefatura(28, 0);
    s.techs.N10 = s.techs.P11 = true;
    movePriority(s, "materiales", -1, "valle"); // en el Valle, Materiales pasa a ser la 1.ª
    expect(s.jefatura.priorities.valle[0]).toBe("materiales");
    expect(s.jefatura.priorities.cueva[0]).toBe("materiales"); // la Cueva tiene su propio orden
    movePriority(s, "construccion", -1, "cueva");
    expect(s.jefatura.priorities.cueva[0]).toBe("construccion");
    expect(s.jefatura.priorities.valle).toEqual(["materiales", "comida", "construccion"]);
  });

  it("una partida con prioridades globales las pasa al Valle", () => {
    const s = createState(29);
    const old = JSON.parse(JSON.stringify(s));
    old.jefatura.priorities = ["construccion", "comida", "materiales"];
    const loaded = parseSave(JSON.stringify(old))!;
    expect(loaded.jefatura.priorities.valle).toEqual(["construccion", "comida", "materiales"]);
    expect(loaded.jefatura.priorities.cueva[0]).toBe("materiales");
  });

  it("las especialidades se llenan solo con gente de la misma zona", () => {
    const s = withJefatura(30, 6);
    s.techs.P02 = s.techs.N10 = s.techs.B01 = true;
    const veta = s.nodes.find((n) => n.zone === "cueva" && n.type === "veta")!;
    const mina = { id: s.nextId++, type: "mina", zone: "cueva" as const, x: veta.x, y: veta.y, progress: 0, built: true };
    s.buildings.push(mina);
    setSpecialtyFull(s, "mina", true);
    run(s, 10);
    expect(staffCount(s, mina)).toBe(0); // nadie en la Cueva: no se trae a nadie del Valle
    expect(specialtyShortZones(s, "mina")).toEqual(["cueva"]);
    transferVillager(s, "valle", "cueva");
    run(s, 20);
    expect(staffCount(s, mina)).toBe(1);
    expect(s.villagers.filter((v) => v.zone === "cueva").length).toBe(1); // nadie más se movió
  });

  it("asigna sola a los libres", () => {
    const s = withJefatura(21, 6);
    run(s, 20);
    const adults = s.villagers.filter((v) => stageOf(v) === "adult");
    expect(adults.every((v) => v.role !== null || v.workplace !== null)).toBe(true);
  });

  it("llena las especialidades que elige el jugador, no todas", () => {
    const s = withJefatura(22, 6);
    s.techs.P11 = true;
    const c = addBuilding(s, "circulo", 3, 3);
    run(s, 5);
    expect(staffCount(s, c)).toBe(0); // no se llena por defecto
    setSpecialtyFull(s, "circulo", true);
    run(s, 5);
    expect(staffCount(s, c)).toBe(1);
  });

  it("un aldeano con tarea manual queda fuera hasta que se lo devuelve", () => {
    const s = withJefatura(23, 6);
    const v = s.villagers.find((x) => stageOf(x) === "adult")!;
    setRole(s, v.id, "construccion");
    expect(v.manual).toBe(true);
    run(s, 10);
    expect(v.role).toBe("construccion"); // la Jefatura no lo toca, aunque no haya planos
    returnToJefatura(s, v.id);
    run(s, 15);
    expect(v.role).not.toBe("construccion");
  });

  it("los ancianos pueden ser chamanes, rinden más y la Jefatura los prefiere", () => {
    const s = withJefatura(25, 4);
    s.techs.P11 = true;
    const elder = s.villagers.find((v) => stageOf(v) === "adult")!;
    elder.age = elder.lifespan * 0.85; // anciano, pero vivo un buen rato
    const c = addBuilding(s, "circulo", 3, 3);
    // Un adulto ocupa el puesto a mano (antes de que la Jefatura actúe).
    const adult = s.villagers.find((v) => stageOf(v) === "adult" && v !== elder)!;
    adult.workplace = c.id;
    setSpecialtyFull(s, "circulo", true);
    run(s, 5);
    expect(elder.workplace).toBe(c.id); // la Jefatura lo cambió por el anciano
    expect(adult.workplace).toBeNull();

    // El anciano chamán produce ×1,5 frente a un adulto chamán.
    const measure = (who: "elder" | "adult") => {
      const t = createState(26);
      t.techs.P01 = t.techs.P11 = true;
      t.debug.infinite.comida = true;
      const circ = addBuilding(t, "circulo", 3, 3);
      const v = t.villagers.find((x) => stageOf(x) === "adult")!;
      if (who === "elder") v.age = v.lifespan * 0.85;
      v.workplace = circ.id;
      for (const x of t.villagers) if (x !== v) x.age = 5; // sin otros ancianos que sumen Comprensión
      run(t, 30);
      return t.inv.comprension;
    };
    expect(measure("elder") / measure("adult")).toBeGreaterThan(1.3);
  });

  it("sin herencia: los niños llegan a adultos libres", () => {
    const s = createState(24);
    s.techs.P01 = true;
    s.debug.infinite.comida = true;
    for (const v of s.villagers) if (stageOf(v) === "adult") v.role = "comida";
    const child = s.villagers.find((v) => stageOf(v) === "child")!;
    run(s, (config.EDAD_ADULTO - child.age + 1) * config.TIEMPO_POR_AÑO);
    expect(stageOf(child)).toBe("adult");
    expect(child.role).toBeNull();
  });
});

describe("zonas", () => {
  const withCave = (seed: number, adults: number) => {
    const s = createState(seed);
    s.techs.P01 = s.techs.P02 = s.techs.P04 = s.techs.P11 = s.techs.N10 = true;
    s.debug.infinite.comida = true;
    debugAddVillagers(s, adults);
    return s;
  };

  it("la Cueva existe desde el inicio, con ocre, rocas, vetas y su pila", () => {
    const s = createState(30);
    expect(s.zones.cueva.tiles[9][3]).toBe("salida");
    expect(s.nodes.filter((n) => n.zone === "cueva" && n.type === "ocre").length).toBeGreaterThan(0);
    expect(s.nodes.some((n) => n.zone === "cueva" && n.type === "veta")).toBe(true);
    expect(s.buildings.some((b) => b.zone === "cueva" && b.type === "pila")).toBe(true);
  });

  it("sin Exploración no se puede mandar gente a la Cueva", () => {
    const s = createState(31);
    expect(transferVillager(s, "valle", "cueva")).not.toBeNull();
  });

  it("mandar un aldeano: camina hasta la entrada y aparece adentro", () => {
    const s = withCave(32, 3);
    expect(transferVillager(s, "valle", "cueva")).toBeNull();
    const v = s.villagers.find((x) => x.transit === "cueva")!;
    run(s, 15);
    expect(v.zone).toBe("cueva");
    expect(v.transit).toBeNull();
  });

  it("en la Cueva, la gente de Materiales junta pigmento del ocre", () => {
    const s = withCave(33, 2);
    for (const v of s.villagers) if (stageOf(v) === "adult") v.role = "materiales";
    // Todo lleno salvo el pigmento, para que vayan por él.
    for (const r of ["ramas", "piedra", "fibras", "madera"] as const) s.inv[r] = 59;
    const v = s.villagers.find((x) => stageOf(x) === "adult")!;
    v.zone = "cueva"; v.x = 3.5; v.y = 8.5;
    s.inv.pigmento = 0;
    run(s, 30);
    expect(s.inv.pigmento).toBeGreaterThan(0);
  });

  it("la Jefatura no deja gente en Comida dentro de la Cueva (no hay comida ahí)", () => {
    const s = withCave(34, 4);
    s.techs.N11 = true;
    for (let i = 0; i < 3; i++) transferVillager(s, "valle", "cueva");
    run(s, 30);
    const inCave = s.villagers.filter((v) => v.zone === "cueva" && stageOf(v) === "adult");
    expect(inCave.length).toBeGreaterThan(0);
    expect(inCave.some((v) => v.role === "comida")).toBe(false);
  });

  it("la meta de adultos de una zona se cumple y se mantiene sola", () => {
    const s = withCave(37, 6);
    changeZoneQuota(s, "cueva", 2);
    run(s, 20);
    expect(zoneCount(s, "cueva")).toBe(2);
    expect(adultsIn(s, "cueva").length).toBe(2);

    // Uno se vuelve anciano: regresa al Valle y se manda a otro en su lugar.
    const old = adultsIn(s, "cueva")[0];
    old.age = old.lifespan * 0.85;
    run(s, 25);
    expect(old.zone).toBe("valle");
    expect(adultsIn(s, "cueva").length).toBe(2);

    // Bajar la meta trae gente de vuelta.
    changeZoneQuota(s, "cueva", -2);
    run(s, 25);
    expect(adultsIn(s, "cueva").length).toBe(0);
  });

  it("los niños y ancianos vuelven solos al Valle", () => {
    const s = withCave(35, 0);
    const kid = s.villagers.find((v) => stageOf(v) === "child")!;
    kid.zone = "cueva"; kid.x = 3.5; kid.y = 8.5;
    run(s, 15);
    expect(kid.zone).toBe("valle");
  });

  it("si la casilla del sendero estaba ocupada en una partida vieja, el sendero va a otra casilla libre", () => {
    const s = createState(38);
    const old = JSON.parse(JSON.stringify(s));
    old.zones.valle.tiles[11][1] = "pasto"; // partida de antes de las Montañas…
    delete old.zones.valle.exits.montanas;
    delete old.zones.montanas;
    old.buildings = old.buildings.filter((b: { zone: string }) => b.zone !== "montanas");
    old.nodes = old.nodes.filter((n: { zone: string }) => n.zone !== "montanas");
    old.buildings.push({ id: 9999, type: "choza", zone: "valle", x: 1, y: 11, progress: 0, built: true }); // …con una choza ahí
    const loaded = parseSave(JSON.stringify(old))!;
    const exit = loaded.zones.valle.exits.montanas!;
    expect(loaded.zones.valle.tiles[exit.y][exit.x]).toBe("sendero");
    expect(loaded.buildings.some((b) => b.id === 9999)).toBe(true); // la choza no se toca
    expect(loaded.zones.montanas).toBeTruthy();
  });

  it("una partida guardada antes de las zonas se migra al Valle y gana la Cueva", () => {
    const s = createState(36) as unknown as Record<string, unknown>;
    const old = JSON.parse(JSON.stringify(s));
    old.w = 8; old.h = 12; old.tiles = (s.zones as GameState["zones"]).valle.tiles;
    delete old.zones;
    old.nodes = (old.nodes as { zone?: string }[]).filter((n) => n.zone === "valle").map((n) => { delete n.zone; return n; });
    old.buildings = (old.buildings as { zone?: string }[]).filter((b) => b.zone === "valle").map((b) => { delete b.zone; return b; });
    for (const v of old.villagers as { zone?: string; transit?: unknown }[]) { delete v.zone; delete v.transit; }
    const loaded = parseSave(JSON.stringify(old))!;
    expect(loaded.zones.valle.w).toBe(8);
    expect(loaded.zones.cueva).toBeTruthy();
    expect(loaded.villagers.every((v) => v.zone === "valle")).toBe(true);
    expect(loaded.buildings.filter((b) => b.type === "pila").map((b) => b.zone).sort()).toEqual(["cueva", "montanas", "valle"]);
    expect(loaded.zones.valle.exits.montanas).toBeTruthy();
  });
});

describe("recursos resueltos", () => {
  it("la comida se resuelve con Arado e irrigación: 4 parcelas junto a un canal, llenas, + granero", () => {
    const s = createState(4);
    s.techs.P01 = s.techs.P02 = s.techs.N01 = true;
    for (let i = 0; i < 4; i++) addBuilding(s, "parcela", i, 4);
    addBuilding(s, "granero", 4, 4);
    s.techs.B09 = true;
    for (let i = 0; i < 4; i++) addBuilding(s, "canal", i, 5); // un canal debajo de cada parcela
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

describe("Era 3", () => {
  const era3 = (seed: number) => {
    const s = createState(seed);
    for (const t of ["P01", "P02", "P04", "P05", "P06", "P11", "N01", "N02", "N03", "N09", "N10", "N11", "B01", "B02", "B03", "B04", "B06", "B07", "B09"]) s.techs[t] = true;
    s.debug.infinite.comida = true;
    return s;
  };

  it("las minas solo se construyen sobre su veta", () => {
    const s = era3(40);
    s.inv.madera = 50; s.inv.piedra = 50;
    const veta = s.nodes.find((n) => n.zone === "cueva" && n.type === "veta")!;
    expect(place(s, "mina", 4, 4, "cueva")).not.toBeNull(); // suelo sin veta
    expect(place(s, "mina", veta.x, veta.y, "cueva")).toBeNull();
    const estano = s.nodes.find((n) => n.zone === "montanas" && n.type === "estano")!;
    expect(place(s, "mina", estano.x, estano.y, "montanas")).not.toBeNull(); // la de cobre no va en estaño
    expect(place(s, "mina_estano", estano.x, estano.y, "montanas")).toBeNull();
  });

  it("los canales tienen que tocar el río u otro canal", () => {
    const s = era3(41);
    s.inv.piedra = 50;
    expect(place(s, "canal", 2, 3)).not.toBeNull(); // lejos del agua
    expect(place(s, "canal", 5, 4)).toBeNull(); // junto a la orilla (x = 6)
    expect(place(s, "canal", 4, 4)).toBeNull(); // junto al canal anterior
  });

  it("cadena del cobre: mina → mineral; carbonera → carbón; fundición → cobre", () => {
    const s = era3(42);
    debugAddVillagers(s, 3);
    const veta = s.nodes.find((n) => n.zone === "cueva" && n.type === "veta")!;
    s.buildings.push({ id: s.nextId++, type: "mina", zone: "cueva", x: veta.x, y: veta.y, progress: 0, built: true });
    const carb = addBuilding(s, "carbonera", 2, 3);
    const fund = addBuilding(s, "fundicion", 3, 3);
    const mina = s.buildings[s.buildings.length - 3];
    s.inv.madera = 40;
    // La mina está en la Cueva: hay que mandar a alguien (la Jefatura no mueve gente entre zonas).
    expect(transferVillager(s, "valle", "cueva")).toBeNull();
    run(s, 15);
    for (const b of [mina, carb, fund]) expect(changeSpecialists(s, b.id, 1)).toBeNull();
    run(s, 90);
    expect(s.inv.cobre).toBeGreaterThan(0);
  });

  it("lo que se junta en las Montañas llega al 60%", () => {
    const s = era3(43);
    debugAddVillagers(s, 1);
    const v = s.villagers[s.villagers.length - 1];
    v.zone = "montanas"; v.x = 3.5; v.y = 8.5;
    v.carry = { res: "piedra", amt: 10 };
    s.inv.piedra = 0;
    run(s, 2);
    expect(s.inv.piedra).toBeCloseTo(6, 5);
  });

  it("se puede ir de la Cueva a las Montañas pasando por el Valle", () => {
    const s = era3(44);
    debugAddVillagers(s, 1);
    const v = s.villagers[s.villagers.length - 1];
    v.zone = "cueva"; v.x = 3.5; v.y = 8.5; v.manual = true;
    v.transit = "montanas";
    run(s, 40);
    expect(v.zone).toBe("montanas");
  });
});

describe("playtest 5: traslados, mejoras y escuela", () => {
  it("a una zona lejana se manda a los adultos más jóvenes", () => {
    const s = createState(50);
    s.techs.P01 = s.techs.P02 = s.techs.P04 = s.techs.N10 = true;
    s.debug.infinite.comida = true;
    debugAddVillagers(s, 4);
    const adults = s.villagers.filter((v) => stageOf(v) === "adult");
    const youngest = [...adults].sort((a, b) => (b.lifespan * 0.8 - b.age) - (a.lifespan * 0.8 - a.age))[0];
    transferVillager(s, "valle", "cueva");
    expect(youngest.transit).toBe("cueva");
  });

  it("mejorar una choza a casa de adobe: cuesta menos, sigue funcionando y termina siendo adobe", () => {
    const s = createState(51);
    s.techs.P01 = s.techs.P02 = s.techs.P04 = s.techs.P06 = s.techs.N03 = true;
    s.debug.infinite.comida = true;
    const choza = addBuilding(s, "choza", 3, 3);
    s.inv.arcilla = 20; s.inv.madera = 20;
    expect(startUpgrade(s, choza.id)).toBeNull();
    expect(s.inv.arcilla).toBe(20 - Math.ceil(12 * (1 - config.DESCUENTO_MEJORA)));
    expect(housing(s)).toBe(config.CAPACIDAD_BASE + 3); // la choza sigue dando techo mientras tanto
    run(s, 60);
    expect(choza.type).toBe("adobe");
    expect(housing(s)).toBe(config.CAPACIDAD_BASE + 6);
  });

  it("mejorar el Círculo a Piedras alineadas conserva al chamán", () => {
    const s = createState(52);
    s.techs.P01 = s.techs.P11 = s.techs.B06 = true;
    s.debug.infinite.comida = true; s.debug.infinite.piedra = true;
    const c = addBuilding(s, "circulo", 3, 3);
    changeSpecialists(s, c.id, 1);
    const chaman = s.villagers.find((v) => v.workplace === c.id)!;
    chaman.lifespan = 200; // que no se muera de viejo durante la prueba
    const illness = config.MORTALIDAD_ENFERMEDAD;
    config.MORTALIDAD_ENFERMEDAD = 0; // ni de una enfermedad al azar
    try {
      expect(startUpgrade(s, c.id)).toBeNull();
      run(s, 120);
    } finally {
      config.MORTALIDAD_ENFERMEDAD = illness;
    }
    expect(c.type).toBe("piedras");
    expect(chaman.workplace).toBe(c.id);
  });

  it("los niños van a la escuela, quedan adentro y llegan a adultos antes", () => {
    const s = createState(53);
    s.techs.P01 = s.techs.N09 = true;
    s.debug.infinite.comida = true;
    addBuilding(s, "escuela", 3, 4);
    const kid = s.villagers.find((v) => stageOf(v) === "child")!;
    run(s, 10);
    expect(kid.task.kind).toBe("work");
    expect(kid.adultAge).toBeCloseTo(config.EDAD_ADULTO * (1 - config.BONO_ESCUELA), 5);
    kid.age = config.EDAD_ADULTO * (1 - config.BONO_ESCUELA) + 0.01;
    expect(stageOf(kid)).toBe("adult");
  });
});

describe("playtest 6: enfermedades, guía y foco", () => {
  it("con menos de 10 habitantes nadie muere de enfermedad", () => {
    const s = createState(60);
    s.debug.infinite.comida = true;
    const before = config.MORTALIDAD_ENFERMEDAD;
    config.MORTALIDAD_ENFERMEDAD = 1000; // si hubiera enfermedades, morirían todos de inmediato
    try { run(s, 5); } finally { config.MORTALIDAD_ENFERMEDAD = before; }
    expect(s.stats.deaths).toBe(0);
  });

  it("la guía sabe cómo se consigue el ladrillo y la arcilla", () => {
    const s = createState(61);
    const ladrillo = sourcesOf(s, "ladrillo");
    expect(ladrillo.some((x) => x.kind === "building" && x.building === "horno_ladrillo" && "arcilla" in x.inputs && "carbon" in x.inputs)).toBe(true);
    const arcilla = sourcesOf(s, "arcilla");
    expect(arcilla.some((x) => x.kind === "gather" && x.who === "materiales" && x.zones.includes("valle"))).toBe(true);
    expect(usesOf("arcilla").some((u) => u.building === "adobe")).toBe(true);
  });

  it("con foco en arcilla, la gente de Materiales va por arcilla", () => {
    const s = createState(62);
    s.techs.P01 = s.techs.P02 = s.techs.N03 = true;
    s.debug.infinite.comida = true;
    for (const v of s.villagers) if (stageOf(v) === "adult") v.role = "materiales";
    s.inv.arcilla = 0;
    s.focus = "arcilla";
    run(s, 20);
    expect(s.inv.arcilla).toBeGreaterThan(0);
    expect(s.inv.ramas + s.inv.piedra + s.inv.fibras + s.inv.madera).toBe(0);
  });

  it("el foco en un recurso de edificio baja por la cadena hasta lo que se recolecta", () => {
    const s = createState(63);
    for (const t of ["P01", "P02", "N03", "B01", "B02", "B03", "B07"]) s.techs[t] = true;
    const ladrillo = focusPlan(s, "ladrillo");
    expect([...ladrillo.targets].sort()).toEqual(["arcilla", "madera"]); // arcilla directa; madera → carbón
    expect(ladrillo.gaps).toContainEqual({ building: "horno_ladrillo", issue: "construir" });
    expect(focusPlan(s, "bronce").targets).toEqual(["madera"]); // mineral y estaño salen de minas
    expect(isFocusable(s, "lana")).toBe(false);
    expect(isFocusable(s, "comida")).toBe(false);
    delete s.techs.B07;
    expect(isFocusable(s, "ladrillo")).toBe(false); // sin el horno desbloqueado no hay cadena
  });

  it("avisa si el edificio de la cadena no tiene trabajador", () => {
    const s = createState(64);
    for (const t of ["P01", "P02", "N03", "B02", "B07"]) s.techs[t] = true;
    addBuilding(s, "horno_ladrillo", 3, 4);
    const gaps = focusPlan(s, "ladrillo").gaps;
    expect(gaps).toContainEqual({ building: "horno_ladrillo", issue: "trabajador" });
    expect(gaps).toContainEqual({ building: "carbonera", issue: "construir" });
  });

  it("con foco en ladrillo, Materiales junta arcilla y madera", () => {
    const s = createState(65);
    for (const t of ["P01", "P02", "N03", "B02", "B07"]) s.techs[t] = true;
    s.debug.infinite.comida = true;
    for (const v of s.villagers) if (stageOf(v) === "adult") v.role = "materiales";
    for (const r of ["arcilla", "madera", "ramas", "piedra", "fibras", "arena"] as const) s.inv[r] = 0;
    s.focus = "ladrillo";
    run(s, 30);
    expect(s.inv.arcilla + s.inv.madera).toBeGreaterThan(0);
    expect(s.inv.ramas + s.inv.piedra + s.inv.fibras + s.inv.arena).toBe(0);
  });
});

describe("playtest 7: mejorar recursos naturales", () => {
  const withN12 = (seed: number) => {
    const s = createState(seed);
    for (const t of ["P01", "P02", "P04", "P06", "N01", "N03", "N12"]) s.techs[t] = true;
    s.debug.infinite.comida = true;
    return s;
  };

  it("un barrero se regenera ×4 y guarda el doble", () => {
    const s = withN12(70);
    const n = s.nodes.find((x) => x.type === "arcilla")!;
    expect(nodeRegen(n, "arcilla")).toBeCloseTo(0.05);
    n.improved = true;
    expect(nodeRegen(n, "arcilla")).toBeCloseTo(0.05 * config.MEJORA_REGEN_MINERAL);
    expect(nodeMax(n, "arcilla")).toBe(15 * config.MEJORA_RESERVA);
  });

  it("sin N12 no se puede mejorar; con N12 los constructores hacen la obra", () => {
    const s = withN12(71);
    delete s.techs.N12;
    const n = s.nodes.find((x) => x.type === "arcilla")!;
    expect(startImproveNode(s, n.id)).toMatch(/hace falta/);
    s.techs.N12 = true;
    s.inv.madera = 10; s.inv.piedra = 10;
    expect(startImproveNode(s, n.id)).toBeNull();
    expect(s.inv.madera).toBe(6);
    expect(s.inv.piedra).toBe(8);
    for (const v of s.villagers) if (stageOf(v) === "adult") v.role = "construccion";
    run(s, 30);
    expect(n.improving).toBeUndefined();
    expect(n.improved).toBe(true);
  });

  it("cancelar la mejora devuelve todo", () => {
    const s = withN12(72);
    const n = s.nodes.find((x) => x.type === "roca")!;
    s.inv.madera = 6;
    expect(startImproveNode(s, n.id)).toBeNull();
    expect(s.inv.madera).toBe(0);
    cancelImproveNode(s, n.id);
    expect(s.inv.madera).toBe(6);
    expect(n.improving).toBeUndefined();
  });

  it("con los barreros, la arcilla rinde mucho más una vez agotada la reserva", () => {
    const flow = (improve: boolean) => {
      const s = withN12(73);
      for (const v of s.villagers) { v.age = 20; v.lifespan = 999; v.role = "materiales"; }
      if (improve) for (const n of s.nodes) if (n.type === "arcilla") n.improved = true;
      s.focus = "arcilla";
      let got = 0;
      for (let i = 0; i < 1800; i++) { s.inv.arcilla = 0; step(s, 0.1); if (i >= 1200) got += s.inv.arcilla; } // minuto 3
      return got;
    };
    const wild = flow(false), barrero = flow(true);
    expect(wild).toBeLessThan(15);
    expect(barrero).toBeGreaterThan(wild * 2.5);
  });

  it("avisa cuando la arcilla silvestre se agota", () => {
    const s = withN12(74);
    for (const n of s.nodes) if (n.type === "arcilla") n.stock.arcilla = 1;
    const w = wildState(s, "arcilla")!;
    expect(w.fill).toBeLessThan(WILD_LOW);
    expect(w.unimproved).toBe(3);
    expect(w.upgrade).toBe("Barrero");
  });
});

describe("Era 4: Hierro / Clásica", () => {
  const era4 = (seed: number, extra: string[] = []) => {
    const s = createState(seed);
    for (const t of ["P01", "P02", "P04", "P05", "P06", "P11", "N01", "N02", "N03", "N09", "N10", "N11", "N12",
      "B01", "B02", "B03", "B04", "B06", "B07", "B09", ...extra]) s.techs[t] = true;
    s.debug.infinite.comida = true;
    return s;
  };

  it("con Geometría el Valle crece hacia abajo y el sendero baja al borde", () => {
    const s = era4(80);
    const nodes = s.nodes.length;
    s.techs.H02 = true;
    step(s, 0.1);
    const z = s.zones.valle;
    expect(z.h).toBe(16);
    expect(z.tiles).toHaveLength(16);
    expect(z.exits.montanas).toEqual({ x: 1, y: 15 });
    expect(z.tiles[15][1]).toBe("sendero");
    expect(z.tiles[11][1]).toBe("pasto");
    expect(z.tiles[14][6]).toBe("orilla");
    expect(s.nodes.length).toBeGreaterThan(nodes);
    step(s, 0.1); // no vuelve a crecer
    expect(z.h).toBe(16);
    // Se sigue llegando a las Montañas por el sendero nuevo.
    expect(transferVillager(s, "valle", "montanas")).toBeNull();
    run(s, 30);
    expect(s.villagers.some((v) => v.zone === "montanas")).toBe(true);
  });

  it("cadena del hierro: mina sobre rocas rojas → mineral; forja → hierro", () => {
    const s = era4(81, ["H01"]);
    s.inv.madera = 20; s.inv.bronce = 4;
    const roja = s.nodes.find((n) => n.zone === "montanas" && n.type === "hierro")!;
    expect(place(s, "mina_hierro", 0, 0, "montanas")).not.toBeNull(); // no es una roca roja
    expect(place(s, "mina_hierro", roja.x, roja.y, "montanas")).toBeNull();
    const mina = s.buildings[s.buildings.length - 1];
    mina.built = true;
    const forja = addBuilding(s, "forja", 2, 3);
    debugAddVillagers(s, 2);
    expect(transferVillager(s, "valle", "montanas")).toBeNull();
    run(s, 40);
    s.inv.carbon = 20;
    for (const b of [mina, forja]) expect(changeSpecialists(s, b.id, 1)).toBeNull();
    run(s, 120);
    expect(s.inv.hierro).toBeGreaterThan(0);
  });

  it("el mercado cambia 3 de lo que sobra por 1 de lo que falta, o del recurso en foco", () => {
    const s = era4(82, ["H07"]);
    for (const r of RESOURCES) s.inv[r.id] = 0;
    s.inv.madera = 90; s.inv.piedra = 10; // almacén: 100
    expect(trade(s)).toEqual({ from: "madera", to: expect.any(String) });
    expect(s.inv.madera).toBe(87);
    s.focus = "arcilla";
    expect(trade(s)).toEqual({ from: "madera", to: "arcilla" });
    expect(s.inv.arcilla).toBe(1);
    s.inv.madera = 2; s.inv.piedra = 2;
    expect(trade(s)).toBeNull(); // nada sobra
  });

  it("la grúa y la geometría aceleran las obras", () => {
    const time = (withGrua: boolean) => {
      const s = era4(83, ["H02"]);
      for (const v of s.villagers) { v.age = 20; v.lifespan = 999; v.role = null; }
      const b = s.villagers[0];
      b.role = "construccion";
      for (const v of s.villagers.slice(1)) v.role = "comida";
      if (withGrua) addBuilding(s, "grua", 3, 5);
      s.buildings.push({ id: s.nextId++, type: "adobe", zone: "valle", x: 3, y: 6, progress: 0, built: false });
      const site = s.buildings[s.buildings.length - 1];
      let t = 0;
      while (!site.built && t < 120) { step(s, 0.1); t += 0.1; }
      return t;
    };
    expect(time(true)).toBeLessThan(time(false));
  });

  it("acueducto: canales lejos del río", () => {
    const s = era4(84, ["H02", "H04"]);
    s.inv.piedra = 50; s.inv.ladrillo = 10;
    expect(place(s, "canal", 2, 3)).not.toBeNull();
    expect(place(s, "acueducto", 2, 4)).toBeNull();
    expect(place(s, "canal", 2, 3)).toBeNull(); // toca el acueducto
  });

  it("Acueducto y medicina: +10 años de vida, una sola vez", () => {
    const s = era4(85);
    const before = s.villagers.map((v) => v.lifespan);
    s.techs.H04 = true;
    step(s, 0.1);
    step(s, 0.1);
    s.villagers.forEach((v, i) => expect(v.lifespan).toBeCloseTo(before[i] + config.VIDA_MEDICINA));
  });

  it("la Arboleda sube a Plantación con el Hierro", () => {
    const s = era4(86);
    const tree = s.nodes.find((n) => n.type === "arbol")!;
    tree.improved = true;
    expect(startImproveNode(s, tree.id)).toMatch(/hace falta/);
    s.techs.H01 = true;
    s.inv.madera = 10; s.inv.hierro = 2;
    const base = nodeRegen(tree, "madera");
    expect(startImproveNode(s, tree.id)).toBeNull();
    for (const v of s.villagers) if (stageOf(v) === "adult") v.role = "construccion";
    run(s, 40);
    expect(tree.improved2).toBe(true);
    expect(nodeRegen(tree, "madera")).toBeCloseTo(base * config.MEJORA_PLANTACION);
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
