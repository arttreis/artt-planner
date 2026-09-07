/* merlin · os modelos
   um lugar só para o que já se sabe de cor: a estrutura de cada canal (o
   checklist que nasce no cliente), os funis prontos e os mapas prontos.

   um modelo é dado puro — nada aqui desenha nem grava. as telas pedem
   `buildFunnel` / `buildMap`, recebem nós e arestas com id novo e gravam
   como qualquer documento. dali em diante é um funil comum: o modelo não
   volta a ser consultado, editar não muda o modelo e apagar não some com
   nada. as taxas médias vêm preenchidas como ponto de partida, para serem
   corrigidas com o número real do cliente. */
import { newId } from "./core.js";

/* ================================================================
   canais
   o mesmo vocabulário serve para três coisas: o canal do cliente
   (clients.html), o checklist que ele ganha ao nascer, e o canal a que um
   funil pertence — é o que amarra "esse cliente vende na shopee" ao
   "e o funil da shopee é assim".
   ================================================================ */
export const CHANNEL_TYPES = ["mercadolivre", "shopee", "tiktokshop", "amazon", "site", "instagram", "google", "whatsapp", "email", "other"];

export const CHANNEL_LABEL = {
  mercadolivre: "mercado livre", shopee: "shopee", tiktokshop: "tiktok shop", amazon: "amazon",
  site: "site", instagram: "instagram", google: "google", whatsapp: "whatsapp", email: "e-mail", other: "outro"
};

/* o modelo de cada canal: a estrutura do que precisa existir. entra como
   itens não feitos ao criar o canal, e dali pra frente é só texto editável. */
export const CHANNEL_CHECKLISTS = {
  mercadolivre: ["conta e reputação", "catálogo cadastrado", "fotos e fichas técnicas", "frete/Mercado Envios", "Mercado Ads", "promoções/cupons", "atendimento e perguntas", "avaliações", "integração com ERP"],
  shopee: ["conta e loja", "catálogo", "frete grátis/programa", "Shopee Ads", "cupons e lives", "avaliações", "atendimento"],
  tiktokshop: ["conta seller", "catálogo", "afiliados/creators", "vídeos e lives de produto", "TikTok Ads", "logística"],
  amazon: ["conta seller", "catálogo/ASINs", "FBA/frete", "Amazon Ads", "avaliações", "brand registry"],
  site: ["domínio e hospedagem", "loja/CMS", "checkout (Stripe)", "pixel Meta e GA4", "SEO básico", "e-mail transacional", "políticas"],
  instagram: ["bio e destaques", "linha editorial", "criativos", "Meta Ads", "WhatsApp/DM", "loja no Instagram"],
  google: ["Google Business", "Google Ads", "GA4", "Search Console"],
  whatsapp: ["número business", "catálogo", "automação (Manychat/API)", "scripts de atendimento"],
  email: ["ferramenta", "listas/segmentos", "automações", "templates"],
  other: []
};

/* ================================================================
   funis
   cada modelo tem `stages` (as etapas, na ordem de leitura) e `flow` (quem
   liga em quem). a chave curta da etapa só existe aqui, para o `flow` poder
   apontar; ao construir, vira id de verdade.

     stages: { chave: [tipo, título, campos?] }
     flow:   "a>b 40, b>c 3"   — o número é a taxa média esperada, em %

   `offers`, `automations`, `triggers` e `creatives` são o que fica
   pendurado numa etapa; `node` é a chave da etapa dona.
   ================================================================ */

/* a ordem dos grupos é a ordem da lista na hora de escolher */
export const FUNNEL_GROUPS = [
  ["structures", "estruturas clássicas"],
  ["launch", "lançamentos e cursos"],
  ["service", "serviços e high ticket"],
  ["retention", "recuperação e recompra"],
  ["mercadolivre", "mercado livre"],
  ["shopee", "shopee"],
  ["tiktokshop", "tiktok shop"],
  ["amazon", "amazon"],
  ["site", "site próprio"],
  ["instagram", "instagram"],
  ["google", "google"],
  ["whatsapp", "whatsapp"],
  ["email", "e-mail"]
];

export const FUNNEL_TEMPLATES = [
  /* ---------- estruturas clássicas ---------- */
  {
    id: "lead-magnet", group: "structures", channel: "",
    name: "captura com isca digital",
    summary: "o anúncio leva à captura, o e-mail entrega a isca e a oferta vem depois",
    stages: {
      traffic: ["traffic", "tráfego frio", { source: "meta", campaign: "captação" }],
      ad: ["ad", "criativo da isca"],
      lp: ["lp", "página de captura"],
      form: ["capture", "formulário", { what: "nome e e-mail" }],
      deliver: ["email", "e-mail 1 · entrega da isca", { sequence: "boas-vindas" }],
      nurture: ["email", "e-mails 2 a 4 · nutrição", { sequence: "nutrição" }],
      invite: ["cta", "convite para a oferta", { text: "quero começar" }],
      checkout: ["checkout", "checkout", { platform: "Stripe" }],
      thanks: ["thanks", "obrigado"]
    },
    flow: "traffic>ad 100, ad>lp 2, lp>form 35, form>deliver 100, deliver>nurture 45, nurture>invite 20, invite>checkout 30, checkout>thanks 55",
    automations: [{ name: "entrega da isca", trigger: "novo lead", action: "manda o material e começa a sequência", node: "deliver" }],
    triggers: [{ name: "reciprocidade", usage: "a isca entrega resultado antes de pedir dinheiro" }]
  },
  {
    id: "tripwire", group: "structures", channel: "",
    name: "produto de entrada (tripwire)",
    summary: "compra pequena e imediata que paga o tráfego; o lucro está no bump e no upsell",
    stages: {
      traffic: ["traffic", "tráfego frio", { source: "meta", campaign: "tripwire" }],
      ad: ["ad", "criativo de oferta"],
      lp: ["lp", "página do produto de entrada"],
      checkout: ["checkout", "checkout de entrada", { platform: "Stripe" }],
      bump: ["bump", "item no checkout"],
      upsell: ["upsell", "oferta seguinte"],
      thanks: ["thanks", "obrigado"],
      post: ["email", "pós-compra e próxima oferta", { sequence: "pós-compra" }]
    },
    flow: "traffic>ad 100, ad>lp 2.5, lp>checkout 8, checkout>bump 25, checkout>upsell 15, checkout>thanks 100, thanks>post 100",
    offers: [
      { name: "produto de entrada", type: "main", promise: "um resultado pequeno e rápido", node: "checkout" },
      { name: "bump", type: "bump", node: "bump" },
      { name: "upsell", type: "upsell", node: "upsell" }
    ]
  },
  {
    id: "vsl-evergreen", group: "structures", channel: "",
    name: "vsl perpétua",
    summary: "vídeo de vendas rodando todo dia, com remarketing para quem assistiu e não comprou",
    stages: {
      traffic: ["traffic", "tráfego frio", { source: "meta", campaign: "vsl" }],
      ad: ["ad", "criativo de gancho"],
      lp: ["lp", "página da vsl"],
      vsl: ["vsl", "vsl", { duration: "22 min" }],
      cta: ["cta", "botão que aparece no pitch", { text: "quero garantir" }],
      checkout: ["checkout", "checkout", { platform: "Stripe" }],
      bump: ["bump", "bump no checkout"],
      upsell: ["upsell", "upsell pós-compra"],
      thanks: ["thanks", "obrigado"],
      remarketing: ["remarketing", "assistiu 50% e não comprou", { window: 7, channel: "meta" }]
    },
    flow: "traffic>ad 100, ad>lp 2, lp>vsl 65, vsl>cta 30, cta>checkout 40, checkout>bump 22, checkout>upsell 12, checkout>thanks 100, vsl>remarketing 35, remarketing>lp 12",
    triggers: [
      { name: "autoridade", usage: "prova e método na primeira metade da vsl" },
      { name: "garantia", usage: "reverte o risco antes de falar de preço" }
    ]
  },
  {
    id: "live-webinar", group: "structures", channel: "",
    name: "webinário ao vivo",
    summary: "inscrição, lembretes, aula ao vivo com oferta no fim e replay para quem faltou",
    stages: {
      traffic: ["traffic", "tráfego", { source: "meta", campaign: "webinário" }],
      ad: ["ad", "criativo de convite"],
      lp: ["lp", "página de inscrição"],
      form: ["capture", "inscrição", { what: "nome, e-mail e whatsapp" }],
      reminders: ["email", "lembretes d-1, 1h e no ar", { sequence: "lembretes" }],
      group: ["whatsapp", "grupo dos inscritos", { flow: "avisos e aquecimento" }],
      live: ["custom", "webinário ao vivo"],
      pitch: ["cta", "oferta no fim da aula", { text: "quero entrar" }],
      checkout: ["checkout", "checkout", { platform: "Stripe" }],
      thanks: ["thanks", "obrigado"],
      replay: ["email", "replay por 48h", { sequence: "replay" }]
    },
    flow: "traffic>ad 100, ad>lp 3, lp>form 40, form>reminders 100, form>group 55, reminders>live 35, group>live 60, live>pitch 55, pitch>checkout 20, checkout>thanks 60, form>replay 100, replay>checkout 3",
    triggers: [{ name: "urgência", usage: "a oferta cai quando o replay expira" }]
  },
  {
    id: "challenge", group: "structures", channel: "",
    name: "desafio de 5 dias",
    summary: "cinco dias de tarefa curta no grupo, com a oferta na aula final",
    stages: {
      traffic: ["traffic", "tráfego", { source: "meta", campaign: "desafio" }],
      ad: ["ad", "criativo do desafio"],
      lp: ["lp", "página do desafio"],
      form: ["capture", "inscrição", { what: "nome, e-mail e whatsapp" }],
      group: ["whatsapp", "grupo do desafio", { flow: "tarefa do dia + prova social" }],
      lessons: ["email", "aulas dos dias 1 a 5", { sequence: "desafio" }],
      final: ["custom", "aula final ao vivo"],
      pitch: ["cta", "oferta na aula final", { text: "quero continuar" }],
      checkout: ["checkout", "checkout", { platform: "Stripe" }],
      thanks: ["thanks", "obrigado"]
    },
    flow: "traffic>ad 100, ad>lp 3.5, lp>form 45, form>group 70, form>lessons 100, group>final 40, lessons>final 20, final>pitch 60, pitch>checkout 22, checkout>thanks 60"
  },
  {
    id: "content-organic", group: "structures", channel: "",
    name: "conteúdo orgânico para lista",
    summary: "o conteúdo que já existe (vídeo, artigo, episódio) puxando gente para a base",
    stages: {
      traffic: ["traffic", "audiência do conteúdo", { source: "organic" }],
      content: ["custom", "vídeo/artigo/episódio"],
      cta: ["cta", "chamada no meio e no fim", { text: "material gratuito" }],
      lp: ["lp", "página do material"],
      form: ["capture", "captura", { what: "e-mail" }],
      nurture: ["email", "sequência de nutrição", { sequence: "nutrição" }],
      checkout: ["checkout", "checkout", { platform: "Stripe" }]
    },
    flow: "traffic>content 100, content>cta 25, cta>lp 20, lp>form 40, form>nurture 100, nurture>checkout 4"
  },

  /* ---------- lançamentos e cursos ---------- */
  {
    id: "seed-launch", group: "launch", channel: "",
    name: "lançamento semente",
    summary: "sem tráfego pago: pesquisa na base, aulas ao vivo e venda no grupo",
    stages: {
      base: ["custom", "base atual (lista, grupo, seguidores)"],
      survey: ["capture", "pesquisa com a base", { what: "dor principal e o que já tentou" }],
      invite: ["email", "convite para as aulas", { sequence: "convite" }],
      group: ["whatsapp", "grupo do lançamento", { flow: "aquecimento diário" }],
      lives: ["custom", "3 aulas ao vivo"],
      pitch: ["cta", "abertura do carrinho", { text: "quero entrar na turma" }],
      checkout: ["checkout", "checkout", { platform: "Stripe" }],
      support: ["whatsapp", "atendimento de dúvidas", { flow: "quebra de objeção" }],
      thanks: ["thanks", "obrigado"]
    },
    flow: "base>survey 8, survey>invite 100, invite>group 25, group>lives 45, lives>pitch 60, pitch>checkout 25, pitch>support 15, support>checkout 35, checkout>thanks 65"
  },
  {
    id: "classic-launch", group: "launch", channel: "",
    name: "lançamento clássico (CPL 1-2-3)",
    summary: "captação, três aulas, carrinho com prazo e remarketing até fechar",
    stages: {
      traffic: ["traffic", "captação paga", { source: "meta", campaign: "lançamento · captação" }],
      ad: ["ad", "criativos de captação"],
      lp: ["lp", "página de inscrição"],
      form: ["capture", "inscrição", { what: "nome, e-mail e whatsapp" }],
      group: ["whatsapp", "grupo/lista de avisos", { flow: "aquecimento" }],
      warmup: ["email", "aquecimento pré-evento", { sequence: "aquecimento" }],
      cpl1: ["custom", "CPL 1 · o problema"],
      cpl2: ["custom", "CPL 2 · o método"],
      cpl3: ["custom", "CPL 3 · a transformação"],
      open: ["cta", "carrinho aberto", { text: "quero minha vaga" }],
      checkout: ["checkout", "checkout", { platform: "Stripe" }],
      remarketing: ["remarketing", "assistiu e não comprou", { window: 7, channel: "meta" }],
      last: ["email", "últimas horas", { sequence: "fechamento" }],
      thanks: ["thanks", "obrigado"]
    },
    flow: "traffic>ad 100, ad>lp 2.5, lp>form 45, form>group 60, form>warmup 100, warmup>cpl1 35, group>cpl1 55, cpl1>cpl2 65, cpl2>cpl3 70, cpl3>open 60, open>checkout 18, open>remarketing 80, remarketing>checkout 4, open>last 100, last>checkout 6, checkout>thanks 70",
    triggers: [
      { name: "escassez", usage: "vagas e prazo de carrinho" },
      { name: "prova social", usage: "alunos antigos nas três aulas" }
    ]
  },
  {
    id: "course-evergreen", group: "launch", channel: "",
    name: "curso perpétuo",
    summary: "aula gratuita que roda o ano inteiro, com oferta imediata e sequência de 7 dias",
    stages: {
      traffic: ["traffic", "tráfego frio", { source: "meta", campaign: "aula gratuita" }],
      ad: ["ad", "criativo da aula"],
      lp: ["lp", "página da aula gratuita"],
      form: ["capture", "inscrição", { what: "nome e e-mail" }],
      lesson: ["vsl", "aula gravada", { duration: "45 min" }],
      pitch: ["cta", "oferta no fim da aula", { text: "quero o curso" }],
      checkout: ["checkout", "checkout do curso", { platform: "Stripe" }],
      bump: ["bump", "material de apoio"],
      upsell: ["upsell", "mentoria em grupo"],
      thanks: ["thanks", "obrigado"],
      sequence: ["email", "7 dias de quebra de objeção", { sequence: "objeções" }]
    },
    flow: "traffic>ad 100, ad>lp 2, lp>form 38, form>lesson 55, lesson>pitch 35, pitch>checkout 25, checkout>bump 20, checkout>upsell 10, checkout>thanks 100, form>sequence 100, sequence>checkout 5",
    offers: [
      { name: "curso", type: "main", node: "checkout" },
      { name: "mentoria", type: "upsell", node: "upsell" }
    ]
  },
  {
    id: "waitlist-cohort", group: "launch", channel: "",
    name: "turma com lista de espera",
    summary: "a lista enche o ano todo e a turma abre em data marcada",
    stages: {
      lp: ["lp", "página da lista de espera"],
      form: ["capture", "entrar na lista", { what: "e-mail e whatsapp" }],
      nurture: ["email", "nutrição até abrir", { sequence: "espera" }],
      alert: ["whatsapp", "aviso de abertura", { flow: "primeiro lote" }],
      cta: ["cta", "vaga na turma", { text: "garantir vaga" }],
      checkout: ["checkout", "checkout", { platform: "Stripe" }],
      thanks: ["thanks", "obrigado"]
    },
    flow: "lp>form 45, form>nurture 100, form>alert 70, nurture>cta 12, alert>cta 30, cta>checkout 28, checkout>thanks 70",
    triggers: [{ name: "escassez", usage: "turma com data e número de vagas" }]
  },
  {
    id: "membership", group: "launch", channel: "",
    name: "clube por assinatura",
    summary: "vender é a parte fácil; o funil só fecha no mês 2, com onboarding e retenção",
    stages: {
      traffic: ["traffic", "tráfego", { source: "meta", campaign: "clube" }],
      ad: ["ad", "criativo do clube"],
      lp: ["lp", "página do clube"],
      checkout: ["checkout", "assinatura mensal", { platform: "Stripe" }],
      thanks: ["thanks", "boas-vindas"],
      onboarding: ["email", "onboarding da primeira semana", { sequence: "onboarding" }],
      community: ["custom", "comunidade e encontros"],
      retention: ["email", "retenção do mês 2", { sequence: "retenção" }]
    },
    flow: "traffic>ad 100, ad>lp 2.5, lp>checkout 4, checkout>thanks 100, thanks>onboarding 100, onboarding>community 45, community>retention 100"
  },

  /* ---------- serviços e high ticket ---------- */
  {
    id: "high-ticket-application", group: "service", channel: "",
    name: "high ticket por aplicação",
    summary: "ninguém compra no site: o formulário filtra e a venda acontece na call",
    stages: {
      traffic: ["traffic", "tráfego qualificado", { source: "meta", campaign: "aplicação" }],
      ad: ["ad", "criativo de autoridade"],
      vsl: ["vsl", "vídeo do método", { duration: "18 min" }],
      cta: ["cta", "candidatar-se", { text: "quero me candidatar" }],
      form: ["capture", "formulário de aplicação", { what: "faturamento, contexto e urgência" }],
      qualify: ["whatsapp", "qualificação e confirmação", { flow: "script de pré-call" }],
      call: ["custom", "call de diagnóstico"],
      checkout: ["checkout", "proposta e contrato", { platform: "Stripe" }],
      thanks: ["thanks", "cliente novo"]
    },
    flow: "traffic>ad 100, ad>vsl 1.5, vsl>cta 25, cta>form 45, form>qualify 100, qualify>call 55, call>checkout 30, checkout>thanks 90"
  },
  {
    id: "free-diagnosis", group: "service", channel: "",
    name: "diagnóstico gratuito (agência)",
    summary: "a reunião de diagnóstico é o produto de entrada; a proposta sai dela",
    stages: {
      traffic: ["traffic", "tráfego", { source: "meta", campaign: "diagnóstico" }],
      ad: ["ad", "criativo de dor específica"],
      lp: ["lp", "página do diagnóstico"],
      form: ["capture", "agendamento", { what: "empresa, canal e faturamento" }],
      confirm: ["email", "confirmação e lembrete", { sequence: "agenda" }],
      meeting: ["custom", "reunião de diagnóstico"],
      proposal: ["custom", "proposta"],
      checkout: ["checkout", "contrato assinado", { platform: "Stripe" }],
      thanks: ["thanks", "cliente novo"]
    },
    flow: "traffic>ad 100, ad>lp 2, lp>form 18, form>confirm 100, confirm>meeting 65, meeting>proposal 70, proposal>checkout 35, checkout>thanks 95"
  },
  {
    id: "local-service", group: "service", channel: "",
    name: "serviço local",
    summary: "quem busca já quer resolver hoje: o caminho é curto e termina no whatsapp",
    stages: {
      traffic: ["traffic", "busca local", { source: "google", campaign: "serviço + cidade" }],
      ad: ["ad", "anúncio de busca"],
      lp: ["lp", "página do serviço"],
      cta: ["cta", "chamar no whatsapp", { text: "falar agora" }],
      whatsapp: ["whatsapp", "atendimento", { flow: "qualificação e agenda" }],
      quote: ["custom", "orçamento/visita"],
      checkout: ["checkout", "pagamento", { platform: "Pix/Stripe" }],
      thanks: ["thanks", "serviço fechado"]
    },
    flow: "traffic>ad 100, ad>lp 6, lp>cta 20, cta>whatsapp 80, whatsapp>quote 45, quote>checkout 40, checkout>thanks 95"
  },
  {
    id: "b2b-outbound", group: "service", channel: "",
    name: "prospecção B2B",
    summary: "lista fria, três toques e uma call de descoberta antes de qualquer proposta",
    stages: {
      list: ["custom", "lista de empresas-alvo"],
      cold: ["email", "cold mail 1 a 3", { sequence: "outbound" }],
      followup: ["whatsapp", "follow-up", { flow: "toque humano" }],
      discovery: ["custom", "call de descoberta"],
      proposal: ["custom", "proposta"],
      checkout: ["checkout", "contrato", { platform: "Stripe" }],
      thanks: ["thanks", "cliente novo"]
    },
    flow: "list>cold 100, cold>followup 60, cold>discovery 3, followup>discovery 8, discovery>proposal 55, proposal>checkout 30, checkout>thanks 95"
  },
  {
    id: "saas-trial", group: "service", channel: "",
    name: "SaaS com teste grátis",
    summary: "a conversão não é a assinatura, é a ativação: chegar ao primeiro valor",
    stages: {
      traffic: ["traffic", "tráfego", { source: "google", campaign: "teste grátis" }],
      ad: ["ad", "criativo de problema"],
      lp: ["lp", "página do produto"],
      signup: ["capture", "conta de teste", { what: "e-mail e empresa" }],
      onboarding: ["email", "onboarding d0, d1 e d3", { sequence: "ativação" }],
      value: ["custom", "primeiro valor entregue"],
      cta: ["cta", "assinar", { text: "assinar agora" }],
      checkout: ["checkout", "assinatura", { platform: "Stripe" }],
      thanks: ["thanks", "assinante"],
      expired: ["remarketing", "teste expirado sem assinar", { window: 14, channel: "e-mail e meta" }]
    },
    flow: "traffic>ad 100, ad>lp 3, lp>signup 8, signup>onboarding 100, onboarding>value 40, value>cta 35, cta>checkout 45, checkout>thanks 95, signup>expired 60, expired>checkout 5"
  },

  /* ---------- recuperação e recompra ---------- */
  {
    id: "abandoned-cart", group: "retention", channel: "",
    name: "carrinho abandonado",
    summary: "três toques em janelas diferentes: e-mail em 1h, whatsapp em 24h, anúncio em 3 dias",
    stages: {
      cart: ["checkout", "checkout iniciado", { platform: "Stripe" }],
      mail: ["email", "e-mail 1 · 1 hora", { sequence: "carrinho" }],
      whatsapp: ["whatsapp", "mensagem · 24 horas", { flow: "dúvida + link" }],
      ads: ["remarketing", "anúncio de recuperação", { window: 3, channel: "meta" }],
      back: ["checkout", "compra recuperada", { platform: "Stripe" }],
      thanks: ["thanks", "obrigado"]
    },
    flow: "cart>mail 100, cart>whatsapp 70, cart>ads 85, mail>back 8, whatsapp>back 12, ads>back 3, back>thanks 100",
    automations: [
      { name: "carrinho abandonado · e-mail", trigger: "checkout iniciado sem pagamento", action: "e-mail em 1 hora", node: "mail" },
      { name: "carrinho abandonado · whatsapp", trigger: "24h sem pagamento", action: "mensagem com o link do carrinho", node: "whatsapp" }
    ]
  },
  {
    id: "winback", group: "retention", channel: "",
    name: "reativação de base parada",
    summary: "quem já comprou uma vez custa menos que um lead novo; o cupom só entra no fim",
    stages: {
      base: ["custom", "quem não compra há 90 dias"],
      mail: ["email", "sentimos sua falta", { sequence: "reativação" }],
      whatsapp: ["whatsapp", "mensagem pessoal", { flow: "sem cupom, só conversa" }],
      cta: ["cta", "cupom de retorno", { text: "voltar com desconto" }],
      checkout: ["checkout", "checkout", { platform: "Stripe" }],
      thanks: ["thanks", "obrigado"]
    },
    flow: "base>mail 100, base>whatsapp 40, mail>cta 6, whatsapp>cta 15, cta>checkout 30, checkout>thanks 90"
  },
  {
    id: "post-purchase-upsell", group: "retention", channel: "",
    name: "upsell pós-compra",
    summary: "o melhor momento de vender de novo é o minuto seguinte à primeira compra",
    stages: {
      main: ["checkout", "compra principal", { platform: "Stripe" }],
      upsell: ["upsell", "oferta em um clique"],
      downsell: ["downsell", "versão menor da mesma oferta"],
      thanks: ["thanks", "obrigado"],
      post: ["email", "pós-venda d+3", { sequence: "pós-venda" }],
      review: ["custom", "pedido de avaliação"]
    },
    flow: "main>upsell 100, upsell>downsell 80, upsell>thanks 20, downsell>thanks 100, thanks>post 100, post>review 30",
    offers: [
      { name: "oferta principal", type: "main", node: "main" },
      { name: "upsell", type: "upsell", node: "upsell" },
      { name: "downsell", type: "downsell", node: "downsell" }
    ]
  },
  {
    id: "referral", group: "retention", channel: "",
    name: "indicação (member get member)",
    summary: "o cliente satisfeito vira canal: ele indica, o indicado entra com benefício",
    stages: {
      happy: ["custom", "cliente satisfeito"],
      invite: ["email", "convite para indicar", { sequence: "indicação" }],
      lp: ["lp", "página de indicação"],
      form: ["capture", "quem foi indicado", { what: "nome e whatsapp do indicado" }],
      contact: ["whatsapp", "contato com o indicado", { flow: "benefício dos dois lados" }],
      checkout: ["checkout", "compra do indicado", { platform: "Stripe" }],
      thanks: ["thanks", "obrigado (e prêmio de quem indicou)"]
    },
    flow: "happy>invite 100, invite>lp 12, lp>form 35, form>contact 100, contact>checkout 25, checkout>thanks 95"
  },
  {
    id: "replenishment", group: "retention", channel: "",
    name: "recompra programada",
    summary: "produto que acaba tem data: o lembrete sai antes do cliente lembrar sozinho",
    stages: {
      first: ["checkout", "primeira compra", { platform: "Stripe" }],
      remind: ["email", "d+20 · está acabando?", { sequence: "recompra" }],
      whatsapp: ["whatsapp", "lembrete com link", { flow: "1 clique para repetir" }],
      cta: ["cta", "repetir o pedido", { text: "comprar de novo" }],
      again: ["checkout", "recompra", { platform: "Stripe" }],
      subscription: ["custom", "assinatura de reposição"]
    },
    flow: "first>remind 100, first>whatsapp 60, remind>cta 15, whatsapp>cta 22, cta>again 40, again>subscription 12"
  },

  /* ---------- mercado livre ---------- */
  {
    id: "ml-winning-listing", group: "mercadolivre", channel: "mercadolivre",
    name: "mercado livre · anúncio ganhador",
    summary: "busca e Mercado Ads caem no mesmo anúncio; reputação e avaliação alimentam de volta",
    stages: {
      search: ["traffic", "busca no ML", { source: "organic", campaign: "palavras do produto" }],
      ads: ["traffic", "Mercado Ads", { source: "marketplace", campaign: "product ads" }],
      listing: ["lp", "anúncio do produto"],
      questions: ["custom", "perguntas respondidas"],
      buy: ["checkout", "compra no ML", { platform: "Mercado Livre" }],
      thanks: ["thanks", "venda concluída"],
      review: ["custom", "avaliação positiva"]
    },
    flow: "search>listing 3, ads>listing 4, listing>questions 6, listing>buy 8, questions>buy 25, buy>thanks 100, thanks>review 20, review>listing 100",
    triggers: [{ name: "prova social", usage: "reputação verde e avaliações com foto sobem a conversão do anúncio" }]
  },
  {
    id: "ml-after-sale", group: "mercadolivre", channel: "mercadolivre",
    name: "mercado livre · pós-venda e saída para a base",
    summary: "o marketplace vende, mas o cliente é dele; aqui a segunda compra acontece na casa própria",
    stages: {
      buy: ["checkout", "compra no ML", { platform: "Mercado Livre" }],
      insert: ["custom", "cartão/QR na embalagem"],
      whatsapp: ["whatsapp", "pós-venda no whatsapp", { flow: "garantia e manual" }],
      capture: ["capture", "cadastro na base", { what: "nome, e-mail e whatsapp" }],
      nurture: ["email", "nutrição fora do ML", { sequence: "pós-venda" }],
      cta: ["cta", "cupom da loja própria", { text: "comprar direto" }],
      site: ["checkout", "compra no site", { platform: "Stripe" }]
    },
    flow: "buy>insert 100, insert>whatsapp 18, whatsapp>capture 60, capture>nurture 100, nurture>cta 20, cta>site 25"
  },

  /* ---------- shopee ---------- */
  {
    id: "shopee-coupon-ads", group: "shopee", channel: "shopee",
    name: "shopee · cupom e ads",
    summary: "preço, frete e cupom decidem a compra; o ads só acelera o que já converte",
    stages: {
      search: ["traffic", "busca na Shopee", { source: "organic", campaign: "palavras do produto" }],
      ads: ["traffic", "Shopee Ads", { source: "marketplace", campaign: "descoberta e busca" }],
      page: ["lp", "página do produto"],
      coupon: ["bump", "cupom da loja"],
      buy: ["checkout", "checkout Shopee", { platform: "Shopee" }],
      thanks: ["thanks", "venda concluída"],
      review: ["custom", "avaliação com foto"]
    },
    flow: "search>page 3, ads>page 5, page>coupon 30, page>buy 6, coupon>buy 20, buy>thanks 100, thanks>review 25, review>page 100"
  },
  {
    id: "shopee-live-affiliates", group: "shopee", channel: "shopee",
    name: "shopee · live e afiliados",
    summary: "creators levam audiência de fora para a live, e a live empurra o produto em destaque",
    stages: {
      affiliates: ["custom", "afiliados e creators"],
      social: ["traffic", "audiência do creator", { source: "tiktok", campaign: "divulgação da live" }],
      live: ["custom", "live de produtos"],
      page: ["lp", "produto em destaque"],
      buy: ["checkout", "checkout Shopee", { platform: "Shopee" }],
      thanks: ["thanks", "venda concluída"],
      group: ["whatsapp", "grupo de ofertas", { flow: "avisos da próxima live" }]
    },
    flow: "affiliates>social 100, social>live 4, live>page 35, page>buy 12, buy>thanks 100, thanks>group 15, group>live 30"
  },

  /* ---------- tiktok shop ---------- */
  {
    id: "tts-creator", group: "tiktokshop", channel: "tiktokshop",
    name: "tiktok shop · creator e afiliado",
    summary: "o creator produz e distribui; a marca cuida da vitrine, do estoque e da avaliação",
    stages: {
      organic: ["traffic", "tiktok orgânico", { source: "tiktok", campaign: "vídeos de produto" }],
      creator: ["custom", "creator/afiliado"],
      video: ["ad", "vídeo com produto marcado"],
      shop: ["lp", "vitrine do tiktok shop"],
      buy: ["checkout", "checkout tiktok shop", { platform: "TikTok Shop" }],
      thanks: ["thanks", "venda concluída"],
      review: ["custom", "avaliação e recompra"]
    },
    flow: "organic>creator 100, creator>video 100, video>shop 3, shop>buy 10, buy>thanks 100, thanks>review 22, review>shop 100"
  },
  {
    id: "tts-live", group: "tiktokshop", channel: "tiktokshop",
    name: "tiktok shop · live shopping",
    summary: "cupom que só vale durante a live, e remarketing depois para quem assistiu",
    stages: {
      ads: ["traffic", "TikTok Ads", { source: "tiktok", campaign: "chamada da live" }],
      live: ["custom", "live"],
      cta: ["cta", "cupom da live", { text: "pegar o cupom" }],
      pinned: ["lp", "produto fixado"],
      buy: ["checkout", "checkout tiktok shop", { platform: "TikTok Shop" }],
      thanks: ["thanks", "venda concluída"],
      remarketing: ["remarketing", "assistiu e não comprou", { window: 3, channel: "tiktok" }]
    },
    flow: "ads>live 2.5, live>cta 30, cta>pinned 70, pinned>buy 14, buy>thanks 100, live>remarketing 60, remarketing>pinned 6",
    triggers: [{ name: "urgência", usage: "o cupom morre no fim da transmissão" }]
  },

  /* ---------- amazon ---------- */
  {
    id: "amazon-launch", group: "amazon", channel: "amazon",
    name: "amazon · lançamento de ASIN",
    summary: "as primeiras avaliações compram o ranking; o ads paga esse começo",
    stages: {
      search: ["traffic", "busca na Amazon", { source: "organic", campaign: "palavras do ASIN" }],
      ads: ["traffic", "Amazon Ads", { source: "marketplace", campaign: "sponsored products" }],
      page: ["lp", "página do ASIN"],
      coupon: ["bump", "cupom de lançamento"],
      buy: ["checkout", "buy box", { platform: "Amazon" }],
      thanks: ["thanks", "venda concluída"],
      review: ["custom", "solicitação de review"]
    },
    flow: "search>page 2, ads>page 4, page>coupon 25, page>buy 9, coupon>buy 18, buy>thanks 100, thanks>review 12, review>page 100"
  },
  {
    id: "amazon-repeat", group: "amazon", channel: "amazon",
    name: "amazon · recompra e marca",
    summary: "a segunda compra vem da marca, não do produto: brand store, seguir e assine-e-poupe",
    stages: {
      first: ["checkout", "primeira compra", { platform: "Amazon" }],
      insert: ["custom", "inserto na embalagem"],
      brand: ["lp", "brand store"],
      follow: ["email", "seguir a marca / novidades", { sequence: "marca" }],
      again: ["checkout", "recompra ou assine e poupe", { platform: "Amazon" }]
    },
    flow: "first>insert 100, insert>brand 8, brand>follow 20, follow>again 15, brand>again 10"
  },

  /* ---------- site próprio ---------- */
  {
    id: "site-cold-traffic", group: "site", channel: "site",
    name: "site · tráfego frio para produto",
    summary: "o clássico do e-commerce: anúncio, página de produto, bump de frete e remarketing",
    stages: {
      traffic: ["traffic", "tráfego frio", { source: "meta", campaign: "produto" }],
      ad: ["ad", "criativo de produto"],
      page: ["lp", "página do produto"],
      bump: ["bump", "frete grátis acima de X"],
      checkout: ["checkout", "checkout", { platform: "Stripe" }],
      thanks: ["thanks", "obrigado"],
      post: ["email", "pós-compra", { sequence: "pós-compra" }],
      remarketing: ["remarketing", "visitou e não comprou", { window: 7, channel: "meta" }]
    },
    flow: "traffic>ad 100, ad>page 1.8, page>bump 22, page>checkout 4, bump>checkout 60, checkout>thanks 55, thanks>post 100, page>remarketing 90, remarketing>page 8"
  },
  {
    id: "site-seo-content", group: "site", channel: "site",
    name: "site · conteúdo e SEO para venda",
    summary: "o artigo responde a dúvida, o produto aparece dentro dela e o cupom pega quem não compra hoje",
    stages: {
      search: ["traffic", "busca orgânica", { source: "organic", campaign: "guias e comparativos" }],
      article: ["lp", "artigo/guia"],
      cta: ["cta", "ver o produto", { text: "conhecer o produto" }],
      product: ["lp", "página do produto"],
      capture: ["capture", "cupom em troca do e-mail", { what: "e-mail" }],
      checkout: ["checkout", "checkout", { platform: "Stripe" }],
      thanks: ["thanks", "obrigado"]
    },
    flow: "search>article 100, article>cta 12, cta>product 70, article>capture 4, capture>product 25, product>checkout 3.5, checkout>thanks 60"
  },

  /* ---------- instagram ---------- */
  {
    id: "ig-content-dm", group: "instagram", channel: "instagram",
    name: "instagram · conteúdo, DM e venda",
    summary: "a palavra-chave no comentário abre a conversa, e a venda acontece no direct",
    stages: {
      organic: ["traffic", "alcance orgânico", { source: "organic", campaign: "reels e carrosséis" }],
      content: ["custom", "reels/carrossel"],
      cta: ["cta", "comente a palavra-chave", { text: "comenta EU QUERO" }],
      dm: ["whatsapp", "DM automática", { flow: "entrega + pergunta" }],
      talk: ["custom", "conversa humana"],
      checkout: ["checkout", "link de pagamento", { platform: "Stripe" }],
      thanks: ["thanks", "obrigado"]
    },
    flow: "organic>content 100, content>cta 4, cta>dm 85, dm>talk 30, talk>checkout 20, checkout>thanks 90"
  },
  {
    id: "ig-ads-whatsapp", group: "instagram", channel: "instagram",
    name: "instagram · anúncio para whatsapp",
    summary: "anúncio curto, página curta, conversa no whatsapp com script; bom para ticket médio",
    stages: {
      ads: ["traffic", "Meta Ads", { source: "meta", campaign: "clique para whatsapp" }],
      ad: ["ad", "criativo de oferta"],
      lp: ["lp", "página curta"],
      cta: ["cta", "chamar no whatsapp", { text: "falar agora" }],
      whatsapp: ["whatsapp", "atendimento com script", { flow: "qualificação, oferta, fechamento" }],
      checkout: ["checkout", "link de pagamento", { platform: "Stripe" }],
      thanks: ["thanks", "obrigado"],
      remarketing: ["remarketing", "conversou e não fechou", { window: 5, channel: "meta" }]
    },
    flow: "ads>ad 100, ad>lp 2, lp>cta 25, cta>whatsapp 75, whatsapp>checkout 18, checkout>thanks 90, whatsapp>remarketing 60, remarketing>whatsapp 10"
  },

  /* ---------- google ---------- */
  {
    id: "google-search-intent", group: "google", channel: "google",
    name: "google · busca de intenção",
    summary: "quem digita já quer comprar: uma landing por grupo de termo, sem desvio",
    stages: {
      ads: ["traffic", "Google Ads · busca", { source: "google", campaign: "termos de compra" }],
      ad: ["ad", "anúncio de texto"],
      lp: ["lp", "landing do termo"],
      cta: ["cta", "chamada principal", { text: "comprar agora" }],
      checkout: ["checkout", "checkout", { platform: "Stripe" }],
      thanks: ["thanks", "obrigado"],
      remarketing: ["remarketing", "visitou a landing", { window: 14, channel: "google display" }]
    },
    flow: "ads>ad 100, ad>lp 5, lp>cta 30, cta>checkout 35, checkout>thanks 60, lp>remarketing 85, remarketing>lp 5"
  },
  {
    id: "google-shopping", group: "google", channel: "google",
    name: "google · shopping e pmax",
    summary: "o catálogo é o criativo: feed limpo, página de produto rápida e recuperação de carrinho",
    stages: {
      pmax: ["traffic", "Google Ads · PMax/Shopping", { source: "google", campaign: "feed do catálogo" }],
      product: ["lp", "página do produto"],
      bump: ["bump", "frete ou kit"],
      checkout: ["checkout", "checkout", { platform: "Stripe" }],
      thanks: ["thanks", "obrigado"],
      post: ["email", "pós-compra", { sequence: "pós-compra" }],
      cart: ["remarketing", "carrinho abandonado", { window: 3, channel: "google e e-mail" }]
    },
    flow: "pmax>product 100, product>bump 20, product>checkout 3, bump>checkout 55, checkout>thanks 55, thanks>post 100, checkout>cart 45, cart>checkout 8"
  },

  /* ---------- whatsapp ---------- */
  {
    id: "wa-broadcast", group: "whatsapp", channel: "whatsapp",
    name: "whatsapp · disparo para a base",
    summary: "a base segmentada é o canal mais barato que existe — e o que mais queima se abusar",
    stages: {
      base: ["custom", "base segmentada"],
      message: ["whatsapp", "mensagem de oferta", { flow: "1 oferta por disparo" }],
      cta: ["cta", "link com cupom", { text: "ver a oferta" }],
      lp: ["lp", "página da oferta"],
      checkout: ["checkout", "checkout", { platform: "Stripe" }],
      thanks: ["thanks", "obrigado"]
    },
    flow: "base>message 100, message>cta 18, cta>lp 90, lp>checkout 8, checkout>thanks 85"
  },
  {
    id: "wa-group", group: "whatsapp", channel: "whatsapp",
    name: "whatsapp · comunidade de ofertas",
    summary: "o grupo vira audiência recorrente: entra uma vez, recebe oferta toda semana",
    stages: {
      traffic: ["traffic", "bio e anúncios", { source: "meta", campaign: "entrada do grupo" }],
      lp: ["lp", "convite do grupo"],
      join: ["capture", "entrada no grupo", { what: "número de whatsapp" }],
      group: ["whatsapp", "comunidade", { flow: "conteúdo + oferta" }],
      routine: ["custom", "rotina semanal de ofertas"],
      cta: ["cta", "oferta da semana", { text: "aproveitar" }],
      checkout: ["checkout", "checkout", { platform: "Stripe" }],
      thanks: ["thanks", "obrigado"]
    },
    flow: "traffic>lp 3, lp>join 45, join>group 100, group>routine 100, routine>cta 20, cta>checkout 25, checkout>thanks 85"
  },

  /* ---------- e-mail ---------- */
  {
    id: "email-nurture", group: "email", channel: "email",
    name: "e-mail · nutrição pós-captura",
    summary: "cinco dias entre virar lead e ver preço: história, prova e só então a oferta",
    stages: {
      lead: ["capture", "novo lead", { what: "e-mail" }],
      d0: ["email", "d0 · boas-vindas e entrega", { sequence: "nutrição" }],
      d1: ["email", "d1 · a história", { sequence: "nutrição" }],
      d3: ["email", "d3 · prova e método", { sequence: "nutrição" }],
      d5: ["email", "d5 · a oferta", { sequence: "nutrição" }],
      cta: ["cta", "chamada da oferta", { text: "quero começar" }],
      checkout: ["checkout", "checkout", { platform: "Stripe" }],
      thanks: ["thanks", "obrigado"]
    },
    flow: "lead>d0 100, d0>d1 55, d1>d3 45, d3>d5 40, d5>cta 18, cta>checkout 30, checkout>thanks 80"
  },
  {
    id: "email-reengagement", group: "email", channel: "email",
    name: "e-mail · reengajamento de base",
    summary: "três e-mails para acordar quem sumiu — e a limpeza da lista para quem não acordar",
    stages: {
      cold: ["custom", "sem abrir há 90 dias"],
      ask: ["email", "ainda quer receber?", { sequence: "reengajamento" }],
      best: ["email", "o melhor conteúdo do ano", { sequence: "reengajamento" }],
      offer: ["email", "oferta de retorno", { sequence: "reengajamento" }],
      checkout: ["checkout", "checkout", { platform: "Stripe" }],
      clean: ["custom", "limpeza da lista"]
    },
    flow: "cold>ask 100, ask>best 12, best>offer 40, offer>checkout 4, cold>clean 85"
  }
];

/* o caminho do modelo em uma linha só, para a tela mostrar antes de criar */
export const funnelChain = (tpl) => Object.values(tpl.stages || {}).map(([, title]) => title);

/* devolve os grupos com os modelos dentro, na ordem de FUNNEL_GROUPS. com
   `channel`, só os daquele canal — e, se o canal não tiver nenhum, tudo. */
export function funnelGroups(channel) {
  const list = channel ? FUNNEL_TEMPLATES.filter((t) => t.channel === channel) : FUNNEL_TEMPLATES;
  const pool = list.length ? list : FUNNEL_TEMPLATES;
  return FUNNEL_GROUPS
    .map(([key, label]) => ({ key, label, items: pool.filter((t) => t.group === key) }))
    .filter((g) => g.items.length);
}

/* "a>b 40, b>c 3" → arestas de verdade, ignorando o que aponta para etapa
   que não existe (erro de digitação no modelo não derruba a criação) */
function parseFlow(flow, ids) {
  return String(flow || "").split(",").map((raw) => {
    const parts = raw.trim().split(/\s+/);
    const [from, to] = String(parts[0] || "").split(">");
    if (!ids.has(from) || !ids.has(to)) return null;
    const rate = parts.length > 1 ? Number(parts[1]) : NaN;
    return { id: newId(), from: ids.get(from), to: ids.get(to), label: "", avgRate: Number.isFinite(rate) ? rate : null };
  }).filter(Boolean);
}

/* o que fica pendurado numa etapa: id novo e `node` traduzido de chave para id */
const linkedItems = (list, defaults, ids) => (list || []).map((item) => ({
  ...defaults, ...item, id: newId(), node: item.node ? (ids.get(item.node) || "") : ""
}));

/* o modelo virando documento: nós sem posição (quem chama roda o layout),
   arestas com a taxa média, e as listas laterais já ligadas às etapas. */
export function buildFunnel(tpl) {
  const ids = new Map();
  const nodes = Object.entries(tpl.stages || {}).map(([key, spec]) => {
    const [type, title, fields] = spec;
    const id = newId();
    ids.set(key, id);
    return { id, type, title: title || "", x: 0, y: 0, fields: { ...(fields || {}) }, number: null, note: "" };
  });
  return {
    nodes,
    edges: parseFlow(tpl.flow, ids),
    creatives: linkedItems(tpl.creatives, { title: "", format: "image", angle: "", url: "", status: "idea" }, ids),
    automations: linkedItems(tpl.automations, { name: "", trigger: "", action: "", tool: "", status: "idea" }, ids),
    offers: linkedItems(tpl.offers, { name: "", price: 0, type: "main", promise: "", guarantee: "" }, ids),
    triggers: linkedItems(tpl.triggers, { name: "", usage: "" }, ids)
  };
}

/* ================================================================
   mapas
   a árvore é literal: um galho é ["título", [filhos]] e uma folha é só o
   texto. a raiz não entra aqui — ela é o nome que o Arthur digitar.
   ================================================================ */

export const MAP_GROUPS = [
  ["campaign", "campanhas e lançamentos"],
  ["offer", "oferta e copy"],
  ["client", "clientes e canais"],
  ["business", "negócio e decisão"]
];

export const MAP_TEMPLATES = [
  /* ---------- campanhas e lançamentos ---------- */
  {
    id: "campaign-plan", group: "campaign",
    name: "plano de campanha",
    summary: "o que precisa estar decidido antes de subir qualquer anúncio",
    tree: [
      ["objetivo", ["meta em número", "prazo", "verba total"]],
      ["público", ["quem é", "dor principal", "objeções"]],
      ["oferta", ["promessa", "preço e parcelamento", "garantia"]],
      ["canais", ["onde anunciar", "formato por canal", "verba por canal"]],
      ["criativos", ["ângulos", "formatos", "quantidade por semana"]],
      ["cronograma", ["pré", "durante", "pós"]],
      ["métricas", ["CPA alvo", "ROAS alvo", "ponto de corte"]]
    ]
  },
  {
    id: "launch-map", group: "campaign",
    name: "mapa do lançamento",
    summary: "as quatro fases de um lançamento e quem responde por cada uma",
    tree: [
      ["pré-lançamento", ["pesquisa com a base", "captação", "aquecimento"]],
      ["evento", ["CPL 1", "CPL 2", "CPL 3", "live de abertura"]],
      ["carrinho", ["abertura", "bônus por lote", "prazo e fechamento"]],
      ["pós", ["entrega e onboarding", "suporte", "remarketing dos que não compraram"]],
      ["equipe e prazos", ["copy", "tráfego", "edição", "suporte"]]
    ]
  },
  {
    id: "content-calendar", group: "campaign",
    name: "linha editorial",
    summary: "pilares, formatos e frequência antes de pensar em post solto",
    tree: [
      ["pilares", ["autoridade", "prova", "bastidor", "oferta"]],
      ["formatos", ["reels", "carrossel", "estático", "story"]],
      ["frequência", ["por semana", "por pilar"]],
      ["ganchos", ["dor", "curiosidade", "número", "contra-intuitivo"]],
      ["chamada", ["comentário", "direct", "link"]],
      ["reaproveitamento", ["corte de live", "e-mail", "artigo"]]
    ]
  },

  /* ---------- oferta e copy ---------- */
  {
    id: "offer-structure", group: "offer",
    name: "estrutura da oferta",
    summary: "tudo que uma oferta precisa ter antes de virar página",
    tree: [
      ["promessa", ["resultado", "prazo", "para quem"]],
      ["mecanismo", ["por que funciona", "por que é diferente"]],
      ["entregáveis", ["o que a pessoa recebe", "formato", "acesso"]],
      ["provas", ["depoimentos", "números", "casos"]],
      ["bônus", ["que resolvem objeção"]],
      ["garantia", ["prazo", "condição"]],
      ["preço", ["à vista", "parcelado", "ancoragem"]],
      ["objeções", ["caro", "não tenho tempo", "não é para mim", "já tentei"]]
    ]
  },
  {
    id: "vsl-script", group: "offer",
    name: "roteiro de vsl",
    summary: "a ordem que segura a atenção até o preço",
    tree: [
      ["gancho", ["promessa em 10 segundos"]],
      ["problema", ["o que dói hoje", "o que já tentaram"]],
      ["história", ["quem sou", "a virada"]],
      ["mecanismo", ["o método", "por que é diferente"]],
      ["prova", ["casos", "números"]],
      ["oferta", ["o que recebe", "preço"]],
      ["bônus", []],
      ["garantia", []],
      ["escassez", ["prazo ou vaga"]],
      ["chamada", ["o que fazer agora"]]
    ]
  },
  {
    id: "avatar", group: "offer",
    name: "avatar",
    summary: "quem é a pessoa do outro lado, em palavras dela",
    tree: [
      ["quem é", ["idade", "trabalho", "renda"]],
      ["dia a dia", ["rotina", "onde perde tempo"]],
      ["dores", ["a que tira o sono"]],
      ["desejos", ["o que quer mostrar", "o que quer sentir"]],
      ["objeções", ["do produto", "do preço", "de si mesma"]],
      ["onde está", ["redes", "grupos", "quem segue"]],
      ["linguagem", ["como fala do problema"]],
      ["o que já tentou", ["e por que não deu certo"]]
    ]
  },
  {
    id: "creative-angles", group: "offer",
    name: "ângulos de criativo",
    summary: "oito entradas diferentes para o mesmo produto",
    tree: [
      ["dor", []], ["desejo", []], ["inimigo comum", []], ["prova social", []],
      ["comparação", []], ["antes e depois", []], ["autoridade", []], ["curiosidade", []]
    ]
  },

  /* ---------- clientes e canais ---------- */
  {
    id: "client-onboarding", group: "client",
    name: "cliente novo",
    summary: "a reunião de entrada: o que perguntar e o que sair pedindo",
    tree: [
      ["contexto", ["o que vende", "há quanto tempo", "time"]],
      ["acessos", ["ads", "analytics", "loja", "domínio"]],
      ["canais", ["quais já operam", "quais estão parados"]],
      ["números atuais", ["faturamento", "ticket", "CAC", "margem"]],
      ["oferta", ["produto principal", "diferencial"]],
      ["concorrentes", ["quem", "o que fazem melhor"]],
      ["primeiros 30 dias", ["o que arruma", "o que testa", "o que mede"]]
    ]
  },
  {
    id: "ecosystem-marketplace", group: "client",
    name: "ecossistema · marketplace",
    summary: "como as peças de um marketplace se sustentam: reputação, catálogo, ads e saída para a base",
    tree: [
      ["conta", ["reputação", "métricas de saúde", "políticas"]],
      ["catálogo", ["títulos e palavras", "fotos e ficha", "variações"]],
      ["preço e frete", ["margem", "frete grátis", "kits"]],
      ["ads", ["produtos que já vendem", "verba", "ACOS alvo"]],
      ["avaliações", ["pedido pós-venda", "resposta a crítica"]],
      ["saída para a base", ["inserto na embalagem", "whatsapp", "loja própria"]],
      ["números", ["visitas", "conversão", "ticket", "recompra"]]
    ]
  },
  {
    id: "ecosystem-owned", group: "client",
    name: "ecossistema · casa própria",
    summary: "site, base e automação: o que não depende de plataforma de ninguém",
    tree: [
      ["site", ["produto", "checkout", "velocidade"]],
      ["tráfego", ["pago", "orgânico", "indicação"]],
      ["captura", ["isca", "pop-up", "cupom"]],
      ["base", ["e-mail", "whatsapp", "segmentos"]],
      ["automações", ["boas-vindas", "carrinho", "pós-compra", "recompra"]],
      ["dados", ["pixel", "GA4", "atribuição"]]
    ]
  },
  {
    id: "ecosystem-social", group: "client",
    name: "ecossistema · social e busca",
    summary: "onde a audiência aparece e como ela vira conversa",
    tree: [
      ["instagram", ["linha editorial", "criativos", "DM"]],
      ["tiktok", ["vídeos", "creators", "live"]],
      ["google", ["busca", "shopping", "perfil da empresa"]],
      ["whatsapp", ["atendimento", "grupo", "disparo"]],
      ["ponte", ["do conteúdo para a base", "da base para a oferta"]]
    ]
  },
  {
    id: "account-audit", group: "client",
    name: "auditoria de conta de anúncios",
    summary: "o roteiro de olhar uma conta que não é sua",
    tree: [
      ["estrutura", ["campanhas", "conjuntos", "nomenclatura"]],
      ["públicos", ["frio", "morno", "quente", "sobreposição"]],
      ["criativos", ["quantidade", "variedade de ângulo", "fadiga"]],
      ["orçamento", ["distribuição", "escala", "desperdício"]],
      ["rastreamento", ["pixel", "eventos", "API de conversões"]],
      ["métricas", ["CPA", "ROAS", "frequência", "CTR"]],
      ["decisões", ["o que cortar", "o que escalar", "o que testar"]]
    ]
  },
  {
    id: "customer-journey", group: "client",
    name: "jornada do cliente",
    summary: "os cinco estágios de consciência e o que cada um precisa ouvir",
    tree: [
      ["não sabe do problema", ["conteúdo que nomeia a dor"]],
      ["sabe do problema", ["conteúdo que explica a causa"]],
      ["compara soluções", ["comparativo", "prova"]],
      ["decide", ["oferta", "garantia", "urgência"]],
      ["compra", ["onboarding", "primeira entrega"]],
      ["indica", ["pedido de avaliação", "programa de indicação"]]
    ]
  },

  /* ---------- negócio e decisão ---------- */
  {
    id: "quarter-okr", group: "business",
    name: "trimestre",
    summary: "um objetivo, resultados em número e a lista do que não vai ser feito",
    tree: [
      ["objetivo", ["em uma frase"]],
      ["resultados-chave", ["número 1", "número 2", "número 3"]],
      ["frentes", ["o que cada uma entrega"]],
      ["riscos", ["o que pode travar"]],
      ["o que não vou fazer", []]
    ]
  },
  {
    id: "media-plan", group: "business",
    name: "plano de mídia",
    summary: "para onde vai a verba, dividida por canal e por etapa do funil",
    tree: [
      ["verba", ["total", "por mês"]],
      ["canais", ["meta", "google", "tiktok", "outros"]],
      ["etapas", ["topo", "meio", "fundo", "remarketing"]],
      ["campanhas", ["objetivo", "público", "criativo"]],
      ["metas", ["CPA", "ROAS", "volume"]],
      ["aprendizados", ["o que testar no próximo ciclo"]]
    ]
  },
  {
    id: "campaign-retro", group: "business",
    name: "retrospectiva da campanha",
    summary: "depois que acaba: o que fica escrito para a próxima",
    tree: [
      ["números", ["investido", "faturado", "CPA", "ROAS"]],
      ["o que funcionou", ["criativo", "público", "oferta"]],
      ["o que não funcionou", []],
      ["hipóteses", ["por que aconteceu"]],
      ["próximos testes", ["um por hipótese"]]
    ]
  },
  {
    id: "agency-process", group: "business",
    name: "processos da agência",
    summary: "o caminho de um cliente dentro da casa, do comercial à renovação",
    tree: [
      ["comercial", ["origem do lead", "diagnóstico", "proposta"]],
      ["onboarding", ["contrato", "acessos", "kickoff"]],
      ["execução", ["rotina semanal", "quem faz o quê"]],
      ["relatório", ["o que mostra", "com que frequência"]],
      ["reunião", ["pauta padrão"]],
      ["renovação", ["sinais de risco", "conversa de renovação"]]
    ]
  },
  {
    id: "decision", group: "business",
    name: "decisão",
    summary: "para quando a cabeça está girando: opções, critérios e prazo",
    tree: [
      ["a pergunta", ["em uma frase"]],
      ["opções", ["A", "B", "não fazer nada"]],
      ["critérios", ["dinheiro", "tempo", "risco", "vontade"]],
      ["a favor", []],
      ["contra", []],
      ["custo de errar", ["dá para voltar atrás?"]],
      ["decisão", ["qual", "até quando"]]
    ]
  },
  {
    id: "brainstorm", group: "business",
    name: "5W2H",
    summary: "a folha em branco com sete perguntas, para destravar qualquer coisa",
    tree: [
      ["o quê", []], ["por quê", []], ["quem", []], ["quando", []],
      ["onde", []], ["como", []], ["quanto custa", []]
    ]
  }
];

export const mapGroups = () => MAP_GROUPS
  .map(([key, label]) => ({ key, label, items: MAP_TEMPLATES.filter((t) => t.group === key) }))
  .filter((g) => g.items.length);

/* os galhos de primeiro nível, para a tela mostrar antes de criar */
export const mapBranches = (tpl) => (tpl.tree || []).map((spec) => (Array.isArray(spec) ? spec[0] : spec));

/* a árvore do modelo virando raiz de verdade. cada galho de primeiro nível
   ganha uma cor (a cor desce sozinha para os filhos, no desenho do mapa). */
export function buildMap(tpl, name) {
  const node = (spec, color) => {
    const [title, children] = Array.isArray(spec) ? spec : [spec, null];
    return {
      id: newId(), title: String(title), note: "", color, collapsed: false, link: "",
      children: (children || []).map((c) => node(c, 0))
    };
  };
  return {
    id: newId(), title: name || tpl.name, note: "", color: 0, collapsed: false, link: "",
    children: (tpl.tree || []).map((spec, i) => node(spec, (i % 6) + 1))
  };
}
