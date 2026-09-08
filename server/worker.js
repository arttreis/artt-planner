/* merlin · o servidor
 *
 * um Worker, um D1 e o Resend. sem framework, sem dependencia — a mesma
 * disciplina das paginas, pelo mesmo motivo: da pra ler inteiro.
 *
 * o que ele faz: diz quem e voce (codigo por e-mail), guarda um documento
 * por dia (tabela days) e guarda documentos soltos por tipo e id (tabela
 * docs) para os outros modulos — ideas, clients, maps, funnels, finance.
 * ele nao entende nada do que esta dentro: so devolve e diz qual e mais novo.
 *
 * e um sistema de uma pessoa: OWNER_EMAILS no wrangler.toml lista quem pode
 * entrar. outro e-mail recebe a mesma resposta de sucesso e nenhum codigo.
 */

const SESSION_DAYS = 90;     /* quanto tempo voce fica logado */
const CODE_MINUTES = 10;     /* validade do codigo, em minutos */
const MAX_ATTEMPTS = 5;      /* erros de digitacao antes de queimar o codigo */
const REQUESTS_PER_HOUR = 6; /* codigos por e-mail por hora */

/* ---------- utilidades ---------- */

const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...extra }
  });

const fail = (msg, status = 400) => json({ error: msg }, status);

const bytesToHex = (b) =>
  [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");

async function sha256(text) {
  return bytesToHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
}

/* comparacao em tempo constante: comparar hash com === vaza informacao pelo
   tempo que a comparacao leva a divergir. */
function sameString(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

const normalizeEmail = (v) => String(v || "").trim().toLowerCase();

/* os e-mails do dono, separados por virgula. vazio = qualquer um entra (so
   faz sentido em desenvolvimento). */
const owners = (env) => String(env.OWNER_EMAILS || "").split(",").map(normalizeEmail).filter(Boolean);
const isOwner = (env, email) => { const o = owners(env); return !o.length || o.includes(email); };
const DOC_TYPE = /^[a-z][a-z0-9_-]{0,31}$/;
const DOC_ID = /^[A-Za-z0-9_.:-]{1,64}$/;
const isValidEmail = (v) => /^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(v);
const isDay = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

/* ---------- sessao (JWT HS256 na mao) ---------- */

const b64url = (s) =>
  btoa(typeof s === "string" ? s : String.fromCharCode(...new Uint8Array(s)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const fromB64url = (s) =>
  atob(s.replace(/-/g, "+").replace(/_/g, "/").padEnd(s.length + (4 - s.length % 4) % 4, "="));

async function hmacKey(secret) {
  return crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]
  );
}

async function signSession(person, secret) {
  const payload = {
    sub: person,
    exp: Math.floor(Date.now() / 1000) + SESSION_DAYS * 86400
  };
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const data = header + "." + b64url(JSON.stringify(payload));
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(secret), new TextEncoder().encode(data));
  return data + "." + b64url(signature);
}

async function readSession(token, secret) {
  if (!token || token.split(".").length !== 3) return null;
  const [header, payload, signature] = token.split(".");
  const ok = await crypto.subtle.verify(
    "HMAC", await hmacKey(secret),
    Uint8Array.from(fromB64url(signature), (c) => c.charCodeAt(0)),
    new TextEncoder().encode(header + "." + payload)
  );
  if (!ok) return null;
  let data = null;
  try { data = JSON.parse(fromB64url(payload)); } catch (e) { return null; }
  /* assinatura valida nao basta: um token expirado e assinado do mesmo jeito */
  if (!data || !data.sub || !data.exp || data.exp < Math.floor(Date.now() / 1000)) return null;
  return data.sub;
}

const readCookie = (req, name) => {
  const raw = req.headers.get("cookie") || "";
  const found = raw.split(";").map((p) => p.trim()).find((p) => p.startsWith(name + "="));
  return found ? found.slice(name.length + 1) : null;
};

/* SameSite=Lax e possivel porque o Worker vive no mesmo dominio do site, numa
   rota /api/*. em dominios diferentes seria SameSite=None, que Safari bloqueia. */
const sessionCookie = (token) =>
  "session=" + token + "; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=" + SESSION_DAYS * 86400;

const deadCookie = () =>
  "session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0";

/* ---------- o e-mail ---------- */

/* o e-mail e um pedaco do app fora do app: mesmo fundo, mesma fonte mono no
   codigo, mesmo verde. tudo inline e em tabela porque cliente de e-mail nao
   le <style> nem variavel de css. as fontes sao as do sistema: Gmail descarta
   web font, e o Sora/JetBrains do site ficam so como primeira opcao. */
function codeEmailHtml(code) {
  const sans = '"Sora",-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif';
  const mono = '"JetBrains Mono","SF Mono",Menlo,Consolas,"Liberation Mono",monospace';
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>Seu código do Merlin</title>
</head>
<body style="margin:0;padding:0;background:#0d0d0d;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#0d0d0d;">Vale por ${CODE_MINUTES} minutos e só funciona uma vez.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#0d0d0d;">
<tr><td align="center" style="padding:48px 20px;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:420px;">
    <tr><td style="padding:0 0 28px;font-family:${mono};font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#7a7a7a;">
      <span style="display:inline-block;width:7px;height:7px;border-radius:7px;background:#2EE86B;vertical-align:1px;margin-right:9px;"></span>Merlin
    </td></tr>
    <tr><td style="padding:0 0 6px;font-family:${sans};font-size:20px;font-weight:600;letter-spacing:-.02em;color:#f2f2f2;">
      Seu código
    </td></tr>
    <tr><td style="padding:0 0 20px;font-family:${sans};font-size:14px;line-height:1.5;color:#8c8c8c;">
      Digite no Merlin para entrar.
    </td></tr>
    <tr><td style="padding:22px 16px;background:#141414;border:1px solid #262626;border-radius:12px;text-align:center;font-family:${mono};font-size:36px;font-weight:500;letter-spacing:.28em;color:#2EE86B;">
      ${code}
    </td></tr>
    <tr><td style="padding:18px 0 0;font-family:${sans};font-size:13px;line-height:1.55;color:#8c8c8c;">
      Vale por <span style="color:#f2f2f2;">${CODE_MINUTES} minutos</span> e só funciona uma vez.
    </td></tr>
    <tr><td style="padding:28px 0 0;"><div style="border-top:1px solid #1f1f1f;"></div></td></tr>
    <tr><td style="padding:20px 0 0;font-family:${sans};font-size:12px;line-height:1.55;color:#5c5c5c;">
      Se não foi você que pediu, ignore. Ninguém entra sem este código.
    </td></tr>
    <tr><td style="padding:22px 0 0;font-family:${mono};font-size:11px;letter-spacing:.06em;color:#4a4a4a;">
      merlin.arttreis.com.br
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}

async function sendCode(env, email, code) {
  /* em desenvolvimento o codigo vai pro log, e nenhum e-mail sai. a chave de
     verdade comeca com "re_" e nunca contem "fake". */
  if (!env.RESEND_API_KEY || env.RESEND_API_KEY.includes("fake")) {
    console.log("[dev] codigo para " + email + ": " + code);
    return;
  }
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: "Bearer " + env.RESEND_API_KEY,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      from: env.SENDER_EMAIL,
      to: [email],
      subject: code + " — seu código do Merlin",
      /* o codigo no assunto tambem: na maioria dos clientes de e-mail voce le
         sem precisar abrir a mensagem. */
      html: codeEmailHtml(code),
      /* a versao em texto fica: e o que aparece em cliente sem html e o que
         alguns filtros de spam olham quando o html vem sozinho. */
      text: "Seu código é " + code + ".\n\n" +
            "Ele vale por " + CODE_MINUTES + " minutos e só funciona uma vez.\n" +
            "Se não foi você que pediu, ignore — ninguém entra sem este código."
    })
  });
  if (!r.ok) throw new Error("resend " + r.status + " " + (await r.text()).slice(0, 200));
}

/* ---------- rotas ---------- */

/* pedir um codigo. responde igual existindo ou nao o e-mail: dizer "essa conta
   nao existe" entrega quem tem conta a quem estiver testando enderecos. */
async function requestCode(req, env) {
  const { email: raw } = await req.json().catch(() => ({}));
  const email = normalizeEmail(raw);
  if (!isValidEmail(email)) return fail("e-mail inválido");

  /* quem nao e o dono recebe exatamente a mesma resposta, e nada acontece:
     dizer "esse e-mail nao pode" contaria quais podem */
  if (!isOwner(env, email)) return json({ ok: true });

  const now = Date.now();
  const recent = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM codes WHERE email = ? AND expires_at > ?"
  ).bind(email, now - 3600e3).first();
  if (recent && recent.n >= REQUESTS_PER_HOUR) return fail("muitos códigos pedidos; tente daqui a pouco", 429);

  /* 6 digitos com getRandomValues, nunca Math.random */
  const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, "0");
  const hash = await sha256(code + ":" + email);

  await env.DB.prepare(
    "INSERT OR REPLACE INTO codes (hash, email, expires_at, attempts, used) VALUES (?, ?, ?, 0, 0)"
  ).bind(hash, email, now + CODE_MINUTES * 60e3).run();

  await sendCode(env, email, code);
  return json({ ok: true });
}

/* trocar o codigo por uma sessao */
async function signIn(req, env) {
  const { email: raw, code } = await req.json().catch(() => ({}));
  const email = normalizeEmail(raw);
  const typed = String(code || "").replace(/\D/g, "");
  if (!isValidEmail(email) || typed.length !== 6) return fail("código inválido");
  if (!isOwner(env, email)) return fail("código inválido ou expirado", 401);

  const hash = await sha256(typed + ":" + email);
  const row = await env.DB.prepare(
    "SELECT hash, expires_at, attempts, used FROM codes WHERE hash = ?"
  ).bind(hash).first();

  /* conta a tentativa mesmo quando o codigo nao existe, para que errar nao
     saia mais barato que acertar */
  if (!row || row.used || row.expires_at < Date.now()) {
    await env.DB.prepare(
      "UPDATE codes SET attempts = attempts + 1 WHERE email = ? AND used = 0 AND expires_at > ?"
    ).bind(email, Date.now()).run();
    return fail("código inválido ou expirado", 401);
  }
  if (row.attempts >= MAX_ATTEMPTS) return fail("código queimado por tentativas; peça outro", 429);
  if (!sameString(row.hash, hash)) return fail("código inválido", 401);

  /* uso unico: o UPDATE condicional e a garantia — dois pedidos simultaneos
     com o mesmo codigo, so um sai com used = 0 */
  const spent = await env.DB.prepare(
    "UPDATE codes SET used = 1 WHERE hash = ? AND used = 0"
  ).bind(hash).run();
  if (!spent.meta.changes) return fail("código já usado", 401);

  let person = await env.DB.prepare("SELECT id FROM people WHERE email = ?").bind(email).first();
  if (!person) {
    const id = crypto.randomUUID();
    await env.DB.prepare("INSERT INTO people (id, email, created_at) VALUES (?, ?, ?)")
      .bind(id, email, Date.now()).run();
    person = { id };
  }

  const token = await signSession(person.id, env.SESSION_SECRET);
  return json({ ok: true, email }, 200, { "set-cookie": sessionCookie(token) });
}

const signOut = () => json({ ok: true }, 200, { "set-cookie": deadCookie() });

async function whoAmI(req, env) {
  const person = await readSession(readCookie(req, "session"), env.SESSION_SECRET);
  if (!person) return json({ signedIn: false });
  const row = await env.DB.prepare("SELECT email FROM people WHERE id = ?").bind(person).first();
  return json({ signedIn: true, email: row ? row.email : null });
}

/* baixar o que mudou desde a ultima vez. `since` e o maior v que o cliente ja
   viu — na primeira vez vem 0 e ele recebe tudo. */
async function downloadDays(req, env, person) {
  const since = +(new URL(req.url).searchParams.get("since") || 0) || 0;
  const { results } = await env.DB.prepare(
    "SELECT day, doc, v FROM days WHERE person = ? AND v > ? ORDER BY v ASC LIMIT 400"
  ).bind(person, since).all();
  return json({
    days: (results || []).map((r) => ({ day: r.day, v: r.v, doc: JSON.parse(r.doc) }))
  });
}

/* subir um dia. o servidor so aceita se o carimbo for mais novo que o que ele
   tem — quem chegou depois ganha, e o cliente descobre isso na resposta. */
async function uploadDay(req, env, person) {
  const body = await req.json().catch(() => null);
  if (!body || !isDay(body.day) || !body.doc || typeof body.doc !== "object") {
    return fail("documento inválido");
  }
  const v = Math.round(+body.v) || 0;
  if (!v) return fail("documento sem carimbo");

  const text = JSON.stringify(body.doc);
  /* 256KB por dia e ordens de grandeza acima do real (~1KB); serve so para
     que um cliente com defeito nao encha o banco */
  if (text.length > 262144) return fail("documento grande demais", 413);

  const r = await env.DB.prepare(
    "INSERT INTO days (person, day, doc, v) VALUES (?, ?, ?, ?) " +
    "ON CONFLICT(person, day) DO UPDATE SET doc = excluded.doc, v = excluded.v " +
    "WHERE excluded.v > days.v"
  ).bind(person, body.day, text, v).run();

  if (r.meta.changes) return json({ ok: true, v });

  /* nao gravou: o servidor tem versao igual ou mais nova. devolve a dele para
     o cliente adotar, em vez de deixar os dois discordando em silencio. */
  const current = await env.DB.prepare(
    "SELECT doc, v FROM days WHERE person = ? AND day = ?"
  ).bind(person, body.day).first();
  return json({
    ok: false, reason: "servidor está na frente",
    server: current ? { day: body.day, v: current.v, doc: JSON.parse(current.doc) } : null
  }, 409);
}

/* ---------- documentos por tipo ----------
   a mesma regra do dia, para qualquer coisa que tenha id: quem tem o v maior
   ganha, e o servidor devolve a versao dele quando recusa. */

async function downloadDocs(req, env, person) {
  const url = new URL(req.url);
  const type = String(url.searchParams.get("type") || "");
  if (!DOC_TYPE.test(type)) return fail("tipo inválido");
  const since = +(url.searchParams.get("since") || 0) || 0;
  const { results } = await env.DB.prepare(
    "SELECT id, doc, v FROM docs WHERE person = ? AND type = ? AND v > ? ORDER BY v ASC LIMIT 500"
  ).bind(person, type, since).all();
  return json({
    docs: (results || []).map((r) => ({ id: r.id, v: r.v, doc: JSON.parse(r.doc) }))
  });
}

async function uploadDoc(req, env, person) {
  const body = await req.json().catch(() => null);
  if (!body || !DOC_TYPE.test(String(body.type || "")) || !DOC_ID.test(String(body.id || ""))
      || !body.doc || typeof body.doc !== "object") {
    return fail("documento inválido");
  }
  const v = Math.round(+body.v) || 0;
  if (!v) return fail("documento sem carimbo");
  const text = JSON.stringify(body.doc);
  /* um mapa mental grande fica na casa dos 100KB; 1MB e o teto de seguranca */
  if (text.length > 1048576) return fail("documento grande demais", 413);

  const r = await env.DB.prepare(
    "INSERT INTO docs (person, type, id, doc, v) VALUES (?, ?, ?, ?, ?) " +
    "ON CONFLICT(person, type, id) DO UPDATE SET doc = excluded.doc, v = excluded.v " +
    "WHERE excluded.v > docs.v"
  ).bind(person, body.type, body.id, text, v).run();

  if (r.meta.changes) return json({ ok: true, v });

  const current = await env.DB.prepare(
    "SELECT doc, v FROM docs WHERE person = ? AND type = ? AND id = ?"
  ).bind(person, body.type, body.id).first();
  return json({
    ok: false, reason: "servidor está na frente",
    server: current ? { id: body.id, v: current.v, doc: JSON.parse(current.doc) } : null
  }, 409);
}

/* ---------- merlin, o conselheiro ----------
   a unica rota que pensa. recebe um contexto (um no do mapa, um funil) e pede
   a Claude sugestoes em JSON. a chave e segredo do worker, como a do Resend;
   sem ela a rota responde 503 e a tela diz que falta configurar. nada aqui e
   gravado: quem decide o que entra no mapa ou no funil e quem esta na tela. */

const MODEL = "claude-opus-5";
const MAX_SUGGESTIONS = 12;
/* o vocabulario de etapas que a tela aceita. se NODE_TYPES mudar em
   funnels.jsx, muda aqui junto: sugestao com tipo que nao existe do outro
   lado e descartada em silencio, e o Merlin parece ter ficado mudo. */
const NODE_TYPES = [
  "traffic", "impression", "ad", "click", "lp", "vsl", "webinar", "product",
  "capture", "quiz", "dm", "group", "email", "whatsapp",
  "booking", "call", "proposal", "closing",
  "cart", "checkout", "payment", "thanks",
  "upsell", "downsell", "onboarding", "repurchase", "custom"
].join(", ");

const SYSTEM = [
  "Você é o Merlin, conselheiro do Arthur Reis — consultor de growth, branding e desenvolvimento;",
  "sócio da Guessless (agência de growth marketing) e da GL Suite (tecnologia sob demanda).",
  "Os clientes dele vendem em Mercado Livre, Shopee, TikTok Shop, Amazon e sites próprios; o checkout da casa é Stripe.",
  "Responda SEMPRE em português do Brasil, com acentuação correta, curto e concreto: nada de frases genéricas.",
  "Responda SOMENTE com um objeto JSON, sem texto antes ou depois, sem cercas de código."
].join(" ");

const listOf = (v) => (Array.isArray(v) && v.length ? v.map((x) => String(x).slice(0, 80)).join("; ") : "nenhum");
const linesOf = (v, n) => (Array.isArray(v) && v.length ? v.slice(0, n || 60).map((x) => "- " + String(x).slice(0, 160)).join("\n") : "- nenhum");

/* tarefas que respondem com uma lista de sugestoes:
   {"suggestions":[{"type","nodeType","title","note"}]} */
const LIST_TASKS = {
  /* ramos para um no de mapa mental */
  branches: (c) => ({
    instruction:
      "Sugira ramos filhos para um nó de mapa mental. Cada ramo é uma ideia, pergunta ou próximo passo que desenvolve o nó. " +
      "Não repita o que já existe entre os irmãos ou filhos listados. No máximo 6 ramos — eles são desenhados em volta do nó, não numa lista, então poucos e bons valem mais que muitos. " +
      "2 a 6 palavras cada, com uma nota curta (até 20 palavras) explicando o porquê. " +
      'Formato: {"suggestions":[{"title":"…","note":"…"}]}',
    context:
      "Mapa: " + String(c.map || "").slice(0, 120) + "\n" +
      "Caminho até o nó: " + (Array.isArray(c.path) ? c.path.map((x) => String(x).slice(0, 80)).join(" > ") : "") + "\n" +
      "Nó selecionado: " + String(c.node || "").slice(0, 200) + "\n" +
      (c.note ? "Nota do nó: " + String(c.note).slice(0, 800) + "\n" : "") +
      "Filhos que já existem: " + (Array.isArray(c.children) && c.children.length ? c.children.map((x) => String(x).slice(0, 80)).join("; ") : "nenhum") + "\n" +
      "Irmãos: " + (Array.isArray(c.siblings) && c.siblings.length ? c.siblings.map((x) => String(x).slice(0, 80)).join("; ") : "nenhum") + "\n" +
      (c.client ? "Cliente: " + String(c.client).slice(0, 60) + "\n" : "")
  }),
  /* o que falta num funil */
  funnel: (c) => ({
    instruction:
      "Analise este funil de marketing e vendas e sugira o que falta ou o que pode melhorar: etapas ausentes, automações (remarketing, recuperação de carrinho, sequências), criativos (ângulos), ofertas (bump, upsell, downsell) e gatilhos mentais. " +
      "Não repita o que já existe. Máximo " + MAX_SUGGESTIONS + " sugestões, cada uma com type, título curto (até 8 palavras) e note (até 30 palavras). " +
      "Valores válidos de type: node (com o campo nodeType em " + NODE_TYPES + "), automation, creative, offer, trigger. " +
      "Uma etapa (node) é um lugar onde dá para contar quanta gente esteve e qual fração passou adiante. CTA, order bump e remarketing NÃO são etapas: o CTA é elemento da página, o bump acontece dentro do checkout e o remarketing é caminho de volta — sugira esses como creative, offer e automation. " +
      'Formato: {"suggestions":[{"type":"node","nodeType":"payment","title":"…","note":"…"},{"type":"automation","title":"…","note":"…"}]}',
    context:
      "Funil: " + String(c.name || "").slice(0, 120) + "\n" +
      (c.client ? "Cliente: " + String(c.client).slice(0, 60) + "\n" : "") +
      (c.channel ? "Canal: " + String(c.channel).slice(0, 60) + "\n" : "") +
      "Etapas na ordem do fluxo: " + (Array.isArray(c.stages) ? c.stages.map((e) => String(e).slice(0, 100)).join(" -> ") : "") + "\n" +
      "Automações: " + listOf(c.automations) + "\n" +
      "Criativos: " + listOf(c.creatives) + "\n" +
      "Ofertas: " + listOf(c.offers) + "\n" +
      "Gatilhos: " + listOf(c.triggers) + "\n" +
      (c.numbers ? "Números do período: " + String(c.numbers).slice(0, 400) + "\n" : "")
  }),
  /* o que vem depois de UMA etapa. a tela ja pintou o palpite da gramatica
     local antes de chamar aqui; o que se pede ao modelo e a versao concreta
     desse palpite — com nome de produto, de ferramenta e de oferta dentro.
     por isso o teto e 3: e uma tira de cartoes no palco, nao uma lista. */
  nextStage: (c) => ({
    instruction:
      "Diga quais são as próximas etapas do funil logo depois da etapa indicada. No máximo 3, da mais provável para a menos. " +
      "Uma etapa é um lugar onde dá para contar quanta gente esteve e qual fração passou adiante — CTA, order bump e remarketing não são etapas e não podem ser sugeridos. " +
      "Não repita o que já sai da etapa. Cada item traz nodeType (obrigatório, um de " + NODE_TYPES + "), title concreto deste funil (até 5 palavras, com nome de ferramenta ou de oferta quando o contexto der) e note com o porquê em até 15 palavras. " +
      "Se a etapa já for o fim natural deste funil, devolva a lista vazia. " +
      'Formato: {"suggestions":[{"nodeType":"payment","title":"pagamento aprovado no pix","note":"…"}]}',
    context:
      "Funil: " + String(c.name || "").slice(0, 120) + "\n" +
      (c.client ? "Cliente: " + String(c.client).slice(0, 60) + "\n" : "") +
      "Etapa em questão: " + String(c.stage || "").slice(0, 120) + "\n" +
      (Array.isArray(c.fields) && c.fields.length ? "O que ela tem preenchido: " + listOf(c.fields) + "\n" : "") +
      "Vem antes dela: " + listOf(c.before) + "\n" +
      "Já sai dela: " + listOf(c.after) + "\n" +
      "Funil inteiro na ordem: " + (Array.isArray(c.stages) ? c.stages.map((e) => String(e).slice(0, 80)).join(" -> ") : "") + "\n" +
      "Ofertas do funil: " + listOf(c.offers) + "\n"
  }),
  /* uma ideia da caixa: perguntas, caminhos e proximos passos */
  expand: (c) => ({
    instruction:
      "Ajude a desenvolver esta ideia. Responda com sugestões acionáveis, sem repetir os passos que já existem. " +
      "Máximo " + MAX_SUGGESTIONS + " itens, cada um com type (question = o que precisa ser respondido antes; path = um jeito de fazer; step = próxima ação concreta), título curto e note de até 25 palavras. " +
      'Formato: {"suggestions":[{"type":"step","title":"…","note":"…"}]}',
    context:
      "Ideia: " + String(c.title || "").slice(0, 200) + "\n" +
      "Estágio: " + String(c.stage || "").slice(0, 30) + "\n" +
      (c.body ? "Corpo:\n" + String(c.body).slice(0, 2500) + "\n" : "") +
      "Passos que já existem:\n" + linesOf(c.steps, 30) + "\n" +
      (c.client ? "Cliente: " + String(c.client).slice(0, 60) + "\n" : "")
  })
};

/* tarefas que respondem com um texto, nao com uma lista: o formato e
   {"text":"…"} em markdown simples (paragrafos, listas com -, negrito). */
const TEXT_TASKS = {
  /* a semana: o que fechou, o que ficou, por cliente */
  week: (c) => ({
    instruction:
      "Resuma esta semana de trabalho em até 180 palavras, em markdown simples: um parágrafo do que foi feito, uma lista curta do que ficou aberto agrupada por cliente, e uma frase de recomendação para a próxima semana. " +
      "Seja específico com os títulos dos cartões; não invente nada que não esteja na lista. " +
      'Formato: {"text":"…"}',
    context:
      "Semana: " + String(c.range || "").slice(0, 60) + "\n" +
      "Cartões (dia · cliente quando houver · título · duração quando houver · feito?):\n" + linesOf(c.cards, 120) + "\n" +
      (c.dayDone ? "O que o dia registrou como concluído:\n" + linesOf(c.dayDone, 80) + "\n" : "")
  }),
  /* pauta de reuniao com um cliente */
  meeting: (c) => ({
    instruction:
      "Prepare uma pauta de reunião com este cliente, em até 220 palavras, em markdown simples: contexto em duas linhas, objetivos e onde estão, pendências do backlog, o que os canais ainda não têm, decisões a tomar e próximos passos. " +
      "Use só o que está no contexto; onde faltar informação, diga o que perguntar ao cliente. " +
      'Formato: {"text":"…"}',
    context:
      "Cliente: " + String(c.name || "").slice(0, 100) + " (" + String(c.status || "").slice(0, 20) + ")\n" +
      (c.summary ? "Resumo: " + String(c.summary).slice(0, 800) + "\n" : "") +
      (c.contract ? "Contrato: " + String(c.contract).slice(0, 300) + "\n" : "") +
      "Objetivos:\n" + linesOf(c.goals, 20) + "\n" +
      "Backlog aberto:\n" + linesOf(c.backlog, 30) + "\n" +
      "Canais e o que falta:\n" + linesOf(c.channels, 20) + "\n" +
      "Diário recente (mais novo primeiro):\n" + linesOf(c.journal, 15) + "\n" +
      (c.offers ? "Ofertas: " + listOf(c.offers) + "\n" : "")
  }),
  /* o mes de habitos: o que segurou, o que caiu, um ajuste */
  habits: (c) => ({
    instruction:
      "Leia este mês de hábitos e responda em até 150 palavras, em markdown simples: o que se manteve, o que caiu e um único ajuste concreto para o mês que vem. " +
      "Use só os números da lista; não invente, não moralize. " +
      'Formato: {"text":"…"}',
    context:
      "Mês: " + String(c.month || "").slice(0, 40) + "\n" +
      "Hábitos (nome · frequência · feitos/esperados · sequência):\n" + linesOf(c.habits, 40) + "\n"
  }),
  /* a revisao de um periodo de planejamento */
  review: (c) => ({
    instruction:
      "Proponha a revisão deste período de planejamento em até 200 palavras, em markdown simples, com três blocos: o que foi, o que não foi, o que muda. " +
      "Use só os objetivos e o que foi registrado como feito; onde faltar informação, diga o que perguntar. Se já houver uma revisão escrita, complemente sem repetir. " +
      'Formato: {"text":"…"}',
    context:
      "Período: " + String(c.kind || "").slice(0, 20) + " · " + String(c.period || "").slice(0, 60) + "\n" +
      "Objetivos (texto · cliente quando houver · feito/aberto):\n" + linesOf(c.goals, 60) + "\n" +
      (Array.isArray(c.weekDone) && c.weekDone.length ? "Cartões da semana concluídos:\n" + linesOf(c.weekDone, 60) + "\n" : "") +
      (c.review && (c.review.went || c.review.didnt || c.review.next)
        ? "Revisão já escrita — foi: " + String(c.review.went || "").slice(0, 400) + " | não foi: " + String(c.review.didnt || "").slice(0, 400) + " | muda: " + String(c.review.next || "").slice(0, 400) + "\n"
        : "")
  }),
  /* os numeros do funil: onde esta perdendo */
  numbers: (c) => ({
    instruction:
      "Leia os números deste funil e diga, em até 200 palavras em markdown simples, onde ele está perdendo gente, qual etapa atacar primeiro e por quê, e duas ações concretas. " +
      "Compare cada taxa com a taxa média esperada quando houver. Se faltar número em alguma etapa, diga qual medir primeiro. Não invente números. " +
      'Formato: {"text":"…"}',
    context:
      "Funil: " + String(c.name || "").slice(0, 120) + "\n" +
      (c.period ? "Período: " + String(c.period).slice(0, 60) + "\n" : "") +
      "Etapas na ordem (tipo · título · pessoas no período):\n" + linesOf(c.stages, 40) + "\n" +
      "Taxas entre etapas (de → para · taxa real · taxa média esperada):\n" + linesOf(c.rates, 40) + "\n" +
      (c.cost ? "Custo de tráfego no período: " + String(c.cost).slice(0, 40) + "\n" : "") +
      (c.cpl ? "CPL: " + String(c.cpl).slice(0, 40) + "\n" : "") +
      (c.cac ? "CAC: " + String(c.cac).slice(0, 40) + "\n" : "")
  }),
  /* uma demanda: da pra fazer com o Claude, e o que sobra pro Arthur.
     quando da, a resposta termina numa linha "Montar: ..." — e ela que a tela
     transforma em tarefa do dia. quando nao da, a linha nao vem e nao ha botao:
     o merlin nao inventa trabalho para justificar a propria resposta. */
  delegate: (c) => ({
    instruction:
      "Diga se esta demanda pode ser feita com o Claude. Comece com uma linha só, em negrito, com o veredicto — **dá**, **dá em parte** ou **não dá** — seguida de uma frase curta dizendo por quê. " +
      "Depois, em markdown simples e no máximo 170 palavras: o que exatamente o Claude faria e de que forma; o que precisa existir antes (arquivo, acesso, conta, um exemplo do resultado certo); e o que continua sendo trabalho do Arthur. " +
      "As formas possíveis são: Claude Code numa pasta ou repositório (lê e escreve arquivos, roda comandos, mexe em planilha e CSV, escreve e publica código); uma skill, que são instruções salvas ensinando uma tarefa recorrente (ele já tem uma para gerar criativos com o Nano Banana); um agente ligado por MCP a uma ferramenta que ele já usa (ClickUp, Meta Ads, Miro, HeyGen, Magnific, Resend, Supabase, Google Drive, Google Agenda, Stripe); um artifact, que é uma página publicada com link para mandar ao cliente (relatório, painel, formulário); um agente agendado, que roda sozinho num horário; ou a API dentro de um produto, como este próprio Merlin. Escolha uma e diga qual — nunca responda que \"dá para automatizar\" sem dizer com o quê. " +
      "Seja honesto e sem entusiasmo: o que depende do julgamento dele, de estar presente, da relação com o cliente ou de apertar botão em ferramenta sem API é **não dá**, e uma linha explica. " +
      (+c.min > 0
        ? "A estimativa de hoje é " + Math.round(+c.min) + " minutos: diga em quantos minutos a demanda ficaria com o Claude fazendo a parte dele, contando o que sobra como supervisão. "
        : "") +
      "Se o veredicto for **dá** ou **dá em parte**, termine com uma última linha exatamente neste formato, sem negrito e sem nada depois: Montar: <o que precisa ser montado antes, começando por um verbo, até 8 palavras>. Se for **não dá**, não escreva essa linha. " +
      'Formato: {"text":"…"}',
    context:
      "Demanda: " + String(c.title || "").slice(0, 200) + "\n" +
      (c.where ? "Onde ela está: " + String(c.where).slice(0, 60) + "\n" : "") +
      (+c.min > 0 ? "Estimativa atual: " + Math.round(+c.min) + " minutos\n" : "Estimativa atual: ainda não tem\n") +
      (c.due ? "Prazo: " + String(c.due).slice(0, 30) + "\n" : "") +
      (c.client ? "Cliente: " + String(c.client).slice(0, 60) + "\n" : "") +
      (c.about ? "Sobre o cliente: " + String(c.about).slice(0, 800) + "\n" : "")
  })
};

/* tira o objeto JSON de uma resposta que pode vir com texto em volta */
function extractJson(text) {
  const a = text.indexOf("{"), b = text.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(text.slice(a, b + 1)); } catch (e) { return null; }
}

async function advise(req, env) {
  if (!env.ANTHROPIC_API_KEY) return fail("o Merlin ainda não tem chave: npx wrangler secret put ANTHROPIC_API_KEY", 503);
  const body = await req.json().catch(() => null);
  const name = String((body && body.task) || "");
  const task = body && (LIST_TASKS[name] || TEXT_TASKS[name]);
  if (!task || !body.context || typeof body.context !== "object") return fail("tarefa inválida");
  const isText = !!TEXT_TASKS[name];
  const { instruction, context } = task(body.context);

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4000,
      /* sugestao curta nao precisa do maximo de raciocinio: medio segura o custo */
      output_config: { effort: "medium" },
      system: SYSTEM,
      messages: [{ role: "user", content: instruction + "\n\n" + context }]
    })
  });
  if (!r.ok) {
    console.error("anthropic " + r.status + " " + (await r.text()).slice(0, 300));
    return fail("o Merlin não respondeu (" + r.status + ")", 502);
  }
  const answer = await r.json();
  if (answer.stop_reason === "refusal") return fail("o Merlin preferiu não responder a isso", 422);
  const text = (answer.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
  const data = extractJson(text);
  if (isText) {
    if (!data || typeof data.text !== "string" || !data.text.trim()) return fail("o Merlin respondeu fora do formato", 502);
    return json({ text: data.text.slice(0, 4000) });
  }
  if (!data || !Array.isArray(data.suggestions)) return fail("o Merlin respondeu fora do formato", 502);
  return json({
    suggestions: data.suggestions.slice(0, MAX_SUGGESTIONS).map((s) => ({
      type: String(s.type || "").slice(0, 20),
      nodeType: String(s.nodeType || "").slice(0, 20),
      title: String(s.title || "").slice(0, 120),
      note: String(s.note || s.detail || "").slice(0, 300)
    })).filter((s) => s.title)
  });
}

/* ---------- entrada ---------- */

export default {
  async fetch(req, env) {
    const url = new URL(req.url);

    /* o site sai daqui tambem, como arquivo estatico. o que nao for /api/
       nao e assunto deste script: devolve para a camada de assets, que serve
       o index.html sem invocar o worker nem gastar cota. */
    if (!url.pathname.startsWith("/api/")) {
      return env.ASSETS ? env.ASSETS.fetch(req) : new Response("não existe", { status: 404 });
    }
    const route = url.pathname.slice(4) || "/";

    if (req.method === "OPTIONS") return new Response(null, { status: 204 });

    try {
      if (route === "/code" && req.method === "POST") return await requestCode(req, env);
      if (route === "/sign-in" && req.method === "POST") return await signIn(req, env);
      if (route === "/sign-out" && req.method === "POST") return signOut();
      if (route === "/me" && req.method === "GET") return await whoAmI(req, env);

      /* rota que nao existe e 404 antes de ser 401: pedir login para um
         caminho inexistente mente sobre a causa do erro */
      if (route !== "/days" && route !== "/docs" && route !== "/merlin") return fail("não existe", 404);

      /* daqui pra baixo, so quem entrou */
      const person = await readSession(readCookie(req, "session"), env.SESSION_SECRET);
      if (!person) return fail("entre primeiro", 401);

      if (route === "/merlin") {
        if (req.method === "POST") return await advise(req, env);
        return fail("método não serve aqui", 405);
      }
      if (route === "/docs") {
        if (req.method === "GET") return await downloadDocs(req, env, person);
        if (req.method === "POST") return await uploadDoc(req, env, person);
        return fail("método não serve aqui", 405);
      }
      if (req.method === "GET") return await downloadDays(req, env, person);
      if (req.method === "POST") return await uploadDay(req, env, person);

      return fail("método não serve aqui", 405);
    } catch (e) {
      /* a mensagem real vai pro log, nunca pro cliente */
      console.error(e && e.stack || e);
      return fail("deu errado aqui do meu lado", 500);
    }
  }
};
