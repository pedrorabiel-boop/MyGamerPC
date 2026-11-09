// Panel de la Jefatura: especialidades (puestos fijos), prioridades (Zipf) y aldeanos con tarea manual.
import { BUILDING_BY_ID, ROLE_BY_ID } from "../content";
import { engine, useEngine } from "../engine";
import { roleUnlocked } from "../sim/economy";
import {
  changeSpecialtyTarget, manualVillagers, movePriority, returnToJefatura, roleCap, setSpecialtyFull, specialtyConfig,
  specialtySlots, specialtyStaffed, specialtyTarget, specialtyTypes, zipfTargets, zonePool,
} from "../sim/jefatura";
import { zoneUnlocked } from "../sim/actions";
import { ZONES, ZONE_BY_ID } from "../sim/state";

export function JefaturaPanel() {
  const { s, ui } = useEngine();
  const zone = ui.zone;
  const multiZone = ZONES.filter((z) => zoneUnlocked(s, z.id)).length > 1;
  const types = specialtyTypes(s);
  const managedPool = zonePool(s, zone);
  const targets = zipfTargets(s, managedPool.length, zone);
  const visible = s.jefatura.priorities.filter((r) => roleUnlocked(s, r));
  const weightOf = (i: number) => (i === 0 ? "1" : `1/${i + 1}`);
  const manual = manualVillagers(s);
  const n = (fn: () => void) => () => { fn(); engine.notify(); };

  // Rango entre las categorías activas (las que tienen trabajo), para mostrar su peso real.
  const activeRank = new Map(visible.filter((r) => roleCap(s, r, zone) > 0).map((r, i) => [r, i]));

  return (
    <div className="jefatura">
      <p className="hint">
        🏛️ <b>Jefatura:</b> la tribu se reparte sola. Primero se llenan las especialidades que elijas; el resto se
        reparte entre las categorías según su prioridad (1, ½, ⅓…), y nadie va a donde no hay trabajo.
      </p>

      <h4>1 · Especialidades</h4>
      {types.length === 0 ? (
        <p className="hint">Todavía no hay edificios de especialistas (Círculo, Horno, Telar, Corral, Huerto).</p>
      ) : (
        <div className="list">
          {types.map((type) => {
            const def = BUILDING_BY_ID[type];
            const cfg = specialtyConfig(s, type);
            const slots = specialtySlots(s, type);
            const have = specialtyStaffed(s, type);
            const target = specialtyTarget(s, type);
            return (
              <div key={type} className="row">
                <span className="big">{def.staff!.icon}</span>
                <span className="grow">
                  <b>{def.staff!.title}</b>
                  <small>{def.name} · ocupados {have}/{slots}{have !== target ? ` → meta ${target}` : ""}</small>
                </span>
                <button className={"chip" + (cfg.full ? " sel" : "")} onClick={n(() => setSpecialtyFull(s, type, !cfg.full))}>Total</button>
                <button className="round" onClick={n(() => changeSpecialtyTarget(s, type, -1))} disabled={target === 0}>−</button>
                <span className="count">{target}</span>
                <button className="round" onClick={n(() => changeSpecialtyTarget(s, type, 1))} disabled={cfg.full || target >= slots}>+</button>
              </div>
            );
          })}
        </div>
      )}

      <h4>2 · Prioridades</h4>
      <p className="hint">
        {multiZone ? `📍 En ${ZONE_BY_ID[zone].label}: ` : ""}{managedPool.length} personas para repartir entre las categorías.
        {multiZone ? " Las prioridades valen para todas las zonas; cada zona reparte con su propio trabajo." : ""}
      </p>
      <div className="list">
        {visible.map((r, i) => {
          const role = ROLE_BY_ID[r];
          const working = roleCap(s, r, zone) > 0;
          const now = managedPool.filter((v) => v.role === r).length;
          const rank = activeRank.get(r);
          return (
            <div key={r} className={"row" + (working ? "" : " disabled")}>
              <span className="rank">{i + 1}</span>
              <span className="big">{role.icon}</span>
              <span className="grow">
                <b>{role.name}</b>
                <small>
                  {working
                    ? `peso ${weightOf(rank ?? i)} · meta ${targets.get(r) ?? 0} · ahora ${now}`
                    : `sin trabajo en ${ZONE_BY_ID[zone].label}: no recibe gente`}
                </small>
              </span>
              <button className="round" onClick={n(() => movePriority(s, r, -1))} disabled={i === 0} aria-label="Subir">↑</button>
              <button className="round" onClick={n(() => movePriority(s, r, 1))} disabled={i === visible.length - 1} aria-label="Bajar">↓</button>
            </div>
          );
        })}
      </div>

      <h4>3 · Con tarea manual ({manual.length})</h4>
      {manual.length === 0 ? (
        <p className="hint">Si tocas un aldeano y le das una tarea, queda fuera de la Jefatura y aparece aquí.</p>
      ) : (
        <>
          <div className="list">
            {manual.map((v) => (
              <div key={v.id} className="row">
                <span className="grow">
                  <b>✋ {v.name}</b>
                  <small>{v.role ? `${ROLE_BY_ID[v.role].icon} ${ROLE_BY_ID[v.role].name}` : "libre"}</small>
                </span>
                <button className="chip" onClick={n(() => returnToJefatura(s, v.id))}>Devolver</button>
              </div>
            ))}
          </div>
          <button className="chip wide" onClick={n(() => manual.forEach((v) => returnToJefatura(s, v.id)))}>Devolver a todos a la Jefatura</button>
        </>
      )}
    </div>
  );
}
