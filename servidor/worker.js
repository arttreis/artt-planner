/* merlin · o servidor
 *
 * um Worker, um D1 e o Resend. sem framework, sem dependencia — a mesma
 * disciplina das paginas, pelo mesmo motivo: da pra ler inteiro.
 *
 * o que ele faz: diz quem e voce (codigo por e-mail), guarda um documento
 * por dia (tabela dias) e guarda documentos soltos por tipo e id (tabela
 * docs) para os outros modulos — ideias, clientes, mapas, funis, financeiro.
 * ele nao entende nada do que esta dentro: so devolve e diz qual e mais novo.
 *
 * e um sistema de uma pessoa: EMAILS_DONO no wrangler.toml lista quem pode
 * entrar. outro e-mail recebe a mesma resposta de sucesso e nenhum codigo.
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

/* os e-mails do dono, separados por virgula. vazio = qualquer um entra (so
   faz sentido em desenvolvimento). */
const donos = (env) => String(env.EMAILS_DONO || "").split(",").map(normalizarEmail).filter(Boolean);
const ehDono = (env, email) => { const d = donos(env); return !d.length || d.includes(email); };
const TIPO_DOC = /^[a-z][a-z0-9_-]{0,31}$/;
const ID_DOC = /^[A-Za-z0-9_.:-]{1,64}$/;
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
      subject: codigo + " — seu código do Merlin",
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

  /* quem nao e o dono recebe exatamente a mesma resposta, e nada acontece:
     dizer "esse e-mail nao pode" contaria quais podem */
  if (!ehDono(env, email)) return json({ ok: true });

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
  if (!ehDono(env, email)) return erro("código inválido ou expirado", 401);

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

/* ---------- documentos por tipo ----------
   a mesma regra do dia, para qualquer coisa que tenha id: quem tem o v maior
   ganha, e o servidor devolve a versao dele quando recusa. */

async function baixarDocs(req, env, pessoa) {
  const url = new URL(req.url);
  const tipo = String(url.searchParams.get("tipo") || "");
  if (!TIPO_DOC.test(tipo)) return erro("tipo inválido");
  const desde = +(url.searchParams.get("desde") || 0) || 0;
  const { results } = await env.artt_planner.prepare(
    "SELECT id, doc, v FROM docs WHERE pessoa = ? AND tipo = ? AND v > ? ORDER BY v ASC LIMIT 500"
  ).bind(pessoa, tipo, desde).all();
  return json({
    docs: (results || []).map((r) => ({ id: r.id, v: r.v, doc: JSON.parse(r.doc) }))
  });
}

async function subirDoc(req, env, pessoa) {
  const corpo = await req.json().catch(() => null);
  if (!corpo || !TIPO_DOC.test(String(corpo.tipo || "")) || !ID_DOC.test(String(corpo.id || ""))
      || !corpo.doc || typeof corpo.doc !== "object") {
    return erro("documento inválido");
  }
  const v = Math.round(+corpo.v) || 0;
  if (!v) return erro("documento sem carimbo");
  const texto = JSON.stringify(corpo.doc);
  /* um mapa mental grande fica na casa dos 100KB; 1MB e o teto de seguranca */
  if (texto.length > 1048576) return erro("documento grande demais", 413);

  const r = await env.artt_planner.prepare(
    "INSERT INTO docs (pessoa, tipo, id, doc, v) VALUES (?, ?, ?, ?, ?) " +
    "ON CONFLICT(pessoa, tipo, id) DO UPDATE SET doc = excluded.doc, v = excluded.v " +
    "WHERE excluded.v > docs.v"
  ).bind(pessoa, corpo.tipo, corpo.id, texto, v).run();

  if (r.meta.changes) return json({ ok: true, v });

  const atual = await env.artt_planner.prepare(
    "SELECT doc, v FROM docs WHERE pessoa = ? AND tipo = ? AND id = ?"
  ).bind(pessoa, corpo.tipo, corpo.id).first();
  return json({
    ok: false, motivo: "servidor está na frente",
    servidor: atual ? { id: corpo.id, v: atual.v, doc: JSON.parse(atual.doc) } : null
  }, 409);
}

/* ---------- merlin, o conselheiro ----------
   a unica rota que pensa. recebe um contexto (um no do mapa, um funil) e pede
   a Claude sugestoes em JSON. a chave e segredo do worker, como a do Resend;
   sem ela a rota responde 503 e a tela diz que falta configurar. nada aqui e
   gravado: quem decide o que entra no mapa ou no funil e quem esta na tela. */

const MODELO = "claude-opus-5";
const MAX_SUGESTOES = 12;

const SISTEMA = [
  "Você é o Merlin, conselheiro do Arthur Reis — consultor de growth, branding e desenvolvimento;",
  "sócio da Guessless (agência de growth marketing) e da GL Suite (tecnologia sob demanda).",
  "Os clientes dele vendem em Mercado Livre, Shopee, TikTok Shop, Amazon e sites próprios; o checkout da casa é Stripe.",
  "Responda SEMPRE em português do Brasil, com acentuação correta, curto e concreto: nada de frases genéricas.",
  "Responda SOMENTE com um objeto JSON, sem texto antes ou depois, sem cercas de código."
].join(" ");

const TAREFAS = {
  /* ramos para um no de mapa mental */
  ramos: (c) => ({
    instrucao:
      "Sugira ramos filhos para um nó de mapa mental. Cada ramo é uma ideia, pergunta ou próximo passo que desenvolve o nó. " +
      "Não repita o que já existe entre os irmãos ou filhos listados. Máximo " + MAX_SUGESTOES + " ramos, 2 a 6 palavras cada, com uma nota curta (até 20 palavras) explicando o porquê. " +
      'Formato: {"sugestoes":[{"titulo":"…","nota":"…"}]}',
    contexto:
      "Mapa: " + String(c.mapa || "").slice(0, 120) + "\n" +
      "Caminho até o nó: " + (Array.isArray(c.caminho) ? c.caminho.map((x) => String(x).slice(0, 80)).join(" > ") : "") + "\n" +
      "Nó selecionado: " + String(c.no || "").slice(0, 200) + "\n" +
      (c.nota ? "Nota do nó: " + String(c.nota).slice(0, 800) + "\n" : "") +
      "Filhos que já existem: " + (Array.isArray(c.filhos) && c.filhos.length ? c.filhos.map((x) => String(x).slice(0, 80)).join("; ") : "nenhum") + "\n" +
      "Irmãos: " + (Array.isArray(c.irmaos) && c.irmaos.length ? c.irmaos.map((x) => String(x).slice(0, 80)).join("; ") : "nenhum") + "\n" +
      (c.frente ? "Frente (empresa): " + String(c.frente).slice(0, 60) + "\n" : "") +
      (c.cliente ? "Cliente: " + String(c.cliente).slice(0, 60) + "\n" : "")
  }),
  /* o que falta num funil */
  funil: (c) => ({
    instrucao:
      "Analise este funil de marketing e vendas e sugira o que falta ou o que pode melhorar: etapas ausentes, automações (remarketing, recuperação de carrinho, sequências), criativos (ângulos), ofertas (bump, upsell, downsell) e gatilhos mentais. " +
      "Não repita o que já existe. Máximo " + MAX_SUGESTOES + " sugestões, cada uma com tipo, título curto (até 8 palavras) e detalhe (até 30 palavras). " +
      "Tipos válidos: no (com campo tipoNo entre trafego, anuncio, lp, vsl, captura, cta, checkout, obrigado, email, whatsapp, remarketing, upsell, downsell, bump), automacao, criativo, oferta, gatilho. " +
      'Formato: {"sugestoes":[{"tipo":"no","tipoNo":"remarketing","titulo":"…","detalhe":"…"},{"tipo":"automacao","titulo":"…","detalhe":"…"}]}',
    contexto:
      "Funil: " + String(c.nome || "").slice(0, 120) + "\n" +
      (c.cliente ? "Cliente: " + String(c.cliente).slice(0, 60) + "\n" : "") +
      (c.canal ? "Canal: " + String(c.canal).slice(0, 60) + "\n" : "") +
      "Etapas na ordem do fluxo: " + (Array.isArray(c.etapas) ? c.etapas.map((e) => String(e).slice(0, 100)).join(" -> ") : "") + "\n" +
      "Automações: " + lista(c.automacoes) + "\n" +
      "Criativos: " + lista(c.criativos) + "\n" +
      "Ofertas: " + lista(c.ofertas) + "\n" +
      "Gatilhos: " + lista(c.gatilhos) + "\n" +
      (c.numeros ? "Números do período: " + String(c.numeros).slice(0, 400) + "\n" : "")
  })
};
const lista = (v) => (Array.isArray(v) && v.length ? v.map((x) => String(x).slice(0, 80)).join("; ") : "nenhum");
const linhas = (v, n) => (Array.isArray(v) && v.length ? v.slice(0, n || 60).map((x) => "- " + String(x).slice(0, 160)).join("\n") : "- nenhum");

/* tarefas que respondem com um texto, nao com uma lista: o formato e
   {"texto":"…"} em markdown simples (paragrafos, listas com -, negrito). */
const TAREFAS_TEXTO = {
  /* uma ideia da caixa: perguntas, caminhos e proximos passos */
  ramificar: (c) => ({
    instrucao:
      "Ajude a desenvolver esta ideia. Responda com sugestões acionáveis, sem repetir os passos que já existem. " +
      "Máximo " + MAX_SUGESTOES + " itens, cada um com tipo (pergunta = o que precisa ser respondido antes; caminho = um jeito de fazer; passo = próxima ação concreta), título curto e nota de até 25 palavras. " +
      'Formato: {"sugestoes":[{"tipo":"passo","titulo":"…","nota":"…"}]}',
    contexto:
      "Ideia: " + String(c.titulo || "").slice(0, 200) + "\n" +
      "Estágio: " + String(c.estagio || "").slice(0, 30) + "\n" +
      (c.corpo ? "Corpo:\n" + String(c.corpo).slice(0, 2500) + "\n" : "") +
      "Passos que já existem:\n" + linhas(c.passos, 30) + "\n" +
      (c.frente ? "Frente (empresa): " + String(c.frente).slice(0, 60) + "\n" : "") +
      (c.cliente ? "Cliente: " + String(c.cliente).slice(0, 60) + "\n" : ""),
    formato: "lista"
  }),
  /* a semana: o que fechou, o que ficou, por frente */
  semana: (c) => ({
    instrucao:
      "Resuma esta semana de trabalho em até 180 palavras, em markdown simples: um parágrafo do que foi feito, uma lista curta do que ficou aberto agrupada por frente (empresa), e uma frase de recomendação para a próxima semana. " +
      "Seja específico com os títulos dos cartões; não invente nada que não esteja na lista. " +
      'Formato: {"texto":"…"}',
    contexto:
      "Semana: " + String(c.intervalo || "").slice(0, 60) + "\n" +
      "Cartões (dia · frente · título · duração · feito?):\n" + linhas(c.cartoes, 120) + "\n" +
      (c.diasFeitos ? "O que o dia registrou como concluído:\n" + linhas(c.diasFeitos, 80) + "\n" : ""),
    formato: "texto"
  }),
  /* pauta de reuniao com um cliente */
  reuniao: (c) => ({
    instrucao:
      "Prepare uma pauta de reunião com este cliente, em até 220 palavras, em markdown simples: contexto em duas linhas, objetivos e onde estão, pendências do backlog, o que os canais ainda não têm, decisões a tomar e próximos passos. " +
      "Use só o que está no contexto; onde faltar informação, diga o que perguntar ao cliente. " +
      'Formato: {"texto":"…"}',
    contexto:
      "Cliente: " + String(c.nome || "").slice(0, 100) + " (" + String(c.status || "").slice(0, 20) + ")\n" +
      (c.frente ? "Frente: " + String(c.frente).slice(0, 60) + "\n" : "") +
      (c.resumo ? "Resumo: " + String(c.resumo).slice(0, 800) + "\n" : "") +
      (c.contrato ? "Contrato: " + String(c.contrato).slice(0, 300) + "\n" : "") +
      "Objetivos:\n" + linhas(c.objetivos, 20) + "\n" +
      "Backlog aberto:\n" + linhas(c.backlog, 30) + "\n" +
      "Canais e o que falta:\n" + linhas(c.canais, 20) + "\n" +
      "Diário recente (mais novo primeiro):\n" + linhas(c.diario, 15) + "\n" +
      (c.ofertas ? "Ofertas: " + lista(c.ofertas) + "\n" : ""),
    formato: "texto"
  }),
  /* os numeros do funil: onde esta perdendo */
  numeros: (c) => ({
    instrucao:
      "Leia os números deste funil e diga, em até 200 palavras em markdown simples, onde ele está perdendo gente, qual etapa atacar primeiro e por quê, e duas ações concretas. " +
      "Compare cada taxa com a taxa média esperada quando houver. Se faltar número em alguma etapa, diga qual medir primeiro. Não invente números. " +
      'Formato: {"texto":"…"}',
    contexto:
      "Funil: " + String(c.nome || "").slice(0, 120) + "\n" +
      (c.periodo ? "Período: " + String(c.periodo).slice(0, 60) + "\n" : "") +
      "Etapas na ordem (tipo · título · pessoas no período):\n" + linhas(c.etapas, 40) + "\n" +
      "Taxas entre etapas (de → para · taxa real · taxa média esperada):\n" + linhas(c.taxas, 40) + "\n" +
      (c.custo ? "Custo de tráfego no período: " + String(c.custo).slice(0, 40) + "\n" : "") +
      (c.cpl ? "CPL: " + String(c.cpl).slice(0, 40) + "\n" : "") +
      (c.cac ? "CAC: " + String(c.cac).slice(0, 40) + "\n" : ""),
    formato: "texto"
  })
};

/* tira o objeto JSON de uma resposta que pode vir com texto em volta */
function extrairJson(texto) {
  const a = texto.indexOf("{"), b = texto.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(texto.slice(a, b + 1)); } catch (e) { return null; }
}

async function aconselhar(req, env) {
  if (!env.ANTHROPIC_API_KEY) return erro("o Merlin ainda não tem chave: npx wrangler secret put ANTHROPIC_API_KEY", 503);
  const corpo = await req.json().catch(() => null);
  const nome = String((corpo && corpo.tarefa) || "");
  const tarefa = corpo && (TAREFAS[nome] || TAREFAS_TEXTO[nome]);
  if (!tarefa || !corpo.contexto || typeof corpo.contexto !== "object") return erro("tarefa inválida");
  const { instrucao, contexto, formato } = tarefa(corpo.contexto);

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: MODELO,
      max_tokens: 4000,
      /* sugestao curta nao precisa do maximo de raciocinio: medio segura o custo */
      output_config: { effort: "medium" },
      system: SISTEMA,
      messages: [{ role: "user", content: instrucao + "\n\n" + contexto }]
    })
  });
  if (!r.ok) {
    console.error("anthropic " + r.status + " " + (await r.text()).slice(0, 300));
    return erro("o Merlin não respondeu (" + r.status + ")", 502);
  }
  const resposta = await r.json();
  if (resposta.stop_reason === "refusal") return erro("o Merlin preferiu não responder a isso", 422);
  const texto = (resposta.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
  const dados = extrairJson(texto);
  if (formato === "texto") {
    if (!dados || typeof dados.texto !== "string" || !dados.texto.trim()) return erro("o Merlin respondeu fora do formato", 502);
    return json({ texto: dados.texto.slice(0, 4000) });
  }
  if (!dados || !Array.isArray(dados.sugestoes)) return erro("o Merlin respondeu fora do formato", 502);
  return json({
    sugestoes: dados.sugestoes.slice(0, MAX_SUGESTOES).map((s) => ({
      tipo: String(s.tipo || "").slice(0, 20),
      tipoNo: String(s.tipoNo || "").slice(0, 20),
      titulo: String(s.titulo || "").slice(0, 120),
      nota: String(s.nota || s.detalhe || "").slice(0, 300)
    })).filter((s) => s.titulo)
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
    const rota = url.pathname.slice(4) || "/";

    if (req.method === "OPTIONS") return new Response(null, { status: 204 });

    try {
      if (rota === "/codigo" && req.method === "POST") return await pedirCodigo(req, env);
      if (rota === "/entrar" && req.method === "POST") return await entrar(req, env);
      if (rota === "/sair" && req.method === "POST") return sair();
      if (rota === "/eu" && req.method === "GET") return await quemSou(req, env);

      /* rota que nao existe e 404 antes de ser 401: pedir login para um
         caminho inexistente mente sobre a causa do erro */
      if (rota !== "/dias" && rota !== "/docs" && rota !== "/merlin") return erro("não existe", 404);

      /* daqui pra baixo, so quem entrou */
      const pessoa = await lerSessao(lerCookie(req, "sessao"), env.SEGREDO_SESSAO);
      if (!pessoa) return erro("entre primeiro", 401);

      if (rota === "/merlin") {
        if (req.method === "POST") return await aconselhar(req, env);
        return erro("método não serve aqui", 405);
      }
      if (rota === "/docs") {
        if (req.method === "GET") return await baixarDocs(req, env, pessoa);
        if (req.method === "POST") return await subirDoc(req, env, pessoa);
        return erro("método não serve aqui", 405);
      }
      if (req.method === "GET") return await baixar(req, env, pessoa);
      if (req.method === "POST") return await subir(req, env, pessoa);

      return erro("método não serve aqui", 405);
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
