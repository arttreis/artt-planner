# Merlin · visão

O `artt planner` deixa de ser um app para qualquer pessoa usar e vira **Merlin**: um sistema
de uma pessoa só, do Arthur, com várias frentes ligadas entre si. O aparelho do dia continua
sendo o coração — o que muda é o que gira em volta dele.

Este documento é a fonte das decisões. O que está aqui é o que o código faz ou vai fazer; o que
não está, não existe ainda.

---

## 1. O nome

**Merlin**, decidido em 06/09/2026. O conselheiro do rei Arthur: não governa, aconselha; sabe o
que ninguém mais viu; está sempre um passo à frente do rei. É o Jarvis certo para alguém chamado
Arthur, e vem do folclore britânico como pedido.

O domínio é **merlin.arttreis.com.br**, também decidido. O nome puxa junto as chaves `merlin:*`
no `localStorage`, o worker `merlin-api` e o remetente `merlin@arttreis.com.br`.

---

## 2. Princípios

### Uma pessoa

O login por e-mail continua existindo porque é o que leva os dados ao celular e ao Safari. Mas o
worker só aceita os **e-mails do dono**, fixados em `OWNER_EMAILS` no `wrangler.toml`. Outro
endereço recebe uma resposta idêntica à de sucesso e nenhum código é enviado.

### Só o dia tem minutos

O produto já tinha uma regra forte: *toda tarefa tem duração, e só existe um dia*. A caixa de
ideias mostrou como conviver com isso: o que está fora do dia **não custa minuto nenhum** até ser
puxado para dentro.

Esse é o princípio do sistema inteiro:

> Ideias, semana, mapas, funis, clientes e financeiro são **reservatórios**. Nenhum deles tem
> hora. O único lugar com hora é o aparelho do dia, e tudo entra nele pelo mesmo gesto: puxar,
> pagar o pedágio da duração, virar banda na barra.

Uma exceção, decidida pelo Arthur: **os cartões da coluna de hoje na semana entram na fila
sozinhos** ao abrir o dia. Vale porque colocar um cartão em "seg 7" já foi a decisão; o cartão
ganha a marca "no dia" e concluir a tarefa fecha o cartão. Prazo vencendo em qualquer outro
lugar continua sendo aviso, nunca tarefa que "rolou sozinha".

### Frentes

O Arthur trabalha em mais de uma empresa, e tudo no sistema pode pertencer a uma **frente**:

- **Artt Reis** — consultoria, a principal.
- **Guessless** — agência de growth, com o Juliano.
- **GL Suite** — tecnologia sob demanda, com o Juliano (glsuite.io).
- **SaaS com Léo e Luca** — em definição.
- **Pessoal** — o que não é trabalho.

Frente é um cadastro editável, não código. Cliente pertence a uma frente; tarefa, ideia, funil e
lançamento financeiro podem apontar para uma. A frente aparece como selo em tudo — mas não há
filtro por frente (nem por nada) nas telas: decidido em 07/09/2026, minimalismo antes de tudo.

### Criar é sempre o mesmo gesto

Todo "novo X" do sistema é um botão que abre uma caixa (pop-up) com os campos —
`abrirFormulario` no núcleo. Nenhuma tela tem formulário aberto no meio da lista. A única
exceção é o campo do dia, que é a linha de comando do aparelho.

### Sidebar

A navegação é uma coluna fixa à esquerda, como um app: logo, **busca global** (`Ctrl+K`, procura
por título em ideias, clientes, semana, mapas, funis e lançamentos), as sete telas com ícone,
"o que é isso", o tema, e embaixo o cartão da nuvem e quem está entrando. Recolhe para só ícones
(`Ctrl+B`); no celular vira gaveta aberta por uma barra fina no topo.

### Dois temas

O design system do arttreis.com.br nos dois modos: escuro (`#0d0d0d` e o verde `#2EE86B`) e
claro (`#f2f2f0`, branco, e o verde escurecido `#0d8038` para texto). O botão de tema fica na
barra de navegação; a escolha persiste no navegador e segue o sistema quando não há escolha.

---

## 3. Arquitetura

Cinco páginas novas ao lado do dia, todas sem build e sem CDN, cada uma legível inteira,
como o `index.html` sempre foi. O que é comum vive em `shared/`. Desde 07/09/2026 a
tela é desenhada com o Preact local (`shared/preact.js`, com `htm` no lugar de JSX):
a página continua uma só, o que muda é que o JS descreve a tela em vez de montar string. O
plano e o estado da migração estão em `MIGRACAO.md`.

```
index.html             o dia (aparelho) — o que já existia, com barra de navegação
ideas.html            caixa de ideias com corpo, estágio e desenvolvimento
week.html            a semana em colunas, por frente
maps.html             mapa mental
funnels.html             funil: mapa com tipos de nó e vazão
clients.html          clientes, frentes, canais, objetivos, backlog
finance.html        do jeito da planilha: mês dia a dia, ano, painel de fixos/cartão/dívidas
shared/
  base.css             tokens dos dois temas + navegação + componentes comuns
  core.js            utilidades, tema, sessão/nuvem, coleções sincronizadas, caixa de entrada do dia
  preact.js            preact + hooks + htm num arquivo, copiado do node_modules (npm run preact)
  ui.js                a camada de tela: hooks que ligam às coleções, diálogo, formulário, selos, ícones
server/              o mesmo worker; ganha /api/docs genérico e a trava de e-mail
```

### Coleções sincronizadas

Cada módulo guarda **documentos por entidade** (uma ideia, um cliente, um mapa) numa coleção. A
coleção mora no `localStorage` em `merlin:<tipo>` e sobe para a tabela `docs` do D1, com o mesmo
carimbo `v` e a mesma regra do dia: o servidor recusa gravação mais velha e devolve a dele. Por
ser por entidade, editar um cliente no celular não sobrescreve uma ideia criada no desktop.

O dia continua sendo um documento por data na tabela `dias`. Nada muda ali.

### Caixa de entrada do dia

Nenhum módulo mexe no documento do dia. Quem quer mandar algo para hoje escreve na fila
`merlin:inbox` (`{titulo, min?, frente?, cliente?, origem}`) e o dia a esvazia ao abrir ou ao
receber o evento de `storage`. Com duração, vira tarefa; sem duração, cai na caixa de ideias do
dia e passa pelo pedágio de lá. É um gesto só, sem acoplamento.

### O que não muda

Design system, worker na Cloudflare com D1, login por código, desfazer, "toda tarefa tem
duração", o aparelho e a barra que se gasta.

---

## 4. As frentes do sistema

### 4.1 O dia (`index.html`)

O que existe, mais:

- `@frente` e `@cliente` no campo de nova tarefa, com selo na linha.
- Caixa de ideias do dia passa a ler a mesma coleção de `ideas.html`.
- Esvazia a caixa de entrada.
- Barra de navegação e tema.

### 4.2 Ideias (`ideas.html`)

Semelhante ao financeiro em estrutura: não é uma lista solta, é um lugar organizado.

- **Corpo**: título e texto livre (markdown simples).
- **Estágio**: `semente → explorando → definida → executando → arquivada`. Filtro por estágio.
- **Frente** opcional.
- **Ramificações**: lista de próximos passos/perguntas dentro da ideia (checklist).
- **Saídas**: "puxar para o dia", "abrir mapa mental" (cria um mapa com a ideia no centro),
  "virar projeto de cliente" (leva para clientes com o texto).
- **Quadro por estágio** como visão alternativa à lista.
- Sincroniza como coleção; a caixa do dia mostra as não arquivadas.

### 4.3 Semana (`week.html`)

Inspirado no quadro do parceiro no Google Tarefas: colunas `seg · ter · qua · qui · sex · fim
de semana`, e dentro de cada coluna os cartões agrupados por **frente**.

- Cartão: título, frente, cliente opcional, duração opcional, feito.
- Arrastar entre colunas e entre frentes.
- "Hoje" é destacado; **puxar para o dia** manda o cartão pela caixa de entrada.
- Semana atual e navegação para a próxima/anterior. O que ficou aberto na semana passada
  aparece numa faixa "ficou de trás", com a escolha de trazer ou arquivar. Nada rola sozinho.
- Modelo de recorrência simples: cartão marcado como "toda semana" reaparece na semana nova.

### 4.4 Mapa mental (`maps.html`)

Referência: MindMaster / XMind. O que faz um mapa ser bom é **teclado e layout automático**.

- `Enter` irmão, `Tab` filho, `Shift+Tab` sobe, `Delete` apaga o ramo (com desfazer), setas
  navegam, `F2`/digitar edita, `Espaço` colapsa/expande.
- Layout automático em árvore, balanceado dos dois lados do centro. Arrastar ramo para outro pai.
- Pan e zoom (scroll, `Ctrl+scroll`, `Ctrl+0` enquadra).
- Nó: título, nota, cor de ramo (as tintas + o verde), link.
- Exportar PNG e outline em markdown.
- Vários mapas, cada um ligado opcionalmente a ideia, cliente ou funil.
- SVG próprio, sem biblioteca.

### 4.5 Funil (`funnels.html`)

Mapa com **tipos de nó**, **fluxo direcionado** e **números em cima**.

- Grafo em camadas da esquerda para a direita; posição manual permitida.
- Tipos: tráfego, anúncio, LP, VSL, captura, **CTA**, checkout, obrigado, e-mail/automação,
  WhatsApp, remarketing, upsell/downsell/bump, personalizado. Cada um com campos próprios (URL,
  plataforma, preço, custo). O checkout nasce com **Stripe**, que é o da casa.
- **Vazão**: cada nó tem pessoas no período; cada aresta mostra a taxa real (calculada) e uma
  **taxa média** esperada, digitada. Onde falta número real, o funil projeta a partir da média
  (em cinza, com "~"). A diferença entre real e média é o que a tela quer mostrar. Números
  continuam manuais; Meta Ads e pixel ficam para depois, por decisão.
- Período selecionável; retratos com data para comparar.
- Pertence a um cliente e a um **canal** (4.6), ou à frente.

### 4.6 Clientes (`clients.html`)

Cliente pertence a uma frente. O que um cliente tem:

- **Ficha**: nome, contatos, links (site, redes, Drive, ClickUp, Meta Ads), status
  (`prospecto → proposta → ativo → pausado → encerrado`).
- **Contrato**: escopo, valor, recorrência, início/fim. Não gera "a receber" sozinho: nem
  todo cliente paga fee ao Arthur (decisão).
- **Canais**: Mercado Livre, Shopee, TikTok Shop, Amazon, site próprio, Instagram, etc. Cada
  canal tem a **estrutura** dele: um checklist do que precisa existir (conta, catálogo, frete,
  anúncios, avaliações, pixel…), com o que já foi feito e o que falta. Vem de um modelo por tipo
  de canal, editável por cliente. Um canal pode ter funis ligados. É o que responde "nesse
  cliente ainda não fiz X".
- **Objetivos** com resultado-chave e prazo, cada um com planejamento (checklist ou mapa).
- **Backlog**: tarefas sem hora, com prazo opcional, frente e cliente já preenchidos; "puxar
  para o dia".
- **Diário**: notas de reunião, decisões e entregas com data, só append.
- **Painel do cliente**: objetivos, prazos, canais incompletos, último contato.
- **Frentes**: o cadastro das empresas mora aqui.

- **Cofre**: acessos do cliente (rótulo, usuário, segredo, URL, nota) guardados **cifrados** no
  documento, com AES-GCM e chave derivada de uma senha-mestra por PBKDF2. A senha fica só na
  memória da sessão; o servidor nunca vê texto puro; perder a senha perde o cofre, sem
  recuperação — é escolha.

### 4.7 Financeiro (`finance.html`)

Do jeito da planilha "Controle Financeiro" que o Arthur já usa (redesenhado em 07/09/2026 a
partir dela). Três abas:

- **Mês**: uma linha por dia com entradas, saídas e **saldo previsto** ao fim de cada dia (a
  aba anual da planilha). Em cima: saldo hoje, fim do mês, **diário** (sobra ÷ dias que
  faltam, a mesma lógica da barra do dia), entradas e saídas. A linha expande e mostra o que
  cai naquele dia; o que é projeção (fixo, parcela) se confirma com um clique e vira lançamento.
- **Ano**: os doze meses lado a lado, cada um com o saldo de cada dia — positivo em verde,
  negativo em hachura. Clicar no mês abre a aba do mês.
- **Painel**: as quatro tabelas do DASHBOARD da planilha — **saídas fixas** e **entradas
  fixas** (nome, categoria, dia, valor), **cartão de crédito** (compras parceladas: nome,
  cartão, parcelamento "3/12", total) e **dívidas** (nome, pessoa, valor, pago) — cada uma com
  o total e o "+" que abre a caixa. Embaixo, a **divisão 50/30/20** sobre as entradas fixas e
  a sobra dos fixos.
- **Lançamentos** avulsos: entrada ou saída, valor, data, categoria, frente, pago/previsto.
- **Config**: saldo inicial (o marco a partir do qual a conta anda), percentuais da divisão e
  categorias.

Fora: assinaturas e planos de compra (apagados em 07/09/2026), conta/cartão por lançamento,
filtro por frente, conciliação bancária, extrato, NF.

### 4.8 Merlin, o conselheiro

O que só uma IA faz bem, sempre passando pela decisão de quem está na tela: a sugestão abre num
diálogo com caixas de marcar; nada entra sozinho.

- **Feito**: rota `/api/merlin` no worker (chave `ANTHROPIC_API_KEY` como segredo, modelo
  `claude-opus-5`) com seis tarefas: **ramos** (mapa mental, nó selecionado), **funil** (o que
  falta: etapas, automações, criativos, ofertas, gatilhos), **ramificar** (perguntas, caminhos
  e passos para uma ideia), **semana** (resumo do que fechou e ficou, por frente), **reunião**
  (pauta com um cliente, que pode ir para o diário) e **números** (onde o funil está perdendo).
- **Depois**: entrada em linguagem natural para o sistema todo.

---

## 5. Ordem de construção

| # | Etapa | Estado |
| --- | --- | --- |
| 0 | Fundação: nome, tema claro, navegação, `shared/`, `/api/docs`, trava de e-mail | em construção |
| 1 | Ideias | feito |
| 2 | Semana | feito |
| 3 | Clientes com frentes e canais | feito |
| 4 | Financeiro | feito |
| 5 | Mapa mental | feito |
| 6 | Funil | feito |
| 7 | Vazão real (Meta Ads, pixel) | depois |
| 8 | Merlin conselheiro (mapa, funil, ideias, semana, reunião, números) | feito |
| 9 | Sidebar, busca global, cofre cifrado, taxa média no funil, cartões de hoje no dia | feito |

---

## 6. Decidido e em aberto

Decidido em 06/09/2026:

1. **Nome**: Merlin. **Domínio**: merlin.arttreis.com.br.
2. **"TA" no funil** era **CTA** — o tipo já existe como etapa, com texto do botão e destino.
3. **Empresa de tecnologia**: GL Suite (glsuite.io).
4. **Checkout**: Stripe, o padrão do nó de checkout.

Decidido em 07/09/2026:

5. **Cofre de acessos**: dentro do app, com cifra local.
6. **Clientes**: nada de importar; entram conforme a necessidade.
7. **Semana → dia**: os cartões de hoje entram no dia sozinhos.
8. **Vazão no funil**: taxa média digitada por etapa, sem integração por enquanto.
9. **Merlin**: as quatro frentes que faltavam (ideias, semana, reunião, números) foram feitas.
10. **Financeiro ↔ clientes**: contrato não gera "a receber" (nem todo cliente paga fee).
11. **Planilha**: sem importador.
12. **Navegação**: sidebar, não barra no topo.
13. **Stack**: HTML/JS/CSS sem build e sem CDN continua; em 07/09/2026 entrou o Preact local
    como única dependência de tela (ver `MIGRACAO.md`). (A página "o que é isso" foi apagada
    em 07/09/2026; a leitura fica neste documento e nos READMEs.)

Em aberto: nada.
