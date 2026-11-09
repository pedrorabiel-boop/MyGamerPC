import { useState } from "react";
import { MANIFESTATION_ICONS, ERAS, IMPLEMENTED_ERAS, TECHS, TECH_BY_ID, techCost } from "../data/tree";
import { engine, useEngine } from "../engine";
import { study, techStatus, unlock } from "../sim/actions";
import { amount } from "../sim/economy";
import { mdToHtml } from "./format";
import { ResourceGuide } from "./ResourceGuide";

const STATUS_LABEL = {
  sellada: "Sellada",
  legible: "Faltan requisitos",
  estudiable: "Estudiable",
  comprendida: "APROBADO",
} as const;

export function BookPanel() {
  const { s } = useEngine();
  const [openId, setOpenId] = useState<string | null>(null);
  const debugTap = s.debug.unlockOnTap;
  const visibleEras = ERAS.filter((e) => e.id <= Math.max(s.erasOpen + 1, debugTap ? ERAS.length : 0));

  const onTap = (id: string) => {
    if (debugTap) {
      if (s.techs[id]) delete s.techs[id];
      else unlock(s, id);
      engine.notify();
      return;
    }
    setOpenId(openId === id ? null : id);
  };

  const bookTab = engine.ui.bookTab;
  const tabs = (
    <div className="seg booktabs">
      <button className={bookTab === "tecnologias" ? "sel" : ""} onClick={() => { engine.ui.bookTab = "tecnologias"; engine.notify(); }}>📜 Tecnologías</button>
      <button className={bookTab === "recursos" ? "sel" : ""} onClick={() => { engine.ui.bookTab = "recursos"; engine.notify(); }}>📦 Recursos</button>
    </div>
  );
  if (bookTab === "recursos") return <div className="book">{tabs}<ResourceGuide /></div>;

  return (
    <div className="book">
      {tabs}
      <p className="hint">
        {debugTap
          ? "🐞 Modo debug: tocar una página la desbloquea (o la vuelve a bloquear)."
          : "Estudia páginas con 💡 Comprensión. Toca el botón 📖 del mapa para generarla."}
      </p>
      {visibleEras.map((era) => (
        <section key={era.id}>
          <h3>
            {era.id}. {era.name}
            {era.id > s.erasOpen && <span className="sealed"> — sellada</span>}
            {era.id > IMPLEMENTED_ERAS && <span className="sealed"> (efectos aún no implementados)</span>}
          </h3>
          {era.milestone.name && era.milestone.name !== "inicio" && (
            <p className="milestone">
              Hito «{era.milestone.name}»: {era.milestone.requires.map((r) => TECH_BY_ID[r].name).join(", ")}
              {era.milestone.population ? ` · ${era.milestone.population} habitantes` : ""}
            </p>
          )}
          <div className="pages">
            {TECHS.filter((t) => t.era === era.id).map((t) => {
              const st = techStatus(s, t.id);
              const cost = techCost(t);
              const open = openId === t.id;
              return (
                <div key={t.id} className={`page ${st}`} onClick={() => onTap(t.id)}>
                  <div className="page-top">
                    <span className="page-name">{st === "sellada" && !debugTap ? "▒▒▒▒▒▒" : t.name}</span>
                    <span className="page-status">{st === "estudiable" ? `💡 ${cost}` : STATUS_LABEL[st]}</span>
                  </div>
                  <div className="page-icons">
                    {[...new Set(t.manifestations.map((m) => MANIFESTATION_ICONS[m.type] ?? ""))].join(" ")}
                    {t.optional && " 🌿"}
                  </div>
                  {open && (
                    <div className="page-detail" onClick={(e) => e.stopPropagation()}>
                      <p dangerouslySetInnerHTML={{ __html: mdToHtml(t.effect || "—") }} />
                      {t.requires.length > 0 && (
                        <p className="req">
                          Requiere:{" "}
                          {t.requires.map((r) => (
                            <span key={r} className={s.techs[r] ? "ok" : "missing"}>{TECH_BY_ID[r].name} </span>
                          ))}
                          {typeof t.requiresPopulation === "number" && <span> · {t.requiresPopulation} habitantes</span>}
                        </p>
                      )}
                      {st === "estudiable" && (
                        <button
                          className="primary"
                          disabled={amount(s, "comprension") < cost}
                          onClick={() => { if (!study(s, t.id)) engine.toast("No alcanza la Comprensión."); engine.notify(); }}
                        >
                          Estudiar (💡 {cost})
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
