/* merlin · ui: a camada de tela em Preact
 *
 * o core.js continua sendo o dono dos dados (colecoes, sessao, nuvem,
 * frentes, caixa de entrada). aqui mora so o que uma pagina precisa para
 * DESENHAR com o Preact: os hooks que ligam a tela as colecoes, os
 * componentes comuns (selo, dialogo, formulario) e os icones como vnode.
 *
 * por que uma camada e nao "tudo no core": as paginas que ainda nao
 * migraram importam o core como sempre; as que migraram importam as duas
 * coisas. nenhuma pagina precisa mudar por causa da outra.
 *
 * a regra que este arquivo cumpre: nada aqui monta HTML por string. quem
 * quer HTML de verdade (o markdown das notas) passa por <${Markdown}/>, que
 * e o unico lugar com dangerouslySetInnerHTML alem dos icones.
 */

import {
  html, render, h, Component, createContext,
  useState, useReducer, useEffect, useLayoutEffect, useRef, useMemo, useCallback, useContext
} from "./preact.js";
import {
  collection, cloud, fronts, clients, listFronts, listClients, clientName, md, ICONS, brl, parseMoney
} from "./core.js";

export {
  html, render, h, Component, createContext,
  useState, useReducer, useEffect, useLayoutEffect, useRef, useMemo, useCallback, useContext
};

/* o standalone do htm nao exporta Fragment; um componente que devolve os
   filhos e a mesma coisa para o Preact */
export const Fragment = (p) => p.children;

/* ---------- montar a pagina ---------- */

/* desenha o componente raiz dentro de um elemento (ou do id dele) */
export function mount(vnode, target) {
  render(vnode, typeof target === "string" ? document.getElementById(target) : target);
}

/* ---------- hooks que ligam a tela aos dados ---------- */

/* redesenha o componente quando a colecao muda (local, nuvem ou outra aba) */
function useSubscription(c) {
  const [, tick] = useState(0);
  useEffect(() => c.onChange(() => tick((n) => n + 1)), [c]);
}

/* a colecao do core, e a pagina redesenha a cada mudanca dela. devolve a
   propria colecao: all(), save(), remove()... */
export function useCollection(type, options) {
  const c = useMemo(() => collection(type, options), [type]);
  useSubscription(c);
  return c;
}

/* as frentes, ordenadas, redesenhando quando o cadastro muda */
export function useFronts() {
  const c = useMemo(() => fronts(), []);
  useSubscription(c);
  return listFronts();
}

/* os clientes vivos, redesenhando quando mudam */
export function useClients() {
  const c = useMemo(() => clients(), []);
  useSubscription(c);
  return listClients();
}

/* a sessao/nuvem: signedIn, email, status */
export function useCloud() {
  const [, tick] = useState(0);
  useEffect(() => cloud.onChange(() => tick((n) => n + 1)), []);
  return cloud;
}

/* troca o #hash sem empilhar historico e avisa quem usa useHash (o
   replaceState nao dispara hashchange sozinho) */
export function setHash(id) {
  const next = id ? "#" + encodeURIComponent(id) : "";
  if ((location.hash || "") === next) return;
  history.replaceState(null, "", location.pathname + location.search + next);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}

/* o #hash da url, ja decodificado, acompanhando o hashchange. e assim que
   "clients.html#<id>" abre o item certo. */
export function useHash() {
  const read = () => { try { return decodeURIComponent(location.hash.slice(1)); } catch (e) { return ""; } };
  const [hash, setHash] = useState(read);
  useEffect(() => {
    const f = () => setHash(read());
    window.addEventListener("hashchange", f);
    return () => window.removeEventListener("hashchange", f);
  }, []);
  return hash;
}

/* um atalho de teclado no documento. o proprio handler decide se vale
   (ex.: !isTyping()) e faz o preventDefault. o handler mora num ref que e
   atualizado a cada render: o listener e um so, registrado uma vez, e nunca
   le um closure velho — sem isso, a tecla apertada logo depois de fechar um
   dialogo ainda via o dialogo aberto. */
export function useKeydown(handler) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const f = (e) => ref.current(e);
    document.addEventListener("keydown", f);
    return () => document.removeEventListener("keydown", f);
  }, []);
}

/* true quando o foco esta num campo de texto: os atalhos de uma letra so
   valem fora dele */
export function isTyping() {
  const el = document.activeElement;
  const tag = el && el.tagName;
  /* checkbox, radio e botao nao sao "digitar": quem acabou de marcar um
     cartao ainda pode apertar n */
  if (tag === "INPUT") return !["checkbox", "radio", "button", "submit", "range", "file"].includes(el.type);
  return tag === "TEXTAREA" || tag === "SELECT" || !!(el && el.isContentEditable);
}

/* ---------- campos de formulario ----------
   useFields(initial) guarda os valores e devolve `bind(name)`, que espalha
   nos inputs o value/onInput certos. o formulario inteiro fica controlado:
   uma sincronizacao que chega no meio da digitacao nao apaga nada. */
export function useFields(initial) {
  const [values, setValues] = useState(initial);
  const set = useCallback((name, value) => setValues((v) => ({ ...v, [name]: value })), []);
  const bind = useCallback((name, kind) => {
    if (kind === "check") return { name, checked: !!values[name], onChange: (e) => set(name, e.currentTarget.checked) };
    return { name, value: values[name] == null ? "" : values[name], onInput: (e) => set(name, e.currentTarget.value), onChange: (e) => set(name, e.currentTarget.value) };
  }, [values, set]);
  return [values, bind, set, setValues];
}

/* ---------- icones ----------
   os icones do core sao strings de SVG. o htm le uma string como se fosse
   um template, e guarda o resultado pelo array de estaticos — por isso o
   cache: o mesmo array, o mesmo parse, um vnode novo a cada chamada. */
const staticsCache = new Map();
export function svg(text) {
  let arr = staticsCache.get(text);
  if (!arr) { arr = [text]; staticsCache.set(text, arr); }
  return html(arr);
}
export const icon = (name) => svg(ICONS[name] || "");

/* ---------- componentes comuns ---------- */

/* markdown minimo do core, dentro de um elemento. o unico lugar em que
   uma pagina migrada encosta em innerHTML. */
export function Markdown({ text, class: cls, tag, ...rest }) {
  return h(tag || "div", { ...rest, class: cls, dangerouslySetInnerHTML: { __html: md(text) } });
}

/* o selo de frente: bolinha da cor e o nome. nada quando a frente nao existe. */
export function FrontBadge({ id }) {
  const f = id && fronts().get(id);
  if (!f) return null;
  return html`<span class="badge" data-color=${f.color}><i class="dot"></i>${f.name}</span>`;
}
/* o selo de cliente, so o nome */
export function ClientBadge({ id }) {
  const name = clientName(id);
  return name ? html`<span class="badge">${name}</span>` : null;
}

/* as <option> de frente/cliente para um <select> controlado: o `value` fica
   no select, aqui so a lista */
export function frontOptionList(empty) {
  const list = listFronts().map((f) => html`<option key=${f.id} value=${f.id}>${f.name}</option>`);
  return empty != null ? [html`<option key="" value="">${empty}</option>`, ...list] : list;
}
export function clientOptionList(empty, front) {
  const list = listClients().filter((c) => !front || c.front === front)
    .map((c) => html`<option key=${c.id} value=${c.id}>${c.name}</option>`);
  return empty != null ? [html`<option key="" value="">${empty}</option>`, ...list] : list;
}

/* Esc fecha o que estiver aberto por cima: registra em captura, para chegar
   antes dos atalhos da pagina, e antes da pintura, para valer ja na primeira
   tecla depois de abrir */
function useEscape(onClose) {
  useLayoutEffect(() => {
    const f = (e) => { if (e.key === "Escape") { e.stopPropagation(); onClose && onClose(); } };
    document.addEventListener("keydown", f, true);
    return () => document.removeEventListener("keydown", f, true);
  }, [onClose]);
}

/* o dialogo: escurece a tela, caixa no meio, fecha no x, no fundo e no Esc.
   `actions` e o rodape (botoes); o conteudo vai nos filhos. */
export function Dialog({ title, sub, wide, onClose, actions, label, class: cls, children }) {
  useEscape(onClose);
  return html`
    <div class=${"dialog" + (cls ? " " + cls : "")} role="dialog" aria-modal="true" aria-label=${label || title}
         onClick=${(e) => { if (e.target === e.currentTarget) onClose && onClose(); }}>
      <div class=${"dialog__box" + (wide ? " dialog__box--wide" : "")}>
        <button class="dialog__close" type="button" aria-label="Fechar" onClick=${onClose}>${icon("x")}</button>
        ${title && html`<p class="dialog__title">${title}</p>`}
        ${sub && html`<p class="dialog__sub">${sub}</p>`}
        ${children}
        ${actions && html`<div class="dialog__actions">${actions}</div>`}
      </div>
    </div>`;
}

/* o formulario em dialogo: todo "criar X" e "editar X" passa por aqui. os
   campos vem nos filhos (use <${Field}> e useFields); `onSubmit()`
   devolvendo false mantem a caixa aberta. o primeiro campo ganha foco ao
   abrir. */
export function Form({ title, sub, wide, submit, remove, onSubmit, onRemove, onClose, children }) {
  const ref = useRef(null);
  /* foco antes da pintura: a primeira tecla ja entra no campo certo */
  useLayoutEffect(() => {
    const first = ref.current && ref.current.querySelector("input:not([type=hidden]):not([type=checkbox]),select,textarea");
    if (first) { first.focus(); if (first.select && first.type !== "date") first.select(); }
  }, []);
  useEscape(onClose);
  const handleSubmit = (e) => {
    e.preventDefault();
    const r = onSubmit ? onSubmit(e.currentTarget) : undefined;
    if (r !== false && onClose) onClose();
  };
  return html`
    <div class="dialog dialog--form" role="dialog" aria-modal="true" aria-label=${title}
         onClick=${(e) => { if (e.target === e.currentTarget) onClose && onClose(); }}>
      <form ref=${ref} class=${"dialog__box" + (wide ? " dialog__box--wide" : "")} autocomplete="off" onSubmit=${handleSubmit}>
        <button class="dialog__close" type="button" aria-label="Fechar" onClick=${onClose}>${icon("x")}</button>
        <p class="dialog__title">${title}</p>
        ${sub && html`<p class="dialog__sub">${sub}</p>`}
        <div class="form-grid">${children}</div>
        <div class="dialog__actions">
          ${remove && html`<button class="link" type="button" onClick=${() => { onClose && onClose(); onRemove && onRemove(); }}>${remove}</button><span class="spacer"></span>`}
          <button class="pill" type="button" onClick=${onClose}>cancelar</button>
          <button class="pill pill--green" type="submit">${submit || "salvar"}</button>
        </div>
      </form>
    </div>`;
}

/* um campo com rotulo dentro do formulario. `full` ocupa a linha toda. */
export function Field({ label, full, children }) {
  return html`<div class=${full ? "full" : null}><label class="field-label">${label}</label>${children}</div>`;
}

/* o numero grande com legenda (.meter do base.css) */
export function Meter({ label, value, class: cls }) {
  return html`<div class="meter"><span class=${"num" + (cls ? " " + cls : "")}>${value}</span><span class="legend">${label}</span></div>`;
}

/* dinheiro: o valor e em centavos, o texto e o que a pessoa digita. so
   reformata ao sair do campo, para "1.2" nao virar "R$ 1,20" no meio da
   digitacao. */
const moneyText = (cents) => (cents ? brl(cents).replace(/^R\$\s?/, "") : "");
export function MoneyInput({ value, onChange, class: cls, ...rest }) {
  const [text, setText] = useState(() => moneyText(value));
  const last = useRef(value);
  useEffect(() => { if (value !== last.current) { last.current = value; setText(moneyText(value)); } }, [value]);
  return html`<input class=${"input input--num" + (cls ? " " + cls : "")} inputmode="decimal" value=${text}
    onInput=${(e) => { setText(e.currentTarget.value); const c = parseMoney(e.currentTarget.value); last.current = c; onChange && onChange(c); }}
    onBlur=${() => setText(moneyText(last.current))} ...${rest}/>`;
}

/* "novo item" no pe de uma lista: um campo e um botao, Enter adiciona */
export function NewItemRow({ placeholder, button, onAdd, class: cls }) {
  const [text, setText] = useState("");
  const add = () => { const t = text.trim(); if (!t) return; onAdd(t); setText(""); };
  return html`
    <div class=${"form-row" + (cls ? " " + cls : "")}>
      <input class="input" placeholder=${placeholder} value=${text} onInput=${(e) => setText(e.currentTarget.value)}
        onKeyDown=${(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}/>
      <button class="pill pill--mini" type="button" onClick=${add}>${button || "adicionar"}</button>
    </div>`;
}
