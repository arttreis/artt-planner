/* testa o worker contra um D1 de mentira, em memoria, com SQL de verdade
   feito na mao. o objetivo nao e cobrir SQL — e provar o fluxo de auth. */
import worker from "./worker.js";

/* ---- D1 falso: entende so as consultas que o worker faz ---- */
const db = { people: [], codes: [], days: [], docs: [] };
let sentEmails = [];

function prepare(sql) {
  let args = [];
  const api = {
    bind: (...a) => { args = a; return api; },
    first: async () => run(sql, args, "first"),
    all: async () => ({ results: run(sql, args, "all") }),
    run: async () => run(sql, args, "run")
  };
  return api;
}

function run(sql, a, mode) {
  const s = sql.replace(/\s+/g, " ").trim();

  if (s.startsWith("SELECT COUNT(*) AS n FROM codes")) {
    return { n: db.codes.filter(c => c.email === a[0] && c.expires_at > a[1]).length };
  }
  if (s.startsWith("INSERT OR REPLACE INTO codes")) {
    db.codes = db.codes.filter(c => c.hash !== a[0]);
    db.codes.push({ hash: a[0], email: a[1], expires_at: a[2], attempts: 0, used: 0 });
    return { meta: { changes: 1 } };
  }
  if (s.startsWith("SELECT hash, expires_at, attempts, used FROM codes")) {
    return db.codes.find(c => c.hash === a[0]) || null;
  }
  if (s.startsWith("UPDATE codes SET attempts")) {
    let n = 0;
    db.codes.forEach(c => { if (c.email === a[0] && !c.used && c.expires_at > a[1]) { c.attempts++; n++; } });
    return { meta: { changes: n } };
  }
  if (s.startsWith("UPDATE codes SET used")) {
    const c = db.codes.find(x => x.hash === a[0] && !x.used);
    if (!c) return { meta: { changes: 0 } };
    c.used = 1;
    return { meta: { changes: 1 } };
  }
  if (s.startsWith("SELECT id FROM people")) {
    return db.people.find(p => p.email === a[0]) || null;
  }
  if (s.startsWith("INSERT INTO people")) {
    db.people.push({ id: a[0], email: a[1], created_at: a[2] });
    return { meta: { changes: 1 } };
  }
  if (s.startsWith("SELECT email FROM people")) {
    return db.people.find(p => p.id === a[0]) || null;
  }
  if (s.startsWith("SELECT day, doc, v FROM days")) {
    return db.days.filter(d => d.person === a[0] && d.v > a[1]).sort((x, y) => x.v - y.v);
  }
  if (s.startsWith("INSERT INTO days")) {
    const [person, day, doc, v] = a;
    const ex = db.days.find(d => d.person === person && d.day === day);
    if (!ex) { db.days.push({ person, day, doc, v }); return { meta: { changes: 1 } }; }
    if (v > ex.v) { ex.doc = doc; ex.v = v; return { meta: { changes: 1 } }; }
    return { meta: { changes: 0 } };
  }
  if (s.startsWith("SELECT doc, v FROM days")) {
    return db.days.find(d => d.person === a[0] && d.day === a[1]) || null;
  }
  if (s.startsWith("SELECT id, doc, v FROM docs")) {
    return db.docs.filter(d => d.person === a[0] && d.type === a[1] && d.v > a[2]).sort((x, y) => x.v - y.v);
  }
  if (s.startsWith("INSERT INTO docs")) {
    const [person, type, id, doc, v] = a;
    const ex = db.docs.find(d => d.person === person && d.type === type && d.id === id);
    if (!ex) { db.docs.push({ person, type, id, doc, v }); return { meta: { changes: 1 } }; }
    if (v > ex.v) { ex.doc = doc; ex.v = v; return { meta: { changes: 1 } }; }
    return { meta: { changes: 0 } };
  }
  if (s.startsWith("SELECT doc, v FROM docs")) {
    return db.docs.find(d => d.person === a[0] && d.type === a[1] && d.id === a[2]) || null;
  }
  if (s.startsWith("DELETE FROM codes")) {
    const before = db.codes.length;
    db.codes = db.codes.filter(c => c.expires_at >= a[0]);
    return { meta: { changes: before - db.codes.length } };
  }
  throw new Error("SQL nao previsto no teste: " + s.slice(0, 70));
}

/* intercepta o Resend para capturar o codigo em vez de mandar e-mail */
let claudeAnswer = null;
globalThis.fetch = async (url, opts) => {
  if (String(url).includes("api.anthropic.com")) {
    const request = JSON.parse(opts.body);
    check("merlin manda a chave", opts.headers["x-api-key"] === "sk-teste");
    check("merlin pede JSON no sistema", /JSON/.test(request.system));
    return new Response(JSON.stringify(claudeAnswer), { status: 200 });
  }
  if (String(url).includes("resend.com")) {
    const body = JSON.parse(opts.body);
    sentEmails.push(body);
    return new Response("{}", { status: 200 });
  }
  throw new Error("fetch inesperado: " + url);
};

const ASSETS = { fetch: async () => new Response("<!doctype html><title>merlin</title>", { headers: { "content-type": "text/html" } }) };
const env = { DB: { prepare }, ASSETS, RESEND_API_KEY: "re_teste", SENDER_EMAIL: "p@x.com", SESSION_SECRET: "segredo-de-teste-longo-o-bastante", OWNER_EMAILS: "" };

const call = (method, route, body, cookie) =>
  worker.fetch(new Request("https://x.com/api" + route, {
    method,
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {})
  }), env);

const codeFromEmail = () => (sentEmails.at(-1).subject.match(/^(\d{6})/) || [])[1];
const cookieOf = (r) => (r.headers.get("set-cookie") || "").split(";")[0];

let passed = 0, failures = [];
const check = (name, cond, detail) => { if (cond) passed++; else failures.push(name + (detail ? " -> " + detail : "")); };

/* ---- 1. e-mail invalido ---- */
let r = await call("POST", "/code", { email: "naoehemail" });
check("recusa e-mail invalido", r.status === 400);

/* ---- 2. pedir codigo ---- */
r = await call("POST", "/code", { email: "  Arthur@Exemplo.COM  " });
check("aceita e envia codigo", r.status === 200);
check("normaliza e-mail", sentEmails.at(-1).to[0] === "arthur@exemplo.com", sentEmails.at(-1).to[0]);
check("codigo tem 6 digitos", /^\d{6}$/.test(codeFromEmail() || ""));
check("codigo no assunto", sentEmails.at(-1).subject.includes(codeFromEmail()));
check("codigo vai no html tambem", sentEmails.at(-1).html.includes(codeFromEmail()));
check("codigo NAO fica em claro no banco", !db.codes.some(c => c.hash === codeFromEmail()));

const right = codeFromEmail();

/* ---- 3. codigo errado ---- */
const wrong = String((+right + 1) % 1000000).padStart(6, "0");
r = await call("POST", "/sign-in", { email: "arthur@exemplo.com", code: wrong });
check("recusa codigo errado", r.status === 401);
check("conta a tentativa", db.codes.some(c => c.attempts > 0));

/* ---- 4. codigo certo ---- */
r = await call("POST", "/sign-in", { email: "arthur@exemplo.com", code: right });
check("aceita codigo certo", r.status === 200, String(r.status));
const cookie = cookieOf(r);
check("devolve cookie de sessao", cookie.startsWith("session="));
const cookieHeader = r.headers.get("set-cookie") || "";
check("cookie HttpOnly", cookieHeader.includes("HttpOnly"));
check("cookie Secure", cookieHeader.includes("Secure"));
check("cookie SameSite=Lax", cookieHeader.includes("SameSite=Lax"));
check("criou a pessoa", db.people.length === 1);

/* ---- 5. reuso do mesmo codigo ---- */
r = await call("POST", "/sign-in", { email: "arthur@exemplo.com", code: right });
check("codigo e de uso unico", r.status === 401, String(r.status));

/* ---- 6. quem sou ---- */
r = await call("GET", "/me", null, cookie);
let body = await r.json();
check("reconhece a sessao", body.signedIn === true && body.email === "arthur@exemplo.com");

r = await call("GET", "/me", null, "session=lixo.invalido.aqui");
body = await r.json();
check("recusa token adulterado", body.signedIn === false);

/* ---- 7. rota protegida sem sessao ---- */
r = await call("GET", "/days", null, null);
check("bloqueia sem sessao", r.status === 401);

/* ---- 8. subir e baixar ---- */
const doc = { day: "2026-09-02", start: 540, end: 1140, doneOpen: false, v: 1000, tasks: [{ id: "a", title: "escrever", min: 60, done: false, reserved: false }] };
r = await call("POST", "/days", { day: "2026-09-02", v: 1000, doc }, cookie);
check("sobe um dia", r.status === 200, String(r.status));

r = await call("GET", "/days?since=0", null, cookie);
body = await r.json();
check("baixa o dia", body.days.length === 1 && body.days[0].doc.tasks[0].title === "escrever");

r = await call("GET", "/days?since=1000", null, cookie);
body = await r.json();
check("since=v nao repete o que ja tenho", body.days.length === 0);

/* ---- 9. conflito: versao antiga nao sobrescreve ---- */
const old = { ...doc, v: 500, tasks: [{ id: "b", title: "versao velha", min: 30, done: false, reserved: false }] };
r = await call("POST", "/days", { day: "2026-09-02", v: 500, doc: old }, cookie);
body = await r.json();
check("recusa versao mais velha", r.status === 409, String(r.status));
check("devolve a versao do servidor", body.server && body.server.v === 1000);
check("nao sobrescreveu", JSON.parse(db.days[0].doc).tasks[0].title === "escrever");

/* ---- 10. versao mais nova sobrescreve ---- */
const newer = { ...doc, v: 2000, tasks: [{ id: "c", title: "mais novo", min: 15, done: false, reserved: false }] };
r = await call("POST", "/days", { day: "2026-09-02", v: 2000, doc: newer }, cookie);
check("aceita versao mais nova", r.status === 200);
check("sobrescreveu", JSON.parse(db.days[0].doc).tasks[0].title === "mais novo");

/* ---- 11. isolamento entre pessoas ---- */
sentEmails = [];
await call("POST", "/code", { email: "outra@exemplo.com" });
r = await call("POST", "/sign-in", { email: "outra@exemplo.com", code: codeFromEmail() });
const otherCookie = cookieOf(r);
r = await call("GET", "/days?since=0", null, otherCookie);
body = await r.json();
check("uma pessoa NAO ve o dia da outra", body.days.length === 0, JSON.stringify(body.days));

/* ---- 12. dia invalido ---- */
r = await call("POST", "/days", { day: "02/09/2026", v: 1, doc: {} }, cookie);
check("recusa formato de data errado", r.status === 400);

/* ---- 13. rate limit ---- */
let last = 200;
for (let i = 0; i < 10; i++) {
  const rr = await call("POST", "/code", { email: "spam@exemplo.com" });
  last = rr.status;
}
check("limita pedidos por hora", last === 429, String(last));

/* ---- 13b. documentos por tipo ---- */
r = await call("POST", "/docs", { type: "ideas", id: "i1", v: 100, doc: { id: "i1", title: "uma ideia" } }, cookie);
check("sobe um doc", r.status === 200, String(r.status));
r = await call("GET", "/docs?type=ideas&since=0", null, cookie);
body = await r.json();
check("baixa o doc por tipo", body.docs.length === 1 && body.docs[0].doc.title === "uma ideia");
r = await call("GET", "/docs?type=clients&since=0", null, cookie);
body = await r.json();
check("tipo diferente nao mistura", body.docs.length === 0);
r = await call("POST", "/docs", { type: "ideas", id: "i1", v: 50, doc: { id: "i1", title: "velha" } }, cookie);
body = await r.json();
check("doc: recusa versao mais velha", r.status === 409 && body.server && body.server.v === 100);
r = await call("POST", "/docs", { type: "ideas", id: "i1", v: 200, doc: { id: "i1", deleted: true } }, cookie);
check("doc: tumulo sobe como versao nova", r.status === 200);
r = await call("GET", "/docs?type=ideas&since=100", null, cookie);
body = await r.json();
check("doc: since=v traz so o que mudou", body.docs.length === 1 && body.docs[0].doc.deleted === true);
r = await call("POST", "/docs", { type: "Ideas!", id: "i1", v: 1, doc: {} }, cookie);
check("doc: recusa tipo invalido", r.status === 400);
r = await call("GET", "/docs?type=ideas&since=0", null, otherCookie);
body = await r.json();
check("doc: uma pessoa NAO ve o doc da outra", body.docs.length === 0);
r = await call("GET", "/docs?type=ideas&since=0", null, null);
check("doc: bloqueia sem sessao", r.status === 401);

/* ---- 13c. so o dono entra ---- */
env.OWNER_EMAILS = "arthur@exemplo.com";
sentEmails = [];
r = await call("POST", "/code", { email: "intruso@exemplo.com" });
check("intruso recebe a mesma resposta", r.status === 200);
check("intruso NAO recebe codigo", sentEmails.length === 0);
r = await call("POST", "/sign-in", { email: "intruso@exemplo.com", code: "123456" });
check("intruso nao entra", r.status === 401);
r = await call("POST", "/code", { email: "arthur@exemplo.com" });
check("dono recebe codigo", r.status === 200 && sentEmails.length === 1);
env.OWNER_EMAILS = "";

/* ---- 13d. o merlin ---- */
r = await call("POST", "/merlin", { task: "branches", context: { node: "x" } }, cookie);
check("merlin sem chave responde 503", r.status === 503, String(r.status));
env.ANTHROPIC_API_KEY = "sk-teste";
claudeAnswer = { stop_reason: "end_turn", content: [{ type: "text", text: 'Aqui vai:\n{"suggestions":[{"title":"Tráfego pago","note":"começa pelo Meta"},{"title":"","note":"vazio"}]}' }] };
r = await call("POST", "/merlin", { task: "branches", context: { map: "lançamento", node: "tráfego", children: [], siblings: ["oferta"] } }, cookie);
body = await r.json();
check("merlin devolve sugestoes", r.status === 200 && body.suggestions.length === 1 && body.suggestions[0].title === "Tráfego pago", JSON.stringify(body));
r = await call("POST", "/merlin", { task: "inventada", context: {} }, cookie);
check("merlin recusa tarefa desconhecida", r.status === 400);
r = await call("POST", "/merlin", { task: "branches", context: { node: "x" } }, null);
check("merlin exige sessao", r.status === 401);
claudeAnswer = { stop_reason: "end_turn", content: [{ type: "text", text: '{"text":"## Semana\\n- fechou 3\\n- ficou 2"}' }] };
r = await call("POST", "/merlin", { task: "week", context: { range: "1-7 set", cards: ["seg · artt · x · 1h · sim"] } }, cookie);
body = await r.json();
check("merlin responde texto", r.status === 200 && /Semana/.test(body.text), JSON.stringify(body));
claudeAnswer = { stop_reason: "end_turn", content: [{ type: "text", text: '{"suggestions":[{"type":"step","title":"validar com 3 clientes","note":"antes de codar"}]}' }] };
r = await call("POST", "/merlin", { task: "expand", context: { title: "app", steps: [] } }, cookie);
body = await r.json();
check("merlin ramifica ideia", r.status === 200 && body.suggestions[0].type === "step");
claudeAnswer = { stop_reason: "refusal", content: [] };
r = await call("POST", "/merlin", { task: "funnel", context: { name: "f", stages: ["lp"] } }, cookie);
check("merlin repassa a recusa", r.status === 422);
env.ANTHROPIC_API_KEY = "";

/* ---- 14. faxina ---- */
db.codes.push({ hash: "velho", email: "x@x.com", expires_at: Date.now() - 7200e3, attempts: 0, used: 0 });
const beforeCleanup = db.codes.length;
await worker.scheduled({}, env);
check("faxina remove codigo expirado", db.codes.length < beforeCleanup);

/* ---- 15. o site sai do mesmo worker que a api ---- */
const raw = (path) => worker.fetch(new Request("https://x.com" + path), env);
r = await raw("/");
check("a raiz serve o site", r.status === 200 && (await r.text()).includes("merlin"));
r = await raw("/qualquer/coisa");
check("caminho desconhecido cai no site, nao em 404 de api", r.status === 200);
r = await raw("/api/naoexiste");
check("rota de api inexistente ainda da 404", r.status === 404);
r = await raw("/api/me");
check("api continua respondendo", r.status === 200);

console.log("\n" + passed + " passaram, " + failures.length + " falharam");
if (failures.length) { console.log("\nFALHAS:"); failures.forEach(f => console.log("  - " + f)); process.exit(1); }
