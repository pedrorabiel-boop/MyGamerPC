// Modo debug para playtests: velocidad, recursos infinitos o fijos, desbloquear tecnologías,
// perillas de ritmo en vivo y manejo de partidas.
import { useState } from "react";
import { config, DEFAULT_CONFIG, type ConfigKey } from "../config";
import { RESOURCES, type ResId } from "../content";
import { ERAS } from "../data/tree";
import { engine, useEngine } from "../engine";
import {
  debugAddVillagers, debugResetTechs, debugSetAmount, debugToggleInfinite, debugUnlockUpToEra,
} from "../sim/actions";
import { exportSave, parseSave, simulateOffline } from "../sim/save";
import { formatNumber } from "./format";

const SPEEDS = [0, 1, 10, 100];

export function DebugPanel() {
  const { s, speed } = useEngine();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [era, setEra] = useState(2);
  const [hours, setHours] = useState("8");
  const [saveText, setSaveText] = useState("");

  const setAmount = (res: ResId) => {
    const v = Number(drafts[res]);
    if (!Number.isFinite(v)) return;
    debugSetAmount(s, res, v);
    engine.notify();
  };

  return (
    <div className="debug">
      <h4>⏱ Velocidad</h4>
      <div className="seg">
        {SPEEDS.map((x) => (
          <button key={x} className={speed === x ? "sel" : ""} onClick={() => { engine.speed = x; engine.notify(); }}>
            {x === 0 ? "⏸ Pausa" : `×${x}`}
          </button>
        ))}
      </div>

      <h4>📖 Tecnologías</h4>
      <label className="check">
        <input
          type="checkbox"
          checked={s.debug.unlockOnTap}
          onChange={(e) => { s.debug.unlockOnTap = e.target.checked; engine.notify(); }}
        />
        Desbloquear al tocar una página del Libro (ignora costos, requisitos y eras)
      </label>
      <div className="inline">
        <span>Desbloquear todo hasta la era</span>
        <select value={era} onChange={(e) => setEra(Number(e.target.value))}>
          {ERAS.map((e) => <option key={e.id} value={e.id}>{e.id}. {e.name}</option>)}
        </select>
        <button onClick={() => { debugUnlockUpToEra(s, era); engine.notify(); }}>Desbloquear</button>
      </div>
      <button onClick={() => { debugResetTechs(s); engine.notify(); }}>Reiniciar tecnologías</button>

      <h4>📦 Recursos</h4>
      <p className="hint">Escribe una cantidad y toca «Fijar», o activa ∞ para que no se gaste ni tenga límite.</p>
      <table className="res-table">
        <tbody>
          {RESOURCES.map((r) => (
            <tr key={r.id}>
              <td>{r.icon} {r.name}</td>
              <td className="num">{s.debug.infinite[r.id] ? "∞" : formatNumber(s.inv[r.id])}</td>
              <td>
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="cantidad"
                  value={drafts[r.id] ?? ""}
                  onChange={(e) => setDrafts({ ...drafts, [r.id]: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && setAmount(r.id)}
                />
              </td>
              <td><button onClick={() => setAmount(r.id)}>Fijar</button></td>
              <td>
                <button className={s.debug.infinite[r.id] ? "sel" : ""} onClick={() => { debugToggleInfinite(s, r.id); engine.notify(); }}>∞</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="inline">
        <button onClick={() => { for (const r of RESOURCES) s.debug.infinite[r.id] = true; engine.notify(); }}>Todo ∞</button>
        <button onClick={() => { s.debug.infinite = {}; engine.notify(); }}>Quitar todos los ∞</button>
      </div>

      <h4>👥 Población</h4>
      <div className="inline">
        <button onClick={() => { debugAddVillagers(s, 1); engine.notify(); }}>+1 adulto</button>
        <button onClick={() => { debugAddVillagers(s, 5); engine.notify(); }}>+5 adultos</button>
        <button onClick={() => { debugAddVillagers(s, 20); engine.notify(); }}>+20 adultos</button>
      </div>

      <h4>🎛 Perillas de ritmo (en vivo)</h4>
      <p className="hint">Cambian el balance al instante. Se reinician al recargar la página.</p>
      <table className="res-table">
        <tbody>
          {(Object.keys(config) as ConfigKey[]).map((k) => (
            <tr key={k} className={config[k] !== DEFAULT_CONFIG[k] ? "changed" : ""}>
              <td className="mono">{k}</td>
              <td>
                <input
                  type="number"
                  step="any"
                  defaultValue={config[k]}
                  onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v)) config[k] = v; }}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h4>💾 Partida</h4>
      <div className="inline">
        <span>Simular offline</span>
        <input type="number" value={hours} onChange={(e) => setHours(e.target.value)} style={{ width: 60 }} />
        <span>horas</span>
        <button
          onClick={() => {
            engine.offlineSummary = simulateOffline(s, Number(hours) * 3600);
            engine.notify();
          }}
        >
          Simular
        </button>
      </div>
      <div className="inline">
        <button onClick={() => { const t = exportSave(s); setSaveText(t); navigator.clipboard?.writeText(t).catch(() => {}); engine.toast("Partida copiada al portapapeles."); }}>Exportar</button>
        <button onClick={() => { const p = parseSave(saveText); if (p) { engine.replaceState(p); engine.toast("Partida importada."); } else engine.toast("Ese texto no es una partida válida."); }}>Importar</button>
        <button className="danger" onClick={() => { if (confirm("¿Borrar la partida y empezar de cero?")) engine.newGame(); }}>Nueva partida</button>
      </div>
      <textarea value={saveText} onChange={(e) => setSaveText(e.target.value)} placeholder="Aquí aparece la partida exportada, o pega una para importarla." rows={3} />
    </div>
  );
}
