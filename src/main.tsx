import { createRoot } from "react-dom/client";
import { engine } from "./engine";
import { App } from "./ui/App";
import "./ui/styles.css";

engine.start();
// En desarrollo, el motor queda accesible desde la consola del navegador (window.engine).
if (import.meta.env.DEV) (window as unknown as { engine: typeof engine }).engine = engine;
createRoot(document.getElementById("root")!).render(<App />);
