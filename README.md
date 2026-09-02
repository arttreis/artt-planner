# artt · planner

Controle de tarefas pessoal, de uso individual. Um arquivo só: `index.html`, com HTML, CSS e JS
inline — sem build, sem framework, sem backend, sem conta. Abre com duplo clique ou serve como
estático em qualquer lugar.

## A ideia

A tela não lista o que existe, ela mostra **quanto ainda cabe**.

Você define a janela do seu dia (padrão 09:00 → 19:00). A barra do topo é essa janela em escala
real de minutos e **se gasta sozinha** conforme o relógio anda. O número grande é sempre a
**sobra** — quanto ainda resta depois do que já está na fila — e ele desce ao longo do dia.

Cada tarefa vira uma banda na barra, na ordem da fila; passar o mouse numa linha acende a banda
dela, e o horário projetado (`14:23–16:53`) fica no `title` da linha.

Quando o dia acaba com coisa aberta, isso aparece como **hora extra**, em tom neutro — é um fato,
não uma acusação.

## Design system

Usa o design system do [arttreis.com.br](https://arttreis.com.br) — o lado escuro dos tokens,
copiados do `:root` do site: `--bg #0d0d0d`, `--surface #141414`, escala de tinta `--ink`
(70/50/32), `--line`/`--fill`, raios 16/8 e pílula 100, espaçamento 16/8/4, **Sora** para
texto e **JetBrains Mono** para medida, e `#2EE86B` como único acento.

A única adição é `--br3` (12px), um passo entre `--br2` e `--br` para os ladrilhos de 44px.

Como o sistema é monocromático + um verde, duas coisas seguem essa disciplina: prioridade é
expressa em opacidade de tinta (não em matiz), e quando o dia estoura **não existe vermelho**
— o verde simplesmente some e sobra a barra hachurada.

## Como usar

Escreva a tarefa com a duração no fim e ela é lida sozinha:

```
revisar proposta 45m
gravar vídeo 1h30
call de alinhamento 2h 15m
```

A duração sai do título e entra na barra do dia. Enquanto você digita, uma prévia mostra o que
foi entendido — e avisa se aquilo não cabe hoje.

| Atalho | O que faz |
| --- | --- |
| `/` | foca o campo de nova tarefa |
| `Enter` | conclui a tarefa em foco |
| `Alt` + `↑` `↓` | reordena |
| `Delete` | exclui (com desfazer) |
| `Esc` | sai do campo / fecha o aviso |

Concluir, excluir e limpar concluídas têm um passo de desfazer.

## Onde ficam os dados

Em `localStorage`, na chave `artt-planner:v2`, no seu próprio navegador. Nada sai da máquina:
não há servidor, conta nem sincronização. Duas abas abertas se conversam pelo evento `storage`
em vez de uma sobrescrever a outra.

## Fora de escopo, por decisão

Virada de dia (tarefa aberta não rola para amanhã sozinha), recorrência, tags, múltiplos dias,
colaboração.
