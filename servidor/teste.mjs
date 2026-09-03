/* testa o worker contra um D1 de mentira, em memoria, com SQL de verdade
   feito na mao. o objetivo nao e cobrir SQL — e provar o fluxo de auth. */
import worker from "file:///c:/Artt/Artt/artt-planner/servidor/worker.js";

/* ---- D1 falso: entende so as consultas que o worker faz ---- */
const banco = { pessoas: [], codigos: [], dias: [] };
let emailsEnviados = [];

function prepare(sql) {
  let args = [];
  const api = {
    bind: (...a) => { args = a; return api; },
    first: async () => rodar(sql, args, "first"),
    all: async () => ({ results: rodar(sql, args, "all") }),
    run: async () => rodar(sql, args, "run")
  };
  return api;
}

function rodar(sql, a, modo) {
  const s = sql.replace(/\s+/g, " ").trim();

  if (s.startsWith("SELECT COUNT(*) AS n FROM codigos")) {
    return { n: banco.codigos.filter(c => c.email === a[0] && c.expira > a[1]).length };
  }
  if (s.startsWith("INSERT OR REPLACE INTO codigos")) {
    banco.codigos = banco.codigos.filter(c => c.hash !== a[0]);
    banco.codigos.push({ hash: a[0], email: a[1], expira: a[2], tentou: 0, usado: 0 });
    return { meta: { changes: 1 } };
  }
  if (s.startsWith("SELECT hash, expira, tentou, usado FROM codigos")) {
    return banco.codigos.find(c => c.hash === a[0]) || null;
  }
  if (s.startsWith("UPDATE codigos SET tentou")) {
    let n = 0;
    banco.codigos.forEach(c => { if (c.email === a[0] && !c.usado && c.expira > a[1]) { c.tentou++; n++; } });
    return { meta: { changes: n } };
  }
  if (s.startsWith("UPDATE codigos SET usado")) {
    const c = banco.codigos.find(x => x.hash === a[0] && !x.usado);
    if (!c) return { meta: { changes: 0 } };
    c.usado = 1;
    return { meta: { changes: 1 } };
  }
  if (s.startsWith("SELECT id FROM pessoas")) {
    return banco.pessoas.find(p => p.email === a[0]) || null;
  }
  if (s.startsWith("INSERT INTO pessoas")) {
    banco.pessoas.push({ id: a[0], email: a[1], criada: a[2] });
    return { meta: { changes: 1 } };
  }
  if (s.startsWith("SELECT email FROM pessoas")) {
    return banco.pessoas.find(p => p.id === a[0]) || null;
  }
  if (s.startsWith("SELECT dia, doc, v FROM dias")) {
    return banco.dias.filter(d => d.pessoa === a[0] && d.v > a[1]).sort((x, y) => x.v - y.v);
  }
  if (s.startsWith("INSERT INTO dias")) {
    const [pessoa, dia, doc, v] = a;
    const ex = banco.dias.find(d => d.pessoa === pessoa && d.dia === dia);
    if (!ex) { banco.dias.push({ pessoa, dia, doc, v }); return { meta: { changes: 1 } }; }
    if (v > ex.v) { ex.doc = doc; ex.v = v; return { meta: { changes: 1 } }; }
    return { meta: { changes: 0 } };
  }
  if (s.startsWith("SELECT doc, v FROM dias")) {
    return banco.dias.find(d => d.pessoa === a[0] && d.dia === a[1]) || null;
  }
  if (s.startsWith("DELETE FROM codigos")) {
    const antes = banco.codigos.length;
    banco.codigos = banco.codigos.filter(c => c.expira >= a[0]);
    return { meta: { changes: antes - banco.codigos.length } };
  }
  throw new Error("SQL nao previsto no teste: " + s.slice(0, 70));
}

/* intercepta o Resend para capturar o codigo em vez de mandar e-mail */
globalThis.fetch = async (url, opts) => {
  if (String(url).includes("resend.com")) {
    const corpo = JSON.parse(opts.body);
    emailsEnviados.push(corpo);
    return new Response("{}", { status: 200 });
  }
  throw new Error("fetch inesperado: " + url);
};

const env = { DB: { prepare }, RESEND_API_KEY: "re_teste", EMAIL_REMETENTE: "p@x.com", SEGREDO_SESSAO: "segredo-de-teste-longo-o-bastante" };

const chamar = (metodo, rota, corpo, cookie) =>
  worker.fetch(new Request("https://x.com/api" + rota, {
    method: metodo,
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    ...(corpo ? { body: JSON.stringify(corpo) } : {})
  }), env);

const codigoDoEmail = () => (emailsEnviados.at(-1).subject.match(/^(\d{6})/) || [])[1];
const cookieDe = (r) => (r.headers.get("set-cookie") || "").split(";")[0];

let ok = 0, falhas = [];
const checa = (nome, cond, detalhe) => { if (cond) ok++; else falhas.push(nome + (detalhe ? " -> " + detalhe : "")); };

/* ---- 1. e-mail invalido ---- */
let r = await chamar("POST", "/codigo", { email: "naoehemail" });
checa("recusa e-mail invalido", r.status === 400);

/* ---- 2. pedir codigo ---- */
r = await chamar("POST", "/codigo", { email: "  Arthur@Exemplo.COM  " });
checa("aceita e envia codigo", r.status === 200);
checa("normaliza e-mail", emailsEnviados.at(-1).to[0] === "arthur@exemplo.com", emailsEnviados.at(-1).to[0]);
checa("codigo tem 6 digitos", /^\d{6}$/.test(codigoDoEmail() || ""));
checa("codigo no assunto", emailsEnviados.at(-1).subject.includes(codigoDoEmail()));
checa("codigo NAO fica em claro no banco", !banco.codigos.some(c => c.hash === codigoDoEmail()));

const certo = codigoDoEmail();

/* ---- 3. codigo errado ---- */
const errado = String((+certo + 1) % 1000000).padStart(6, "0");
r = await chamar("POST", "/entrar", { email: "arthur@exemplo.com", codigo: errado });
checa("recusa codigo errado", r.status === 401);
checa("conta a tentativa", banco.codigos.some(c => c.tentou > 0));

/* ---- 4. codigo certo ---- */
r = await chamar("POST", "/entrar", { email: "arthur@exemplo.com", codigo: certo });
checa("aceita codigo certo", r.status === 200, String(r.status));
const cookie = cookieDe(r);
checa("devolve cookie de sessao", cookie.startsWith("sessao="));
const cabecalhoCookie = r.headers.get("set-cookie") || "";
checa("cookie HttpOnly", cabecalhoCookie.includes("HttpOnly"));
checa("cookie Secure", cabecalhoCookie.includes("Secure"));
checa("cookie SameSite=Lax", cabecalhoCookie.includes("SameSite=Lax"));
checa("criou a pessoa", banco.pessoas.length === 1);

/* ---- 5. reuso do mesmo codigo ---- */
r = await chamar("POST", "/entrar", { email: "arthur@exemplo.com", codigo: certo });
checa("codigo e de uso unico", r.status === 401, String(r.status));

/* ---- 6. quem sou ---- */
r = await chamar("GET", "/eu", null, cookie);
let corpo = await r.json();
checa("reconhece a sessao", corpo.entrou === true && corpo.email === "arthur@exemplo.com");

r = await chamar("GET", "/eu", null, "sessao=lixo.invalido.aqui");
corpo = await r.json();
checa("recusa token adulterado", corpo.entrou === false);

/* ---- 7. rota protegida sem sessao ---- */
r = await chamar("GET", "/dias", null, null);
checa("bloqueia sem sessao", r.status === 401);

/* ---- 8. subir e baixar ---- */
const doc = { dia: "2026-09-02", inicio: 540, fim: 1140, feitasAbertas: false, v: 1000, tarefas: [{ id: "a", titulo: "escrever", min: 60, feito: false, reserva: false }] };
r = await chamar("POST", "/dias", { dia: "2026-09-02", v: 1000, doc }, cookie);
checa("sobe um dia", r.status === 200, String(r.status));

r = await chamar("GET", "/dias?desde=0", null, cookie);
corpo = await r.json();
checa("baixa o dia", corpo.dias.length === 1 && corpo.dias[0].doc.tarefas[0].titulo === "escrever");

r = await chamar("GET", "/dias?desde=1000", null, cookie);
corpo = await r.json();
checa("desde=v nao repete o que ja tenho", corpo.dias.length === 0);

/* ---- 9. conflito: versao antiga nao sobrescreve ---- */
const velho = { ...doc, v: 500, tarefas: [{ id: "b", titulo: "versao velha", min: 30, feito: false, reserva: false }] };
r = await chamar("POST", "/dias", { dia: "2026-09-02", v: 500, doc: velho }, cookie);
corpo = await r.json();
checa("recusa versao mais velha", r.status === 409, String(r.status));
checa("devolve a versao do servidor", corpo.servidor && corpo.servidor.v === 1000);
checa("nao sobrescreveu", JSON.parse(banco.dias[0].doc).tarefas[0].titulo === "escrever");

/* ---- 10. versao mais nova sobrescreve ---- */
const novo = { ...doc, v: 2000, tarefas: [{ id: "c", titulo: "mais novo", min: 15, feito: false, reserva: false }] };
r = await chamar("POST", "/dias", { dia: "2026-09-02", v: 2000, doc: novo }, cookie);
checa("aceita versao mais nova", r.status === 200);
checa("sobrescreveu", JSON.parse(banco.dias[0].doc).tarefas[0].titulo === "mais novo");

/* ---- 11. isolamento entre pessoas ---- */
emailsEnviados = [];
await chamar("POST", "/codigo", { email: "outra@exemplo.com" });
r = await chamar("POST", "/entrar", { email: "outra@exemplo.com", codigo: codigoDoEmail() });
const cookieOutra = cookieDe(r);
r = await chamar("GET", "/dias?desde=0", null, cookieOutra);
corpo = await r.json();
checa("uma pessoa NAO ve o dia da outra", corpo.dias.length === 0, JSON.stringify(corpo.dias));

/* ---- 12. dia invalido ---- */
r = await chamar("POST", "/dias", { dia: "02/09/2026", v: 1, doc: {} }, cookie);
checa("recusa formato de data errado", r.status === 400);

/* ---- 13. rate limit ---- */
let ultimo = 200;
for (let i = 0; i < 10; i++) {
  const rr = await chamar("POST", "/codigo", { email: "spam@exemplo.com" });
  ultimo = rr.status;
}
checa("limita pedidos por hora", ultimo === 429, String(ultimo));

/* ---- 14. faxina ---- */
banco.codigos.push({ hash: "velho", email: "x@x.com", expira: Date.now() - 7200e3, tentou: 0, usado: 0 });
const antesFaxina = banco.codigos.length;
await worker.scheduled({}, env);
checa("faxina remove codigo expirado", banco.codigos.length < antesFaxina);

console.log("\n" + ok + " passaram, " + falhas.length + " falharam");
if (falhas.length) { console.log("\nFALHAS:"); falhas.forEach(f => console.log("  - " + f)); process.exit(1); }
