/* merlin · a semana
   colunas de seg a sex mais o fim de semana, cartoes agrupados por frente.
   nada aqui tem hora: o cartao entra no dia pelo gesto de puxar. */
import "./shared/base.css";
import {
  initPage, newId, today, isDay, notify, sendToDay, api,
  parseMentions, formatMin, parseDuration, mondayOf, addDays, dateLabel, dateOf
} from "./shared/core.js";
import { useState, useEffect, useRef } from "react";
import {
  mount, useCollection, useFronts, useClients, useKeydown, isTyping,
  useFields, Form, Field, Dialog, Markdown, FrontBadge, ClientBadge, frontOptionList, clientOptionList, icon
} from "./shared/ui.jsx";

initPage("week");

/* o cartao da semana: day e 'YYYY-MM-DD' (seg-sex) ou 'weekend:YYYY-MM-DD'
   (a segunda daquela semana), para o fim de semana caber numa coluna so. */
const WEEKEND = "weekend:";
const isValidDay = (v) => isDay(v) || (typeof v === "string" && v.startsWith(WEEKEND) && isDay(v.slice(WEEKEND.length)));
function normalize(d) {
  return {
    id: d.id,
    title: String(d.title || "").slice(0, 200),
    day: isValidDay(d.day) ? d.day : today(),
    front: d.front || "",
    client: d.client || "",
    min: Math.max(0, Math.round(+d.min || 0)),
    done: !!d.done,
    recurring: !!d.recurring,
    order: Number.isFinite(+d.order) ? +d.order : 0,
    createdAt: +d.createdAt || Date.now(),
    updatedAt: +d.updatedAt || +d.createdAt || Date.now(),
    /* id do cartao original, so nas copias que a recorrencia gera — impede
       uma copia de virar, ela mesma, uma nova origem que se copia sozinha */
    recurringSource: d.recurringSource || "",
    /* quem escreve isto e o dia: e o id da tarefa que ele criou a partir
       deste cartao. aqui so lemos — nunca gravamos este campo. */
    inDay: d.inDay || "",
    /* de onde o cartao veio (um objetivo dos planos, por exemplo). so passa
       adiante: quem le e a pagina de origem. */
    origin: d.origin && typeof d.origin === "object" ? { type: String(d.origin.type || ""), id: String(d.origin.id || "") } : null
  };
}

/* icone que nao mora no core por ser exclusivo deste quadro */
const RecurringIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 11a8 8 0 00-14.9-4M4 13a8 8 0 0014.9 4" /><path d="M4 4v4h4M20 20v-4h-4" />
  </svg>
);

const COLUMNS = [
  { id: "mon", offset: 0, label: "seg" },
  { id: "tue", offset: 1, label: "ter" },
  { id: "wed", offset: 2, label: "qua" },
  { id: "thu", offset: 3, label: "qui" },
  { id: "fri", offset: 4, label: "sex" },
  { id: "weekend", offset: null, label: "sáb · dom" }
];

/* ---------- datas ---------- */

const mondayOfCard = (c) => c.day.startsWith(WEEKEND) ? c.day.slice(WEEKEND.length) : mondayOf(c.day);
const columnDay = (monday, col) => col.offset == null ? WEEKEND + monday : addDays(monday, col.offset);
const dayNumber = (day) => dateOf(day).getDate();
const daysBetween = (monday, day) => Math.round((dateOf(day) - dateOf(monday)) / 86400000);

function columnIsToday(monday, col) {
  const t = today();
  if (col.offset != null) return columnDay(monday, col) === t;
  const sat = addDays(monday, 5), sun = addDays(monday, 6);
  return t === sat || t === sun;
}

/* "8–14 set" quando cabe no mesmo mes; "29 ago–4 set" quando vira o mes */
function weekRange(monday) {
  const end = addDays(monday, 6);
  if (dateOf(monday).getMonth() === dateOf(end).getMonth()) return dayNumber(monday) + "–" + dateLabel(end);
  return dateLabel(monday) + "–" + dateLabel(end);
}

/* coluna de "hoje": o proprio dia se for de semana, o fds da semana atual se
   hoje cair em sabado ou domingo */
function todayColumn() {
  const t = today();
  const dow = dateOf(t).getDay();
  return (dow === 0 || dow === 6) ? (WEEKEND + mondayOf(t)) : t;
}

/* today / late / future — e disso que depende se "puxar para o dia" faz
   sentido e se o cartao entra na faixa de quem ficou de tras */
function cardStatus(c) {
  const t = today();
  if (c.day.startsWith(WEEKEND)) {
    const monday = c.day.slice(WEEKEND.length), sat = addDays(monday, 5), sun = addDays(monday, 6);
    if (t === sat || t === sun) return "today";
    return t > sun ? "late" : "future";
  }
  if (c.day === t) return "today";
  return c.day < t ? "late" : "future";
}

/* ---------- "@frente"/"@cliente" e duracao no fim do texto ----------
   parseMentions e do core: reconhece os dois arrobas de uma vez, comparando
   sem acento/espaco/caixa com nome e id. so a duracao fica por nossa conta,
   porque ela precisa rodar DEPOIS de tirar os arrobas do texto. */
function parseLine(raw) {
  const found = parseMentions(raw);
  const { min, title } = parseDuration(found.title);
  return { title: title.trim(), min, front: found.front || "", client: found.client || "" };
}
/* o rotulo da coluna: nome do dia e numero ("seg 7"); no fim de semana, os
   dois nomes e os dois numeros ("sáb · dom 12–13") */
function columnLabel(monday, col) {
  if (col.id !== "weekend") return col.label + " " + dayNumber(columnDay(monday, col));
  return col.label + " " + dayNumber(addDays(monday, 5)) + "–" + dayNumber(addDays(monday, 6));
}

/* ---------- ordenacao dentro do grupo: aberto por ordem, feito no fim ---------- */
function sortGroup(list) {
  const open = list.filter((c) => !c.done).sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);
  const done = list.filter((c) => c.done).sort((a, b) => a.updatedAt - b.updatedAt);
  return open.concat(done);
}

/* ---------- recorrencia ----------
   so a origem (sem recurringSource) espalha copia; a copia carrega
   recurringSource e nunca vira uma nova origem. so acontece em semana atual
   ou futura — reabrir uma semana passada nao inventa tarefa nela. */
function spawnRecurring(week, monday) {
  if (monday < mondayOf(today())) return;
  const all = week.all();
  const inWeek = all.filter((c) => mondayOfCard(c) === monday);
  const exists = (title, front) => inWeek.some((c) => c.title === title && (c.front || "") === (front || ""));
  const fresh = [];
  all.forEach((t) => {
    if (!t.recurring || t.recurringSource) return;
    const sourceMonday = mondayOfCard(t);
    if (sourceMonday === monday) return;
    if (exists(t.title, t.front)) return;
    const onWeekend = t.day.startsWith(WEEKEND);
    const day = onWeekend ? (WEEKEND + monday) : addDays(monday, daysBetween(sourceMonday, t.day));
    const now = Date.now();
    const copy = {
      id: newId(), title: t.title, day, front: t.front, client: t.client,
      min: t.min, done: false, recurring: true, order: now,
      createdAt: now, updatedAt: now, recurringSource: t.id
    };
    fresh.push(copy);
    inWeek.push(copy); // impede duas origens de gerarem duas copias iguais na mesma passada
  });
  if (fresh.length) week.saveMany(fresh);
}

/* ---------- a pagina ----------
   o estado de tela mora aqui: a semana aberta, a caixa de cartao, o resumo do
   merlin, qual titulo esta em edicao e qual coluna esta sob o arrasto. nada
   disso e documento — some ao recarregar, como deve. */
function Week() {
  const week = useCollection("week", { normalize });
  const fronts = useFronts();
  useClients();
  const [monday, setMonday] = useState(() => mondayOf(today()));
  const [form, setForm] = useState(null);         // { id, day } | null
  const [summary, setSummary] = useState(null);   // texto do merlin | null
  const [thinking, setThinking] = useState(false);
  const [editing, setEditing] = useState(null);
  const [target, setTarget] = useState("");       // dia da coluna sob o arrasto
  const [dragging, setDragging] = useState(null);
  const dragId = useRef(null);

  /* uma vez por semana aberta */
  useEffect(() => { spawnRecurring(week, monday); }, [week, monday]);

  const isCurrentWeek = monday === mondayOf(today());
  const all = week.all();
  const inWeek = all.filter((c) => mondayOfCard(c) === monday);
  const late = isCurrentWeek ? all.filter((c) => !c.done && mondayOfCard(c) < monday) : [];

  /* ---------- acoes ---------- */
  const shiftWeek = (n) => setMonday((m) => addDays(m, n * 7));
  const openNew = (day) => setForm({ id: "", day: day || (isCurrentWeek ? todayColumn() : monday) });
  const toggleDone = (c, value) => week.save({ ...c, done: value, updatedAt: Date.now() });
  const removeCard = (id) => {
    const before = week.remove(id);
    if (before) notify("cartão apagado", () => week.save(before));
  };
  const pull = (c) => sendToDay({ title: c.title, min: c.min, front: c.front, client: c.client, origin: { type: "week", id: c.id } });
  const bringLate = () => {
    if (!late.length) return;
    const before = late.map((c) => ({ ...c }));
    const day = todayColumn();
    week.saveMany(late.map((c) => ({ ...c, day, updatedAt: Date.now() })));
    notify(late.length + (late.length === 1 ? " cartão trazido" : " cartões trazidos") + " para esta semana", () => week.saveMany(before));
  };
  const archiveLate = () => {
    if (!late.length) return;
    const before = late.map((c) => ({ ...c }));
    week.saveMany(late.map((c) => ({ ...c, done: true, updatedAt: Date.now() })));
    notify(late.length + (late.length === 1 ? " cartão arquivado" : " cartões arquivados"), () => week.saveMany(before));
  };

  /* ---------- resumir com o merlin ----------
     o contexto e so texto: uma linha por cartao, na mesma ordem que a leitura
     humana usaria. quem entende disso e o worker; aqui a unica preocupacao e
     nao mandar a semana errada quando o usuario trocou de semana no meio. */
  const summaryLine = (c) => {
    const col = COLUMNS.find((col) => columnDay(monday, col) === c.day);
    const colLabel = col ? columnLabel(monday, col) : c.day;
    const front = c.front ? fronts.find((f) => f.id === c.front) : null;
    const parts = [colLabel];
    if (front) parts.push(front.name);
    parts.push(c.title);
    if (c.min) parts.push(formatMin(c.min));
    if (c.done) parts.push("feito");
    return parts.join(" · ");
  };
  const askSummary = async () => {
    if (thinking) return;
    setThinking(true);
    try {
      const r = await api("/merlin", { method: "POST", body: JSON.stringify({ task: "week", context: { range: weekRange(monday), cards: inWeek.map(summaryLine) } }) });
      if (r.ok) setSummary(r.body.text || "");
      else if (r.status === 401) notify("entre para usar o Merlin");
      else notify(r.body.error || "não consegui falar com o Merlin");
    } catch (e) {
      notify("não consegui falar com o Merlin");
    } finally { setThinking(false); }
  };

  /* ---------- atalhos: n abre um cartao novo, Alt+seta troca de semana ----------
     Esc e dos dialogos, que se fecham sozinhos. */
  useKeydown((e) => {
    if (form || summary != null) return;
    if (e.key === "n" && !isTyping() && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); openNew(); return; }
    if (e.altKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) { e.preventDefault(); shiftWeek(e.key === "ArrowLeft" ? -1 : 1); }
  });

  /* ---------- arrastar e soltar nativo ----------
     solto na hora exata de largar: muda dia e frente, e se for solto perto de
     um cartao especifico, entra antes/depois dele (ordem fracionaria, sem
     precisar reindexar o grupo inteiro). no toque isso nao dispara — e o
     dialogo de editar, com o seletor de dia, que resolve por la. */
  const onDragStart = (e, c) => {
    if (e.target.tagName === "INPUT") { e.preventDefault(); return; }
    dragId.current = c.id;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", c.id);
    /* a classe entra depois do quadro, senao a imagem arrastada ja nasce apagada */
    requestAnimationFrame(() => setDragging(c.id));
  };
  const onDragEnd = () => { dragId.current = null; setDragging(null); setTarget(""); };
  const onDrop = (e, day) => {
    e.preventDefault();
    setTarget("");
    const original = dragId.current && week.get(dragId.current);
    dragId.current = null;
    if (!original) return;
    const groupEl = e.target.closest(".group");
    const front = groupEl ? groupEl.dataset.front : (original.front || "");
    const targetCard = e.target.closest(".card");

    const siblings = week.all()
      .filter((c) => c.day === day && (c.front || "") === (front || "") && c.id !== original.id && !c.done)
      .sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);

    let order;
    if (targetCard && targetCard.dataset.id !== original.id) {
      const idx = siblings.findIndex((c) => c.id === targetCard.dataset.id);
      const r = targetCard.getBoundingClientRect();
      const before = e.clientY < r.top + r.height / 2;
      const pos = idx < 0 ? siblings.length : (before ? idx : idx + 1);
      const prev = siblings[pos - 1], next = siblings[pos];
      order = prev && next ? (prev.order + next.order) / 2
        : prev ? prev.order + 1
        : next ? next.order - 1
        : 0;
    } else {
      order = siblings.length ? siblings[siblings.length - 1].order + 1 : Date.now();
    }
    week.save({ ...original, day, front, order, updatedAt: Date.now() });
  };

  const actions = { toggleDone, removeCard, pull, edit: (id) => setForm({ id }), editing, setEditing, week, dragging, onDragStart, onDragEnd };

  return (
    <>
      <div className="header">
        <div>
          <h1>semana</h1>
          <p className="sub">{weekRange(monday)}</p>
        </div>
        <div className="actions">
          <button className="pill" type="button" onClick={() => shiftWeek(-1)}>‹ semana anterior</button>
          <button className="pill" type="button" onClick={() => setMonday(mondayOf(today()))}>hoje</button>
          <button className="pill" type="button" id="merlin-btn" disabled={thinking} onClick={askSummary}>
            <span className="merlin-btn__icon" aria-hidden="true">{icon("spark")}</span>
            <span>{thinking ? "pensando…" : "resumir com o merlin"}</span>
          </button>
          <button className="pill" type="button" onClick={() => shiftWeek(1)}>próxima ›</button>
          <button className="pill pill--green" type="button" title="novo cartão (n)" onClick={() => openNew()}>{icon("plus")}cartão</button>
        </div>
      </div>

      {late.length > 0 && (
        <div className="behind">
          <p className="behind__text"><b>{late.length}</b> {late.length === 1 ? "cartão ficou" : "cartões ficaram"} de trás</p>
          <div className="behind__actions">
            <button className="pill" type="button" onClick={bringLate}>trazer para esta semana</button>
            <button className="pill" type="button" onClick={archiveLate}>arquivar</button>
          </div>
        </div>
      )}

      {!inWeek.length && <p className="empty">Semana em branco. O "+" de cada dia abre um cartão novo.</p>}

      <div className="board-scroll">
        <div className="board">
          {COLUMNS.map((col) => {
            const day = columnDay(monday, col);
            return (
              <Column key={day} day={day} label={columnLabel(monday, col)} isToday={columnIsToday(monday, col)}
                isTarget={target === day} fronts={fronts} cards={inWeek.filter((c) => c.day === day)}
                onNew={() => openNew(day)} onEnter={() => setTarget(day)} onLeave={() => setTarget("")}
                onDrop={(e) => onDrop(e, day)} actions={actions} />
            );
          })}
        </div>
      </div>

      {form && <CardForm week={week} monday={monday} id={form.id} presetDay={form.day} onClose={() => setForm(null)} onRemove={removeCard} />}
      {summary != null && <MerlinDialog text={summary} onClose={() => setSummary(null)} />}
    </>
  );
}

/* ---------- a coluna: cabecalho com o dia, os minutos abertos e o "+" ---------- */
function Column({ day, label, isToday, isTarget, fronts, cards, onNew, onEnter, onLeave, onDrop, actions }) {
  const openMin = cards.filter((c) => !c.done).reduce((s, c) => s + c.min, 0);
  const groups = fronts
    .map((f) => ({ id: f.id, cards: cards.filter((c) => c.front === f.id) }))
    .filter((g) => g.cards.length);
  const noFront = cards.filter((c) => !c.front || !fronts.some((f) => f.id === c.front));
  if (noFront.length) groups.push({ id: "", cards: noFront });

  return (
    <section className={"day-column" + (isToday ? " is-today" : "") + (isTarget ? " is-target" : "")}>
      <header className="day-column__head">
        <div>
          <p className="day-column__day">{label}</p>
          <p className="day-column__min t-mono t-mute">{openMin ? formatMin(openMin) : "—"}</p>
        </div>
        <button className="action day-column__add" type="button" title={"novo cartão em " + label} aria-label={"Novo cartão em " + label} onClick={onNew}>{icon("plus")}</button>
      </header>
      <div className="day-column__body" data-day={day}
           onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
           onDragEnter={onEnter}
           onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) onLeave(); }}
           onDrop={onDrop}>
        {groups.map((g) => (
          <div key={g.id} className="group" data-front={g.id}>
            <p className="group__label">{g.id ? <FrontBadge id={g.id} /> : <span className="t-mono t-mute">sem frente</span>}</p>
            <ul className="group__list">
              {sortGroup(g.cards).map((c) => <Card key={c.id} c={c} actions={actions} />)}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------- o cartao ---------- */
function Card({ c, actions }) {
  const status = cardStatus(c);
  /* com inDay o cartao ja esta na fila de hoje — o dia e quem escreveu isso,
     entao "puxar" (que manda pra la de novo) deixa de fazer sentido aqui */
  const canPull = !c.done && !c.inDay && (status === "today" || status === "late");
  return (
    <li className={"card" + (c.done ? " is-done" : "") + (actions.dragging === c.id ? " is-dragging" : "")} draggable="true" data-id={c.id}
        onDragStart={(e) => actions.onDragStart(e, c)} onDragEnd={actions.onDragEnd}>
      <input type="checkbox" className="card__check" checked={c.done} aria-label={"Concluir " + c.title} onChange={(e) => actions.toggleDone(c, e.currentTarget.checked)} />
      {actions.editing === c.id
        ? <EditableTitle c={c} week={actions.week} onClose={() => actions.setEditing(null)} />
        : <span className="card__title" tabIndex="0" onClick={() => actions.setEditing(c.id)}>{c.title}</span>}
      {c.inDay && <span className="badge badge--green">no dia</span>}
      <ClientBadge id={c.client} />
      {c.min > 0 && <span className="card__min mono">{formatMin(c.min)}</span>}
      {c.recurring && <span className="card__recurring" title="toda semana"><RecurringIcon /></span>}
      <span className="card__actions">
        {canPull && <button className="action" type="button" title="puxar para o dia" onClick={() => actions.pull(c)}>{icon("arrow")}</button>}
        <button className="action" type="button" title="editar" onClick={() => actions.edit(c.id)}>{icon("pencil")}</button>
        <button className="action" type="button" title="apagar" onClick={() => actions.removeCard(c.id)}>{icon("trash")}</button>
      </span>
    </li>
  );
}

/* ---------- edicao inline do titulo ----------
   Enter e blur salvam; Esc cancela. o `closed` evita que o blur que o
   navegador dispara ao tirar o input da tela salve uma segunda vez. */
function EditableTitle({ c, week, onClose }) {
  const ref = useRef(null);
  const closed = useRef(false);
  const [value, setValue] = useState(c.title);
  /* antes da pintura: quem clicou ja esta com o dedo no teclado */
  useEffect(() => { ref.current.focus(); ref.current.select(); }, []);
  const save = () => {
    if (closed.current) return;
    closed.current = true;
    const t = value.trim();
    if (t && t !== c.title) week.save({ ...c, title: t.slice(0, 200), updatedAt: Date.now() });
    onClose();
  };
  const cancel = () => { if (closed.current) return; closed.current = true; onClose(); };
  return (
    <input ref={ref} className="input card__title-input" value={value} maxLength="200"
      onChange={(e) => setValue(e.currentTarget.value)} onBlur={save}
      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); save(); } else if (e.key === "Escape") { e.preventDefault(); cancel(); } }} />
  );
}

/* ---------- a caixa do cartao: criar e editar sao a mesma ----------
   no titulo, "@frente" e a duracao no fim continuam valendo — e a mesma
   gramatica do dia — mas os campos ao lado ganham quando preenchidos. */
function CardForm({ week, monday, id, presetDay, onClose, onRemove }) {
  const c = id ? week.get(id) : null;
  const [v, bind, set] = useFields({
    title: c ? c.title : "",
    day: c ? c.day : (presetDay || todayColumn()),
    duration: c && c.min ? formatMin(c.min) : "",
    front: c ? c.front : "",
    client: c ? c.client : "",
    recurring: !!(c && c.recurring)
  });
  if (id && !c) return null;
  const submit = () => {
    const parsed = parseLine(v.title);
    const title = parsed.title.slice(0, 200);
    if (!title) { notify("o cartão precisa de um título"); return false; }
    const min = parseDuration(v.duration).min || parsed.min;
    const front = v.front || parsed.front, client = v.client || parsed.client;
    const now = Date.now();
    if (c) week.save({ ...c, title, day: v.day, front, client, min, recurring: v.recurring, updatedAt: now });
    else week.save({ id: newId(), title, day: v.day, front, client, min, done: false, recurring: v.recurring, order: now, createdAt: now, updatedAt: now });
  };
  return (
    <Form title={c ? "cartão" : "novo cartão"} submit={c ? "salvar" : "adicionar"} remove={c ? "apagar" : ""}
          onRemove={() => onRemove(id)} onClose={onClose} onSubmit={submit}>
      <Field label="título" full>
        <input className="input" maxLength="200" required placeholder="o que fazer · @frente · 45m" {...bind("title")} />
      </Field>
      <Field label="dia">
        <select className="select" {...bind("day")}>
          {COLUMNS.map((col) => { const d = columnDay(monday, col); return <option key={d} value={d}>{columnLabel(monday, col)}</option>; })}
        </select>
      </Field>
      <Field label="duração"><input className="input input--mono" placeholder="45m, 1h30" {...bind("duration")} /></Field>
      <Field label="frente">
        {/* trocar a frente restringe a lista de clientes a ela */}
        <select className="select" {...bind("front")} onChange={(e) => { set("front", e.currentTarget.value); set("client", ""); }}>{frontOptionList("sem frente")}</select>
      </Field>
      <Field label="cliente"><select className="select" {...bind("client")}>{clientOptionList("sem cliente", v.front || undefined)}</select></Field>
      <label className="row full"><input type="checkbox" {...bind("recurring", "check")} /> toda semana</label>
    </Form>
  );
}

/* ---------- o resumo do merlin ---------- */
function MerlinDialog({ text, onClose }) {
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); notify("copiado"); }
    catch (e) { notify("não consegui copiar"); }
  };
  return (
    <Dialog title="o merlin resume a semana" wide onClose={onClose}
      actions={<>
        <button className="pill" type="button" onClick={copy}>copiar</button>
        <button className="pill pill--green" type="button" onClick={onClose}>fechar</button>
      </>}>
      <Markdown className="merlin-body" text={text} />
    </Dialog>
  );
}

mount(<Week />, "app");
