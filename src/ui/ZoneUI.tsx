// Zonas: selector arriba del mapa y ventana de traslado de aldeanos (al tocar la entrada de la cueva).
import { engine, useEngine } from "../engine";
import { adultsIn, transferVillager, travelingTo, zoneUnlocked } from "../sim/actions";
import { hasJefatura } from "../sim/jefatura";
import { ZONES, ZONE_BY_ID, type ZoneId } from "../sim/state";

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
    </div>
  );
}

/** Ventana de la Cueva: cuántos hay adentro, entrar a verla y mandar o traer aldeanos (+ / −). */
export function ZoneModal() {
  const { s, ui } = useEngine();
  const target = ui.zoneModal;
  if (!target) return null;
  const other: ZoneId = target === "valle" ? "cueva" : "valle";
  const zone = ZONE_BY_ID[target];
  const inside = adultsIn(s, target).length;
  const coming = travelingTo(s, target);
  const leaving = s.villagers.filter((v) => v.transit === other && v.zone === target).length;
  const available = adultsIn(s, other).filter((v) => v.workplace == null && !v.order).length;
  const close = () => { engine.ui.zoneModal = null; engine.notify(); };
  const move = (from: ZoneId, to: ZoneId) => {
    const err = transferVillager(s, from, to);
    if (err) engine.toast(err);
    engine.notify();
  };

  return (
    <div className="modal" onClick={close}>
      <div className="modal-box zone" onClick={(e) => e.stopPropagation()}>
        <h2>{zone.icon} {zone.name}</h2>
        <p>
          <b>{inside}</b> {inside === 1 ? "aldeano adentro" : "aldeanos adentro"}
          {coming > 0 && <span className="muted"> · {coming} en camino</span>}
          {leaving > 0 && <span className="muted"> · {leaving} saliendo</span>}
        </p>
        <div className="transfer">
          <button className="round" onClick={() => move(target, other)} disabled={inside === 0} aria-label="Traer de vuelta">−</button>
          <div className="transfer-mid">
            <b>{inside + coming}</b>
            <small>enviados a {zone.label}</small>
          </div>
          <button className="round" onClick={() => move(other, target)} disabled={available === 0} aria-label="Enviar">+</button>
        </div>
        <p className="muted">
          + manda un adulto desde {ZONE_BY_ID[other].label} ({available} {available === 1 ? "disponible" : "disponibles"}); − trae uno de vuelta.
          Los niños y los ancianos se quedan en el Valle; los especialistas no se mueven de su puesto.
          {hasJefatura(s) ? " Adentro, la Jefatura los reparte según el trabajo que haya ahí." : " Adentro siguen en su categoría: si no tiene trabajo ahí, dan vueltas."}
        </p>
        <div className="inline">
          {ui.zone !== target && (
            <button className="primary" onClick={() => { engine.ui.zone = target; engine.ui.selected = null; engine.ui.selectedBuilding = null; close(); }}>
              Entrar a mirar
            </button>
          )}
          {ui.zone === target && target !== "valle" && (
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
