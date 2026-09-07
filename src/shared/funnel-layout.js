/* merlin · a geometria do funil
   onde cada etapa fica no palco. duas telas criam funil — a lista de funis e
   o canal do cliente —, e as duas precisam que as etapas nasçam arrumadas em
   camadas, então a conta mora aqui e não dentro da página. */
export const NODE_W = 228, NODE_H = 104;

/* ---------- camadas ----------
   camada de um nó = maior distância desde uma origem (nó sem entrada). uma
   aresta que aponta para um nó que já está "na pilha" desta busca é uma
   aresta de retorno (ex.: remarketing que volta pra lp) — ela é ignorada na
   contagem, senão o funil com um loop nunca terminaria de calcular camada. */
export function computeLayers(nodes, edges) {
  const out = new Map(nodes.map((n) => [n.id, []]));
  const hasIn = new Set();
  edges.forEach((a) => {
    if (!out.has(a.from) || !out.has(a.to)) return;
    out.get(a.from).push(a.to);
    hasIn.add(a.to);
  });
  const layer = new Map(nodes.map((n) => [n.id, 0]));
  const visited = new Set();
  const stack = new Set();

  function visit(id, depth) {
    if (stack.has(id)) return; // aresta de retorno: corta o ciclo aqui
    const current = layer.get(id) || 0;
    if (visited.has(id) && depth <= current) return; // já tem profundidade maior ou igual, nada a propagar
    layer.set(id, Math.max(current, depth));
    stack.add(id);
    visited.add(id);
    (out.get(id) || []).forEach((to) => visit(to, depth + 1));
    stack.delete(id);
  }

  const roots = nodes.filter((n) => !hasIn.has(n.id));
  (roots.length ? roots : nodes).forEach((n) => visit(n.id, 0));
  return layer;
}

/* layout em camadas da esquerda para a direita; dentro da camada, uma
   passada de baricentro pela posição das origens reduz cruzamentos de forma
   simples (não é um algoritmo ótimo, é o suficiente pra não virar espaguete).
   devolve nós novos: o documento nunca é alterado no lugar. */
export function layoutNodes(nodes, edges) {
  if (!nodes.length) return nodes;
  const layer = computeLayers(nodes, edges);
  const byLayer = new Map();
  nodes.forEach((n) => {
    const c = layer.get(n.id) || 0;
    if (!byLayer.has(c)) byLayer.set(c, []);
    byLayer.get(c).push(n);
  });
  const layers = [...byLayer.keys()].sort((a, b) => a - b);
  const incoming = new Map();
  edges.forEach((a) => {
    if (!incoming.has(a.to)) incoming.set(a.to, []);
    incoming.get(a.to).push(a.from);
  });
  const position = new Map();
  layers.forEach((c) => byLayer.get(c).forEach((n, i) => position.set(n.id, i)));
  layers.forEach((c, idx) => {
    if (idx === 0) return; // a primeira camada mantém a ordem que já tinha
    const list = byLayer.get(c);
    const weight = new Map();
    list.forEach((n) => {
      const from = (incoming.get(n.id) || []).map((id) => position.get(id)).filter((v) => v != null);
      weight.set(n.id, from.length ? from.reduce((a, b) => a + b, 0) / from.length : position.get(n.id));
    });
    list.sort((a, b) => weight.get(a.id) - weight.get(b.id));
    list.forEach((n, i) => position.set(n.id, i));
  });
  const GAP_X = 96, GAP_Y = 36, MARGIN = 60;
  const placed = new Map();
  layers.forEach((c) => {
    byLayer.get(c).forEach((n, i) => {
      placed.set(n.id, { x: MARGIN + c * (NODE_W + GAP_X), y: MARGIN + i * (NODE_H + GAP_Y) });
    });
  });
  return nodes.map((n) => ({ ...n, ...placed.get(n.id) }));
}
