/* copia o que e publico da raiz para site/: as paginas e compartilhado/.
   a raiz segue sendo a fonte unica; site/ e so o que sobe com o worker. */
import { mkdirSync, copyFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

const raiz = join(import.meta.dirname, "..");
const destino = join(import.meta.dirname, "site");

/* nao apaga a pasta inteira: com o wrangler dev rodando ela esta aberta e o
   Windows recusa. sobrescreve arquivo a arquivo e tira so o que sobrou. */
mkdirSync(join(destino, "compartilhado"), { recursive: true });

const paginas = readdirSync(raiz).filter((n) => n.endsWith(".html") && !n.startsWith("_"));
paginas.forEach((n) => copyFileSync(join(raiz, n), join(destino, n)));

const comp = join(raiz, "compartilhado");
/* o LEIA.md e documentacao de quem mexe no codigo, nao do produto */
const comuns = readdirSync(comp).filter((n) => statSync(join(comp, n)).isFile() && !n.endsWith(".md"));
comuns.forEach((n) => copyFileSync(join(comp, n), join(destino, "compartilhado", n)));

readdirSync(destino).forEach((n) => {
  const alvo = join(destino, n);
  if (statSync(alvo).isFile() && !paginas.includes(n)) rmSync(alvo, { force: true });
});
readdirSync(join(destino, "compartilhado")).forEach((n) => {
  if (!comuns.includes(n)) rmSync(join(destino, "compartilhado", n), { force: true });
});

console.log("site/ atualizado: " + paginas.join(", ") + " + compartilhado/");
