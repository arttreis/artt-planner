/* merlin · nucleo compartilhado
 *
 * o que toda pagina precisa e nenhuma deveria reescrever: tema, barra de
 * navegacao, sessao com o worker, colecoes que sincronizam por documento, e a
 * caixa de entrada por onde os modulos mandam coisa para o dia.
 *
 * e um ES module sem dependencia. cada pagina importa o que usa.
 */

/* ---------- utilidades ---------- */

export const $ = (id) => document.getElementById(id);

export const escapar = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const SESSAO_ID = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
let contadorId = 0;
export const novoId = () => SESSAO_ID + "-" + (++contadorId).toString(36);

export function diaDe(d) {
  const p = (n) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
}
export const hoje = () => diaDe(new Date());
export const ehDia = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
export const dataDe = (dia) => { const [a, m, d] = dia.split("-").map(Number); return new Date(a, m - 1, d); };
export const somarDias = (dia, n) => { const d = dataDe(dia); d.setDate(d.getDate() + n); return diaDe(d); };

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
export const rotuloData = (dia, comAno) => {
  if (!ehDia(dia)) return "";
  const d = dataDe(dia);
  return d.getDate() + " " + MESES[d.getMonth()] + (comAno ? " " + d.getFullYear() : "");
};
export const diaDaSemana = (dia) => SEMANA[dataDe(dia).getDay()];
export const rotuloMes = (aaaamm) => {
  const [a, m] = aaaamm.split("-").map(Number);
  return MESES[m - 1] + " " + a;
};
/* segunda-feira da semana que contem `dia` */
export function segundaDe(dia) {
  const d = dataDe(dia);
  const desloca = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - desloca);
  return diaDe(d);
}

/* dinheiro em centavos, sempre inteiro: soma de float e mentira */
export const brl = (centavos, sinal) => {
  const n = Math.round(+centavos || 0);
  const s = (Math.abs(n) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pre = n < 0 ? "−" : (sinal && n > 0 ? "+" : "");
  return pre + "R$ " + s;
};
export function lerValor(texto) {
  /* aceita "1.234,56", "1.200" (milhar), "1234.56" (decimal), "1234", "R$ 12".
     a regra do ponto: com virgula presente, ponto e milhar; sem virgula, ponto
     seguido de exatamente 3 digitos no fim e milhar, senao e decimal. */
  const t = String(texto || "").replace(/[^\d,.-]/g, "");
  if (!t) return 0;
  let n;
  if (t.includes(",")) n = parseFloat(t.replace(/\./g, "").replace(",", "."));
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) n = parseFloat(t.replace(/\./g, ""));
  else n = parseFloat(t);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export const formatarMin = (min) => {
  min = Math.max(0, Math.round(+min || 0));
  const h = Math.floor(min / 60), m = min % 60;
  return h ? h + "h" + (m ? String(m).padStart(2, "0") : "") : m + "m";
};

/* duracao no fim de um texto: "revisar proposta 45m" -> {min:45, titulo:"revisar proposta"}.
   e a mesma gramatica do dia, resumida: quem quiser a completa esta no index. */
export function lerDuracao(texto) {
  const t = String(texto || "").trim();
  const re = /\s*(?:(\d+(?:[.,]\d+)?)\s*h(?:oras?)?\s*(?:(\d{1,2})\s*(?:m(?:in)?)?)?|(\d+)\s*m(?:in(?:utos?)?)?|(meia hora))\s*$/i;
  const m = t.match(re);
  if (!m) return { min: 0, titulo: t };
  let min = 0;
  if (m[4]) min = 30;
  else if (m[1] != null) min = Math.round(parseFloat(m[1].replace(",", ".")) * 60) + (+m[2] || 0);
  else min = +m[3];
  if (!min) return { min: 0, titulo: t };
  return { min, titulo: t.slice(0, m.index).trim() };
}

export const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

/* ---------- tema ---------- */

const CHAVE_TEMA = "merlin:tema";

export function temaAtual() {
  return document.documentElement.classList.contains("light") ? "claro" : "escuro";
}
export function aplicarTema(qual) {
  document.documentElement.classList.toggle("light", qual === "claro");
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = qual === "claro" ? "#f2f2f0" : "#0d0d0d";
}
export function lerTemaSalvo() {
  try { return localStorage.getItem(CHAVE_TEMA) || ""; } catch (e) { return ""; }
}
export function iniciarTema() {
  const salvo = lerTemaSalvo();
  if (salvo) { aplicarTema(salvo); return; }
  aplicarTema(window.matchMedia("(prefers-color-scheme: light)").matches ? "claro" : "escuro");
}
export function alternarTema() {
  const novo = temaAtual() === "claro" ? "escuro" : "claro";
  aplicarTema(novo);
  try { localStorage.setItem(CHAVE_TEMA, novo); } catch (e) {}
}
/* aplica antes da primeira pintura, para nao piscar */
iniciarTema();

/* a sidebar empurra o conteudo via html.merlin (casca.css). a classe entra
   aqui, no import, para o layout ja nascer certo; e o estado recolhida vem
   junto, do localStorage. */
document.documentElement.classList.add("merlin");
try { if (localStorage.getItem("merlin:sidebar") === "fechada") document.documentElement.classList.add("sidebar-fechada"); } catch (e) {}

/* ---------- navegacao ---------- */

export const PAGINAS = [
  { id: "dia", rotulo: "dia", href: "index.html" },
  { id: "semana", rotulo: "semana", href: "semana.html" },
  { id: "ideias", rotulo: "ideias", href: "ideias.html" },
  { id: "clientes", rotulo: "clientes", href: "clientes.html" },
  { id: "funis", rotulo: "funis", href: "funis.html" },
  { id: "mapas", rotulo: "mapas", href: "mapas.html" },
  { id: "financeiro", rotulo: "financeiro", href: "financeiro.html" }
];

const LOGO = '<svg viewBox="0 0 472.5 472.5" fill="currentColor" aria-hidden="true"><path d="M236.31,236.23c-3.63,128.42,107.71,238.95,236.22,236.22v-118.11c-64.78,2.88-121-53.42-118.11-118.11h-118.11Z"/><path d="M236.22,0C239.85,128.42,128.52,238.95,0,236.22v-118.11C64.78,120.99,121,64.69,118.11,0h118.11Z"/><path d="M315.07,0h77.61c44.09,0,79.89,35.8,79.89,79.89v77.61h-157.5V0h0Z"/><path d="M79.96,315H.07v78.75h78.75v78.75h78.75v-79.89c0-42.86-34.75-77.61-77.61-77.61Z"/></svg>';

const ICONE_NAV = {
  dia: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  semana: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  ideias: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 21h4M12 3a6 6 0 00-3.5 10.9c.7.5 1 1.3 1 2.1h5c0-.8.3-1.6 1-2.1A6 6 0 0012 3z"/></svg>',
  clientes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0113 0"/><circle cx="17" cy="9" r="2.5"/><path d="M15.5 14.5a5 5 0 016 5.5"/></svg>',
  funis: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h18l-7 8.5V20l-4-2v-5.5z"/></svg>',
  mapas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="2.5"/><circle cx="4.5" cy="6" r="2"/><circle cx="19.5" cy="6" r="2"/><circle cx="4.5" cy="18" r="2"/><circle cx="19.5" cy="18" r="2"/><path d="M6.3 7l3.7 3.5M17.7 7L14 10.5M6.3 17l3.7-3.5M17.7 17L14 13.5"/></svg>',
  financeiro: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 6.5v11M15 9.2c0-1.2-1.3-2-3-2s-3 .8-3 2 1.3 1.8 3 2 3 .9 3 2.1-1.3 2-3 2-3-.8-3-2"/></svg>',
  docs: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/></svg>',
  busca: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/></svg>',
  dobrar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M14 10l-2 2 2 2"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  tema: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a9 9 0 100 18 7 7 0 010-18z"/></svg>',
  sol: '<svg class="knob__sol" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/></svg>',
  lua: '<svg class="knob__lua" viewBox="0 0 24 24" fill="currentColor"><path d="M14.5 3.5a8.5 8.5 0 1 0 6 14.3 7 7 0 0 1-6-14.3z"/><path d="M18.5 3l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/></svg>'
};

/* monta a sidebar. o nome "montarNav" fica porque as paginas chamam assim. */
export function montarNav(atual) {
  const sb = document.createElement("aside");
  sb.className = "sb";
  sb.setAttribute("aria-label", "Navegação");
  sb.innerHTML =
    '<div class="sb__topo">' +
      '<a class="sb__logo" href="index.html" aria-label="Merlin">' + LOGO + "<b>merlin</b></a>" +
      '<button class="sb__dobrar" type="button" id="sb-dobrar" title="Recolher (Ctrl+B)" aria-label="Recolher a barra">' + ICONE_NAV.dobrar + "</button>" +
    "</div>" +
    '<div class="sb__busca"><label class="sb__busca-campo">' + ICONE_NAV.busca +
      '<input id="sb-busca" type="search" placeholder="buscar…" autocomplete="off" aria-label="Buscar em tudo"><kbd>ctrl k</kbd></label>' +
      '<div class="sb__achados" id="sb-achados" hidden></div></div>' +
    '<ul class="sb__lista">' +
      PAGINAS.map((p) =>
        '<li><a class="sb__item" href="' + p.href + '"' + (p.id === atual ? ' aria-current="page"' : "") + ' title="' + p.rotulo + '">' +
        (ICONE_NAV[p.id] || "") + "<span>" + p.rotulo + "</span></a></li>"
      ).join("") +
    "</ul>" +
    '<div class="sb__sep"></div>' +
    '<ul class="sb__lista">' +
      '<li><button class="sb__item sb__tema" type="button" id="tema" aria-label="Alternar tema claro/escuro" title="tema">' +
        '<span style="display:flex;align-items:center;gap:10px">' + ICONE_NAV.tema + "<span>tema</span></span>" +
        /* o interruptor: a bolinha desliza e, do lado vazio, fica o icone do
           modo que esta ativo — lua no escuro, sol no claro */
        '<span class="knob" aria-hidden="true">' + ICONE_NAV.sol + ICONE_NAV.lua + '<span class="knob__dot"></span></span></button></li>' +
    "</ul>" +
    '<div class="sb__espaco"></div>' +
    '<div class="sb__cartao">' +
      '<div class="nuvem" id="nuvem" data-e="fora"><i class="ponto"></i><span id="nuvem-estado">só neste navegador</span></div>' +
      '<p id="nuvem-texto">entre com seu e-mail para levar o Merlin a outros aparelhos.</p>' +
      '<button class="pill pill--verde" type="button" id="nuvem-acao">entrar</button>' +
    "</div>" +
    '<div class="sb__quem">' +
      '<span class="avatar is-fora" id="sb-avatar">?</span>' +
      '<span class="quem"><b id="sb-nome">só você</b><span id="sb-email">sem sessão</span></span>' +
      '<button type="button" id="nuvem-sair" hidden>sair</button>' +
    "</div>";
  document.body.prepend(sb);

  /* a barra fina do celular e o escurecedor da gaveta */
  const movel = document.createElement("div");
  movel.className = "sb__movel";
  movel.innerHTML =
    '<button type="button" id="sb-abrir" aria-label="Abrir a navegação">' + ICONE_NAV.menu + "</button>" +
    '<a class="sb__logo" href="index.html" aria-label="Merlin">' + LOGO + "<b>merlin</b></a>";
  const escurece = document.createElement("div");
  escurece.className = "sb__escurece";
  document.body.prepend(escurece);
  document.body.prepend(movel);

  const raiz = document.documentElement;
  const fecharGaveta = () => raiz.classList.remove("sidebar-aberta");
  $("sb-abrir").addEventListener("click", () => raiz.classList.toggle("sidebar-aberta"));
  escurece.addEventListener("click", fecharGaveta);
  $("sb-dobrar").addEventListener("click", alternarSidebar);
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") { e.preventDefault(); alternarSidebar(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); $("sb-busca").focus(); $("sb-busca").select(); }
    if (e.key === "Escape") { fecharGaveta(); fecharAchados(); }
  });

  $("tema").addEventListener("click", alternarTema);
  montarEntrada();
  montarBusca();
  $("nuvem-acao").addEventListener("click", (e) => {
    if (e.currentTarget.dataset.para === "erro") { nuvem.sincronizarTudo(); return; }
    abrirEntrada();
  });
  $("nuvem-sair").addEventListener("click", async () => {
    await api("/sair", { method: "POST" }).catch(() => {});
    nuvem.entrou = false; nuvem.email = "";
    nuvem.marcar("fora");
    nuvem.avisar();
  });
  nuvem.marcar(nuvem.entrou ? "ligada" : "fora");
  return sb;
}

export function alternarSidebar() {
  const raiz = document.documentElement;
  raiz.classList.toggle("sidebar-fechada");
  try { localStorage.setItem("merlin:sidebar", raiz.classList.contains("sidebar-fechada") ? "fechada" : "aberta"); } catch (e) {}
  /* quem desenha em SVG mede o container: avisa que ele mudou de tamanho */
  setTimeout(() => window.dispatchEvent(new Event("resize")), 320);
}

/* ---------- busca global ----------
   procura por titulo em tudo que mora no navegador: ideias, clientes,
   cartoes da semana, mapas, funis e lancamentos. nao e indice: e um filtro
   sobre o que ja esta em memoria, e por isso e instantaneo. */
const FONTES = [
  { tipo: "ideias", rotulo: "ideia", campo: "titulo", href: (d) => "ideias.html#" + encodeURIComponent(d.id) },
  { tipo: "clientes", rotulo: "cliente", campo: "nome", href: (d) => "clientes.html#" + encodeURIComponent(d.id) },
  { tipo: "semana", rotulo: "semana", campo: "titulo", href: () => "semana.html", filtro: (d) => !d.feito },
  { tipo: "mapas", rotulo: "mapa", campo: "nome", href: (d) => "mapas.html#" + encodeURIComponent(d.id) },
  { tipo: "funis", rotulo: "funil", campo: "nome", href: (d) => "funis.html#" + encodeURIComponent(d.id) },
  { tipo: "financeiro", rotulo: "R$", campo: "nome", href: () => "financeiro.html", filtro: (d) => d.tipo === "lancamento" || d.tipo === "fixo" || d.tipo === "divida" || d.tipo === "cartao" }
];
export function buscar(termo) {
  const k = chato(termo);
  if (!k || k.length < 2) return [];
  const achados = [];
  FONTES.forEach((f) => {
    colecao(f.tipo).todos().forEach((d) => {
      if (f.filtro && !f.filtro(d)) return;
      const texto = String(d[f.campo] || "");
      if (chato(texto).includes(k)) achados.push({ rotulo: f.rotulo, texto, href: f.href(d) });
    });
  });
  return achados.slice(0, 12);
}
function fecharAchados() { const a = $("sb-achados"); if (a) a.hidden = true; }
function montarBusca() {
  const campo = $("sb-busca"), caixa = $("sb-achados");
  let foco = -1;
  const desenhar = () => {
    const achados = buscar(campo.value);
    foco = -1;
    if (!campo.value.trim()) { caixa.hidden = true; return; }
    caixa.hidden = false;
    caixa.innerHTML = achados.length
      ? achados.map((a) => '<a href="' + a.href + '"><span class="t-mono">' + escapar(a.rotulo) + "</span><span>" + escapar(a.texto) + "</span></a>").join("")
      : "<p>nada com esse nome</p>";
  };
  campo.addEventListener("input", desenhar);
  campo.addEventListener("focus", () => { if (campo.value.trim()) desenhar(); });
  campo.addEventListener("keydown", (e) => {
    const links = [...caixa.querySelectorAll("a")];
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!links.length) return;
      foco = (foco + (e.key === "ArrowDown" ? 1 : links.length - 1)) % links.length;
      links.forEach((l, i) => l.classList.toggle("is-foco", i === foco));
      links[foco].scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter") {
      const alvo = links[foco >= 0 ? foco : 0];
      if (alvo) location.href = alvo.href;
    } else if (e.key === "Escape") { campo.value = ""; caixa.hidden = true; campo.blur(); }
  });
  document.addEventListener("click", (e) => { if (!e.target.closest(".sb__busca")) fecharAchados(); });
}

/* ---------- aviso com desfazer ---------- */

let elAviso = null, timerAviso = null, acaoDesfazer = null;
export function mostrarAviso(texto, desfazer) {
  if (!elAviso) {
    elAviso = document.createElement("div");
    elAviso.className = "aviso";
    elAviso.setAttribute("role", "status");
    elAviso.innerHTML = '<span></span><button type="button" hidden>desfazer</button>';
    elAviso.querySelector("button").addEventListener("click", () => {
      const f = acaoDesfazer; fecharAviso(); if (f) f();
    });
    document.body.appendChild(elAviso);
  }
  elAviso.querySelector("span").textContent = texto;
  const b = elAviso.querySelector("button");
  acaoDesfazer = desfazer || null;
  b.hidden = !desfazer;
  elAviso.hidden = false;
  clearTimeout(timerAviso);
  timerAviso = setTimeout(fecharAviso, desfazer ? 7000 : 3500);
}
export function fecharAviso() { if (elAviso) elAviso.hidden = true; acaoDesfazer = null; }

/* ---------- formulario em dialogo ----------
   todo "criar X" do sistema passa por aqui: um botao abre a caixa, a caixa
   tem os campos e um enviar. nenhuma tela tem formulario aberto no meio do
   conteudo — a lista fica so com o que existe, e o gesto de criar e sempre
   o mesmo. `campos` e HTML de campos com atributo name; `aoEnviar(valores,
   form)` recebe um objeto {name: valor} e, devolvendo false, mantem a caixa
   aberta (para reclamar de algo). */
let formAberto = null;
export const campoForm = (rotulo, html, inteiro) =>
  "<div" + (inteiro ? ' class="inteiro"' : "") + '><label class="rotulo-campo">' + escapar(rotulo) + "</label>" + html + "</div>";
export function abrirFormulario({ titulo, sub, campos, enviar, apagar, aoEnviar, aoApagar, aoAbrir, largo }) {
  fecharFormulario();
  const d = document.createElement("div");
  d.className = "dialogo dialogo--form";
  d.setAttribute("role", "dialog"); d.setAttribute("aria-modal", "true"); d.setAttribute("aria-label", titulo);
  d.innerHTML =
    '<form class="dialogo__caixa' + (largo ? " dialogo__caixa--larga" : "") + '" autocomplete="off">' +
      '<button class="dialogo__fechar" type="button" data-fechar aria-label="Fechar">' + ICONE.x + "</button>" +
      '<p class="dialogo__titulo">' + escapar(titulo) + "</p>" +
      (sub ? '<p class="dialogo__sub">' + escapar(sub) + "</p>" : "") +
      '<div class="form-grade">' + campos + "</div>" +
      '<div class="dialogo__acoes">' +
        (apagar ? '<button class="link" type="button" data-apagar>' + escapar(apagar) + '</button><span class="espaco"></span>' : "") +
        '<button class="pill" type="button" data-fechar>cancelar</button>' +
        '<button class="pill pill--verde" type="submit">' + escapar(enviar || "salvar") + "</button>" +
      "</div>" +
    "</form>";
  document.body.appendChild(d);
  formAberto = d;
  const form = d.querySelector("form");
  const valores = () => {
    const o = {};
    form.querySelectorAll("[name]").forEach((el) => { o[el.name] = el.type === "checkbox" ? el.checked : el.value; });
    return o;
  };
  d.addEventListener("click", (e) => { if (e.target === d || e.target.closest("[data-fechar]")) fecharFormulario(); });
  const btnApagar = d.querySelector("[data-apagar]");
  if (btnApagar) btnApagar.addEventListener("click", () => { fecharFormulario(); if (aoApagar) aoApagar(); });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const r = aoEnviar ? aoEnviar(valores(), form) : undefined;
    if (r !== false) fecharFormulario();
  });
  if (aoAbrir) aoAbrir(form);
  const primeiro = form.querySelector("input:not([type=hidden]),select,textarea");
  if (primeiro) { primeiro.focus(); if (primeiro.select && primeiro.type !== "date") primeiro.select(); }
  return form;
}
export function fecharFormulario() { if (formAberto) { formAberto.remove(); formAberto = null; } }
export const formularioAberto = () => !!formAberto;
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && formAberto) { e.stopPropagation(); fecharFormulario(); } }, true);

/* ---------- sessao e nuvem ---------- */

const API = "/api";
export async function api(rota, opcoes) {
  const r = await fetch(API + rota, {
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    ...opcoes
  });
  const corpo = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, corpo };
}

const DIZERES = {
  ligada:  ["sincronizado", ""],
  fora:    ["só neste navegador", "entrar"],
  offline: ["sem conexão — sobe depois", ""],
  erro:    ["não consegui sincronizar", "tentar de novo"]
};

const colecoes = new Map();
const ouvintesNuvem = new Set();

const TEXTOS_NUVEM = {
  ligada: "o mesmo Merlin em todos os seus aparelhos.",
  fora: "entre com seu e-mail para levar o Merlin a outros aparelhos.",
  offline: "sem rede agora; o que você fizer sobe quando voltar.",
  erro: "o servidor não respondeu; tente de novo."
};
export const nuvem = {
  entrou: false,
  email: "",
  estado: "fora",
  marcar(qual) {
    this.estado = qual;
    const el = $("nuvem"); if (!el) return;
    const [texto, acao] = DIZERES[qual] || DIZERES.fora;
    el.dataset.e = qual;
    $("nuvem-estado").textContent = texto;
    const t = $("nuvem-texto"); if (t) t.textContent = TEXTOS_NUVEM[qual] || TEXTOS_NUVEM.fora;
    const b = $("nuvem-acao");
    b.hidden = !acao; b.textContent = acao; b.dataset.para = qual;
    $("nuvem-sair").hidden = !this.entrou;
    /* quem esta aqui */
    const av = $("sb-avatar"), nome = $("sb-nome"), email = $("sb-email");
    if (av) {
      const e = this.entrou ? String(this.email || "") : "";
      av.textContent = e ? e[0].toUpperCase() : "?";
      av.classList.toggle("is-fora", !e);
      nome.textContent = e ? e.split("@")[0] : "só você";
      email.textContent = e || "sem sessão";
    }
  },
  aoMudar(fn) { ouvintesNuvem.add(fn); return () => ouvintesNuvem.delete(fn); },
  avisar() { ouvintesNuvem.forEach((f) => { try { f(this); } catch (e) { console.error(e); } }); },
  async retomar() {
    try {
      const r = await api("/eu", { method: "GET" });
      this.entrou = !!(r.ok && r.corpo.entrou);
      this.email = this.entrou ? String(r.corpo.email || "") : "";
    } catch (e) { this.entrou = false; this.email = ""; }
    this.marcar(this.entrou ? "ligada" : "fora");
    this.avisar();
    if (this.entrou) await this.sincronizarTudo();
  },
  async sincronizarTudo() {
    if (!this.entrou) return;
    for (const c of colecoes.values()) await c.sincronizar();
  }
};

/* a tela de entrar: e-mail, codigo, sessao. igual a do dia. */
let emailPedido = "";
function montarEntrada() {
  if ($("entrada")) return;
  const d = document.createElement("div");
  d.className = "dialogo"; d.id = "entrada"; d.hidden = true;
  d.setAttribute("role", "dialog"); d.setAttribute("aria-modal", "true"); d.setAttribute("aria-label", "Entrar");
  d.innerHTML =
    '<div class="dialogo__caixa">' +
      '<button class="dialogo__fechar" type="button" id="entrada-fechar" aria-label="Fechar">✕</button>' +
      '<p class="dialogo__titulo">Levar o Merlin para outros aparelhos</p>' +
      '<form id="form-email" autocomplete="on"><div id="entrada-email">' +
        '<p class="dialogo__sub">Sem senha: mando um código de 6 dígitos.</p>' +
        '<input class="ent-campo" id="campo-email" type="email" inputmode="email" autocomplete="email" placeholder="seu@email.com" aria-label="Seu e-mail">' +
        '<button class="ent-botao" type="submit">mandar código</button>' +
      "</div></form>" +
      '<form id="form-codigo" autocomplete="off"><div id="entrada-codigo" hidden>' +
        '<input class="ent-campo ent-codigo" id="campo-codigo" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000" aria-label="Código de 6 dígitos">' +
        '<button class="ent-botao" type="submit">entrar</button>' +
      "</div></form>" +
      '<p class="ent-recado" id="entrada-recado" role="status" aria-live="polite"></p>' +
    "</div>";
  document.body.appendChild(d);
  const recado = (t) => { $("entrada-recado").textContent = t; };
  $("entrada-fechar").addEventListener("click", fecharEntrada);
  d.addEventListener("click", (e) => { if (e.target === d) fecharEntrada(); });
  $("form-email").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $("campo-email").value.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(email)) { recado("esse e-mail não parece certo"); return; }
    recado("mandando…");
    const r = await api("/codigo", { method: "POST", body: JSON.stringify({ email }) });
    if (!r.ok) { recado(r.corpo.erro || "não consegui mandar o código"); return; }
    emailPedido = email;
    $("entrada-email").hidden = true; $("entrada-codigo").hidden = false;
    recado("mandei um código de 6 dígitos para " + email);
    $("campo-codigo").value = ""; $("campo-codigo").focus();
  });
  $("form-codigo").addEventListener("submit", async (e) => {
    e.preventDefault();
    const codigo = $("campo-codigo").value.replace(/\D/g, "");
    if (codigo.length !== 6) { recado("o código tem 6 dígitos"); return; }
    recado("conferindo…");
    const r = await api("/entrar", { method: "POST", body: JSON.stringify({ email: emailPedido, codigo }) });
    if (!r.ok) { recado(r.corpo.erro || "código inválido"); return; }
    nuvem.entrou = true;
    nuvem.email = String(r.corpo.email || emailPedido);
    fecharEntrada();
    nuvem.marcar("ligada");
    nuvem.avisar();
    await nuvem.sincronizarTudo();
  });
}
export function abrirEntrada() {
  $("entrada").hidden = false;
  $("entrada-email").hidden = false; $("entrada-codigo").hidden = true;
  $("entrada-recado").textContent = ""; $("campo-email").value = "";
  $("campo-email").focus();
}
export const fecharEntrada = () => { const e = $("entrada"); if (e) e.hidden = true; };

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") { const d = $("entrada"); if (d && !d.hidden) fecharEntrada(); }
});

/* ---------- colecoes ----------
   uma colecao e um conjunto de documentos do mesmo tipo, cada um com id e
   carimbo v. mora em localStorage (merlin:<tipo>) e sobe para /api/docs.
   a regra e a mesma do dia: quem tem o v maior ganha; o servidor devolve a
   versao dele quando recusa, e o cliente adota.

   apagar e um tumulo ({id, apagado:true}): sem ele, o outro aparelho subiria
   o documento de volta na proxima sincronizacao. */

const CARIMBO = (() => { let ultimo = 0; return () => { ultimo = Math.max(Date.now(), ultimo + 1); return ultimo; }; })();

export function colecao(tipo, opcoes = {}) {
  /* a colecao e uma so por tipo. quem chegar depois com um normalizador (o
     dono da colecao, quando o nucleo ja a abriu para mostrar selos) o entrega
     a colecao existente em vez de ser ignorado. */
  if (colecoes.has(tipo)) {
    const c = colecoes.get(tipo);
    if (opcoes.normalizar) c.definirNormalizar(opcoes.normalizar);
    return c;
  }
  const chave = "merlin:" + tipo;
  let normalizar = opcoes.normalizar || ((d) => d);
  const ouvintes = new Set();
  let dados = ler();
  let timerSubir = null;
  let sincronizando = false;

  function ler() {
    let bruto = null;
    try { bruto = JSON.parse(localStorage.getItem(chave)); } catch (e) {}
    const d = { itens: {}, vServidor: 0, sujos: [] };
    if (bruto && typeof bruto === "object") {
      if (bruto.itens && typeof bruto.itens === "object") d.itens = bruto.itens;
      d.vServidor = +bruto.vServidor || 0;
      d.sujos = Array.isArray(bruto.sujos) ? bruto.sujos : [];
    }
    return d;
  }
  function salvar() {
    try { localStorage.setItem(chave, JSON.stringify(dados)); } catch (e) { console.warn("sem localStorage", e); }
  }
  function avisar(origem) {
    ouvintes.forEach((f) => { try { f(origem); } catch (e) { console.error(e); } });
  }
  function docDe(item) {
    if (!item || !item.doc || item.doc.apagado) return null;
    return normalizar({ ...item.doc });
  }

  const c = {
    tipo,
    definirNormalizar(fn) { normalizar = fn; },
    todos() {
      return Object.values(dados.itens).map(docDe).filter(Boolean);
    },
    obter(id) { return docDe(dados.itens[id]); },
    existe(id) { return !!(dados.itens[id] && !dados.itens[id].doc.apagado); },
    gravar(doc) {
      if (!doc || !doc.id) throw new Error("documento sem id");
      const v = CARIMBO();
      const limpo = { ...doc, id: String(doc.id), v };
      dados.itens[limpo.id] = { v, doc: limpo };
      if (!dados.sujos.includes(limpo.id)) dados.sujos.push(limpo.id);
      salvar();
      agendarSubida();
      avisar("local");
      return limpo;
    },
    /* varias gravacoes com um aviso so */
    gravarVarios(docs) {
      docs.forEach((doc) => {
        const v = CARIMBO();
        const limpo = { ...doc, id: String(doc.id), v };
        dados.itens[limpo.id] = { v, doc: limpo };
        if (!dados.sujos.includes(limpo.id)) dados.sujos.push(limpo.id);
      });
      salvar(); agendarSubida(); avisar("local");
    },
    apagar(id) {
      const antes = c.obter(id);
      if (!antes) return null;
      c.gravar({ id, apagado: true });
      return antes;
    },
    aoMudar(fn) { ouvintes.add(fn); return () => ouvintes.delete(fn); },
    async sincronizar() {
      if (!nuvem.entrou || sincronizando) return;
      sincronizando = true;
      try { await baixar(); await subir(); }
      finally { sincronizando = false; }
    },
    recarregar() { dados = ler(); avisar("storage"); }
  };

  async function baixar() {
    try {
      const r = await api("/docs?tipo=" + encodeURIComponent(tipo) + "&desde=" + dados.vServidor, { method: "GET" });
      if (r.status === 401) { nuvem.entrou = false; nuvem.marcar("fora"); nuvem.avisar(); return; }
      if (!r.ok) { nuvem.marcar("erro"); return; }
      let mudou = false;
      (r.corpo.docs || []).forEach((d) => {
        dados.vServidor = Math.max(dados.vServidor, d.v);
        const local = dados.itens[d.id];
        /* o que esta sujo aqui e mais novo que o de la nao e sobrescrito: sobe
           depois e o servidor decide */
        if (local && dados.sujos.includes(d.id) && local.v >= d.v) return;
        if (!local || d.v > local.v) { dados.itens[d.id] = { v: d.v, doc: { ...d.doc, id: d.id, v: d.v } }; mudou = true; }
      });
      salvar();
      if (mudou) avisar("nuvem");
      nuvem.marcar("ligada");
    } catch (e) { nuvem.marcar("offline"); }
  }

  async function subir() {
    if (!nuvem.entrou) return;
    const fila = dados.sujos.slice();
    for (const id of fila) {
      const item = dados.itens[id];
      if (!item) { dados.sujos = dados.sujos.filter((x) => x !== id); continue; }
      try {
        const r = await api("/docs", {
          method: "POST",
          body: JSON.stringify({ tipo, id, v: item.v, doc: item.doc })
        });
        if (r.ok) {
          dados.vServidor = Math.max(dados.vServidor, item.v);
          dados.sujos = dados.sujos.filter((x) => x !== id);
          nuvem.marcar("ligada");
        } else if (r.status === 409 && r.corpo.servidor) {
          const s = r.corpo.servidor;
          dados.itens[id] = { v: s.v, doc: { ...s.doc, id, v: s.v } };
          dados.vServidor = Math.max(dados.vServidor, s.v);
          dados.sujos = dados.sujos.filter((x) => x !== id);
          avisar("nuvem");
        } else if (r.status === 401) {
          nuvem.entrou = false; nuvem.marcar("fora"); nuvem.avisar(); break;
        } else { nuvem.marcar("erro"); break; }
      } catch (e) { nuvem.marcar("offline"); break; }
    }
    salvar();
  }

  function agendarSubida() {
    if (!nuvem.entrou) return;
    clearTimeout(timerSubir);
    timerSubir = setTimeout(() => subir(), 1200);
  }

  /* outra aba gravou: recarrega e avisa */
  window.addEventListener("storage", (e) => { if (e.key === chave) c.recarregar(); });

  colecoes.set(tipo, c);
  return c;
}

/* sobe o que ficou sujo antes de a aba sumir, e baixa ao voltar */
document.addEventListener("visibilitychange", () => {
  if (!nuvem.entrou) return;
  if (document.hidden) { for (const c of colecoes.values()) c.sincronizar(); }
  else nuvem.sincronizarTudo();
});

/* ---------- frentes ----------
   o cadastro das empresas. e uma colecao como as outras, mas todo modulo
   precisa dela para mostrar selo — por isso mora aqui, com as sementes. */

export const FRENTES_SEMENTE = [
  { id: "artt", nome: "Artt Reis", cor: 5, ordem: 1 },
  { id: "guessless", nome: "Guessless", cor: 1, ordem: 2 },
  { id: "glsuite", nome: "GL Suite", cor: 4, ordem: 3 },
  { id: "saas", nome: "SaaS (Léo e Luca)", cor: 2, ordem: 4 },
  { id: "pessoal", nome: "Pessoal", cor: 6, ordem: 5 }
];

export function frentes() {
  const c = colecao("frentes", {
    normalizar: (d) => ({ id: d.id, nome: String(d.nome || "").slice(0, 60), cor: +d.cor || 0, ordem: +d.ordem || 99, v: d.v })
  });
  if (!c.todos().length) c.gravarVarios(FRENTES_SEMENTE);
  return c;
}
export const listarFrentes = () => frentes().todos().sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome));
export const seloFrente = (id) => {
  const f = id && frentes().obter(id);
  if (!f) return "";
  return '<span class="selo" data-cor="' + f.cor + '"><i class="ponto"></i>' + escapar(f.nome) + "</span>";
};
/* o numero da cor da frente (0 se nao ha), para quem pinta alem do selo */
export const corFrente = (id) => { const f = id && frentes().obter(id); return f ? f.cor : 0; };
export function opcoesFrente(escolhida, vazio) {
  return (vazio != null ? '<option value="">' + escapar(vazio) + "</option>" : "") +
    listarFrentes().map((f) => '<option value="' + f.id + '"' + (f.id === escolhida ? " selected" : "") + ">" + escapar(f.nome) + "</option>").join("");
}

/* clientes: o indice leve que os outros modulos usam para selo e escolha.
   a colecao inteira mora em clientes.html; aqui so o que e comum. */
export const clientes = () => colecao("clientes");
export const listarClientes = () => clientes().todos().filter((c) => c.status !== "encerrado").sort((a, b) => String(a.nome).localeCompare(String(b.nome)));
export const nomeCliente = (id) => { const c = id && clientes().obter(id); return c ? c.nome : ""; };
export function opcoesCliente(escolhido, vazio, frente) {
  return (vazio != null ? '<option value="">' + escapar(vazio) + "</option>" : "") +
    listarClientes().filter((c) => !frente || c.frente === frente)
      .map((c) => '<option value="' + c.id + '"' + (c.id === escolhido ? " selected" : "") + ">" + escapar(c.nome) + "</option>").join("");
}

/* ---------- @frente e @cliente no texto ----------
   "@guessless" ou "@lojax" liga o que esta sendo escrito a uma frente ou a
   um cliente. compara sem acento, sem espaco e sem caixa, com o id e com o
   nome; frente ganha do cliente quando os dois casam. o que nao casou fica
   no texto, porque pode ser so um arroba. */
export const chato = (v) => String(v || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/gi, "").toLowerCase();
const ARROBA = /(?:^|\s)@([^\s@]+)/g;
export function lerArrobas(texto) {
  let frente = "", cliente = "";
  const fr = listarFrentes(), cl = listarClientes();
  const titulo = String(texto || "").replace(ARROBA, (m, tok) => {
    const k = chato(tok);
    if (!k) return m;
    const f = fr.find((x) => chato(x.id) === k || chato(x.nome) === k || chato(x.nome).startsWith(k));
    if (f && !frente) { frente = f.id; return " "; }
    const c = cl.find((x) => chato(x.nome) === k || chato(x.nome).startsWith(k));
    if (c && !cliente) { cliente = c.id; if (!frente && c.frente) frente = c.frente; return " "; }
    return m;
  });
  return { frente, cliente, titulo: titulo.replace(/\s+/g, " ").trim() };
}

/* ---------- caixa de entrada do dia ----------
   quem quer mandar algo para hoje escreve aqui. o dia esvazia ao abrir e ao
   receber o evento de storage. nada aqui toca no documento do dia. */

const CHAVE_ENTRADA = "merlin:entrada";
export function lerEntrada() {
  try { const v = JSON.parse(localStorage.getItem(CHAVE_ENTRADA)); return Array.isArray(v) ? v : []; }
  catch (e) { return []; }
}
export function gravarEntrada(lista) {
  try { localStorage.setItem(CHAVE_ENTRADA, JSON.stringify(lista)); } catch (e) {}
}
/* item: {titulo, min?, frente?, cliente?, origem:{tipo,id}} */
export function mandarParaODia(item) {
  const lista = lerEntrada();
  lista.push({
    id: novoId(),
    titulo: String(item.titulo || "").trim().slice(0, 200),
    min: Math.max(0, Math.round(+item.min || 0)),
    frente: item.frente || "",
    cliente: item.cliente || "",
    origem: item.origem || null,
    quando: Date.now()
  });
  gravarEntrada(lista);
  mostrarAviso(item.min ? "foi para a fila de hoje" : "foi para a caixa de ideias do dia — lá ela ganha duração");
}

/* ---------- markdown minimo ----------
   paragrafos, listas, negrito, italico, links e codigo. o suficiente para
   uma nota; nada que mereca uma biblioteca. */
export function md(texto) {
  const linhas = String(texto || "").split(/\r?\n/);
  let html = "", lista = null;
  const inline = (s) => escapar(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    .replace(/(^|\s)\*([^*]+)\*/g, "$1<i>$2</i>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a class="link" href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/(^|\s)(https?:\/\/[^\s<]+)/g, '$1<a class="link" href="$2" target="_blank" rel="noopener">$2</a>');
  const fecharLista = () => { if (lista) { html += "</" + lista + ">"; lista = null; } };
  linhas.forEach((l) => {
    const m = l.match(/^\s*(?:[-*]|(\d+)[.)])\s+(.*)$/);
    if (m) {
      const tipo = m[1] ? "ol" : "ul";
      if (lista !== tipo) { fecharLista(); html += "<" + tipo + ">"; lista = tipo; }
      const chk = m[2].match(/^\[( |x)\]\s+(.*)$/i);
      html += chk ? '<li class="chk' + (chk[1].toLowerCase() === "x" ? " is-feita" : "") + '">' + inline(chk[2]) + "</li>" : "<li>" + inline(m[2]) + "</li>";
      return;
    }
    fecharLista();
    if (!l.trim()) return;
    const h = l.match(/^\s*(#{1,3})\s+(.*)$/);
    if (h) { html += "<h" + (h[1].length + 2) + ">" + inline(h[2]) + "</h" + (h[1].length + 2) + ">"; return; }
    html += "<p>" + inline(l) + "</p>";
  });
  fecharLista();
  return html;
}

/* ---------- icones comuns ---------- */
export const ICONE = {
  lixo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M9.5 7V5h5v2M6.5 7l1 12.5h9L17.5 7"/></svg>',
  seta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h13M12 5l7 7-7 7"/></svg>',
  mais: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12.5l5.5 5.5L20 6.5"/></svg>',
  lapis: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4l10.5-10.5a2.1 2.1 0 00-3-3L5 17v3z"/><path d="M13.5 6.5l3 3"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13.5a4 4 0 006 .5l2.5-2.5a4 4 0 10-5.7-5.7L11.5 7"/><path d="M14 10.5a4 4 0 00-6-.5L5.5 12.5a4 4 0 105.7 5.7L12.5 17"/></svg>',
  pega: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  relogio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 2"/></svg>',
  mapa: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="2.5"/><circle cx="4.5" cy="6" r="2"/><circle cx="19.5" cy="6" r="2"/><circle cx="4.5" cy="18" r="2"/><circle cx="19.5" cy="18" r="2"/><path d="M6.3 7l3.7 3.5M17.7 7L14 10.5M6.3 17l3.7-3.5M17.7 17L14 13.5"/></svg>'
};

/* ---------- inicio comum ---------- */
export function iniciarPagina(id) {
  montarNav(id);
  frentes();
  clientes();
  nuvem.retomar();
}
