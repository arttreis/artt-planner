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
  collection, cloud, fronts, clients, listFronts, listClients, clientName, md, ICONS, brl, parseMoney,
  PAGES, LOGO, NAV_ICONS, CLOUD_STATUS, search, signIn, currentNotice, onNotice, closeNotice,
  toggleTheme, toggleSidebar, setShellRenderer
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

/* =====================================================================
   a casca: sidebar, busca global, tema, nuvem, entrar e o aviso.
   e a mesma em toda pagina, e o core so guarda o estado dela. quem monta
   e o initPage(id) do core, que chama o desenhista registrado no fim
   deste arquivo.
   ===================================================================== */

/* a gaveta do celular e o recolhido do desktop moram numa classe do <html>,
   porque o CSS inteiro depende delas; aqui so as ligamos ao estado. */
function useRootClass(name, on) {
  useLayoutEffect(() => {
    document.documentElement.classList.toggle(name, !!on);
  }, [name, on]);
}

/* ---------- busca global ---------- */
function SearchBox({ onNavigate }) {
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const [focus, setFocus] = useState(-1);
  const ref = useRef(null);
  const hits = term.trim() ? search(term) : [];

  /* Ctrl+K de qualquer lugar; Esc limpa e devolve o foco a pagina */
  useKeydown((e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      ref.current.focus(); ref.current.select();
      setOpen(true);
    }
  });
  useEffect(() => {
    const f = (e) => { if (!e.target.closest(".sb__search")) setOpen(false); };
    document.addEventListener("click", f);
    return () => document.removeEventListener("click", f);
  }, []);

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!hits.length) return;
      setFocus((i) => (i + (e.key === "ArrowDown" ? 1 : hits.length - 1) + (i < 0 ? 1 : 0)) % hits.length);
    } else if (e.key === "Enter") {
      const hit = hits[focus >= 0 ? focus : 0];
      if (hit) { onNavigate && onNavigate(); location.href = hit.href; }
    } else if (e.key === "Escape") {
      e.stopPropagation();
      setTerm(""); setOpen(false); ref.current.blur();
    }
  };

  return html`
    <div class="sb__search">
      <label class="sb__search-field">
        ${svg(NAV_ICONS.search)}
        <input ref=${ref} id="sb-search" type="search" placeholder="buscar…" autocomplete="off" aria-label="Buscar em tudo"
               value=${term} onInput=${(e) => { setTerm(e.currentTarget.value); setOpen(true); setFocus(-1); }}
               onFocus=${() => { if (term.trim()) setOpen(true); }} onKeyDown=${onKeyDown}/>
        <kbd>ctrl k</kbd>
      </label>
      ${open && term.trim() && html`
        <div class="sb__results" id="sb-results">
          ${hits.length
            ? hits.map((hit, i) => html`
                <a key=${hit.href + i} href=${hit.href} class=${i === focus ? "is-focus" : null} onClick=${onNavigate}>
                  <span class="t-mono">${hit.label}</span><span>${hit.text}</span>
                </a>`)
            : html`<p>nada com esse nome</p>`}
        </div>`}
    </div>`;
}

/* ---------- o cartao da nuvem e quem esta aqui ---------- */
function CloudCard() {
  const c = useCloud();
  const info = CLOUD_STATUS[c.status] || CLOUD_STATUS.local;
  const email = c.signedIn ? String(c.email || "") : "";
  return html`
    <${Fragment}>
      <div class="sb__card">
        <div class="cloud" id="cloud" data-status=${c.status}><i class="dot"></i><span id="cloud-status">${info.line}</span></div>
        <p id="cloud-text">${info.text}</p>
        ${info.action && html`
          <button class="pill pill--green" type="button" id="cloud-action"
                  onClick=${() => (c.status === "error" ? c.syncAll() : signIn.show())}>${info.action}</button>`}
      </div>
      <div class="sb__who">
        <span class=${"avatar" + (email ? "" : " is-out")} id="sb-avatar">${email ? email[0].toUpperCase() : "?"}</span>
        <span class="who"><b id="sb-name">${email ? email.split("@")[0] : "só você"}</b><span id="sb-email">${email || "sem sessão"}</span></span>
        ${c.signedIn && html`<button type="button" id="cloud-signout" onClick=${() => c.signOut()}>sair</button>`}
      </div>
    <//>`;
}

/* ---------- a caixa de entrar ----------
   um passo de e-mail e um de codigo. quem faz as chamadas e o core; aqui
   so o recado que ele devolve. */
function SignInDialog() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState("email");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const emailRef = useRef(null), codeRef = useRef(null);
  useLayoutEffect(() => { emailRef.current && emailRef.current.focus(); }, []);
  useEffect(() => { if (step === "code" && codeRef.current) codeRef.current.focus(); }, [step]);
  useEscape(() => signIn.hide());

  const sendCode = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setMessage("mandando…");
    const r = await signIn.requestCode(email);
    setBusy(false); setMessage(r.message);
    if (r.ok) { setEmail(r.email); setCode(""); setStep("code"); }
  };
  const enter = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setMessage("conferindo…");
    const r = await signIn.submitCode(email, code);
    setBusy(false);
    if (!r.ok) setMessage(r.message);
  };

  return html`
    <div class="dialog" id="signin" role="dialog" aria-modal="true" aria-label="Entrar"
         onClick=${(e) => { if (e.target === e.currentTarget) signIn.hide(); }}>
      <div class="dialog__box">
        <button class="dialog__close" type="button" id="signin-close" aria-label="Fechar" onClick=${() => signIn.hide()}>${icon("x")}</button>
        <p class="dialog__title">Levar o Merlin para outros aparelhos</p>
        ${step === "email"
          ? html`
            <form id="form-email" autocomplete="on" onSubmit=${sendCode}>
              <div id="signin-email">
                <p class="dialog__sub">Sem senha: mando um código de 6 dígitos.</p>
                <input ref=${emailRef} class="signin-input" id="email-input" type="email" inputmode="email" autocomplete="email"
                       placeholder="seu@email.com" aria-label="Seu e-mail" value=${email} onInput=${(e) => setEmail(e.currentTarget.value)}/>
                <button class="signin-button" type="submit" disabled=${busy}>mandar código</button>
              </div>
            </form>`
          : html`
            <form id="form-code" autocomplete="off" onSubmit=${enter}>
              <div id="signin-code-step">
                <input ref=${codeRef} class="signin-input signin-code" id="code-input" inputmode="numeric" autocomplete="one-time-code"
                       maxlength="6" placeholder="000000" aria-label="Código de 6 dígitos" value=${code} onInput=${(e) => setCode(e.currentTarget.value)}/>
                <button class="signin-button" type="submit" disabled=${busy}>entrar</button>
              </div>
            </form>`}
        <p class="signin-message" id="signin-message" role="status" aria-live="polite">${message}</p>
      </div>
    </div>`;
}

/* ---------- o aviso com desfazer ---------- */
function Notice() {
  const [notice, setNotice] = useState(currentNotice);
  useEffect(() => onNotice(setNotice), []);
  if (!notice) return null;
  return html`
    <div class="notice" role="status">
      <span>${notice.text}</span>
      ${notice.undo && html`<button type="button" onClick=${() => { const f = notice.undo; closeNotice(); f(); }}>desfazer</button>`}
    </div>`;
}

/* ---------- a casca inteira ---------- */
function Shell({ page }) {
  const [drawer, setDrawer] = useState(false);
  const [closed, setClosed] = useState(() => document.documentElement.classList.contains("sidebar-closed"));
  const [signInOpen, setSignInOpen] = useState(signIn.open);
  useEffect(() => signIn.onChange((s) => setSignInOpen(s.open)), []);
  useRootClass("sidebar-open", drawer);

  const fold = () => { toggleSidebar(); setClosed(document.documentElement.classList.contains("sidebar-closed")); };
  useKeydown((e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") { e.preventDefault(); fold(); }
    if (e.key === "Escape") setDrawer(false);
  });

  return html`
    <${Fragment}>
      <div class="sb__mobile">
        <button type="button" id="sb-open" aria-label="Abrir a navegação" onClick=${() => setDrawer((d) => !d)}>${svg(NAV_ICONS.menu)}</button>
        <a class="sb__logo" href="index.html" aria-label="Merlin">${svg(LOGO)}<b>merlin</b></a>
      </div>
      <div class="sb__scrim" onClick=${() => setDrawer(false)}></div>
      <aside class="sb" aria-label="Navegação">
        <div class="sb__top">
          <a class="sb__logo" href="index.html" aria-label="Merlin">${svg(LOGO)}<b>merlin</b></a>
          <button class="sb__fold" type="button" id="sb-fold" title="Recolher (Ctrl+B)" aria-label="Recolher a barra" onClick=${fold}>${svg(NAV_ICONS.fold)}</button>
        </div>
        <${SearchBox} onNavigate=${() => setDrawer(false)}/>
        <ul class="sb__list">
          ${PAGES.map((p) => html`
            <li key=${p.id}>
              <a class="sb__item" href=${p.href} title=${p.label} aria-current=${p.id === page ? "page" : null}>
                ${svg(NAV_ICONS[p.id] || "")}<span>${p.label}</span>
              </a>
            </li>`)}
        </ul>
        <div class="sb__sep"></div>
        <ul class="sb__list">
          <li>
            <button class="sb__item sb__theme" type="button" id="theme" aria-label="Alternar tema claro/escuro" title="tema" onClick=${toggleTheme}>
              <span style="display:flex;align-items:center;gap:10px">${svg(NAV_ICONS.theme)}<span>tema</span></span>
              <!-- o interruptor: a bolinha desliza e, do lado vazio, fica o
                   icone do modo ativo — lua no escuro, sol no claro -->
              <span class="knob" aria-hidden="true">${svg(NAV_ICONS.sun)}${svg(NAV_ICONS.moon)}<span class="knob__dot"></span></span>
            </button>
          </li>
        </ul>
        <div class="sb__spacer"></div>
        <${CloudCard}/>
      </aside>
      ${signInOpen && html`<${SignInDialog}/>`}
      <${Notice}/>
    <//>`;
}

/* o core chama isto no initPage: a casca mora num no proprio, antes do
   conteudo, e o resto da pagina desenha no #app como sempre. */
setShellRenderer((page) => {
  const host = document.createElement("div");
  host.className = "shell";
  document.body.prepend(host);
  render(html`<${Shell} page=${page}/>`, host);
});
