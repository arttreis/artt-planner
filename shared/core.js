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

/* so a casca (sidebar, busca) e o markdown montam HTML por string; as
   paginas desenham com o htm, que escapa sozinho. */
const escapeHtml = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
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
  { id: "finance", label: "financeiro", href: "finance.html" },
  { id: "habits", label: "hábitos", href: "habits.html" },
  { id: "plans", label: "planos", href: "plans.html" }
];

export const LOGO = '<svg viewBox="0 0 472.5 472.5" fill="currentColor" aria-hidden="true"><path d="M236.31,236.23c-3.63,128.42,107.71,238.95,236.22,236.22v-118.11c-64.78,2.88-121-53.42-118.11-118.11h-118.11Z"/><path d="M236.22,0C239.85,128.42,128.52,238.95,0,236.22v-118.11C64.78,120.99,121,64.69,118.11,0h118.11Z"/><path d="M315.07,0h77.61c44.09,0,79.89,35.8,79.89,79.89v77.61h-157.5V0h0Z"/><path d="M79.96,315H.07v78.75h78.75v78.75h78.75v-79.89c0-42.86-34.75-77.61-77.61-77.61Z"/></svg>';

export const NAV_ICONS = {
  day: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  week: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  ideas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 21h4M12 3a6 6 0 00-3.5 10.9c.7.5 1 1.3 1 2.1h5c0-.8.3-1.6 1-2.1A6 6 0 0012 3z"/></svg>',
  clients: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0113 0"/><circle cx="17" cy="9" r="2.5"/><path d="M15.5 14.5a5 5 0 016 5.5"/></svg>',
  funnels: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h18l-7 8.5V20l-4-2v-5.5z"/></svg>',
  maps: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="2.5"/><circle cx="4.5" cy="6" r="2"/><circle cx="19.5" cy="6" r="2"/><circle cx="4.5" cy="18" r="2"/><circle cx="19.5" cy="18" r="2"/><path d="M6.3 7l3.7 3.5M17.7 7L14 10.5M6.3 17l3.7-3.5M17.7 17L14 13.5"/></svg>',
  finance: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 6.5v11M15 9.2c0-1.2-1.3-2-3-2s-3 .8-3 2 1.3 1.8 3 2 3 .9 3 2.1-1.3 2-3 2-3-.8-3-2"/></svg>',
  habits: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 13l2 2 4-4M8 18h2M14 17h2"/></svg>',
  plans: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h6v14H4zM14 5h6v6h-6zM14 15h6v4h-6z"/></svg>',
  docs: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/></svg>',
  fold: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M14 10l-2 2 2 2"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  theme: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a9 9 0 100 18 7 7 0 010-18z"/></svg>',
  sun: '<svg class="knob__sol" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/></svg>',
  moon: '<svg class="knob__lua" viewBox="0 0 24 24" fill="currentColor"><path d="M14.5 3.5a8.5 8.5 0 1 0 6 14.3 7 7 0 0 1-6-14.3z"/><path d="M18.5 3l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/></svg>'
};

export function toggleSidebar() {
  const root = document.documentElement;
  root.classList.toggle("sidebar-closed");
  try { localStorage.setItem("merlin:sidebar", root.classList.contains("sidebar-closed") ? "closed" : "open"); } catch (e) {}
  /* quem desenha em SVG mede o container: avisa que ele mudou de tamanho */
  setTimeout(() => window.dispatchEvent(new Event("resize")), 320);
}

/* ---------- busca global ----------
   procura por titulo em tudo que mora no navegador: ideias, clientes,
   cartoes da semana, mapas, funis, lancamentos, habitos e objetivos. nao e indice: e um filtro
   sobre o que ja esta em memoria, e por isso e instantaneo. */
const SEARCH_SOURCES = [
  { type: "ideas", label: "ideia", field: "title", href: (d) => "ideas.html#" + encodeURIComponent(d.id) },
  { type: "clients", label: "cliente", field: "name", href: (d) => "clients.html#" + encodeURIComponent(d.id) },
  { type: "week", label: "semana", field: "title", href: () => "week.html", filter: (d) => !d.done },
  { type: "maps", label: "mapa", field: "name", href: (d) => "maps.html#" + encodeURIComponent(d.id) },
  { type: "funnels", label: "funil", field: "name", href: (d) => "funnels.html#" + encodeURIComponent(d.id) },
  { type: "finance", label: "R$", field: "name", href: () => "finance.html", filter: (d) => d.type === "entry" || d.type === "fixed" || d.type === "debt" || d.type === "card" },
  { type: "habits", label: "hábito", field: "name", href: () => "habits.html", filter: (d) => !d.archived },
  /* os objetivos moram dentro do documento do periodo: `each` abre o doc em varios achados */
  { type: "plans", label: "objetivo", href: () => "plans.html", each: (d) => (d.goals || []).map((g) => g.text) }
];
export function search(term) {
  const k = foldKey(term);
  if (!k || k.length < 2) return [];
  const hits = [];
  SEARCH_SOURCES.forEach((src) => {
    collection(src.type).all().forEach((d) => {
      if (src.filter && !src.filter(d)) return;
      const texts = src.each ? src.each(d) : [d[src.field]];
      texts.forEach((t) => {
        const text = String(t || "");
        if (foldKey(text).includes(k)) hits.push({ label: src.label, text, href: src.href(d) });
      });
    });
  });
  return hits.slice(0, 12);
}
/* ---------- aviso com desfazer ----------
   o core so guarda qual e o aviso da vez e por quanto tempo; quem desenha e
   a casca, no ui.js. `notify` continua com a mesma assinatura de sempre. */

let notice = null, noticeTimer = null;
const noticeListeners = new Set();
const emitNotice = () => noticeListeners.forEach((f) => { try { f(notice); } catch (e) { console.error(e); } });

export function notify(text, undo) {
  clearTimeout(noticeTimer);
  /* o carimbo serve de `key`: avisar duas vezes o mesmo texto reinicia o
     tempo em vez de parecer que nada aconteceu */
  notice = { text: String(text), undo: undo || null, at: Date.now() };
  noticeTimer = setTimeout(closeNotice, undo ? 7000 : 3500);
  emitNotice();
}
export function closeNotice() { clearTimeout(noticeTimer); notice = null; emitNotice(); }
export const currentNotice = () => notice;
export function onNotice(fn) { noticeListeners.add(fn); return () => noticeListeners.delete(fn); }

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
export const CLOUD_STATUS = {
  synced:  { line: "sincronizado", action: "", text: "o mesmo Merlin em todos os seus aparelhos." },
  local:   { line: "só neste navegador", action: "entrar", text: "entre com seu e-mail para levar o Merlin a outros aparelhos." },
  offline: { line: "sem conexão — sobe depois", action: "", text: "sem rede agora; o que você fizer sobe quando voltar." },
  error:   { line: "não consegui sincronizar", action: "tentar de novo", text: "o servidor não respondeu; tente de novo." }
};

const collections = new Map();
const cloudListeners = new Set();

export const cloud = {
  signedIn: false,
  email: "",
  status: "local",
  setStatus(which) {
    if (this.status === which) return;
    this.status = which;
    this.emit();
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
  },
  async signOut() {
    await api("/sign-out", { method: "POST" }).catch(() => {});
    this.signedIn = false; this.email = "";
    this.setStatus("local");
    this.emit();
  }
};

/* ---------- entrar ----------
   e-mail, codigo, sessao. o core guarda se a caixa esta aberta e faz as duas
   chamadas; a caixa em si e da casca. cada chamada devolve o recado que a
   tela mostra, para o texto do erro nao morar em dois lugares. */

const signInListeners = new Set();
export const signIn = {
  open: false,
  onChange(fn) { signInListeners.add(fn); return () => signInListeners.delete(fn); },
  emit() { signInListeners.forEach((f) => { try { f(this); } catch (e) { console.error(e); } }); },
  show() { this.open = true; this.emit(); },
  hide() { this.open = false; this.emit(); },
  /* manda o codigo. devolve {ok, message} — a mensagem e sempre para a tela. */
  async requestCode(raw) {
    const email = String(raw || "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(email)) return { ok: false, message: "esse e-mail não parece certo" };
    const r = await api("/code", { method: "POST", body: JSON.stringify({ email }) }).catch(() => null);
    if (!r || !r.ok) return { ok: false, message: (r && r.body.error) || "não consegui mandar o código" };
    return { ok: true, email, message: "mandei um código de 6 dígitos para " + email };
  },
  /* troca o codigo por sessao. em caso de sucesso ja sincroniza tudo. */
  async submitCode(email, raw) {
    const code = String(raw || "").replace(/\D/g, "");
    if (code.length !== 6) return { ok: false, message: "o código tem 6 dígitos" };
    const r = await api("/sign-in", { method: "POST", body: JSON.stringify({ email, code }) }).catch(() => null);
    if (!r || !r.ok) return { ok: false, message: (r && r.body.error) || "código inválido" };
    cloud.signedIn = true;
    cloud.email = String(r.body.email || email);
    this.hide();
    cloud.setStatus("synced");
    cloud.emit();
    cloud.syncAll();
    return { ok: true, message: "" };
  }
};
export const openSignIn = () => signIn.show();
export const closeSignIn = () => signIn.hide();

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
/* o numero da cor da frente (0 se nao ha), para quem pinta alem do selo */
export const frontColor = (id) => { const f = id && fronts().get(id); return f ? f.color : 0; };
/* clientes: o indice leve que os outros modulos usam para selo e escolha.
   a colecao inteira mora em clientes.html; aqui so o que e comum. */
export const clients = () => collection("clients");
export const listClients = () => clients().all().filter((c) => c.status !== "closed").sort((a, b) => String(a.name).localeCompare(String(b.name)));
export const clientName = (id) => { const c = id && clients().get(id); return c ? c.name : ""; };
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
  map: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="2.5"/><circle cx="4.5" cy="6" r="2"/><circle cx="19.5" cy="6" r="2"/><circle cx="4.5" cy="18" r="2"/><circle cx="19.5" cy="18" r="2"/><path d="M6.3 7l3.7 3.5M17.7 7L14 10.5M6.3 17l3.7-3.5M17.7 17L14 13.5"/></svg>',
  /* a faisca e o gesto de pedir ajuda ao merlin, em toda pagina */
  spark: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9L12 2z"/></svg>',
  archive: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7h18v3H3zM5 10v9h14v-9M10 14h4"/></svg>',
  arrowLeft: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H6M12 5l-7 7 7 7"/></svg>',
  chevronLeft: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>',
  chevronRight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
  unfold: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 4v9a3 3 0 003 3h9"/><path d="M14 12l4 4-4 4"/></svg>'
};

/* ---------- inicio comum ----------
   quem desenha a casca (sidebar, busca, entrar, aviso) e o ui.js, que se
   registra aqui ao ser importado. e assim que o core continua sem saber
   desenhar: se ele importasse o ui, os dois se importariam em circulo. */
let renderShell = null;
export function setShellRenderer(fn) { renderShell = fn; }

export function initPage(id) {
  if (renderShell) renderShell(id);
  fronts();
  clients();
  cloud.resume();
}
