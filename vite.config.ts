import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./",
  // host: true permite abrir el juego desde el celular en la misma red wifi (playtests).
  server: { host: true, port: 5173 },
});
