# shared/ · como um módulo do Merlin é feito

Cada módulo é **uma página HTML** na raiz (`ideas.html`, `clients.html`…), com CSS e JS
inline, legível inteira, sem build e sem CDN. A tela é desenhada com o Preact (com `htm` no
lugar de JSX), que mora aqui dentro. O que é comum vive aqui:

- `base.css` — tokens dos dois temas (escuro no `:root`, claro em `html.light`), a sidebar
  (via `shell.css`), e os componentes: `.block`, `.pill`, `.chip`, `.badge`, `.input`,
  `.line`, `.table`, `.dialog`, `.notice`, `.meter`, `.bar`, `.tabs`, `.grid`/`.col-*`.
- `core.js` — os **dados**: tema, sidebar, sessão/nuvem, coleções sincronizadas, frentes,
  caixa de entrada do dia, aviso com desfazer, markdown. Não desenha tela de módulo.
- `preact.js` — Preact + hooks + htm num arquivo só, copiado do `node_modules` por
  `npm run preact` (na raiz). Não se edita.
- `ui.js` — a **tela**: hooks que ligam a página às coleções, componentes comuns, ícones
  como vnode e a **casca** (sidebar, busca, tema, nuvem, entrar, aviso). É o que uma página
  importa para desenhar. Ele se registra no core com `setShellRenderer`, e é por isso que
  `initPage(id)` — que vem do core — já monta a casca.

Identificadores, chaves, campos e classes são em inglês; texto de tela e comentários, em
português. O dicionário completo está em [`MIGRATION.md`](../MIGRATION.md).

## Esqueleto de uma página

```html
<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0d0d0d">
<title>merlin · ideias</title>
<link rel="icon" href="data:image/svg+xml,...">  <!-- copie o do index.html -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="shared/base.css">
<script>/* anti-flash do tema: antes de qualquer pintura */
try{var t=localStorage.getItem("merlin:theme");if(t?t==="light":matchMedia("(prefers-color-scheme: light)").matches)document.documentElement.classList.add("light")}catch(e){}</script>
<style>/* só o que é deste módulo */</style>
</head>
<body>
<main class="page" id="app"></main>
<script type="module">
import { initPage, newId, today, notify, sendToDay } from "./shared/core.js";
import { html, mount, useState, useCollection, useFronts, useHash, useFields,
         Form, Field, Dialog, Markdown, FrontBadge, ClientBadge, frontOptionList, clientOptionList, icon }
  from "./shared/ui.js";

initPage("ideas");   // monta a sidebar, carrega frentes e clientes, retoma a sessão

const normalize = (d) => ({ ...d, title: String(d.title || "") });

function Ideas() {
  const ideas = useCollection("ideas", { normalize });   // redesenha a cada mudança
  const [form, setForm] = useState(null);
  return html`
    <div class="header">
      <div><h1>ideias</h1><p class="sub">o que ainda não é tarefa</p></div>
      <div class="actions"><button class="pill pill--green" type="button" onClick=${() => setForm({})}>${icon("plus")}ideia</button></div>
    </div>
    ${ideas.all().length ? html`<ul>${ideas.all().map((d) => html`<li key=${d.id}>${d.title}</li>`)}</ul>`
                         : html`<p class="empty">Nada aqui. O "+" abre uma ideia nova.</p>`}
    ${form && html`<${IdeaForm} ideas=${ideas} onClose=${() => setForm(null)}/>`}`;
}
mount(html`<${Ideas}/>`, "app");
</script>
</body>
</html>
```

O `html` é o `htm`: parece HTML, é JavaScript. `${x}` é sempre texto (escapado); componente
é `<${Comp} prop=${v}>…<//>`; atributos espalhados são `...${obj}`; `class` funciona.

## `core.js` — o que uma página importa

| o quê | para quê |
| --- | --- |
| `initPage(id)` | sidebar, frentes, clientes, sessão. `id` é `day, week, ideas, clients, funnels, maps, finance` |
| `collection(type, {normalize})` | fora de componente; dentro use `useCollection` |
| `newId()`, `today()`, `dayOf(date)`, `isDay(v)`, `dateOf(day)`, `addDays(day, n)`, `mondayOf(day)` | datas como `YYYY-MM-DD` |
| `dateLabel(day, withYear?)`, `weekdayOf(day)`, `monthLabel("YYYY-MM")` | rótulos |
| `brl(cents, sign?)`, `parseMoney(text)` | dinheiro em centavos |
| `formatMin(min)`, `parseDuration(text) → {min, title}` | duração no fim do texto |
| `parseMentions(text) → {front, client, title}` | `@frente` e `@cliente` no texto |
| `notify(text, undo?)` | aviso com desfazer |
| `sendToDay({title, min, front, client, origin:{type, id}})` | manda para o dia |
| `api(route, options) → {ok, status, body}` | fala com o worker |
| `md(text)` | markdown mínimo (use `<${Markdown}>`) |
| `listFronts()`, `listClients()`, `clientName(id)`, `frontColor(id)`, `foldKey(text)` | leitura |
| `ICONS` | fonte dos ícones (use `icon("plus")`) |

## `ui.js` — hooks e componentes

| o quê | para quê |
| --- | --- |
| `mount(vnode, "app")` | desenha a raiz dentro do elemento |
| `useCollection(type, {normalize})` | a coleção, redesenhando a cada mudança (local, nuvem, outra aba) |
| `useFronts()`, `useClients()` | as listas, redesenhando quando mudam |
| `useCloud()` | `signedIn`, `email`, `status` |
| `useHash()` | o `#id` da URL, acompanhando o `hashchange` |
| `useKeydown(handler)` | atalho no documento; o handler é sempre o atual, sem deps. Use `isTyping()` para não disparar dentro de um campo |
| `setHash(id)` | troca o `#id` sem empilhar histórico, avisando o `useHash` |
| `useFields(initial)` → `[values, bind, set]` | formulário controlado: `<input ...${bind("title")}>`, checkbox com `bind("x", "check")` |
| `<${Form} title sub? wide? submit? remove? onSubmit onRemove? onClose>` | todo "criar X" e "editar X". `onSubmit(form)` devolvendo `false` mantém aberta |
| `<${Field} label full?>` | um campo com rótulo dentro do formulário |
| `<${Dialog} title wide? onClose actions?>` | caixa modal para o que não é formulário |
| `<${Markdown} text class? tag? …>` | markdown mínimo do core; o único lugar com `innerHTML` |
| `<${Meter} label value class?>` | o número grande com legenda |
| `<${MoneyInput} value onChange>` | dinheiro em centavos; só reformata ao sair do campo |
| `<${NewItemRow} placeholder button onAdd>` | "novo item" no pé de uma lista, Enter adiciona |
| `<${FrontBadge} id>`, `<${ClientBadge} id>` | os selos |
| `frontOptionList("sem frente")`, `clientOptionList("sem cliente", front?)` | `<option>`s; o escolhido vai no `value` do `<select>` |
| `icon("plus")`, `svg(text)` | ícone como vnode |

Ícones em `ICONS`: `trash, arrow, plus, check, pencil, link, grip, x, clock, map, spark,
archive, arrowLeft, chevronLeft, chevronRight, unfold`.

## Coleções (`collection(type, {normalize})`)

- `all()` → array de documentos vivos (sem os apagados).
- `get(id)`, `has(id)`.
- `save(doc)` → grava, carimba `v`, salva no localStorage, agenda subida, avisa. `doc.id` é
  obrigatório (use `newId()`). Devolve o doc gravado.
- `saveMany(docs)` → o mesmo, com um aviso só.
- `remove(id)` → grava um túmulo `{id, deleted:true}` e devolve o doc anterior (para desfazer
  com `save(before)`).
- `onChange(fn)` → chama `fn(origin)` a cada mudança. `useCollection` já assina por você.
- Nunca escreva no `localStorage` por conta própria. A chave `merlin:<type>` é do core.
- A coleção é uma só por tipo. Se o core já a abriu (ele abre `fronts` e `clients` em
  `initPage`), chamar `collection(type, {normalize})` de novo entrega o normalizador à
  coleção existente — a ordem das chamadas não importa.

Um documento é um objeto JSON plano. Coloque nele o que o módulo precisa, mas mantenha
**estes campos com estes nomes** quando fizerem sentido, porque outros módulos leem:

| campo | tipo | significado |
| --- | --- | --- |
| `id` | string | do `newId()` |
| `front` | string | id de uma frente (`listFronts()`), ou `""` |
| `client` | string | id de um cliente (`listClients()`), ou `""` |
| `createdAt` | number | epoch ms |
| `updatedAt` | number | epoch ms |
| `deleted` | boolean | só o core escreve |

### Tipos de coleção e dono

| tipo | dono | forma mínima que outros módulos leem |
| --- | --- | --- |
| `fronts` | core | `{id, name, color (1-6), order}` |
| `clients` | clients.html | `{id, name, front, status, channels:[{id, type, name, items:[{id, text, done}]}], goals:[…], backlog:[…], journal:[…], contract:{…}, contacts:[…], links:[…], offers:[…]}` |
| `ideas` | ideas.html | `{id, title, body, stage, front, client, steps:[{id, text, done}], outputs:[{type, id, at}], history:[{type:'stage', from, to, at}]}` |
| `week` | week.html | `{id, title, day ('YYYY-MM-DD' ou 'weekend:YYYY-MM-DD' da segunda), front, client, min, done, recurring}` |
| `maps` | maps.html | `{id, name, root:{id, title, note, color, collapsed, children:[…]}, front, client, idea, funnel}` |
| `funnels` | funnels.html | `{id, name, client, channel, front, nodes:[{id, type, title, x, y, fields:{}, number}], edges:[{from, to}], creatives:[…], automations:[…], offers:[…], triggers:[…], snapshots:[…]}` |
| `finance` | finance.html | vários docs: `{id, type:'entry'|'fixed'|'card'|'debt'|'config', …}` (`card` é uma compra parcelada: `{name, card, total, installments, start:'YYYY-MM', dayOfMonth}`) |
| `vault` | clients.html | um doc `{id:'config', salt}` — só o sal do cofre; o segredo vai cifrado dentro do cliente |
| `habits` | habits.html | `{id, name, front, schedule:{type:'daily'|'perWeek'|'weekdays', times, weekdays:[0-6]}, min, color, order, archived, marks:{'YYYY-MM-DD':true}}` |
| `plans` | plans.html | um doc por período, id `kind:period`: `{id, kind:'quarter'|'month'|'week', period:'2026-Q4'|'2026-09'|'2026-W37', goals:[{id, text, front, client, done, parent, card, order}], review:{went, didnt, next}}` |

Ligações entre módulos são **por id**, nunca por cópia. Para abrir outra página num item:
`clients.html#<id>`, `maps.html#<id>`, `funnels.html#<id>`, `ideas.html#<id>`. Cada
página lê o hash (`useHash()`) e abre o item, se existir.

## Criar é um botão e uma caixa

Todo "novo X" é um `<${Form}>` que só existe enquanto há estado para ele
(`form && html\`<${XForm} …/>\``). Dentro, `useFields` guarda os valores e `bind(name)`
espalha `value`/`onInput` nos campos. `onSubmit` lê os valores do estado, grava na coleção e
devolve `false` para manter a caixa aberta (reclamando com `notify`). `Esc`, o ✕,
"cancelar" e o clique fora fecham. Criar e editar são a mesma caixa.

Nenhuma tela tem formulário aberto no meio da lista, e nenhuma tela tem filtro.

## Mandar para o dia

`sendToDay({title, min, front, client, origin:{type, id}})`. Com `min`, vira tarefa na
fila de hoje; sem `min`, vai para a caixa de ideias do dia (onde ganha duração). Nada mais
toca no documento do dia. O aviso já é mostrado pelo core.

## Regras de casa

- Português do Brasil em tudo que aparece na tela e nos comentários. Minúsculas nos rótulos,
  como o resto do sistema ("ideias", "puxar para o dia"). Sem emoji na interface.
- **Inglês em todo identificador**: variável, função, componente, prop, chave, campo, classe
  de CSS, id de elemento, nome de arquivo.
- Sem build, sem CDN. O Preact local é a única dependência de tela.
- Nada de `innerHTML` nem de HTML por string: `${x}` no `html\`\`` já é texto. O markdown
  passa por `<${Markdown}>`. Se sentiu falta de `escapeHtml()`, o caminho está errado.
- Estado de tela é `useState`; nada de variável de módulo com `render()` depois.
- `key` em toda lista, com o `id` do documento.
- Eventos nos elementos (`onClick=${…}`). Arrastar e soltar é a exceção aceita para
  `closest()`.
- Canvas e SVG desenhados à mão ficam num componente com `useRef`; o desenho continua
  imperativo por dentro.
- Nada de vermelho: o sistema é monocromático + um verde. Negativo é `--ink-50` ou hachura.
- Toda ação destrutiva passa por `notify(text, undo)`.
- Responsivo: no celular a página vira uma coluna. Nada rola horizontal fora de
  `.table-scroll` ou de um canvas.
- Atalhos de teclado onde faz sentido; `Esc` fecha diálogos.
- Estado vazio explica o que a tela faz em uma frase, sem tutorial.
- Minimalismo antes de tudo: sem filtros, sem formulário aberto na tela, um botão "+" por
  coisa que se cria. A busca global da sidebar substitui qualquer filtro por nome.
- Comentários no código explicam **por quê**, não o quê, como no `index.html`.
