/* merlin · build
 *
 * uma pagina HTML por assunto continua sendo a unidade do sistema — o que muda
 * e que o JS de cada uma vive ao lado, em src/, e passa pelo Vite. cada HTML
 * da raiz e uma entrada: o build cospe os mesmos nomes de arquivo em
 * server/site/, que e a pasta que o Worker serve.
 */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/* as entradas sao os HTML da raiz que ja tem um modulo em src/. nada de lista
   fixa: pagina nova entra no build so por existir com o seu par. o que estiver
   sem par e avisado em vez de sumir em silencio. */
const html = readdirSync(import.meta.dirname).filter((n) => n.endsWith(".html") && !n.startsWith("_"));
/* MERLIN_ONLY=week,ideas limita o build a essas paginas. serve para trabalhar
   numa pagina so sem esperar (nem quebrar por causa) das outras. */
const only = (process.env.MERLIN_ONLY || "").split(",").map((s) => s.trim()).filter(Boolean);
const pages = {};
for (const file of html) {
  const name = file.replace(/\.html$/, "");
  if (only.length && !only.includes(name)) continue;
  if (existsSync(resolve(import.meta.dirname, "src", name + ".jsx"))) pages[name] = resolve(import.meta.dirname, file);
  else console.warn("· " + file + " ficou de fora do build: falta src/" + name + ".jsx");
}

export default defineConfig({
  plugins: [react()],
  build: {
    /* sai direto onde o worker le. o site.mjs sumiu: nao ha mais copia. */
    outDir: "server/site",
    emptyOutDir: true,
    rollupOptions: { input: pages },
    /* um sistema de uma pessoa nao precisa de source map em producao, mas o
       de desenvolvimento ajuda quando algo quebra so no navegador dela */
    sourcemap: false,
    target: "es2022"
  },
  server: { port: 8765, strictPort: true }
});
