import type { ResId } from "../content";
import { amount, has } from "../sim/economy";
import type { GameState } from "../sim/state";

/** Antes de N09 Conteo, la tribu no sabe contar: los recursos se ven como palabras. */
export function qty(s: GameState, res: ResId): string {
  if (s.resolved[res]) return "✅ resuelto";
  const n = amount(s, res);
  if (n === Infinity) return "∞";
  if (res === "comprension" || has(s, "N09")) return formatNumber(n);
  if (n < 1) return "nada";
  if (n < 5) return "pocos";
  if (n < 15) return "algunos";
  if (n < 40) return "muchos";
  return "montones";
}

export function formatNumber(n: number): string {
  if (n === Infinity) return "∞";
  if (n < 1000) return String(Math.floor(n));
  if (n < 1e6) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
}

/** Markdown mínimo de los textos del árbol: **negrita** y *cursiva*. */
export function mdToHtml(text: string): string {
  return text
    .replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!))
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>");
}
