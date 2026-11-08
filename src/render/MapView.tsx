// Mapa de la zona con PixiJS. Solo dibuja: el estado vive en la simulación.
import { Application, Container, Graphics, Text } from "pixi.js";
import { useEffect, useRef } from "react";
import { BUILDING_BY_ID, JOB_BY_ID, NODE_DEFS, type ResId } from "../content";
import { engine } from "../engine";
import { canPlace, orderGather, place } from "../sim/actions";
import { stageOf } from "../sim/economy";

const TILE_COLORS = { pasto: 0x557a35, rio: 0x2f6fb5, orilla: 0x8a7a50, cueva: 0x1a1a1a } as const;

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
      world.addChild(tilesG, nodesG, buildingsG, labels, overlayG, villagersG);
      app.stage.addChild(world);

      let ts = 32; // tamaño de casilla en píxeles
      let lastLayout = "";
      const labelById = new Map<number, Text>();

      const layout = () => {
        const s = engine.s;
        const sw = app.screen.width, sh = app.screen.height;
        const key = `${sw}x${sh}`;
        if (key === lastLayout) return;
        lastLayout = key;
        ts = Math.floor(Math.min(sw / s.w, sh / s.h));
        world.x = Math.floor((sw - ts * s.w) / 2);
        world.y = Math.floor((sh - ts * s.h) / 2);
        tilesG.clear();
        for (let y = 0; y < s.h; y++) {
          for (let x = 0; x < s.w; x++) {
            const t = s.tiles[y][x];
            tilesG.rect(x * ts, y * ts, ts, ts).fill(TILE_COLORS[t]);
            tilesG.rect(x * ts, y * ts, ts, ts).stroke({ width: 1, color: 0x000000, alpha: 0.12 });
          }
        }
        // Entrada de la cueva con brillo verde.
        tilesG.circle(0.5 * ts, 0.62 * ts, ts * 0.3).fill(0x000000);
        tilesG.circle(0.5 * ts, 0.66 * ts, ts * 0.08).fill({ color: 0x3fe07a, alpha: 0.8 });
        for (const lbl of labelById.values()) lbl.style.fontSize = ts * 0.55;
      };

      const draw = () => {
        const s = engine.s;
        layout();

        // Nodos de recursos
        nodesG.clear();
        for (const n of s.nodes) {
          const def = NODE_DEFS[n.type];
          const fullness = Object.entries(def.stocks).reduce((acc, [r, d]) => acc + (n.stock[r as ResId] ?? 0) / d!.max, 0) / Object.keys(def.stocks).length;
          const cx = (n.x + 0.5) * ts, cy = (n.y + 0.5) * ts;
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
          }
        }

        // Edificios
        buildingsG.clear();
        const seen = new Set<number>();
        for (const b of s.buildings) {
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
          lbl.y = y + ts / 2;
          lbl.alpha = b.built ? 1 : 0.5;
        }
        for (const [id, lbl] of labelById) if (!seen.has(id)) { lbl.destroy(); labelById.delete(id); }

        // Modo colocar: marca las casillas válidas
        overlayG.clear();
        if (engine.ui.placing) {
          for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) {
            if (canPlace(s, engine.ui.placing, x, y)) overlayG.rect(x * ts + 3, y * ts + 3, ts - 6, ts - 6).stroke({ width: 2, color: 0xffe08a, alpha: 0.8 });
          }
        }

        // Aldeanos
        villagersG.clear();
        for (const v of s.villagers) {
          const stage = stageOf(v);
          const r = ts * (stage === "child" ? 0.11 : 0.16);
          const cx = v.x * ts, cy = v.y * ts;
          const body = stage === "elder" ? 0xcfc8b8 : 0xf2c28e;
          const ring = v.job ? JOB_BY_ID[v.job]?.color ?? 0xffffff : 0x333333;
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

        if (engine.ui.placing) {
          const err = place(s, engine.ui.placing, tx, ty);
          if (err) engine.toast(err);
          else engine.ui.placing = null;
          engine.notify();
          return;
        }

        // ¿Tocó un aldeano?
        let best: number | null = null, bd = 0.45;
        for (const v of s.villagers) {
          const d = Math.hypot(v.x - fx, v.y - fy);
          if (d < bd) { bd = d; best = v.id; }
        }
        if (best != null) { engine.ui.selected = best; engine.notify(); return; }

        // Con un aldeano seleccionado, tocar un recurso = señalar.
        const node = s.nodes.find((n) => n.x === tx && n.y === ty);
        if (engine.ui.selected != null && node) {
          const err = orderGather(s, engine.ui.selected, node.id);
          if (err) engine.toast(err);
          engine.notify();
          return;
        }
        if (node) { engine.toast(`${NODE_DEFS[node.type].name}. Selecciona un aldeano y toca aquí para que recolecte.`); return; }
        const b = s.buildings.find((x) => x.x === tx && x.y === ty);
        if (b) { engine.toast(`${BUILDING_BY_ID[b.type].icon} ${BUILDING_BY_ID[b.type].name}${b.built ? "" : " (en construcción)"}: ${BUILDING_BY_ID[b.type].desc}`); return; }
        if (s.tiles[ty]?.[tx] === "cueva") { engine.toast("Una cueva oscura. Algo brilla en verde adentro… Hace falta una antorcha."); return; }
        engine.ui.selected = null;
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
