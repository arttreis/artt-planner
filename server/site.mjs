/* copia o que e publico da raiz para site/: as paginas e shared/.
   a raiz segue sendo a fonte unica; site/ e so o que sobe com o worker. */
import { mkdirSync, copyFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const target = join(import.meta.dirname, "site");

/* nao apaga a pasta inteira: com o wrangler dev rodando ela esta aberta e o
   Windows recusa. sobrescreve arquivo a arquivo e tira so o que sobrou. */
mkdirSync(join(target, "shared"), { recursive: true });

const pages = readdirSync(root).filter((n) => n.endsWith(".html") && !n.startsWith("_"));
pages.forEach((n) => copyFileSync(join(root, n), join(target, n)));

const sharedDir = join(root, "shared");
/* o README e documentacao de quem mexe no codigo, nao do produto */
const sharedFiles = readdirSync(sharedDir).filter((n) => statSync(join(sharedDir, n)).isFile() && !n.endsWith(".md"));
sharedFiles.forEach((n) => copyFileSync(join(sharedDir, n), join(target, "shared", n)));

readdirSync(target).forEach((n) => {
  const path = join(target, n);
  if (statSync(path).isFile() && !pages.includes(n)) rmSync(path, { force: true });
});
readdirSync(join(target, "shared")).forEach((n) => {
  if (!sharedFiles.includes(n)) rmSync(join(target, "shared", n), { force: true });
});

console.log("site/ atualizado: " + pages.join(", ") + " + shared/");
