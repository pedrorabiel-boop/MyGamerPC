// Zonas: selector arriba del mapa y ventana de traslado de aldeanos (al tocar la entrada de la cueva).
import { engine, useEngine } from "../engine";
import { adultsIn, travelingTo, zoneUnlocked } from "../sim/actions";
import { changeZoneQuota, zoneQuota } from "../sim/zones";
import { hasJefatura } from "../sim/jefatura";
import { ZONES, ZONE_BY_ID } from "../sim/state";

/** Pestañas Valle / Cueva sobre el mapa (aparece cuando hay más de una zona abierta). */
export function ZoneBar() {
  const { s, ui } = useEngine();
  const open = ZONES.filter((z) => zoneUnlocked(s, z.id));
  if (open.length < 2) return null;
  return (
    <div className="zonebar">
      {open.map((z) => (
        <button
          key={z.id}
          className={ui.zone === z.id ? "sel" : ""}
          onClick={() => { engine.ui.zone = z.id; engine.ui.selected = null; engine.ui.selectedBuilding = null; engine.ui.placing = null; engine.notify(); }}
        >
          {z.icon} {z.name} <small>{s.villagers.filter((v) => v.zone === z.id && !v.transit).length}</small>
        </button>
      ))}
      {ui.zone !== "valle" && (
        <button className="people-btn" onClick={() => { engine.ui.zoneModal = ui.zone; engine.notify(); }}>
          👥 Gente
        </button>
      )}
    </div>
  );
}

/**
 * Ventana de una zona: cuántos hay adentro, entrar a verla y la META de adultos (− / +).
 * La meta se mantiene sola: si alguien envejece o muere, se manda a otro desde el Valle.
 */
export function ZoneModal() {
  const { s, ui } = useEngine();
  const target = ui.zoneModal;
  if (!target) return null;
  const zone = ZONE_BY_ID[target];
  const inside = adultsIn(s, target).length;
  const coming = travelingTo(s, target);
  const leaving = s.villagers.filter((v) => v.transit === "valle" && v.zone === target).length;
  const available = adultsIn(s, "valle").filter((v) => v.workplace == null && !v.order).length;
  const quota = zoneQuota(s, target);
  const close = () => { engine.ui.zoneModal = null; engine.notify(); };
  const change = (d: number) => { changeZoneQuota(s, target, d); engine.notify(); };

  return (
    <div className="modal" onClick={close}>
      <div className="modal-box zone" onClick={(e) => e.stopPropagation()}>
        <h2>{zone.icon} {zone.name}</h2>
        <p>
          <b>{inside}</b> {inside === 1 ? "adulto adentro" : "adultos adentro"}
          {coming > 0 && <span className="muted"> · {coming} en camino</span>}
          {leaving > 0 && <span className="muted"> · {leaving} saliendo</span>}
        </p>
        <div className="transfer">
          <button className="round" onClick={() => change(-1)} disabled={quota === 0} aria-label="Bajar la meta">−</button>
          <div className="transfer-mid">
            <b>{quota}</b>
            <small>adultos en {zone.label}</small>
          </div>
          <button className="round" onClick={() => change(1)} aria-label="Subir la meta">+</button>
        </div>
        <p className="muted">
          Esta es la <b>meta</b>: el juego la mantiene solo. Si alguien envejece o muere, se manda a otro desde el Valle
          ({available} {available === 1 ? "disponible" : "disponibles"}); si bajas la meta, vuelven al Valle.
          Los niños y los ancianos viven en el Valle; los especialistas y los que tienen tarea manual no se mueven solos.
          {target === "montanas" ? " Las Montañas están lejos: lo que se junta ahí llega al 60%." : ""}
          {hasJefatura(s) ? " Adentro, la Jefatura los reparte según las prioridades de la zona." : " Adentro siguen en su categoría: si no tiene trabajo ahí, dan vueltas."}
        </p>
        {quota > inside + coming && available === 0 && (
          <p className="warn">No hay adultos libres en el Valle para cumplir la meta.</p>
        )}
        <div className="inline">
          {ui.zone !== target && (
            <button className="primary" onClick={() => { engine.ui.zone = target; engine.ui.selected = null; engine.ui.selectedBuilding = null; close(); }}>
              Entrar a mirar
            </button>
          )}
          {ui.zone === target && (
            <button className="primary" onClick={() => { engine.ui.zone = "valle"; engine.ui.selected = null; engine.ui.selectedBuilding = null; close(); }}>
              Volver a mirar el Valle
            </button>
          )}
          <button onClick={close}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
