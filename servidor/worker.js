/* artt planner · o servidor
 *
 * um Worker, um D1 e o Resend. sem framework, sem dependencia — a mesma
 * disciplina do index.html, pelo mesmo motivo: da pra ler inteiro.
 *
 * o que ele faz: diz quem e voce (codigo por e-mail) e guarda um documento
 * por dia. ele nao entende tarefa, nao ordena fila, nao calcula sobra. essa
 * conta e do cliente, e continua sendo mesmo com servidor no meio.
 */

const SESSAO_DIAS = 90;      /* quanto tempo voce fica logado */
const CODIGO_MIN = 10;       /* validade do codigo, em minutos */
const TENTATIVAS = 5;        /* erros de digitacao antes de queimar o codigo */
const PEDIDOS_HORA = 6;      /* codigos por e-mail por hora */

/* ---------- utilidades ---------- */

const json = (dados, status = 200, extra = {}) =>
  new Response(JSON.stringify(dados), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...extra }
  });

const erro = (msg, status = 400) => json({ erro: msg }, status);

const bytesParaHex = (b) =>
  [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");

async function sha256(texto) {
  return bytesParaHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto)));
}

/* comparacao em tempo constante: comparar hash com === vaza informacao pelo
   tempo que a comparacao leva a divergir. */
function iguais(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

const normalizarEmail = (v) => String(v || "").trim().toLowerCase();
const emailValido = (v) => /^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(v);
const ehDia = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

/* ---------- sessao (JWT HS256 na mao) ---------- */

const b64url = (s) =>
  btoa(typeof s === "string" ? s : String.fromCharCode(...new Uint8Array(s)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const deB64url = (s) =>
  atob(s.replace(/-/g, "+").replace(/_/g, "/").padEnd(s.length + (4 - s.length % 4) % 4, "="));

async function chaveHmac(segredo) {
  return crypto.subtle.importKey(
    "raw", new TextEncoder().encode(segredo),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]
  );
}

async function assinarSessao(pessoa, segredo) {
  const corpo = {
    sub: pessoa,
    exp: Math.floor(Date.now() / 1000) + SESSAO_DIAS * 86400
  };
  const cabeca = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const dados = cabeca + "." + b64url(JSON.stringify(corpo));
  const firma = await crypto.subtle.sign("HMAC", await chaveHmac(segredo), new TextEncoder().encode(dados));
  return dados + "." + b64url(firma);
}

async function lerSessao(token, segredo) {
  if (!token || token.split(".").length !== 3) return null;
  const [cabeca, corpo, firma] = token.split(".");
  const ok = await crypto.subtle.verify(
    "HMAC", await chaveHmac(segredo),
    Uint8Array.from(deB64url(firma), (c) => c.charCodeAt(0)),
    new TextEncoder().encode(cabeca + "." + corpo)
  );
  if (!ok) return null;
  let dados = null;
  try { dados = JSON.parse(deB64url(corpo)); } catch (e) { return null; }
  /* assinatura valida nao basta: um token expirado e assinado do mesmo jeito */
  if (!dados || !dados.sub || !dados.exp || dados.exp < Math.floor(Date.now() / 1000)) return null;
  return dados.sub;
}

const lerCookie = (req, nome) => {
  const bruto = req.headers.get("cookie") || "";
  const achado = bruto.split(";").map((p) => p.trim()).find((p) => p.startsWith(nome + "="));
  return achado ? achado.slice(nome.length + 1) : null;
};

/* SameSite=Lax e possivel porque o Worker vive no mesmo dominio do site, numa
   rota /api/*. em dominios diferentes seria SameSite=None, que Safari bloqueia. */
const cookieSessao = (token) =>
  "sessao=" + token + "; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=" + SESSAO_DIAS * 86400;

const cookieMorto = () =>
  "sessao=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0";

/* ---------- o e-mail ---------- */

async function mandarCodigo(env, email, codigo) {
  /* em desenvolvimento o codigo vai pro log, e nenhum e-mail sai. a chave de
     verdade comeca com "re_" e nunca contem "fake". */
  if (!env.RESEND_API_KEY || env.RESEND_API_KEY.includes("fake")) {
    console.log("[dev] codigo para " + email + ": " + codigo);
    return;
  }
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: "Bearer " + env.RESEND_API_KEY,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      from: env.EMAIL_REMETENTE,
      to: [email],
      subject: codigo + " — seu código do planner",
      /* o codigo no assunto tambem: na maioria dos clientes de e-mail voce le
         sem precisar abrir a mensagem. */
      text: "Seu código é " + codigo + ".\n\n" +
            "Ele vale por " + CODIGO_MIN + " minutos e só funciona uma vez.\n" +
            "Se não foi você que pediu, ignore — ninguém entra sem este código."
    })
  });
  if (!r.ok) throw new Error("resend " + r.status + " " + (await r.text()).slice(0, 200));
}

/* ---------- rotas ---------- */

/* pedir um codigo. responde igual existindo ou nao o e-mail: dizer "essa conta
   nao existe" entrega quem tem conta a quem estiver testando enderecos. */
async function pedirCodigo(req, env) {
  const { email: bruto } = await req.json().catch(() => ({}));
  const email = normalizarEmail(bruto);
  if (!emailValido(email)) return erro("e-mail inválido");

  const agora = Date.now();
  const recentes = await env.artt_planner.prepare(
    "SELECT COUNT(*) AS n FROM codigos WHERE email = ? AND expira > ?"
  ).bind(email, agora - 3600e3).first();
  if (recentes && recentes.n >= PEDIDOS_HORA) return erro("muitos códigos pedidos; tente daqui a pouco", 429);

  /* 6 digitos com getRandomValues, nunca Math.random */
  const codigo = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, "0");
  const hash = await sha256(codigo + ":" + email);

  await env.artt_planner.prepare(
    "INSERT OR REPLACE INTO codigos (hash, email, expira, tentou, usado) VALUES (?, ?, ?, 0, 0)"
  ).bind(hash, email, agora + CODIGO_MIN * 60e3).run();

  await mandarCodigo(env, email, codigo);
  return json({ ok: true });
}

/* trocar o codigo por uma sessao */
async function entrar(req, env) {
  const { email: bruto, codigo } = await req.json().catch(() => ({}));
  const email = normalizarEmail(bruto);
  const digitado = String(codigo || "").replace(/\D/g, "");
  if (!emailValido(email) || digitado.length !== 6) return erro("código inválido");

  const hash = await sha256(digitado + ":" + email);
  const linha = await env.artt_planner.prepare(
    "SELECT hash, expira, tentou, usado FROM codigos WHERE hash = ?"
  ).bind(hash).first();

  /* conta a tentativa mesmo quando o codigo nao existe, para que errar nao
     saia mais barato que acertar */
  if (!linha || linha.usado || linha.expira < Date.now()) {
    await env.artt_planner.prepare(
      "UPDATE codigos SET tentou = tentou + 1 WHERE email = ? AND usado = 0 AND expira > ?"
    ).bind(email, Date.now()).run();
    return erro("código inválido ou expirado", 401);
  }
  if (linha.tentou >= TENTATIVAS) return erro("código queimado por tentativas; peça outro", 429);
  if (!iguais(linha.hash, hash)) return erro("código inválido", 401);

  /* uso unico: o UPDATE condicional e a garantia — dois pedidos simultaneos
     com o mesmo codigo, so um sai com usado = 0 */
  const gasto = await env.artt_planner.prepare(
    "UPDATE codigos SET usado = 1 WHERE hash = ? AND usado = 0"
  ).bind(hash).run();
  if (!gasto.meta.changes) return erro("código já usado", 401);

  let pessoa = await env.artt_planner.prepare("SELECT id FROM pessoas WHERE email = ?").bind(email).first();
  if (!pessoa) {
    const id = crypto.randomUUID();
    await env.artt_planner.prepare("INSERT INTO pessoas (id, email, criada) VALUES (?, ?, ?)")
      .bind(id, email, Date.now()).run();
    pessoa = { id };
  }

  const token = await assinarSessao(pessoa.id, env.SEGREDO_SESSAO);
  return json({ ok: true, email }, 200, { "set-cookie": cookieSessao(token) });
}

const sair = () => json({ ok: true }, 200, { "set-cookie": cookieMorto() });

async function quemSou(req, env) {
  const pessoa = await lerSessao(lerCookie(req, "sessao"), env.SEGREDO_SESSAO);
  if (!pessoa) return json({ entrou: false });
  const linha = await env.artt_planner.prepare("SELECT email FROM pessoas WHERE id = ?").bind(pessoa).first();
  return json({ entrou: true, email: linha ? linha.email : null });
}

/* baixar o que mudou desde a ultima vez. `desde` e o maior v que o cliente ja
   viu — na primeira vez vem 0 e ele recebe tudo. */
async function baixar(req, env, pessoa) {
  const desde = +(new URL(req.url).searchParams.get("desde") || 0) || 0;
  const { results } = await env.artt_planner.prepare(
    "SELECT dia, doc, v FROM dias WHERE pessoa = ? AND v > ? ORDER BY v ASC LIMIT 400"
  ).bind(pessoa, desde).all();
  return json({
    dias: (results || []).map((r) => ({ dia: r.dia, v: r.v, doc: JSON.parse(r.doc) }))
  });
}

/* subir um dia. o servidor so aceita se o carimbo for mais novo que o que ele
   tem — quem chegou depois ganha, e o cliente descobre isso na resposta. */
async function subir(req, env, pessoa) {
  const corpo = await req.json().catch(() => null);
  if (!corpo || !ehDia(corpo.dia) || !corpo.doc || typeof corpo.doc !== "object") {
    return erro("documento inválido");
  }
  const v = Math.round(+corpo.v) || 0;
  if (!v) return erro("documento sem carimbo");

  const texto = JSON.stringify(corpo.doc);
  /* 256KB por dia e ordens de grandeza acima do real (~1KB); serve so para
     que um cliente com defeito nao encha o banco */
  if (texto.length > 262144) return erro("documento grande demais", 413);

  const r = await env.artt_planner.prepare(
    "INSERT INTO dias (pessoa, dia, doc, v) VALUES (?, ?, ?, ?) " +
    "ON CONFLICT(pessoa, dia) DO UPDATE SET doc = excluded.doc, v = excluded.v " +
    "WHERE excluded.v > dias.v"
  ).bind(pessoa, corpo.dia, texto, v).run();

  if (r.meta.changes) return json({ ok: true, v });

  /* nao gravou: o servidor tem versao igual ou mais nova. devolve a dele para
     o cliente adotar, em vez de deixar os dois discordando em silencio. */
  const atual = await env.artt_planner.prepare(
    "SELECT doc, v FROM dias WHERE pessoa = ? AND dia = ?"
  ).bind(pessoa, corpo.dia).first();
  return json({
    ok: false, motivo: "servidor está na frente",
    servidor: atual ? { dia: corpo.dia, v: atual.v, doc: JSON.parse(atual.doc) } : null
  }, 409);
}

/* ---------- entrada ---------- */

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const rota = url.pathname.replace(/^\/api/, "") || "/";

    if (req.method === "OPTIONS") return new Response(null, { status: 204 });

    try {
      if (rota === "/codigo" && req.method === "POST") return await pedirCodigo(req, env);
      if (rota === "/entrar" && req.method === "POST") return await entrar(req, env);
      if (rota === "/sair" && req.method === "POST") return sair();
      if (rota === "/eu" && req.method === "GET") return await quemSou(req, env);

      /* daqui pra baixo, so quem entrou */
      const pessoa = await lerSessao(lerCookie(req, "sessao"), env.SEGREDO_SESSAO);
      if (!pessoa) return erro("entre primeiro", 401);

      if (rota === "/dias" && req.method === "GET") return await baixar(req, env, pessoa);
      if (rota === "/dias" && req.method === "POST") return await subir(req, env, pessoa);

      return erro("não existe", 404);
    } catch (e) {
      /* a mensagem real vai pro log, nunca pro cliente */
      console.error(e && e.stack || e);
      return erro("deu errado aqui do meu lado", 500);
    }
  },

  /* faxina: codigo velho nao serve pra nada e so cresce */
  async scheduled(evento, env) {
    await env.artt_planner.prepare("DELETE FROM codigos WHERE expira < ?").bind(Date.now() - 3600e3).run();
  }
};
