import { BUILDINGS, RES_BY_ID, type ResId } from "../content";
import { engine, useEngine } from "../engine";
import { canAfford, has } from "../sim/economy";

export function BuildPanel({ onPick }: { onPick: () => void }) {
  const { s } = useEngine();
  const available = BUILDINGS.filter((b) => b.unlockedBy && has(s, b.unlockedBy));
  if (!available.length) return <p className="hint">Todavía no sabes construir nada. Estudia el Libro (Fuego, Refugio…).</p>;
  return (
    <div className="list">
      {available.map((b) => {
        const ok = canAfford(s, b.cost);
        return (
          <button
            key={b.id}
            className={"row" + (ok ? "" : " disabled")}
            onClick={() => {
              if (!ok) { engine.toast("No alcanzan los materiales."); return; }
              engine.ui.placing = b.id;
              engine.toast(`Toca una casilla marcada para colocar: ${b.name}.`);
              onPick();
            }}
          >
            <span className="big">{b.icon}</span>
            <span className="grow">
              <b>{b.name}</b>
              <small>{b.desc}</small>
            </span>
            <span className="cost">
              {Object.entries(b.cost).map(([r, a]) => (
                <span key={r}>{RES_BY_ID[r as ResId].icon}{a} </span>
              ))}
            </span>
          </button>
        );
      })}
    </div>
  );
}
