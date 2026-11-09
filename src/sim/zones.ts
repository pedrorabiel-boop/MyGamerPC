// Metas de población por zona: el jugador decide cuántos adultos quiere en la Cueva o en las
// Montañas, y el juego mantiene esa cantidad sola. Si alguien envejece (vuelve al Valle) o muere,
// se manda a otro; si la meta baja, se trae a alguien de vuelta. Las zonas se conectan por el Valle.
import { config } from "../config";
import { adultsIn, transferVillager, zoneUnlocked } from "./actions";
import { stageOf } from "./economy";
import type { GameState, ZoneId } from "./state";

/** Adultos que están en la zona (y no se van) más los que van en camino hacia ella. */
export function zoneCount(s: GameState, zone: ZoneId): number {
  return s.villagers.filter((v) => stageOf(v) === "adult" && (v.zone === zone ? !v.transit : v.transit === zone)).length;
}

export const zoneQuota = (s: GameState, zone: ZoneId) => s.zoneQuota[zone] ?? 0;

export function changeZoneQuota(s: GameState, zone: ZoneId, delta: number) {
  if (zone === "valle") return;
  s.zoneQuota[zone] = Math.max(0, zoneQuota(s, zone) + delta);
}

/** Cada cierto tiempo, manda o trae de a un adulto por zona hasta cumplir la meta. */
export function maintainZoneQuotas(s: GameState, dt: number) {
  s.zoneTimer -= dt;
  if (s.zoneTimer > 0) return;
  s.zoneTimer = config.JEFATURA_INTERVALO;
  for (const zone of Object.keys(s.zones) as ZoneId[]) {
    if (zone === "valle" || !zoneUnlocked(s, zone) || s.zoneQuota[zone] == null) continue;
    const have = zoneCount(s, zone), want = zoneQuota(s, zone);
    if (have < want) transferVillager(s, "valle", zone, true);
    else if (have > want) transferVillager(s, zone, "valle", true);
  }
}

/** Partidas anteriores: la meta de cada zona parte con la gente que ya hay ahí. */
export function migrateZoneQuotas(s: GameState) {
  s.zoneTimer ??= 0;
  if (s.zoneQuota) return;
  s.zoneQuota = {};
  for (const zone of Object.keys(s.zones) as ZoneId[]) {
    if (zone !== "valle") s.zoneQuota[zone] = adultsIn(s, zone).length;
  }
}
