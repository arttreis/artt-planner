# compartilhado/ · como um módulo do Merlin é feito

Cada módulo é **uma página HTML** na raiz (`ideias.html`, `clientes.html`…), com CSS e JS
inline, legível inteira, sem build e sem framework. O que é comum vive aqui:

- `base.css` — tokens dos dois temas (escuro no `:root`, claro em `html.light`), a sidebar
  (via `casca.css`), e os componentes: `.bloco`, `.pill`, `.chip`, `.selo`, `.campo`, `.linha`,
  `.tabela`, `.dialogo`, `.aviso`, `.medidor`, `.barra`, `.abas`, `.grade`/`.col-*`.
- `nucleo.js` — ES module com tudo que a página precisa para existir no sistema.

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
<link rel="stylesheet" href="compartilhado/base.css">
<script>/* anti-flash do tema: antes de qualquer pintura */
try{var t=localStorage.getItem("merlin:tema");if(t?t==="claro":matchMedia("(prefers-color-scheme: light)").matches)document.documentElement.classList.add("light")}catch(e){}</script>
<style>/* só o que é deste módulo */</style>
</head>
<body>
<main class="pagina">
  <div class="cabeca"><div><h1>ideias</h1><p class="sub">o que ainda não é tarefa</p></div><div class="acoes">…</div></div>
  …
</main>
<script type="module">
import { iniciarPagina, colecao, $, escapar, novoId, hoje, mostrarAviso, mandarParaODia,
         listarFrentes, seloFrente, opcoesFrente, listarClientes, nomeCliente, opcoesCliente, md, ICONE, brl, lerValor }
  from "./compartilhado/nucleo.js";

iniciarPagina("ideias");   // monta a sidebar, carrega frentes e clientes, retoma a sessão
const ideias = colecao("ideias", { normalizar: (d) => ({ ...d, titulo: String(d.titulo || "") }) });
ideias.aoMudar(render);    // 'local' | 'nuvem' | 'storage'
render();
</script>
</body>
</html>
```

## Coleções (`colecao(tipo, {normalizar})`)

- `todos()` → array de documentos vivos (sem os apagados).
- `obter(id)`, `existe(id)`.
- `gravar(doc)` → grava, carimba `v`, salva no localStorage, agenda subida, avisa. `doc.id` é
  obrigatório (use `novoId()`). Devolve o doc gravado.
- `gravarVarios(docs)` → o mesmo, com um aviso só.
- `apagar(id)` → grava um túmulo `{id, apagado:true}` e devolve o doc anterior (para desfazer
  com `gravar(anterior)`).
- `aoMudar(fn)` → chama `fn(origem)` a cada mudança. Renderize a partir de `todos()`.
- Nunca escreva no `localStorage` por conta própria. A chave `merlin:<tipo>` é do núcleo.
- A coleção é uma só por tipo. Se o núcleo já a abriu (ele abre `frentes` e `clientes` em
  `iniciarPagina`), chamar `colecao(tipo, {normalizar})` de novo entrega o normalizador à
  coleção existente — a ordem das chamadas não importa.

Um documento é um objeto JSON plano. Coloque nele o que o módulo precisa, mas mantenha
**estes campos com estes nomes** quando fizerem sentido, porque outros módulos leem:

| campo | tipo | significado |
| --- | --- | --- |
| `id` | string | do `novoId()` |
| `frente` | string | id de uma frente (`listarFrentes()`), ou `""` |
| `cliente` | string | id de um cliente (`listarClientes()`), ou `""` |
| `criada` | number | epoch ms |
| `atualizada` | number | epoch ms |
| `apagado` | boolean | só o núcleo escreve |

### Tipos de coleção e dono

| tipo | dono | forma mínima que outros módulos leem |
| --- | --- | --- |
| `frentes` | núcleo | `{id, nome, cor (1-6), ordem}` |
| `clientes` | clientes.html | `{id, nome, frente, status, canais:[{id, tipo, nome, itens:[{id, texto, feito}]}], objetivos:[…], backlog:[…], diario:[…], contrato:{…}, contatos:[…], links:[…], ofertas:[…]}` |
| `ideias` | ideias.html | `{id, titulo, corpo, estagio, frente, cliente, passos:[{id, texto, feito}], saidas:[{tipo, id, quando}], historico:[{tipo:'estagio', de, para, quando}]}` |
| `semana` | semana.html | `{id, titulo, dia ('YYYY-MM-DD' ou 'fds:YYYY-MM-DD' da segunda), frente, cliente, min, feito, recorrente}` |
| `mapas` | mapas.html | `{id, nome, raiz:{id, titulo, nota, cor, colapsado, filhos:[…]}, frente, cliente, ideia, funil}` |
| `funis` | funis.html | `{id, nome, cliente, canal, frente, nos:[{id, tipo, titulo, x, y, campos:{}, numero}], arestas:[{de, para}], criativos:[…], automacoes:[…], ofertas:[…], gatilhos:[…], retratos:[…]}` |
| `financeiro` | financeiro.html | vários docs: `{id, tipo:'lancamento'|'fixo'|'cartao'|'divida'|'config', …}` (`cartao` é uma compra parcelada: `{nome, cartao, total, parcelas, inicio:'YYYY-MM', diaDoMes}`) |

Ligações entre módulos são **por id**, nunca por cópia. Para abrir outra página num item:
`clientes.html#<id>`, `mapas.html#<id>`, `funis.html#<id>`, `ideias.html#<id>`. Cada
página lê `location.hash` ao carregar e abre o item, se existir.

## Criar é um botão e uma caixa

Todo "novo X" passa por `abrirFormulario({ titulo, sub?, campos, enviar?, apagar?, aoEnviar, aoApagar?, aoAbrir?, largo? })`:

- `campos` é HTML de campos com atributo `name`; monte cada um com `campoForm(rotulo, html, inteiro?)`.
- `aoEnviar(valores, form)` recebe `{name: valor}` (checkbox vira booleano). Devolver `false`
  mantém a caixa aberta (para reclamar com `mostrarAviso`).
- `apagar` é o texto do link de apagar (só na edição); `aoApagar` roda depois de fechar.
- `aoAbrir(form)` serve para ligar comportamentos (ex.: frente restringe clientes).
- `Esc`, o ✕, "cancelar" e o clique fora fecham. `formularioAberto()` diz se há uma aberta,
  para os atalhos de teclado não dispararem por cima. Criar e editar são a mesma caixa.

Nenhuma tela tem formulário aberto no meio da lista, e nenhuma tela tem filtro.

## Mandar para o dia

`mandarParaODia({titulo, min, frente, cliente, origem:{tipo, id}})`. Com `min`, vira tarefa na
fila de hoje; sem `min`, vai para a caixa de ideias do dia (onde ganha duração). Nada mais
toca no documento do dia. O aviso já é mostrado pelo núcleo.

## Frentes e clientes

- `listarFrentes()` → ordenadas. `seloFrente(id)` → HTML do selo. `opcoesFrente(escolhida, "texto do vazio")` → `<option>`s.
- `listarClientes()` (sem os encerrados), `nomeCliente(id)`, `opcoesCliente(escolhido, "vazio", frente?)`.

## Regras de casa

- Português do Brasil em tudo que aparece na tela e nos comentários. Minúsculas nos rótulos,
  como o resto do sistema ("ideias", "puxar para o dia"). Sem emoji na interface.
- Sem framework, sem CDN de JS, sem build. Só `base.css`, `nucleo.js` e o que está inline.
- Nada de vermelho: o sistema é monocromático + um verde. Negativo é `--ink-50` ou hachura.
- Toda ação destrutiva passa por `mostrarAviso(texto, desfazer)`.
- Escape tudo que vem do usuário com `escapar()` antes de virar HTML.
- Responsivo: no celular a página vira uma coluna. Nada rola horizontal fora de
  `.tabela-rolagem` ou de um canvas.
- Atalhos de teclado onde faz sentido; `Esc` fecha diálogos.
- Estado vazio explica o que a tela faz em uma frase, sem tutorial.
- Minimalismo antes de tudo: sem filtros, sem formulário aberto na tela, um botão "+" por
  coisa que se cria. A busca global da sidebar substitui qualquer filtro por nome.
- Comentários no código explicam **por quê**, não o quê, como no `index.html`.
