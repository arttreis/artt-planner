/* merlin · core compartilhado
 *
 * o que toda pagina precisa e nenhuma deveria reescrever: tema, barra de
 * navegacao, sessao com o worker, colecoes que sincronizam por documento, e a
 * caixa de entrada por onde os modulos mandam coisa para o dia.
 *
 * e um ES module sem dependencia. cada pagina importa o que usa. quem desenha
 * tela e o ui.js; aqui so os dados e a casca imperativa (sidebar, entrar,
 * aviso), que servem para pagina antiga e nova.
 *
 * tudo em ingles: identificadores, chaves do localStorage, tipos de colecao,
 * campos dos documentos e rotas. so o que aparece na tela e em portugues.
 */

/* ---------- utilidades ---------- */

export const $ = (id) => document.getElementById(id);

export const escapeHtml = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const SESSION_ID = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
let idCounter = 0;
export const newId = () => SESSION_ID + "-" + (++idCounter).toString(36);

/* a data como o estado a guarda: YYYY-MM-DD no fuso local, nunca ISO/UTC —
   toISOString() em Sao Paulo joga tudo depois das 21h para o dia seguinte. */
export function dayOf(d) {
  const p = (n) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
}
export const today = () => dayOf(new Date());
export const isDay = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
export const dateOf = (day) => { const [y, m, d] = day.split("-").map(Number); return new Date(y, m - 1, d); };
export const addDays = (day, n) => { const d = dateOf(day); d.setDate(d.getDate() + n); return dayOf(d); };

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
export const dateLabel = (day, withYear) => {
  if (!isDay(day)) return "";
  const d = dateOf(day);
  return d.getDate() + " " + MONTHS[d.getMonth()] + (withYear ? " " + d.getFullYear() : "");
};
export const weekdayOf = (day) => WEEKDAYS[dateOf(day).getDay()];
export const monthLabel = (yyyymm) => {
  const [y, m] = yyyymm.split("-").map(Number);
  return MONTHS[m - 1] + " " + y;
};
/* segunda-feira da semana que contem `day` */
export function mondayOf(day) {
  const d = dateOf(day);
  const dow = d.getDay();
  d.setDate(d.getDate() - ((dow + 6) % 7));
  return dayOf(d);
}

/* dinheiro em centavos, para nunca somar float */
export const brl = (cents, sign) => {
  const v = Math.abs(cents) / 100;
  const s = v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  if (sign && cents < 0) return "−" + s;
  return s;
};
export function parseMoney(text) {
  /* aceita "1.234,56", "1.200" (milhar), "1234.56" (decimal), "1234", "R$ 12".
     a regra do ponto: com virgula presente, ponto e milhar; sem virgula, ponto
     seguido de exatamente 3 digitos no fim e milhar, senao e decimal. */
  const t = String(text || "").replace(/[^\d,.-]/g, "");
  if (!t) return 0;
  let n;
  if (t.includes(",")) n = parseFloat(t.replace(/\./g, "").replace(",", "."));
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) n = parseFloat(t.replace(/\./g, ""));
  else n = parseFloat(t);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export const formatMin = (min) => {
  min = Math.max(0, Math.round(min));
  const h = Math.floor(min / 60), m = min % 60;
  if (h && m) return h + "h" + String(m).padStart(2, "0");
  if (h) return h + "h";
  return m + "m";
};
/* a duracao no fim do texto: "45m", "1h30", "2h 15m", "meia hora", "1,5h" */
export function parseDuration(text) {
  const t = String(text || "").trim();
  const re = /\s*(?:(\d+(?:[.,]\d+)?)\s*h(?:oras?)?\s*(?:(\d{1,2})\s*(?:m(?:in)?)?)?|(\d+)\s*m(?:in(?:utos?)?)?|(meia hora))\s*$/i;
  const m = t.match(re);
  if (!m) return { min: 0, title: t };
  let min = 0;
  if (m[4]) min = 30;
  else if (m[1] != null) min = Math.round(parseFloat(m[1].replace(",", ".")) * 60) + (+m[2] || 0);
  else min = +m[3];
  if (!min) return { min: 0, title: t };
  return { min, title: t.slice(0, m.index).trim() };
}

export const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

/* ---------- tema ---------- */

const THEME_KEY = "merlin:theme";

export function currentTheme() {
  return document.documentElement.classList.contains("light") ? "light" : "dark";
}
export function applyTheme(which) {
  document.documentElement.classList.toggle("light", which === "light");
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = which === "light" ? "#f2f2f0" : "#0d0d0d";
}
export function savedTheme() {
  try { return localStorage.getItem(THEME_KEY) || ""; } catch (e) { return ""; }
}
export function initTheme() {
  const saved = savedTheme();
  if (saved) { applyTheme(saved); return; }
  applyTheme(window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
}
export function toggleTheme() {
  const next = currentTheme() === "light" ? "dark" : "light";
  applyTheme(next);
  try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
}
/* aplica antes da primeira pintura, para nao piscar */
initTheme();

/* a sidebar empurra o conteudo via html.merlin (shell.css). a classe entra
   aqui, no import, para o layout ja nascer certo; e o estado recolhida vem
   junto, do localStorage. */
document.documentElement.classList.add("merlin");
try { if (localStorage.getItem("merlin:sidebar") === "closed") document.documentElement.classList.add("sidebar-closed"); } catch (e) {}

/* ---------- navegacao ---------- */

export const PAGES = [
  { id: "day", label: "dia", href: "index.html" },
  { id: "week", label: "semana", href: "week.html" },
  { id: "ideas", label: "ideias", href: "ideas.html" },
  { id: "clients", label: "clientes", href: "clients.html" },
  { id: "funnels", label: "funis", href: "funnels.html" },
  { id: "maps", label: "mapas", href: "maps.html" },
  { id: "finance", label: "financeiro", href: "finance.html" }
];

const LOGO = '<svg viewBox="0 0 472.5 472.5" fill="currentColor" aria-hidden="true"><path d="M236.31,236.23c-3.63,128.42,107.71,238.95,236.22,236.22v-118.11c-64.78,2.88-121-53.42-118.11-118.11h-118.11Z"/><path d="M236.22,0C239.85,128.42,128.52,238.95,0,236.22v-118.11C64.78,120.99,121,64.69,118.11,0h118.11Z"/><path d="M315.07,0h77.61c44.09,0,79.89,35.8,79.89,79.89v77.61h-157.5V0h0Z"/><path d="M79.96,315H.07v78.75h78.75v78.75h78.75v-79.89c0-42.86-34.75-77.61-77.61-77.61Z"/></svg>';

const NAV_ICONS = {
  day: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  week: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  ideas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 21h4M12 3a6 6 0 00-3.5 10.9c.7.5 1 1.3 1 2.1h5c0-.8.3-1.6 1-2.1A6 6 0 0012 3z"/></svg>',
  clients: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0113 0"/><circle cx="17" cy="9" r="2.5"/><path d="M15.5 14.5a5 5 0 016 5.5"/></svg>',
  funnels: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h18l-7 8.5V20l-4-2v-5.5z"/></svg>',
  maps: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="2.5"/><circle cx="4.5" cy="6" r="2"/><circle cx="19.5" cy="6" r="2"/><circle cx="4.5" cy="18" r="2"/><circle cx="19.5" cy="18" r="2"/><path d="M6.3 7l3.7 3.5M17.7 7L14 10.5M6.3 17l3.7-3.5M17.7 17L14 13.5"/></svg>',
  finance: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 6.5v11M15 9.2c0-1.2-1.3-2-3-2s-3 .8-3 2 1.3 1.8 3 2 3 .9 3 2.1-1.3 2-3 2-3-.8-3-2"/></svg>',
  docs: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/></svg>',
  fold: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M14 10l-2 2 2 2"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  theme: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a9 9 0 100 18 7 7 0 010-18z"/></svg>',
  sun: '<svg class="knob__sol" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/></svg>',
  moon: '<svg class="knob__lua" viewBox="0 0 24 24" fill="currentColor"><path d="M14.5 3.5a8.5 8.5 0 1 0 6 14.3 7 7 0 0 1-6-14.3z"/><path d="M18.5 3l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/></svg>'
};

/* monta a sidebar: logo, busca, as sete telas, tema, nuvem e quem esta aqui */
export function mountNav(current) {
  const sb = document.createElement("aside");
  sb.className = "sb";
  sb.setAttribute("aria-label", "Navegação");
  sb.innerHTML =
    '<div class="sb__top">' +
      '<a class="sb__logo" href="index.html" aria-label="Merlin">' + LOGO + "<b>merlin</b></a>" +
      '<button class="sb__fold" type="button" id="sb-fold" title="Recolher (Ctrl+B)" aria-label="Recolher a barra">' + NAV_ICONS.fold + "</button>" +
    "</div>" +
    '<div class="sb__search"><label class="sb__search-field">' + NAV_ICONS.search +
      '<input id="sb-search" type="search" placeholder="buscar…" autocomplete="off" aria-label="Buscar em tudo"><kbd>ctrl k</kbd></label>' +
      '<div class="sb__results" id="sb-results" hidden></div></div>' +
    '<ul class="sb__list">' +
      PAGES.map((p) =>
        '<li><a class="sb__item" href="' + p.href + '"' + (p.id === current ? ' aria-current="page"' : "") + ' title="' + p.label + '">' +
        (NAV_ICONS[p.id] || "") + "<span>" + p.label + "</span></a></li>"
      ).join("") +
    "</ul>" +
    '<div class="sb__sep"></div>' +
    '<ul class="sb__list">' +
      '<li><button class="sb__item sb__theme" type="button" id="theme" aria-label="Alternar tema claro/escuro" title="tema">' +
        '<span style="display:flex;align-items:center;gap:10px">' + NAV_ICONS.theme + "<span>tema</span></span>" +
        /* o interruptor: a bolinha desliza e, do lado vazio, fica o icone do
           modo que esta ativo — lua no escuro, sol no claro */
        '<span class="knob" aria-hidden="true">' + NAV_ICONS.sun + NAV_ICONS.moon + '<span class="knob__dot"></span></span></button></li>' +
    "</ul>" +
    '<div class="sb__spacer"></div>' +
    '<div class="sb__card">' +
      '<div class="cloud" id="cloud" data-status="local"><i class="dot"></i><span id="cloud-status">só neste navegador</span></div>' +
      '<p id="cloud-text">entre com seu e-mail para levar o Merlin a outros aparelhos.</p>' +
      '<button class="pill pill--green" type="button" id="cloud-action">entrar</button>' +
    "</div>" +
    '<div class="sb__who">' +
      '<span class="avatar is-out" id="sb-avatar">?</span>' +
      '<span class="who"><b id="sb-name">só você</b><span id="sb-email">sem sessão</span></span>' +
      '<button type="button" id="cloud-signout" hidden>sair</button>' +
    "</div>";
  document.body.prepend(sb);

  /* a barra fina do celular e o escurecedor da gaveta */
  const mobileBar = document.createElement("div");
  mobileBar.className = "sb__mobile";
  mobileBar.innerHTML =
    '<button type="button" id="sb-open" aria-label="Abrir a navegação">' + NAV_ICONS.menu + "</button>" +
    '<a class="sb__logo" href="index.html" aria-label="Merlin">' + LOGO + "<b>merlin</b></a>";
  const scrim = document.createElement("div");
  scrim.className = "sb__scrim";
  document.body.prepend(scrim);
  document.body.prepend(mobileBar);

  const root = document.documentElement;
  const closeDrawer = () => root.classList.remove("sidebar-open");
  $("sb-open").addEventListener("click", () => root.classList.toggle("sidebar-open"));
  scrim.addEventListener("click", closeDrawer);
  $("sb-fold").addEventListener("click", toggleSidebar);
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") { e.preventDefault(); toggleSidebar(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); $("sb-search").focus(); $("sb-search").select(); }
    if (e.key === "Escape") { closeDrawer(); closeSearchResults(); }
  });

  $("theme").addEventListener("click", toggleTheme);
  mountSignIn();
  mountSearch();
  $("cloud-action").addEventListener("click", (e) => {
    if (e.currentTarget.dataset.for === "error") { cloud.syncAll(); return; }
    openSignIn();
  });
  $("cloud-signout").addEventListener("click", async () => {
    await api("/sign-out", { method: "POST" }).catch(() => {});
    cloud.signedIn = false; cloud.email = "";
    cloud.setStatus("local");
    cloud.emit();
  });
  cloud.setStatus(cloud.signedIn ? "synced" : "local");
  return sb;
}

export function toggleSidebar() {
  const root = document.documentElement;
  root.classList.toggle("sidebar-closed");
  try { localStorage.setItem("merlin:sidebar", root.classList.contains("sidebar-closed") ? "closed" : "open"); } catch (e) {}
  /* quem desenha em SVG mede o container: avisa que ele mudou de tamanho */
  setTimeout(() => window.dispatchEvent(new Event("resize")), 320);
}

/* ---------- busca global ----------
   procura por titulo em tudo que mora no navegador: ideias, clientes,
   cartoes da semana, mapas, funis e lancamentos. nao e indice: e um filtro
   sobre o que ja esta em memoria, e por isso e instantaneo. */
const SEARCH_SOURCES = [
  { type: "ideas", label: "ideia", field: "title", href: (d) => "ideas.html#" + encodeURIComponent(d.id) },
  { type: "clients", label: "cliente", field: "name", href: (d) => "clients.html#" + encodeURIComponent(d.id) },
  { type: "week", label: "semana", field: "title", href: () => "week.html", filter: (d) => !d.done },
  { type: "maps", label: "mapa", field: "name", href: (d) => "maps.html#" + encodeURIComponent(d.id) },
  { type: "funnels", label: "funil", field: "name", href: (d) => "funnels.html#" + encodeURIComponent(d.id) },
  { type: "finance", label: "R$", field: "name", href: () => "finance.html", filter: (d) => d.type === "entry" || d.type === "fixed" || d.type === "debt" || d.type === "card" }
];
export function search(term) {
  const k = foldKey(term);
  if (!k || k.length < 2) return [];
  const hits = [];
  SEARCH_SOURCES.forEach((src) => {
    collection(src.type).all().forEach((d) => {
      if (src.filter && !src.filter(d)) return;
      const text = String(d[src.field] || "");
      if (foldKey(text).includes(k)) hits.push({ label: src.label, text, href: src.href(d) });
    });
  });
  return hits.slice(0, 12);
}
function closeSearchResults() { const a = $("sb-results"); if (a) a.hidden = true; }
function mountSearch() {
  const input = $("sb-search"), box = $("sb-results");
  let focus = -1;
  const draw = () => {
    const hits = search(input.value);
    focus = -1;
    if (!input.value.trim()) { box.hidden = true; return; }
    box.hidden = false;
    box.innerHTML = hits.length
      ? hits.map((a) => '<a href="' + a.href + '"><span class="t-mono">' + escapeHtml(a.label) + "</span><span>" + escapeHtml(a.text) + "</span></a>").join("")
      : "<p>nada com esse nome</p>";
  };
  input.addEventListener("input", draw);
  input.addEventListener("focus", () => { if (input.value.trim()) draw(); });
  input.addEventListener("keydown", (e) => {
    const links = [...box.querySelectorAll("a")];
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!links.length) return;
      focus = (focus + (e.key === "ArrowDown" ? 1 : links.length - 1)) % links.length;
      links.forEach((l, i) => l.classList.toggle("is-focus", i === focus));
      links[focus].scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter") {
      const target = links[focus >= 0 ? focus : 0];
      if (target) location.href = target.href;
    } else if (e.key === "Escape") { input.value = ""; box.hidden = true; input.blur(); }
  });
  document.addEventListener("click", (e) => { if (!e.target.closest(".sb__search")) closeSearchResults(); });
}

/* ---------- aviso com desfazer ---------- */

let noticeEl = null, noticeTimer = null, undoAction = null;
export function notify(text, undo) {
  if (!noticeEl) {
    noticeEl = document.createElement("div");
    noticeEl.className = "notice";
    noticeEl.setAttribute("role", "status");
    noticeEl.innerHTML = '<span></span><button type="button" hidden>desfazer</button>';
    noticeEl.querySelector("button").addEventListener("click", () => {
      const f = undoAction; closeNotice(); if (f) f();
    });
    document.body.appendChild(noticeEl);
  }
  noticeEl.querySelector("span").textContent = text;
  const b = noticeEl.querySelector("button");
  undoAction = undo || null;
  b.hidden = !undo;
  noticeEl.hidden = false;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(closeNotice, undo ? 7000 : 3500);
}
export function closeNotice() { if (noticeEl) noticeEl.hidden = true; undoAction = null; }

/* ---------- formulario em dialogo (versao por string) ----------
   e o que as paginas ainda nao migradas usam. as migradas usam o
   <Formulario> do ui.js. some na fase 7 da migracao. `fields` e HTML de
   campos com atributo name; `onSubmit(values, form)` recebe {name: valor} e,
   devolvendo false, mantem a caixa aberta. */
let openFormEl = null;
export const formField = (label, htmlText, full) =>
  "<div" + (full ? ' class="full"' : "") + '><label class="field-label">' + escapeHtml(label) + "</label>" + htmlText + "</div>";
export function openForm({ title, sub, fields, submit, remove, onSubmit, onRemove, onOpen, wide }) {
  closeForm();
  const d = document.createElement("div");
  d.className = "dialog dialog--form";
  d.setAttribute("role", "dialog"); d.setAttribute("aria-modal", "true"); d.setAttribute("aria-label", title);
  d.innerHTML =
    '<form class="dialog__box' + (wide ? " dialog__box--wide" : "") + '" autocomplete="off">' +
      '<button class="dialog__close" type="button" data-close aria-label="Fechar">' + ICONS.x + "</button>" +
      '<p class="dialog__title">' + escapeHtml(title) + "</p>" +
      (sub ? '<p class="dialog__sub">' + escapeHtml(sub) + "</p>" : "") +
      '<div class="form-grid">' + fields + "</div>" +
      '<div class="dialog__actions">' +
        (remove ? '<button class="link" type="button" data-remove>' + escapeHtml(remove) + '</button><span class="spacer"></span>' : "") +
        '<button class="pill" type="button" data-close>cancelar</button>' +
        '<button class="pill pill--green" type="submit">' + escapeHtml(submit || "salvar") + "</button>" +
      "</div>" +
    "</form>";
  document.body.appendChild(d);
  openFormEl = d;
  const form = d.querySelector("form");
  const values = () => {
    const o = {};
    form.querySelectorAll("[name]").forEach((el) => { o[el.name] = el.type === "checkbox" ? el.checked : el.value; });
    return o;
  };
  d.addEventListener("click", (e) => { if (e.target === d || e.target.closest("[data-close]")) closeForm(); });
  const removeBtn = d.querySelector("[data-remove]");
  if (removeBtn) removeBtn.addEventListener("click", () => { closeForm(); if (onRemove) onRemove(); });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const r = onSubmit ? onSubmit(values(), form) : undefined;
    if (r !== false) closeForm();
  });
  if (onOpen) onOpen(form);
  const first = form.querySelector("input:not([type=hidden]),select,textarea");
  if (first) { first.focus(); if (first.select && first.type !== "date") first.select(); }
  return form;
}
export function closeForm() { if (openFormEl) { openFormEl.remove(); openFormEl = null; } }
export const isFormOpen = () => !!openFormEl;
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && openFormEl) { e.stopPropagation(); closeForm(); } }, true);

/* ---------- sessao e nuvem ---------- */

const API = "/api";
export async function api(route, options) {
  const r = await fetch(API + route, {
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    ...options
  });
  const body = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, body };
}

/* os estados da nuvem: synced (entrou e esta em dia), local (so este
   navegador), offline (sem rede, sobe depois), error (o servidor falhou) */
const STATUS_LINES = {
  synced:  ["sincronizado", ""],
  local:   ["só neste navegador", "entrar"],
  offline: ["sem conexão — sobe depois", ""],
  error:   ["não consegui sincronizar", "tentar de novo"]
};
const STATUS_TEXTS = {
  synced: "o mesmo Merlin em todos os seus aparelhos.",
  local: "entre com seu e-mail para levar o Merlin a outros aparelhos.",
  offline: "sem rede agora; o que você fizer sobe quando voltar.",
  error: "o servidor não respondeu; tente de novo."
};

const collections = new Map();
const cloudListeners = new Set();

export const cloud = {
  signedIn: false,
  email: "",
  status: "local",
  setStatus(which) {
    this.status = which;
    const el = $("cloud"); if (!el) return;
    const [text, action] = STATUS_LINES[which] || STATUS_LINES.local;
    el.dataset.status = which;
    $("cloud-status").textContent = text;
    const t = $("cloud-text"); if (t) t.textContent = STATUS_TEXTS[which] || STATUS_TEXTS.local;
    const b = $("cloud-action");
    b.hidden = !action; b.textContent = action; b.dataset.for = which;
    $("cloud-signout").hidden = !this.signedIn;
    /* quem esta aqui */
    const av = $("sb-avatar"), name = $("sb-name"), email = $("sb-email");
    if (av) {
      const e = this.signedIn ? String(this.email || "") : "";
      av.textContent = e ? e[0].toUpperCase() : "?";
      av.classList.toggle("is-out", !e);
      name.textContent = e ? e.split("@")[0] : "só você";
      email.textContent = e || "sem sessão";
    }
  },
  onChange(fn) { cloudListeners.add(fn); return () => cloudListeners.delete(fn); },
  emit() { cloudListeners.forEach((f) => { try { f(this); } catch (e) { console.error(e); } }); },
  async resume() {
    try {
      const r = await api("/me", { method: "GET" });
      this.signedIn = !!(r.ok && r.body.signedIn);
      this.email = this.signedIn ? String(r.body.email || "") : "";
    } catch (e) { this.signedIn = false; this.email = ""; }
    this.setStatus(this.signedIn ? "synced" : "local");
    this.emit();
    if (this.signedIn) await this.syncAll();
  },
  async syncAll() {
    if (!this.signedIn) return;
    for (const c of collections.values()) await c.sync();
  }
};

/* a tela de entrar: e-mail, codigo, sessao. igual a do dia. */
let requestedEmail = "";
function mountSignIn() {
  if ($("signin")) return;
  const d = document.createElement("div");
  d.className = "dialog"; d.id = "signin"; d.hidden = true;
  d.setAttribute("role", "dialog"); d.setAttribute("aria-modal", "true"); d.setAttribute("aria-label", "Entrar");
  d.innerHTML =
    '<div class="dialog__box">' +
      '<button class="dialog__close" type="button" id="signin-close" aria-label="Fechar">✕</button>' +
      '<p class="dialog__title">Levar o Merlin para outros aparelhos</p>' +
      '<form id="form-email" autocomplete="on"><div id="signin-email">' +
        '<p class="dialog__sub">Sem senha: mando um código de 6 dígitos.</p>' +
        '<input class="signin-input" id="email-input" type="email" inputmode="email" autocomplete="email" placeholder="seu@email.com" aria-label="Seu e-mail">' +
        '<button class="signin-button" type="submit">mandar código</button>' +
      "</div></form>" +
      '<form id="form-code" autocomplete="off"><div id="signin-code-step" hidden>' +
        '<input class="signin-input signin-code" id="code-input" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000" aria-label="Código de 6 dígitos">' +
        '<button class="signin-button" type="submit">entrar</button>' +
      "</div></form>" +
      '<p class="signin-message" id="signin-message" role="status" aria-live="polite"></p>' +
    "</div>";
  document.body.appendChild(d);
  const say = (t) => { $("signin-message").textContent = t; };
  $("signin-close").addEventListener("click", closeSignIn);
  d.addEventListener("click", (e) => { if (e.target === d) closeSignIn(); });
  $("form-email").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $("email-input").value.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(email)) { say("esse e-mail não parece certo"); return; }
    say("mandando…");
    const r = await api("/code", { method: "POST", body: JSON.stringify({ email }) });
    if (!r.ok) { say(r.body.error || "não consegui mandar o código"); return; }
    requestedEmail = email;
    $("signin-email").hidden = true; $("signin-code-step").hidden = false;
    say("mandei um código de 6 dígitos para " + email);
    $("code-input").value = ""; $("code-input").focus();
  });
  $("form-code").addEventListener("submit", async (e) => {
    e.preventDefault();
    const code = $("code-input").value.replace(/\D/g, "");
    if (code.length !== 6) { say("o código tem 6 dígitos"); return; }
    say("conferindo…");
    const r = await api("/sign-in", { method: "POST", body: JSON.stringify({ email: requestedEmail, code }) });
    if (!r.ok) { say(r.body.error || "código inválido"); return; }
    cloud.signedIn = true;
    cloud.email = String(r.body.email || requestedEmail);
    closeSignIn();
    cloud.setStatus("synced");
    cloud.emit();
    await cloud.syncAll();
  });
}
export function openSignIn() {
  $("signin").hidden = false;
  $("signin-email").hidden = false; $("signin-code-step").hidden = true;
  $("signin-message").textContent = ""; $("email-input").value = "";
  $("email-input").focus();
}
export const closeSignIn = () => { const e = $("signin"); if (e) e.hidden = true; };

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") { const d = $("signin"); if (d && !d.hidden) closeSignIn(); }
});

/* ---------- colecoes ----------
   uma colecao e um conjunto de documentos do mesmo tipo, cada um com id e
   carimbo v. mora em localStorage (merlin:<tipo>) e sobe para /api/docs.
   a regra e a mesma do dia: quem tem o v maior ganha; o servidor devolve a
   versao dele quando recusa, e o cliente adota.

   apagar e um tumulo ({id, deleted:true}): sem ele, o outro aparelho subiria
   o documento de volta na proxima sincronizacao. */

const STAMP = (() => { let last = 0; return () => { last = Math.max(Date.now(), last + 1); return last; }; })();

export function collection(type, options = {}) {
  /* a colecao e uma so por tipo. quem chegar depois com um normalizador (o
     dono da colecao, quando o core ja a abriu para mostrar selos) o entrega
     a colecao existente em vez de ser ignorado. */
  if (collections.has(type)) {
    const c = collections.get(type);
    if (options.normalize) c.setNormalize(options.normalize);
    return c;
  }
  const key = "merlin:" + type;
  let normalize = options.normalize || ((d) => d);
  const listeners = new Set();
  let data = read();
  let uploadTimer = null;
  let syncing = false;

  function read() {
    let raw = null;
    try { raw = JSON.parse(localStorage.getItem(key)); } catch (e) {}
    const d = { items: {}, serverV: 0, dirty: [] };
    if (raw && typeof raw === "object") {
      if (raw.items && typeof raw.items === "object") d.items = raw.items;
      d.serverV = +raw.serverV || 0;
      d.dirty = Array.isArray(raw.dirty) ? raw.dirty : [];
    }
    return d;
  }
  function persist() {
    try { localStorage.setItem(key, JSON.stringify(data)); } catch (e) { console.warn("sem localStorage", e); }
  }
  function emit(origin) {
    listeners.forEach((f) => { try { f(origin); } catch (e) { console.error(e); } });
  }
  function docOf(item) {
    if (!item || !item.doc || item.doc.deleted) return null;
    return normalize({ ...item.doc });
  }

  const c = {
    type,
    setNormalize(fn) { normalize = fn; },
    all() {
      return Object.values(data.items).map(docOf).filter(Boolean);
    },
    get(id) { return docOf(data.items[id]); },
    has(id) { return !!(data.items[id] && !data.items[id].doc.deleted); },
    save(doc) {
      if (!doc || !doc.id) throw new Error("documento sem id");
      const v = STAMP();
      const clean = { ...doc, id: String(doc.id), v };
      data.items[clean.id] = { v, doc: clean };
      if (!data.dirty.includes(clean.id)) data.dirty.push(clean.id);
      persist();
      scheduleUpload();
      emit("local");
      return clean;
    },
    /* varias gravacoes com um aviso so */
    saveMany(docs) {
      docs.forEach((doc) => {
        const v = STAMP();
        const clean = { ...doc, id: String(doc.id), v };
        data.items[clean.id] = { v, doc: clean };
        if (!data.dirty.includes(clean.id)) data.dirty.push(clean.id);
      });
      persist(); scheduleUpload(); emit("local");
    },
    remove(id) {
      const before = c.get(id);
      if (!before) return null;
      c.save({ id, deleted: true });
      return before;
    },
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    async sync() {
      if (!cloud.signedIn || syncing) return;
      syncing = true;
      try { await download(); await upload(); }
      finally { syncing = false; }
    },
    reload() { data = read(); emit("storage"); }
  };

  async function download() {
    try {
      const r = await api("/docs?type=" + encodeURIComponent(type) + "&since=" + data.serverV, { method: "GET" });
      if (r.status === 401) { cloud.signedIn = false; cloud.setStatus("local"); cloud.emit(); return; }
      if (!r.ok) { cloud.setStatus("error"); return; }
      let changed = false;
      (r.body.docs || []).forEach((d) => {
        data.serverV = Math.max(data.serverV, d.v);
        const local = data.items[d.id];
        /* o que esta sujo aqui e mais novo que o de la nao e sobrescrito: sobe
           depois e o servidor decide */
        if (local && data.dirty.includes(d.id) && local.v >= d.v) return;
        if (!local || d.v > local.v) { data.items[d.id] = { v: d.v, doc: { ...d.doc, id: d.id, v: d.v } }; changed = true; }
      });
      persist();
      if (changed) emit("cloud");
      cloud.setStatus("synced");
    } catch (e) { cloud.setStatus("offline"); }
  }

  async function upload() {
    if (!cloud.signedIn) return;
    const queue = data.dirty.slice();
    for (const id of queue) {
      const item = data.items[id];
      if (!item) { data.dirty = data.dirty.filter((x) => x !== id); continue; }
      try {
        const r = await api("/docs", {
          method: "POST",
          body: JSON.stringify({ type, id, v: item.v, doc: item.doc })
        });
        if (r.ok) {
          data.serverV = Math.max(data.serverV, item.v);
          data.dirty = data.dirty.filter((x) => x !== id);
          cloud.setStatus("synced");
        } else if (r.status === 409 && r.body.server) {
          const s = r.body.server;
          data.items[id] = { v: s.v, doc: { ...s.doc, id, v: s.v } };
          data.serverV = Math.max(data.serverV, s.v);
          data.dirty = data.dirty.filter((x) => x !== id);
          emit("cloud");
        } else if (r.status === 401) {
          cloud.signedIn = false; cloud.setStatus("local"); cloud.emit(); break;
        } else { cloud.setStatus("error"); break; }
      } catch (e) { cloud.setStatus("offline"); break; }
    }
    persist();
  }

  function scheduleUpload() {
    if (!cloud.signedIn) return;
    clearTimeout(uploadTimer);
    uploadTimer = setTimeout(() => upload(), 1200);
  }

  /* outra aba gravou: recarrega e avisa */
  window.addEventListener("storage", (e) => { if (e.key === key) c.reload(); });

  collections.set(type, c);
  return c;
}

/* sobe o que ficou sujo antes de a aba sumir, e baixa ao voltar */
document.addEventListener("visibilitychange", () => {
  if (!cloud.signedIn) return;
  if (document.hidden) { for (const c of collections.values()) c.sync(); }
  else cloud.syncAll();
});

/* ---------- frentes ----------
   o cadastro das empresas. e uma colecao como as outras, mas todo modulo
   precisa dela para mostrar selo — por isso mora aqui, com as sementes. */

export const SEED_FRONTS = [
  { id: "artt", name: "Artt Reis", color: 5, order: 1 },
  { id: "guessless", name: "Guessless", color: 1, order: 2 },
  { id: "glsuite", name: "GL Suite", color: 4, order: 3 },
  { id: "saas", name: "SaaS (Léo e Luca)", color: 2, order: 4 },
  { id: "personal", name: "Pessoal", color: 6, order: 5 }
];

export function fronts() {
  const c = collection("fronts", {
    normalize: (d) => ({ id: d.id, name: String(d.name || "").slice(0, 60), color: +d.color || 0, order: +d.order || 99, v: d.v })
  });
  if (!c.all().length) c.saveMany(SEED_FRONTS);
  return c;
}
export const listFronts = () => fronts().all().sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
/* o selo como string: so para as paginas ainda nao migradas */
export const frontBadge = (id) => {
  const f = id && fronts().get(id);
  if (!f) return "";
  return '<span class="badge" data-color="' + f.color + '"><i class="dot"></i>' + escapeHtml(f.name) + "</span>";
};
/* o numero da cor da frente (0 se nao ha), para quem pinta alem do selo */
export const frontColor = (id) => { const f = id && fronts().get(id); return f ? f.color : 0; };
export function frontOptions(selected, empty) {
  return (empty != null ? '<option value="">' + escapeHtml(empty) + "</option>" : "") +
    listFronts().map((f) => '<option value="' + f.id + '"' + (f.id === selected ? " selected" : "") + ">" + escapeHtml(f.name) + "</option>").join("");
}

/* clientes: o indice leve que os outros modulos usam para selo e escolha.
   a colecao inteira mora em clientes.html; aqui so o que e comum. */
export const clients = () => collection("clients");
export const listClients = () => clients().all().filter((c) => c.status !== "closed").sort((a, b) => String(a.name).localeCompare(String(b.name)));
export const clientName = (id) => { const c = id && clients().get(id); return c ? c.name : ""; };
export function clientOptions(selected, empty, front) {
  return (empty != null ? '<option value="">' + escapeHtml(empty) + "</option>" : "") +
    listClients().filter((c) => !front || c.front === front)
      .map((c) => '<option value="' + c.id + '"' + (c.id === selected ? " selected" : "") + ">" + escapeHtml(c.name) + "</option>").join("");
}

/* ---------- @frente e @cliente no texto ----------
   "@guessless" ou "@lojax" liga o que esta sendo escrito a uma frente ou a
   um cliente. compara sem acento, sem espaco e sem caixa, com o id e com o
   nome; frente ganha do cliente quando os dois casam. o que nao casou fica
   no texto, porque pode ser so um arroba. */
export const foldKey = (v) => String(v || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/gi, "").toLowerCase();
const MENTION = /(?:^|\s)@([^\s@]+)/g;
export function parseMentions(text) {
  let front = "", client = "";
  const fr = listFronts(), cl = listClients();
  const title = String(text || "").replace(MENTION, (m, tok) => {
    const k = foldKey(tok);
    if (!k) return m;
    const f = fr.find((x) => foldKey(x.id) === k || foldKey(x.name) === k || foldKey(x.name).startsWith(k));
    if (f && !front) { front = f.id; return " "; }
    const c = cl.find((x) => foldKey(x.name) === k || foldKey(x.name).startsWith(k));
    if (c && !client) { client = c.id; if (!front && c.front) front = c.front; return " "; }
    return m;
  });
  return { front, client, title: title.replace(/\s+/g, " ").trim() };
}

/* ---------- caixa de entrada do dia ----------
   quem quer mandar algo para hoje escreve aqui. o dia esvazia ao abrir e ao
   receber o evento de storage. nada aqui toca no documento do dia. */

const INBOX_KEY = "merlin:inbox";
export function readInbox() {
  try { const v = JSON.parse(localStorage.getItem(INBOX_KEY)); return Array.isArray(v) ? v : []; }
  catch (e) { return []; }
}
export function writeInbox(list) {
  try { localStorage.setItem(INBOX_KEY, JSON.stringify(list)); } catch (e) {}
}
/* item: {title, min?, front?, client?, origin:{type,id}} */
export function sendToDay(item) {
  const list = readInbox();
  list.push({
    id: newId(),
    title: String(item.title || "").trim().slice(0, 200),
    min: Math.max(0, Math.round(+item.min || 0)),
    front: item.front || "",
    client: item.client || "",
    origin: item.origin ? { type: item.origin.type, id: item.origin.id } : null,
    at: Date.now()
  });
  writeInbox(list);
  notify(item.min ? "foi para a fila de hoje" : "foi para a caixa de ideias do dia — lá ela ganha duração");
}

/* ---------- markdown minimo ----------
   paragrafos, listas, negrito, italico, links e codigo. o suficiente para
   uma nota; nada que mereca uma biblioteca. */
export function md(text) {
  const lines = String(text || "").split(/\r?\n/);
  let out = "", list = null;
  const inline = (s) => escapeHtml(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    .replace(/(^|\s)\*([^*]+)\*/g, "$1<i>$2</i>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a class="link" href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/(^|\s)(https?:\/\/[^\s<]+)/g, '$1<a class="link" href="$2" target="_blank" rel="noopener">$2</a>');
  const closeList = () => { if (list) { out += "</" + list + ">"; list = null; } };
  lines.forEach((l) => {
    const m = l.match(/^\s*(?:[-*]|(\d+)[.)])\s+(.*)$/);
    if (m) {
      const kind = m[1] ? "ol" : "ul";
      if (list !== kind) { closeList(); out += "<" + kind + ">"; list = kind; }
      const chk = m[2].match(/^\[( |x)\]\s+(.*)$/i);
      out += chk ? '<li class="chk' + (chk[1].toLowerCase() === "x" ? " is-done" : "") + '">' + inline(chk[2]) + "</li>" : "<li>" + inline(m[2]) + "</li>";
      return;
    }
    closeList();
    if (!l.trim()) return;
    const h = l.match(/^\s*(#{1,3})\s+(.*)$/);
    if (h) { out += "<h" + (h[1].length + 2) + ">" + inline(h[2]) + "</h" + (h[1].length + 2) + ">"; return; }
    out += "<p>" + inline(l) + "</p>";
  });
  closeList();
  return out;
}

/* ---------- icones comuns ---------- */
export const ICONS = {
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M9.5 7V5h5v2M6.5 7l1 12.5h9L17.5 7"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h13M12 5l7 7-7 7"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12.5l5.5 5.5L20 6.5"/></svg>',
  pencil: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4l10.5-10.5a2.1 2.1 0 00-3-3L5 17v3z"/><path d="M13.5 6.5l3 3"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13.5a4 4 0 006 .5l2.5-2.5a4 4 0 10-5.7-5.7L11.5 7"/><path d="M14 10.5a4 4 0 00-6-.5L5.5 12.5a4 4 0 105.7 5.7L12.5 17"/></svg>',
  grip: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 2"/></svg>',
  map: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="2.5"/><circle cx="4.5" cy="6" r="2"/><circle cx="19.5" cy="6" r="2"/><circle cx="4.5" cy="18" r="2"/><circle cx="19.5" cy="18" r="2"/><path d="M6.3 7l3.7 3.5M17.7 7L14 10.5M6.3 17l3.7-3.5M17.7 17L14 13.5"/></svg>'
};

/* ---------- inicio comum ---------- */
export function initPage(id) {
  mountNav(id);
  fronts();
  clients();
  cloud.resume();
}
