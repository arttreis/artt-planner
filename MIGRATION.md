# Merlin · as duas migrações

Este documento é a fonte do que mudou, em que ordem, e como saber que cada passo terminou. O
que está aqui é o que o código faz; o que não está, não faz parte da migração.

São duas migrações no mesmo dia, 07/09/2026:

1. **De HTML por string para o Preact, e de português para inglês** (seções 1 a 9). Decidida de
   madrugada, executada enquanto o Arthur dormia, e no ar ao meio-dia.
2. **Do Preact para o React 19 com Vite e JSX** (seção 10). Decidida à tarde, depois de ele
   perguntar por que não tinha sido React desde o começo.

A primeira resolveu o problema real: escape manual, redesenho que matava o foco, e nada que
compusesse. A segunda trocou a peça que resolvia isso por outra equivalente, com um passo de
build — foi escolha de ferramenta, não conserto de defeito.

---

## 1. Por quê

As sete páginas desenhavam a tela montando HTML por string e trocando o `innerHTML`.
Funcionava, mas cobrava três preços que só cresciam:

- **Escape manual.** Toda string do usuário passava por `escapar()` antes de virar HTML. Eram
  dezenas de pontos por página, e um esquecido é script executando a partir de um título.
- **Redesenhar tudo apaga o estado do DOM.** Cada `render()` reescrevia o bloco inteiro e
  perdia foco, cursor e rolagem. Quatro páginas guardavam o `activeElement` à mão.
- **Nada compunha.** O diálogo do Merlin existia duas vezes, o contador de sugestões três;
  sem componente com estado próprio, compartilhar era função que devolve string.

E uma quarta decisão, tomada no meio da noite pelo Arthur: **tudo em inglês** — identificadores,
chaves do `localStorage`, tipos de coleção, campos dos documentos, rotas e JSON da API, colunas
do banco, classes de CSS e nomes de arquivo. Só o que aparece na tela e os comentários seguem
em português. Sem migração de dados: o que estava gravado com os nomes antigos não é lido.

Medido em 07/09/2026, antes de começar:

| medida | valor |
| --- | --- |
| páginas | 7 |
| linhas no total | ~12.500 |
| `innerHTML` em `clientes.html` / `funis.html` | 32 / 30 |
| chamadas a `escapar()` no total | ~150 |
| páginas com restauração de foco à mão | 4 |
| testes automatizados do lado do navegador | 0 |

## 2. A decisão

**Preact com `htm`**, copiado para dentro de `shared/preact.js`. Nada de Next.js, nada de
Vite, nada de bundler.

- **Diff de DOM e componentes com estado** são as duas coisas que só um framework resolve, e
  o Preact entrega as duas em 13 KB.
- **`htm` escreve o template numa tagged template**, sem JSX, sem transpilar. O escape vem de
  graça: `${title}` é texto, nunca HTML.
- **Um arquivo, sem build e sem CDN.** O `htm/preact/standalone` traz Preact, hooks e htm num
  módulo só que não importa nada. É copiado do `node_modules` por `update-preact.mjs`
  (`npm run preact` na raiz) e sobe com o resto de `shared/` pelo `site.mjs` de sempre.
- **O deploy não muda.** Worker, D1, cookie `SameSite=Lax`, tudo igual.

## 3. O dicionário

Tudo que tinha nome em português ganhou um nome em inglês. A tabela é a referência para
qualquer página ou módulo novo.

### Arquivos e páginas

| antes | depois |
| --- | --- |
| `compartilhado/` | `shared/` |
| `compartilhado/nucleo.js` | `shared/core.js` (dados) |
| `compartilhado/casca.css` | `shared/shell.css` |
| `compartilhado/LEIA.md` | `shared/README.md` |
| — | `shared/ui.js` (tela), `shared/preact.js` |
| `servidor/` | `server/` (`teste.mjs` → `test.mjs`) |
| `semana.html`, `ideias.html`, `clientes.html`, `funis.html`, `mapas.html`, `financeiro.html` | `week.html`, `ideas.html`, `clients.html`, `funnels.html`, `maps.html`, `finance.html` |
| ids de página `dia, semana, ideias, clientes, funis, mapas, financeiro` | `day, week, ideas, clients, funnels, maps, finance` |
| — | `habits.html`, `plans.html` (telas novas, ids `habits` e `plans`) |

### Chaves do navegador

| antes | depois |
| --- | --- |
| `merlin:tema` (`claro`/`escuro`) | `merlin:theme` (`light`/`dark`) |
| `merlin:sidebar` (`fechada`/`aberta`) | `merlin:sidebar` (`closed`/`open`) |
| `merlin:entrada` | `merlin:inbox` |
| `merlin:dia` | `merlin:day` |
| ~~`merlin:frentes`~~, `merlin:clientes`, `merlin:ideias`, `merlin:semana`, `merlin:mapas`, `merlin:funis`, `merlin:financeiro` | ~~`merlin:fronts`~~ (só existe para a purga esvaziar), `merlin:clients`, `merlin:ideas`, `merlin:week`, `merlin:maps`, `merlin:funnels`, `merlin:finance` |
| forma da coleção `{itens, vServidor, sujos}` | `{items, serverV, dirty}` |
| túmulo `{apagado:true}` | `{deleted:true}` |

### Campos comuns dos documentos

| antes | depois |
| --- | --- |
| `titulo`, `nome`, `corpo`, `nota` | `title`, `name`, `body`, `note` |
| ~~`frente`~~, `cliente` | ~~`front`~~, `client` |
| `feito`, `apagado` | `done`, `deleted` |
| `criada`, `atualizada`, `quando` | `createdAt`, `updatedAt`, `at` |
| `ordem`, `cor`, `tipo`, `estagio` | `order`, `color`, `type`, `stage` |
| `origem:{tipo,id}` | `origin:{type,id}` |

Por coleção (as formas de hoje; **as frentes saíram do sistema em 07/09/2026** — a coleção
`fronts` foi apagada, o campo `front` saiu de todas as formas abaixo e o `purgeFronts()` do
core tira o que já estava gravado, coleção por coleção, ver "Frentes: saíram" na VISAO):

- ~~**fronts** `{id, name, color (1-6), order}`; sementes `artt, guessless, glsuite, saas, personal`.~~
- **clients** `{id, name, status ('active'|'paused'|'closed'), summary, channels:[{id, type, name, items:[{id, text, done}]}], goals:[{id, text, done}], backlog:[{id, text, done}], journal:[{id, text, at}], contract:{…}, contacts:[…], links:[…], offers:[…]}`.
- **ideas** `{id, title, body, stage, client, steps:[{id, text, done}], outputs:[{type, id, at}], history:[{type:'stage', from, to, at}]}`.
- **week** `{id, title, day ('YYYY-MM-DD' | 'weekend:YYYY-MM-DD'), client, min, done, recurring, order, createdAt, updatedAt, recurringSource, inDay}`.
- **maps** `{id, name, root:{id, title, note, color, collapsed, children:[…]}, client, idea, funnel}`.
- **funnels** `{id, name, client, channel, nodes:[{id, type, title, x, y, fields:{}, number}], edges:[{from, to}], creatives:[…], automations:[…], offers:[…], triggers:[…], snapshots:[…]}`; tipos de nó `traffic, ad, lp, vsl, capture, cta, checkout, thanks, email, whatsapp, remarketing, upsell, downsell, bump`.
- **finance** vários docs `{id, type:'entry'|'fixed'|'card'|'debt'|'config', …}`.
- **inbox** (`merlin:inbox`) `[{id, title, min, client, origin:{type, id}, at}]`.
- **day** (`merlin:day`, tabela `days`) é do `index.html`, em inglês.
- **vault** (`merlin:vault`) um doc `{id:'config', salt}`, de `clients.html`.
- **habits** `{id, name, schedule:{type:'daily'|'perWeek'|'weekdays', times, weekdays:[0-6]}, min, color, order, archived, marks:{'YYYY-MM-DD':true}}`.
- **plans** um doc por período, id `kind:period`: `{id, kind:'quarter'|'month'|'week', period, goals:[{id, text, client, done, parent, card, order}], review:{went, didnt, next}}`.

### API e banco

| antes | depois |
| --- | --- |
| `POST /api/codigo {email}` | `POST /api/code {email}` |
| `POST /api/entrar {email, codigo}` | `POST /api/sign-in {email, code}` |
| `POST /api/sair` | `POST /api/sign-out` |
| `GET /api/eu → {entrou, email}` | `GET /api/me → {signedIn, email}` |
| `GET /api/dias?desde= → {dias:[{dia, v, doc}]}` | `GET /api/days?since= → {days:[{day, v, doc}]}` |
| `POST /api/dias {dia, v, doc}` | `POST /api/days {day, v, doc}` |
| `GET /api/docs?tipo=&desde=` | `GET /api/docs?type=&since=` |
| `POST /api/docs {tipo, id, v, doc}` | `POST /api/docs {type, id, v, doc}` |
| 409 `{ok:false, motivo, servidor}` | `{ok:false, reason, server}` |
| erro `{erro}` | `{error}` |
| `POST /api/merlin {tarefa, contexto}` | `{task, context}`; tarefas `branches, funnel, expand, week, meeting, numbers, habits, review`; resposta `{text}` ou `{suggestions:[{type, nodeType, title, note}]}` |
| cookie `sessao` | `session` |
| tabelas `pessoas, codigos, dias, docs(tipo)` | `people, codes, days, docs(type)` |
| binding D1 `artt_planner` | `DB` |
| vars `EMAIL_REMETENTE`, `EMAILS_DONO` | `SENDER_EMAIL`, `OWNER_EMAILS` |
| secret `SEGREDO_SESSAO` | `SESSION_SECRET` (**precisa ser criado de novo**: `npx wrangler secret put SESSION_SECRET`) |

O banco em produção ainda tem as tabelas antigas. Rodar `npx wrangler d1 execute artt-planner
--remote --file schema.sql` cria as novas, vazias, ao lado. As antigas podem ser apagadas
quando o Arthur quiser.

### Classes de CSS do `shared/`

| antes | depois |
| --- | --- |
| `.pagina`, `--larga`, `--cheia` | `.page`, `--wide`, `--full` |
| `.cabeca`, `.acoes`, `.acoes-linha` | `.header`, `.actions`, `.row-actions` |
| `.bloco`, `--raso`, `.rotulo`, `.nota`, `.vazio` | `.block`, `--flat`, `.heading`, `.note`, `.empty` |
| `.pill--verde`, `--icone`, `.acao` | `.pill--green`, `--icon`, `.action` |
| `.campo`, `--mono`, `--num`, `--pilula`, `.campo-area`, `.campo-sel` | `.input`, `--mono`, `--num`, `--pill`, `.textarea`, `.select` |
| `.rotulo-campo`, `.form-grade`, `.inteiro`, `.form-linha` | `.field-label`, `.form-grid`, `.full`, `.form-row` |
| `.lista`, `.linha`, `.nome`, `.medida` | `.list`, `.line`, `.name`, `.measure` |
| `.chip--verde`, `.medidor(es)`, `.leg`, `.barra`, `--hachura` | `.chip--green`, `.meter(s)`, `.legend`, `.bar`, `--hatched` |
| `.aviso`, `.abas`, `.aba`, `.tabela`, `.tabela-rolagem` | `.notice`, `.tabs`, `.tab`, `.table`, `.table-scroll` |
| `.espaco`, `.oculto-visual`, `.fileira`, `.coluna` | `.spacer`, `.visually-hidden`, `.row`, `.column` |
| `.negativo`, `.positivo`, `.fraco`, `.pequeno` | `.negative`, `.positive`, `.weak`, `.small` |
| `.is-ativa`, `.is-feita`, `.is-negativo`, `.is-verde`, `.is-hoje`, `.is-foco`, `.is-fora` | `.is-active`, `.is-done`, `.is-negative`, `.is-green`, `.is-today`, `.is-focus`, `.is-out` |
| `.dialogo`, `__caixa`, `__caixa--larga`, `__fechar`, `__titulo`, `__acoes` | `.dialog`, `__box`, `__box--wide`, `__close`, `__title`, `__actions` |
| `.selo`, `--verde`, `--cheio`, `.ponto`, `[data-cor]`, `--cor`, `--cor1..6` | `.badge`, `--green`, `--solid`, `.dot`, `[data-color]`, `--color`, `--color-1..6` |
| `.sb__topo`, `__dobrar`, `__busca`, `__busca-campo`, `__achados`, `__lista`, `__secao`, `__espaco`, `__tema`, `__cartao`, `__quem`, `__movel`, `__escurece` | `.sb__top`, `__fold`, `__search`, `__search-field`, `__results`, `__list`, `__section`, `__spacer`, `__theme`, `__card`, `__who`, `__mobile`, `__scrim` |
| `.nuvem[data-e]`, `.quem`, `.knob__sol`, `__lua` | `.cloud[data-status]`, `.who`, `.knob__sun`, `__moon` |
| `html.sidebar-fechada`, `.sidebar-aberta` | `html.sidebar-closed`, `.sidebar-open` |
| `.ent-campo`, `.ent-codigo`, `.ent-botao`, `.ent-recado` | `.signin-input`, `.signin-code`, `.signin-button`, `.signin-message` |

## 4. A arquitetura depois

```
shared/
  preact.js     preact + hooks + htm, copiado (npm run preact). nao se edita.
  core.js       dados: tema, sidebar, sessao/nuvem, colecoes, inbox, notify, md e a
                purga das frentes (purgeFronts, uma vez por navegador).
  ui.js         tela: hooks (useCollection, useClients, useCloud, useHash,
                useKeydown, useFields), componentes (Dialog, Form, Field, Markdown,
                ClientBadge) e icones como vnode (icon, svg).
  base.css / shell.css   os mesmos, com classes em ingles.
server/         worker.js, schema.sql, test.mjs, site.mjs, wrangler.toml
```

Uma página migrada (o esqueleto completo está em `shared/README.md`):

```html
<main class="page" id="app"></main>
<script type="module">
import { initPage, today, newId, notify } from "./shared/core.js";
import { html, mount, useState, useCollection, Form, Field, useFields } from "./shared/ui.js";

initPage("ideas");

function Ideas() {
  const ideas = useCollection("ideas", { normalize });
  const [open, setOpen] = useState(null);
  return html`...`;
}
mount(html`<${Ideas}/>`, "app");
</script>
```

Regras da página migrada:

- **Zero `innerHTML`** fora de `<${Markdown}/>` (o markdown das notas).
- **Zero `escapeHtml()`**: o htm escapa tudo. Se precisou chamar, algo está errado.
- **Estado de tela é `useState`**, nunca variável de módulo com `render()` depois.
- **Formulários controlados** com `useFields`, para uma sincronização no meio da digitação
  não apagar o que está sendo escrito.
- **Eventos nos elementos** (`onClick=${...}`), não delegação por `closest()` sobre o quadro.
  A exceção aceita é arrastar e soltar, onde o alvo é o DOM mesmo.
- **`key` em toda lista** com o `id` do documento.
- **Ícones via `icon("plus")` ou `svg(text)`**, nunca string concatenada.
- Canvas e SVG desenhados à mão (mapas, funis) ficam num componente com `useRef` e continuam
  imperativos por dentro. Migrar é envolver, não reescrever o desenho.
- **Identificadores em inglês.** Texto de tela e comentários em português.

## 5. As fases

### Fase 0 · fundação — feita

- [x] `preact` e `htm` como devDependencies na raiz; `update-preact.mjs` e `npm run preact`.
- [x] `shared/preact.js` gerado (preact 10.29.8, htm 3.1.1).
- [x] `shared/core.js` em inglês: API, chaves, tipos, rotas, classes. Sem aliases antigos.
- [x] `shared/ui.js` com hooks, componentes e ícones.
- [x] `shared/base.css` e `shell.css` com classes em inglês.
- [x] `server/` em inglês: rotas, JSON, tabelas, env. 63 testes passando.
- [x] Este documento, `shared/README.md`, `server/README.md`, `README.md`, `VISAO.md`.

### Fase 1 · piloto: `week.html` — feita

- [x] `Week`, `Column`, `Card`, `EditableTitle`, `CardForm`, `MerlinDialog`.
- [x] Arrastar e soltar: dia, ~~frente~~, antes/depois de um cartão (ordem fracionária).
- [x] Edição inline com foco e seleção; Enter salva, Esc cancela, blur salva.
- [x] Faixa "ficou de trás" com trazer e arquivar, ambos com desfazer.
- [x] Atalhos `n`, `Alt+←/→`, `Esc`.
- [x] Roteiro Playwright no Chromium.

### Fase 2 · `ideas.html` e `finance.html` — feita

- [x] `ideas.html`: lista por dia, ideia aberta (`useHash`), estágio `seed|exploring|defined|
  executing|archived`, passos, atividade, quadro por estágio, Merlin (`task: "expand"`).
  770 → 736 linhas de JS, 19 → 0 `innerHTML`, 12 → 0 escapes.
- [x] `finance.html`: abas mês/ano/painel, formulários de `entry|fixed|card|debt|config`.
  731 → 836 linhas de JS, 2 → 0 `innerHTML`, 29 → 0 escapes.

### Fase 3 · `clients.html` — feita

- [x] ~~Cadastro de frentes, lista por frente~~ (saíram em 07/09/2026), painel do cliente
  em oito abas (`useHash`).
- [x] Canais, objetivos, backlog, diário, ofertas, contrato, contatos, links e o cofre, com
  a mesma cifra de antes (PBKDF2 300k + AES-GCM; a coleção `vault` guarda só o sal).
- [x] Pauta de reunião com o Merlin (`task: "meeting"`).
  1169 → 1077 linhas de JS, 30 → 0 `innerHTML`, 37 → 0 escapes.

### Fase 4 · `funnels.html` e `maps.html`

- [x] `maps.html`: lista, editor com o SVG num componente de ref (o motor desenha com
  `render()` do Preact, sem `innerHTML`), teclado, arrasto, zoom/pan, painel do nó,
  exportar, ramos do Merlin (`task: "branches"`). 8 → 0 `innerHTML`, 8 → 0 escapes.
- [x] `funnels.html`: lista com miniatura e editor de tela cheia — palco SVG num componente
  de ref, biblioteca, painel por tipo de nó, vazão com taxa média, gaveta de criativos,
  automações, ofertas, gatilhos e números, retratos e o Merlin (`task: "funnel"` e
  `"numbers"`). 1721 → 1607 linhas de JS, 30 → 0 `innerHTML`, 49 → 0 escapes.

### Fase 5 · `index.html` — feita

- [x] Barra que se gasta com o relógio, fila, sobra, reserva, caixa de ideias, pedágio.
- [x] `merlin:inbox` esvaziada ao abrir e no evento `storage`.
- [x] Cartões da semana de hoje entrando sozinhos, com `inDay` escrito de volta.
- [x] Desfazer (pilha de 12), dia de ontem, matriz de Eisenhower efêmera, ClickUp.
- [x] Documento do dia em inglês: `{day, start, end, doneOpen, v, tasks:[{id, title, min,
  done, reserved, clickup, front, client, origin}]}`; a ordem do array é a prioridade.
  (o `front` saiu em 07/09/2026, ver "Frentes: saíram" na VISAO.)
  A chave antiga `artt-planner:v2` saiu. 1746 → 1519 linhas de JS, 15 → 0 `innerHTML`,
  3 → 0 escapes, e o escapador próprio do dia desapareceu.

### Fase 6 · a casca em Preact — feita

- [x] Sidebar, busca global, interruptor de tema, cartão da nuvem, quem está aqui, a caixa de
  entrar e o aviso viram componentes em `ui.js`.
- [x] `cloud.setStatus()` só guarda estado e avisa; `notify` é o aviso da vez com quem
  escuta, com a mesma assinatura; `signIn` tem `show/hide` e `requestCode/submitCode`, que
  devolvem o recado pronto para a tela.
- [x] O core não importa o ui: o ui se registra com `setShellRenderer`, e `initPage` acha o
  desenhista pronto. Roteiro `pw/shell.mjs`, 28 verificações.

### Fase 7 · limpeza — feita

- [x] Saíram do `core.js`: `openForm`, `formField`, `closeForm`, `isFormOpen`, `frontBadge`,
  `frontOptions` e `clientOptions`. `escapeHtml` deixou de ser exportado e só serve ao `md`.
- [x] O core caiu de 899 para 631 linhas, sem nenhum `innerHTML`.

## 5b. Como ficou

| medida | antes | depois |
| --- | --- | --- |
| páginas | 7 | 9 (entraram hábitos e planos) |
| linhas de JS nas páginas | 8.017 | 8.300 |
| `innerHTML` nas páginas | 104 | 0 |
| escapes manuais nas páginas | ~150 | 0 |
| `innerHTML` no `shared/` | 12 | 0 |
| `core.js` | 821 | 631 (mais `ui.js`, 510) |
| verificações automatizadas no navegador | 0 | 592 |
| testes do servidor | 62 | 69 |

Nenhum identificador em português sobrou no código. O que aparece na tela e os comentários
seguem em português, como sempre foram.

## 6. Pronto quando

Uma página está migrada quando tudo isto vale:

1. Faz o mesmo que antes, item a item, com a lista da fase conferida no navegador (roteiro
   Playwright no Chromium, e uma passada na largura de celular).
2. `grep -c innerHTML` dá 0 fora de `Markdown`; `grep -c "escapeHtml("` dá 0.
3. Nenhuma variável de módulo guarda estado de tela; nenhum `render()` solto.
4. Foco e rolagem sobrevivem a uma sincronização chegando no meio de uma edição.
5. Os dois temas, e a tela estreita, sem rolagem horizontal fora de `.table-scroll`.
6. Nenhum identificador em português.
7. `npm run site` e `npm run deploy` passam sem mudança.
8. Commit por página.

## 7. Riscos e o que fazer com eles

- **O `htm` interpreta em tempo de execução.** O parse é feito uma vez por template e fica em
  cache; o custo é de milissegundos no primeiro render.
- **Arrastar e soltar nativo com diff de DOM.** Com `key` pelo `id`, o elemento arrastado
  sobrevive ao re-render. Regra: `key` sempre.
- **Formulário aberto quando chega sincronização.** Com `value` controlado o Preact
  restauraria o valor antigo; por isso `useFields`, que guarda os valores em estado.
- **Canvas/SVG dos mapas e funis.** Não se migra o desenho; só se envolve.
- **Dados antigos.** Nada do que estava em `merlin:semana`, `merlin:ideias`… nem nas tabelas
  antigas do D1 é lido pelo código novo. Decisão do Arthur em 07/09/2026: sem migração.

## 8. Hábitos e planejamento — feito

Pedido do Arthur em 07/09/2026: uma tela de **hábitos/tracker** e **planejamento trimestral,
mensal e semanal**. As duas nasceram já em Preact e em inglês, com o desenho da `VISAO.md`
(seções 4.9 e 4.10):

- `habits.html` — a grade do mês, frequência `daily|perWeek|weekdays`, sequência, taxa do
  mês, puxar para o dia (`origin: {type:"habit"}`), arquivar com desfazer, Merlin
  (`task: "habits"`). Coleção `habits`, marcas dentro do documento.
- `plans.html` — trimestre, mês e semana lado a lado; objetivos por cliente, desdobrar
  (filho com `parent`), puxar para a semana (cartão com `origin: {type:"plan"}`), revisão em
  três campos e Merlin (`task: "review"`). Coleção `plans`, um documento por período.

As duas entraram na sidebar e na busca global; o worker ganhou as duas tarefas do Merlin.

## 10. Segunda migração: do Preact para o React 19

### Por quê

Pergunta do Arthur, à tarde: por que Preact e não React ou Next. A resposta honesta foi que o
Next não servia (SSR, rotas e SEO não existem num sistema local-first atrás de login, e ele
quebraria o cookie `SameSite=Lax` que depende de site e API no mesmo Worker), e que entre React
e Preact o que decidiu foi a regra "sem build": o React precisa de um compilador para o JSX, e
sem ele vira `createElement` escrito à mão.

Ele optou por trocar a regra: **React de verdade, atual, com o build que vier junto**.

Um fato técnico pesou na escolha e vale registrar: **o React 19 não tem mais build UMD**. Só
CommonJS. Não existe React 19 no navegador sem bundler. Ficar sem build significaria congelar
no React 18.3.1, a última versão com UMD.

| | Preact + htm | React 18.3 sem build | React 19 com Vite |
| --- | --- | --- | --- |
| tamanho | 13 KB | 143 KB | ~140 KB |
| passo de build | nenhum | nenhum | Vite |
| versão | atual | congelada | atual |
| JSX | não | não | sim |

### O que mudou de forma

A unidade do sistema continua sendo **uma página por assunto**. O que mudou é que ela virou dois
arquivos em vez de um:

```
week.html          o CSS da página inline, o anti-flash do tema, <main id="app"> e
                   <script type="module" src="/src/week.jsx">
src/week.jsx       a tela, em React com JSX
src/shared/
  core.js          os dados. JavaScript puro, sem React, testável sem navegador.
  icons.jsx        os 32 SVGs que eram string, agora elementos
  ui.jsx           hooks, componentes comuns e a casca inteira
  base.css / shell.css
vite.config.js     cada HTML com par em src/ é uma entrada; o build sai em server/site/
```

O que se perdeu: a página não é mais legível inteira num arquivo só, e `npm run build` passou a
existir entre editar e ver. O que se ganhou: JSX, React DevTools, o ecossistema e a porta aberta
para TypeScript.

### O dicionário da segunda migração

| antes (Preact + htm) | depois (React + JSX) |
| --- | --- |
| `shared/` | `src/shared/` |
| `shared/preact.js` (vendorizado) | `react` e `react-dom` do npm, empacotados pelo Vite |
| `shared/ui.js` | `src/shared/ui.jsx` |
| os ícones como string em `core.js` | `src/shared/icons.jsx`, elementos |
| `server/site.mjs` (cópia) | `vite build --outDir server/site` |
| `html\`<div class=${x}>\`` | `<div className={x}>` |
| `<${Comp} p=${v}/>` … `<//>` | `<Comp p={v}>` … `</Comp>` |
| `...${bind("t")}` | `{...bind("t")}` |
| `svg(TEXTO)` | um componente JSX no topo da página, ou `icon("nome")` |
| `onInput` | `onChange` |
| `render(vnode, el)` do Preact | `createRoot(el).render(...)` |
| `class`, `for`, `maxlength`, `tabindex` | `className`, `htmlFor`, `maxLength`, `tabIndex` |

O que **não** mudou: nome de classe CSS, id de elemento, texto de tela, comentário, forma dos
documentos, chave do `localStorage`, chamada de API, atalho de teclado. Foi tradução, não
refatoração — e os roteiros Playwright da primeira migração, sem uma linha alterada, são a
prova: eles passam contra o build do React exatamente como passavam contra o Preact.

### Como se testa agora

Os roteiros rodam contra o **build**, não contra os arquivos soltos:

```bash
npm run build                              # gera server/site/
npx vite preview --port 8765 --strictPort --host 127.0.0.1
cd <scratchpad>/pw && node testa.mjs week.html week.mjs
```

`MERLIN_ONLY=week` limita o build a uma página, e `PW_PORT` diz ao roteiro onde bater — foi
assim que oito páginas foram convertidas em paralelo, cada uma com a sua porta e a sua pasta.

Duas armadilhas de ambiente que custaram tempo e ficam registradas: o `http.server` do Python
serve `.js` como `application/octet-stream` no Windows, e o navegador recusa o módulo; e o
`vite preview` sobe só em IPv6 se não receber `--host 127.0.0.1`.

### Duas coisas que só apareceram na integração

**A ordem do CSS inverteu.** O Vite injeta o CSS do bundle no fim do `<head>`, ou seja depois
do `<style>` inline da página — o contrário da ordem antiga, em que o `<link>` do `base.css`
vinha primeiro. Empates de especificidade passaram a ser vencidos pelo comum, e regras da
página pararam de valer: no financeiro os medidores estouravam a coluna, com 38px onde a
página pede 27. O conserto não cabia numa página: o CSS de cada uma saiu do HTML para
`src/<pagina>.css`, importado logo depois do `base.css`. A ordem volta a ser a de sempre, e
vale igual no `dev` e no `build`.

**O mapa não aceitou o desenho imperativo.** Trocar os vnodes por `createElementNS` quebrava o
duplo clique: `paint()` refaz a árvore a cada pintura, e o `<rect>` que recebeu o `mousedown`
já não estava no documento no `mouseup`, então o Chrome não emitia `click` nem `dblclick` — o
Preact escondia isso porque remendava atributo no lugar. Ficou um `createRoot(svg)` guardado
num ref e reusado, com `flushSync` no que vem de ponteiro, roda e animação; sem ele o fantasma
do arraste fica um quadro atrás.

### Estado — feito

- [x] Fundação: Vite, `src/shared/core.js`, `icons.jsx`, `ui.jsx`.
- [x] As nove páginas: `index`, `week`, `ideas`, `clients`, `funnels`, `maps`, `finance`,
  `habits`, `plans`.
- [x] `server/site.mjs` (a cópia) some; quem gera `server/site/` é o `vite build`.
- [x] **604 verificações** no navegador contra o build, e os roteiros da primeira migração
  passaram sem mudança — a prova de que foi tradução, não refatoração. As duas exceções estão
  anotadas nos commits: o roteiro da casca clicava no centro de um escurecedor que a gaveta
  cobre, e o do dia importava um arquivo que o Vite não expõe mais.

---

## 9. Como retomar

Numa sessão nova: leia este arquivo, `shared/README.md` e `shared/ui.js`; rode
`git log --oneline -15` para ver em que fase parou; abra a página com
`python -m http.server 8765` na raiz e o roteiro Playwright do scratchpad. A `week.html` é o
exemplo de como fazer a próxima.
