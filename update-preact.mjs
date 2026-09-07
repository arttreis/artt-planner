/* copia o Preact (com hooks e htm, num arquivo so) do node_modules para
   shared/preact.js. nao e build: e uma copia, com cabecalho dizendo a
   versao. rode depois de "npm install" quando quiser subir de versao.

   por que o standalone do htm, e nao os tres arquivos do preact: os modulos
   do preact importam "preact" pelo nome, e o navegador nao resolve nome sem
   import map. o standalone ja vem com tudo dentro e nao importa nada. */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const raiz = import.meta.dirname;
const versao = (p) => JSON.parse(readFileSync(join(raiz, "node_modules", p, "package.json"), "utf8")).version;
const fonte = join(raiz, "node_modules/htm/preact/standalone.module.js");
const destino = join(raiz, "shared/preact.js");

const cabecalho =
  "/* merlin · preact " + versao("preact") + " + htm " + versao("htm") + " (htm/preact/standalone)\n" +
  " * copiado do node_modules por update-preact.mjs — nao edite a mao.\n" +
  " * e a unica dependencia de tela do sistema: sem build, sem CDN. */\n";
writeFileSync(destino, cabecalho + readFileSync(fonte, "utf8"));
console.log("shared/preact.js: preact " + versao("preact") + ", htm " + versao("htm"));
