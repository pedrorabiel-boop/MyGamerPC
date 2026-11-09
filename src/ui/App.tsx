import { useState } from "react";
import { config } from "../config";
import { RES_BY_ID, TECH_INTRO, type ResId } from "../content";
import { TECH_BY_ID } from "../data/tree";
import { DEBUG_ENABLED, engine, useEngine, type Tab } from "../engine";
import { MapView } from "../render/MapView";
import { dismissIntro, tapBook } from "../sim/actions";
import { isTribeLost } from "../sim/economy";
import { BookPanel } from "./BookPanel";
import { BuildingCard } from "./BuildingCard";
import { BuildPanel } from "./BuildPanel";
import { DebugPanel } from "./DebugPanel";
import { formatNumber } from "./format";
import { TopBar } from "./TopBar";
import { VillagerCard } from "./VillagerCard";
import { VillagersPanel } from "./VillagersPanel";
import { ZoneBar, ZoneModal } from "./ZoneUI";
import { ResourceMenu } from "./ResourceMenu";


export function App() {
  const { s, ui, offlineSummary } = useEngine();
  const tab = ui.tab;
  const setTab = (t: Tab) => { engine.ui.tab = t; engine.ui.resMenu = null; engine.notify(); };
  const [bump, setBump] = useState(0);

  const lastLog = s.log[s.log.length - 1];
  const toast = ui.toast && Date.now() - ui.toast.at < 4000 ? ui.toast.msg : lastLog && Date.now() - lastLog.at < 4000 ? lastLog.msg : null;

  const tabs: [Tab, string, string][] = [
    ["mapa", "🗺️", "Mapa"],
    ["libro", "📖", "Libro"],
    ["construir", "🔨", "Construir"],
    ["aldeanos", "👥", "Aldeanos"],
  ];
  if (DEBUG_ENABLED) tabs.push(["debug", "🐞", "Debug"]);

  return (
    <div className="app">
      <TopBar />
      <main className="stage">
        <MapView />
        <ZoneBar />
        <ZoneModal />
        <ResourceMenu />

        {tab === "mapa" && <VillagerCard />}
        {tab === "mapa" && <BuildingCard />}

        {engine.ui.placing && (
          <div className="placing">
            Colocando… toca una casilla marcada
            <button onClick={() => { engine.ui.placing = null; engine.notify(); }}>Cancelar</button>
          </div>
        )}

        <button
          className={"book-tap" + (bump % 2 ? " bump" : "")}
          onClick={() => { tapBook(s); setBump((b) => b + 1); engine.notify(); }}
          aria-label="Tocar el Libro"
        >
          📖
        </button>

        {toast && <div className="toast">{toast}</div>}

        {tab !== "mapa" && (
          <div className={"sheet" + (tab === "libro" || tab === "debug" ? " tall" : "")}>
            <div className="sheet-head">
              <b>{tabs.find((t) => t[0] === tab)?.[2]}</b>
              <button className="x" onClick={() => setTab("mapa")}>✕</button>
            </div>
            <div className="sheet-body">
              {tab === "libro" && <BookPanel />}
              {tab === "construir" && <BuildPanel onPick={() => setTab("mapa")} />}
              {tab === "aldeanos" && <VillagersPanel />}
              {tab === "debug" && <DebugPanel />}
            </div>
          </div>
        )}

        {s.prototypeEnded && (
          <div className="modal">
            <div className="modal-box">
              <h2>🏁 ¡Fin del prototipo!</h2>
              <p>Tu tribu llegó a la <b>Edad de Bronce</b>. Hasta aquí llega esta versión.</p>
              <p className="muted">Años: {Math.floor(s.time / config.TIEMPO_POR_AÑO)} · Nacimientos: {s.stats.births} · Muertes: {s.stats.deaths}</p>
              <button className="primary" onClick={() => { s.prototypeEnded = false; engine.notify(); }}>Seguir jugando</button>
            </div>
          </div>
        )}

        {s.introQueue.length > 0 && !isTribeLost(s) && !offlineSummary && (
          <div className="modal">
            <div className="modal-box intro">
              <div className="intro-kicker">📖 Nueva página comprendida</div>
              <h2>{TECH_BY_ID[s.introQueue[0]]?.name}</h2>
              <ul>
                {(TECH_INTRO[s.introQueue[0]] ?? []).map((line, i) => <li key={i}>{line}</li>)}
              </ul>
              <button className="primary" onClick={() => { dismissIntro(s); engine.notify(); }}>
                Entendido{s.introQueue.length > 1 ? ` (${s.introQueue.length - 1} más)` : ""}
              </button>
            </div>
          </div>
        )}

        {isTribeLost(s) && s.lostDismissed && (
          <div className="lostbar">
            💀 Tribu extinta
            <button onClick={() => engine.newGame()}>Empezar de nuevo</button>
          </div>
        )}

        {isTribeLost(s) && !s.lostDismissed && (
          <div className="modal">
            <div className="modal-box">
              <h2>💀 Tu tribu no puede continuar</h2>
              <p>
                {s.villagers.length === 1
                  ? `Solo queda ${s.villagers[0].name}. Sin nadie más, no habrá una próxima generación.`
                  : "No queda nadie."}
                {offlineSummary && ` Pasó mientras no estabas (${Math.floor(offlineSummary.years)} años).`}
              </p>
              <p className="muted">
                Años: {Math.floor(s.time / config.TIEMPO_POR_AÑO)} · Nacimientos: {s.stats.births} · Muertes: {s.stats.deaths} ·
                Tecnologías: {Object.keys(s.techs).length}
              </p>
              <p className="muted"><em>"El Departamento lamenta informarle que su PC gamer ha sido postergado indefinidamente. Su alma, en cambio, sigue vigente."</em></p>
              <div className="inline">
                <button className="primary" onClick={() => engine.newGame()}>Empezar de nuevo</button>
                <button onClick={() => { s.lostDismissed = true; engine.offlineSummary = null; engine.notify(); }}>Seguir mirando</button>
              </div>
            </div>
          </div>
        )}

        {offlineSummary && !(isTribeLost(s) && !s.lostDismissed) && (
          <div className="modal">
            <div className="modal-box">
              <h2>🌙 Mientras no estabas…</h2>
              <p>
                Pasaron <b>{Math.floor(offlineSummary.years)} años</b>. Nacieron {offlineSummary.births} y murieron {offlineSummary.deaths}.
              </p>
              <ul>
                {Object.entries(offlineSummary.gained).map(([r, n]) => (
                  <li key={r}>{RES_BY_ID[r as ResId].icon} {RES_BY_ID[r as ResId].name}: {n! > 0 ? "+" : "−"}{formatNumber(Math.abs(n!))}</li>
                ))}
              </ul>
              <button className="primary" onClick={() => { engine.offlineSummary = null; engine.notify(); }}>Seguir</button>
            </div>
          </div>
        )}
      </main>

      <nav className="tabs">
        {tabs.map(([id, icon, label]) => (
          <button key={id} className={tab === id ? "sel" : ""} onClick={() => setTab(tab === id ? "mapa" : id)}>
            <span>{icon}</span>
            <small>{label}</small>
          </button>
        ))}
      </nav>
    </div>
  );
}
