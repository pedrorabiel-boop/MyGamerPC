// Mapa de la zona con PixiJS. Solo dibuja: el estado vive en la simulación.
import { Application, Container, Graphics, Text } from "pixi.js";
import { useEffect, useRef } from "react";
import { BUILDING_BY_ID, NODE_DEFS, NODE_UPGRADES, ROLE_BY_ID, SPECIALIST_COLOR, type ResId } from "../content";
import { engine } from "../engine";
import { canPlace, orderGather, place, zoneUnlocked } from "../sim/actions";
import { has, nodeMax, staffCount, stageOf } from "../sim/economy";
import type { Villager, ZoneId } from "../sim/state";
import { config } from "../config";

/** Niño adentro de la escuela: no se dibuja (ya llegó y está estudiando). */
const atSchool = (v: Villager) => v.task.kind === "work" && stageOf(v) === "child";

const TILE_COLORS = { pasto: 0x557a35, rio: 0x2f6fb5, orilla: 0x8a7a50, cueva: 0x1a1a1a, suelo: 0x4a4038, pared: 0x1f1b18, salida: 0x8a7a5a, sendero: 0x8a7a50, monte: 0x6f7a6a, pico: 0xd8dde4 } as const;

export function MapView() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current!;
    const app = new Application();
    let ready = false;
    let destroyed = false;

    (async () => {
      await app.init({
        resizeTo: el,
        background: 0x1b1814,
        antialias: true,
        autoDensity: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
      });
      if (destroyed) { app.destroy(true); return; }
      ready = true;
      el.appendChild(app.canvas);

      const world = new Container();
      const tilesG = new Graphics();
      const overlayG = new Graphics();
      const nodesG = new Graphics();
      const buildingsG = new Graphics();
      const labels = new Container();
      const villagersG = new Graphics();
      const entranceLabels = new Container();
      world.addChild(tilesG, entranceLabels, nodesG, buildingsG, labels, overlayG, villagersG);
      app.stage.addChild(world);

      let ts = 32; // tamaño de casilla en píxeles
      let lastLayout = "";
      let lastEntranceState = "";
      const labelById = new Map<number, Text>();

      const layout = () => {
        const s = engine.s;
        const zone = engine.ui.zone;
        const z = s.zones[zone];
        const sw = app.screen.width, sh = app.screen.height;
        const key = `${sw}x${sh}:${zone}`;
        if (key === lastLayout) return;
        lastLayout = key;
        // Márgenes para que el mapa nunca quede debajo de lo que flota encima:
        // arriba las pestañas de zona; abajo el botón del Libro y los avisos.
        const TOP = 40, BOTTOM = 88;
        const usableH = Math.max(100, sh - TOP - BOTTOM);
        ts = Math.floor(Math.min(sw / z.w, usableH / z.h));
        world.x = Math.floor((sw - ts * z.w) / 2);
        world.y = TOP + Math.floor((usableH - ts * z.h) / 2);
        tilesG.clear();
        for (let y = 0; y < z.h; y++) {
          for (let x = 0; x < z.w; x++) {
            const t = z.tiles[y][x];
            tilesG.rect(x * ts, y * ts, ts, ts).fill(TILE_COLORS[t]);
            tilesG.rect(x * ts, y * ts, ts, ts).stroke({ width: 1, color: 0x000000, alpha: t === "pared" ? 0 : 0.12 });
            if (t === "cueva") {
              // Entrada de la cueva con brillo verde.
              tilesG.circle((x + 0.5) * ts, (y + 0.62) * ts, ts * 0.3).fill(0x000000);
              tilesG.circle((x + 0.5) * ts, (y + 0.66) * ts, ts * 0.08).fill({ color: 0x3fe07a, alpha: 0.8 });
            } else if (t === "sendero") {
              // Sendero a las Montañas: camino de tierra con una montañita.
              tilesG.rect((x + 0.38) * ts, y * ts, ts * 0.24, ts).fill({ color: 0xb8a070, alpha: 0.9 });
              tilesG.moveTo((x + 0.15) * ts, (y + 0.55) * ts).lineTo((x + 0.35) * ts, (y + 0.2) * ts).lineTo((x + 0.55) * ts, (y + 0.55) * ts).fill({ color: 0x9aa4a8, alpha: 0.9 });
            } else if (t === "pico") {
              tilesG.moveTo(x * ts, (y + 1) * ts).lineTo((x + 0.5) * ts, (y + 0.1) * ts).lineTo((x + 1) * ts, (y + 1) * ts).fill(0x8a929a);
              tilesG.moveTo((x + 0.36) * ts, (y + 0.36) * ts).lineTo((x + 0.5) * ts, (y + 0.1) * ts).lineTo((x + 0.64) * ts, (y + 0.36) * ts).fill(0xffffff);
            } else if (t === "salida") {
              // Salida al Valle: luz que entra.
              tilesG.circle((x + 0.5) * ts, (y + 0.7) * ts, ts * 0.38).fill({ color: 0xf6e3a0, alpha: 0.55 });
              tilesG.circle((x + 0.5) * ts, (y + 0.75) * ts, ts * 0.2).fill({ color: 0xfff6d0, alpha: 0.8 });
            } else if (t === "pared" && (x * 7 + y * 3) % 5 === 0) {
              // Murciélagos colgando, de adorno.
              const cx = (x + 0.5) * ts, cy = (y + 0.75) * ts;
              tilesG.moveTo(cx - ts * 0.18, cy - ts * 0.05).lineTo(cx, cy + ts * 0.06).lineTo(cx + ts * 0.18, cy - ts * 0.05).stroke({ width: 2, color: 0x000000, alpha: 0.7 });
            }
          }
        }
        for (const lbl of labelById.values()) lbl.style.fontSize = ts * 0.55;
        // Íconos de las entradas a otras zonas.
        entranceLabels.removeChildren().forEach((c) => c.destroy());
        for (let y = 0; y < z.h; y++) for (let x = 0; x < z.w; x++) {
          const t = z.tiles[y][x];
          const icon = t === "sendero" ? "⛰️" : t === "cueva" ? "🕳️" : t === "salida" ? "🏞️" : null;
          if (!icon) continue;
          const lbl = new Text({ text: icon, style: { fontSize: ts * 0.62 } });
          lbl.anchor.set(0.5);
          lbl.x = (x + 0.5) * ts;
          lbl.y = (y + 0.45) * ts;
          lbl.label = t;
          entranceLabels.addChild(lbl);
        }
        lastEntranceState = "";
      };

      const draw = () => {
        const s = engine.s;
        layout();
        // Entradas en gris mientras la zona a la que llevan está cerrada.
        const entranceState = `${zoneUnlocked(s, "cueva")}${zoneUnlocked(s, "montanas")}`;
        if (entranceState !== lastEntranceState) {
          lastEntranceState = entranceState;
          for (const c of entranceLabels.children) {
            const open = c.label === "sendero" ? zoneUnlocked(s, "montanas") : c.label === "cueva" ? zoneUnlocked(s, "cueva") : true;
            c.alpha = open ? 1 : 0.35;
          }
        }

        const zone = engine.ui.zone;
        const z = s.zones[zone];

        // Nodos de recursos
        nodesG.clear();
        for (const n of s.nodes) {
          if (n.zone !== zone) continue;
          const def = NODE_DEFS[n.type];
          const nStocks = Object.keys(def.stocks).length;
          const fullness = nStocks ? Object.keys(def.stocks).reduce((acc, r) => acc + (n.stock[r as ResId] ?? 0) / nodeMax(n, r as ResId), 0) / nStocks : 1;
          const cx = (n.x + 0.5) * ts, cy = (n.y + 0.5) * ts;
          // Mejorado (N12): suelo trabajado y cerco; en obra: barra de progreso.
          if (n.improved) {
            nodesG.roundRect(n.x * ts + 2, n.y * ts + 2, ts - 4, ts - 4, ts * 0.12).fill({ color: 0x6b4a2a, alpha: 0.35 }).stroke({ width: 2, color: 0xc8a060, alpha: 0.9 });
          }
          if (n.improving != null && NODE_UPGRADES[n.type]) {
            const p = Math.min(1, n.improving / NODE_UPGRADES[n.type]!.buildTime);
            nodesG.rect(n.x * ts + 4, n.y * ts + 3, ts - 8, 4).fill({ color: 0x000000, alpha: 0.5 });
            nodesG.rect(n.x * ts + 4, n.y * ts + 3, (ts - 8) * p, 4).fill(0x8fd16a);
          }
          if (engine.ui.selectedNode === n.id) nodesG.roundRect(n.x * ts, n.y * ts, ts, ts, ts * 0.15).stroke({ width: 2, color: 0xffffff });
          const alpha = 0.35 + 0.65 * fullness;
          if (n.type === "arbol") {
            nodesG.rect(cx - ts * 0.05, cy, ts * 0.1, ts * 0.35).fill({ color: 0x5a3a1a, alpha });
            nodesG.circle(cx, cy - ts * 0.05, ts * 0.32).fill({ color: def.color, alpha });
          } else if (n.type === "arbusto") {
            nodesG.circle(cx, cy, ts * 0.3).fill({ color: def.color, alpha });
            const berries = Math.round((n.stock.comida ?? 0) / 2);
            for (let i = 0; i < berries; i++) {
              const ang = (i / 4) * Math.PI * 2;
              nodesG.circle(cx + Math.cos(ang) * ts * 0.15, cy + Math.sin(ang) * ts * 0.15, ts * 0.05).fill(0xd8324a);
            }
          } else if (n.type === "roca") {
            nodesG.roundRect(cx - ts * 0.3, cy - ts * 0.2, ts * 0.6, ts * 0.42, ts * 0.15).fill({ color: def.color, alpha });
            if ((n.stock.pigmento ?? 0) >= 1) nodesG.circle(cx + ts * 0.12, cy - ts * 0.02, ts * 0.06).fill(0xc0504d);
          } else if (n.type === "pasto") {
            for (let i = -2; i <= 2; i++) nodesG.rect(cx + i * ts * 0.1 - 1, cy - ts * 0.25, 2, ts * 0.45).fill({ color: def.color, alpha });
          } else if (n.type === "manada") {
            for (let i = 0; i < 3; i++) nodesG.ellipse(cx + (i - 1) * ts * 0.22, cy + (i % 2) * ts * 0.12, ts * 0.13, ts * 0.09).fill({ color: def.color, alpha });
          } else if (n.type === "arcilla") {
            nodesG.ellipse(cx, cy, ts * 0.32, ts * 0.2).fill({ color: def.color, alpha });
          } else if (n.type === "ocre") {
            nodesG.roundRect(cx - ts * 0.32, cy - ts * 0.22, ts * 0.64, ts * 0.46, ts * 0.12).fill({ color: def.color, alpha });
            nodesG.rect(cx - ts * 0.22, cy - ts * 0.06, ts * 0.44, ts * 0.05).fill({ color: 0xffb070, alpha: alpha * 0.8 });
          } else if (n.type === "arena") {
            nodesG.ellipse(cx, cy, ts * 0.32, ts * 0.18).fill({ color: def.color, alpha });
            nodesG.circle(cx - ts * 0.1, cy, ts * 0.03).fill({ color: 0xffffff, alpha: 0.6 });
          } else if (n.type === "estano") {
            nodesG.roundRect(cx - ts * 0.34, cy - ts * 0.24, ts * 0.68, ts * 0.48, ts * 0.12).fill(0x4a4f55);
            for (const [dx, dy] of [[-0.15, -0.08], [0.1, 0.05], [0.2, -0.12], [-0.05, 0.12]]) nodesG.circle(cx + dx * ts, cy + dy * ts, ts * 0.05).fill(def.color);
          } else if (n.type === "hierro") {
            nodesG.roundRect(cx - ts * 0.3, cy - ts * 0.22, ts * 0.6, ts * 0.44, ts * 0.14).fill(def.color);
            nodesG.rect(cx - ts * 0.18, cy - ts * 0.04, ts * 0.36, ts * 0.05).fill({ color: 0xd06040, alpha: 0.8 });
          } else if (n.type === "veta") {
            nodesG.roundRect(cx - ts * 0.34, cy - ts * 0.24, ts * 0.68, ts * 0.48, ts * 0.12).fill(0x2e2a26);
            for (const [dx, dy] of [[-0.15, -0.08], [0.1, 0.05], [0.2, -0.12], [-0.05, 0.12]]) {
              nodesG.circle(cx + dx * ts, cy + dy * ts, ts * 0.05).fill({ color: def.color, alpha: 0.9 });
            }
          }
        }

        // Edificios
        buildingsG.clear();
        const seen = new Set<number>();
        for (const b of s.buildings) {
          if (b.zone !== zone) continue;
          const def = BUILDING_BY_ID[b.type];
          const x = b.x * ts, y = b.y * ts;
          seen.add(b.id);
          if (b.built) {
            buildingsG.roundRect(x + 2, y + 2, ts - 4, ts - 4, ts * 0.15).fill(def.color);
          } else {
            buildingsG.roundRect(x + 2, y + 2, ts - 4, ts - 4, ts * 0.15).fill({ color: def.color, alpha: 0.3 });
            buildingsG.roundRect(x + 2, y + 2, ts - 4, ts - 4, ts * 0.15).stroke({ width: 2, color: 0xffffff, alpha: 0.5 });
            const p = def.buildTime ? Math.min(1, b.progress / def.buildTime) : 1;
            buildingsG.rect(x + 4, y + ts - 8, (ts - 8) * p, 4).fill(0xf0a030);
          }
          let lbl = labelById.get(b.id);
          if (!lbl) {
            lbl = new Text({ text: def.icon, style: { fontSize: ts * 0.55 } });
            lbl.anchor.set(0.5);
            labels.addChild(lbl);
            labelById.set(b.id, lbl);
          }
          lbl.x = x + ts / 2;
          lbl.y = y + ts / 2 - (def.staff ? ts * 0.08 : 0);
          lbl.alpha = b.built ? 1 : 0.5;

          // Puestos de trabajo: llenos = ocupados (verde), vacíos = falta gente (rojo).
          if (def.staff && b.built) {
            const n = def.staff.slots;
            const have = staffCount(s, b);
            const r = Math.max(4, ts * 0.11);
            const gap = r * 2.5;
            const startX = x + ts / 2 - ((n - 1) * gap) / 2;
            const cy = y + ts - r * 0.4;
            // Píldora oscura detrás de los puntos, para que se lean sobre cualquier fondo.
            buildingsG.roundRect(startX - r * 1.5, cy - r * 1.4, (n - 1) * gap + r * 3, r * 2.8, r * 1.4).fill({ color: 0x111111, alpha: 0.85 });
            for (let i = 0; i < n; i++) {
              const cx = startX + i * gap;
              if (i < have) buildingsG.circle(cx, cy, r).fill(0x7fe07a);
              else buildingsG.circle(cx, cy, r * 0.8).stroke({ width: 2, color: 0xff5a4a });
            }
            // Marca "!" si le falta gente.
            if (have < n) {
              const bx = x + ts - r * 0.9, by = y + r * 0.9;
              buildingsG.circle(bx, by, r * 1.1).fill(0xe0453a).stroke({ width: 1.5, color: 0xffffff });
              buildingsG.rect(bx - r * 0.18, by - r * 0.65, r * 0.36, r * 0.75).fill(0xffffff);
              buildingsG.circle(bx, by + r * 0.45, r * 0.2).fill(0xffffff);
            }
          }
          if (b.built && b.upgradeTo) {
            const to = BUILDING_BY_ID[b.upgradeTo];
            const p = Math.min(1, (b.upgradeProgress ?? 0) / (to.buildTime * (1 - config.DESCUENTO_MEJORA)));
            buildingsG.rect(x + 4, y + 3, ts - 8, 4).fill({ color: 0x000000, alpha: 0.5 });
            buildingsG.rect(x + 4, y + 3, (ts - 8) * p, 4).fill(0x6ec6ff);
          }
          if (engine.ui.selectedBuilding === b.id) {
            buildingsG.roundRect(x, y, ts, ts, ts * 0.15).stroke({ width: 2, color: 0xffffff });
          }
        }
        for (const [id, lbl] of labelById) if (!seen.has(id)) { lbl.destroy(); labelById.delete(id); }

        // Modo colocar: marca las casillas válidas
        overlayG.clear();
        if (engine.ui.placing) {
          for (let y = 0; y < z.h; y++) for (let x = 0; x < z.w; x++) {
            if (canPlace(s, engine.ui.placing, x, y, zone)) overlayG.rect(x * ts + 3, y * ts + 3, ts - 6, ts - 6).stroke({ width: 2, color: 0xffe08a, alpha: 0.8 });
          }
        }

        // Aldeanos
        villagersG.clear();
        for (const v of s.villagers) {
          if (v.zone !== zone || atSchool(v)) continue;
          const stage = stageOf(v);
          const r = ts * (stage === "child" ? 0.11 : 0.16);
          const cx = v.x * ts, cy = v.y * ts;
          const body = stage === "elder" ? 0xcfc8b8 : 0xf2c28e;
          const ring = v.workplace != null ? SPECIALIST_COLOR : v.role ? ROLE_BY_ID[v.role].color : 0x333333;
          if (engine.ui.selected === v.id) villagersG.circle(cx, cy, r + 5).stroke({ width: 2, color: 0xffffff });
          villagersG.circle(cx, cy, r).fill(body).stroke({ width: 2.5, color: ring });
          if (v.carry) villagersG.rect(cx + r * 0.6, cy - r * 1.2, r * 0.8, r * 0.8).fill(0xffd166);
          if (v.order) villagersG.circle(cx, cy - r - 4, 2.5).fill(0xffffff);
        }
      };

      app.ticker.add(draw);

      app.stage.eventMode = "static";
      app.stage.hitArea = app.screen;
      app.stage.on("pointertap", (e) => {
        const p = world.toLocal(e.global);
        const fx = p.x / ts, fy = p.y / ts;
        const tx = Math.floor(fx), ty = Math.floor(fy);
        const s = engine.s;
        const zone = engine.ui.zone;
        const tile = s.zones[zone].tiles[ty]?.[tx];

        if (engine.ui.placing) {
          const err = place(s, engine.ui.placing, tx, ty, zone);
          if (err) engine.toast(err);
          else engine.ui.placing = null;
          engine.notify();
          return;
        }

        // ¿Tocó un aldeano?
        let best: number | null = null, bd = 0.45;
        for (const v of s.villagers) {
          if (v.zone !== zone || atSchool(v)) continue;
          const d = Math.hypot(v.x - fx, v.y - fy);
          if (d < bd) { bd = d; best = v.id; }
        }
        if (best != null) { engine.ui.selected = best; engine.ui.selectedBuilding = null; engine.ui.selectedNode = null; engine.notify(); return; }

        // Con un aldeano seleccionado, tocar un recurso = señalar.
        const node = s.nodes.find((n) => n.zone === zone && n.x === tx && n.y === ty);
        if (node?.type === "veta" || node?.type === "estano") {
          const name = node.type === "veta" ? "Vetas de cobre" : "Vetas de estaño";
          engine.toast(has(s, "B01") ? `${name}: construye encima una ⛏️ Mina (🔨 Construir).` : `${name}: brillan, pero todavía no sabemos sacarlas. Hace falta Minería.`);
          return;
        }
        if (node?.type === "hierro") { engine.toast("Rocas rojas: algo hay ahí adentro… (Edad de Hierro)."); return; }
        if (engine.ui.selected != null && node) {
          const err = orderGather(s, engine.ui.selected, node.id);
          if (err) engine.toast(err);
          engine.notify();
          return;
        }
        if (node) { engine.ui.selectedNode = node.id; engine.ui.selectedBuilding = null; engine.notify(); return; }
        const b = s.buildings.find((x) => x.zone === zone && x.x === tx && x.y === ty);
        if (b) { engine.ui.selectedBuilding = b.id; engine.ui.selected = null; engine.ui.selectedNode = null; engine.notify(); return; }
        // Entradas (en el Valle) o salida (en otra zona): ventana de traslado de esa zona.
        const target: ZoneId | null = tile === "cueva" ? "cueva" : tile === "sendero" ? "montanas" : tile === "salida" ? zone : null;
        if (target) {
          if (!zoneUnlocked(s, target)) {
            engine.toast(target === "cueva"
              ? "Una cueva oscura. Algo brilla en verde adentro… Hace falta una antorcha (Exploración)."
              : "Un sendero hacia las montañas. Es muy lejos para ir cargando cosas a mano: hace falta la Rueda.");
            return;
          }
          engine.ui.zoneModal = target;
          engine.notify();
          return;
        }
        engine.ui.selected = null;
        engine.ui.selectedBuilding = null;
        engine.notify();
      });
    })();

    return () => {
      destroyed = true;
      if (ready) app.destroy(true, { children: true });
    };
  }, []);

  return <div ref={host} className="map" />;
}
