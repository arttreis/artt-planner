# artt · planner

Controle de tarefas pessoal, de uso individual. Um arquivo só: `index.html`, com HTML, CSS e JS
inline — sem build, sem framework, sem backend, sem conta. Abre com duplo clique ou serve como
estático em qualquer lugar.

## A ideia

A tela não lista o que existe, ela mostra **quanto ainda cabe**.

Você define a janela do seu dia (padrão 09:00 → 19:00). A barra do topo é essa janela em escala
real de minutos e **se gasta sozinha** conforme o relógio anda. O número grande é sempre a
**sobra** — quanto ainda resta depois do que já está na fila — e ele desce ao longo do dia.

Cada linha da lista carrega, no fundo, a faixa de quando aquela tarefa cai no dia, no mesmo eixo
da barra. Dá para seguir uma tarefa da banda lá em cima até a linha dela.

Quando o dia acaba com coisa aberta, isso aparece como **hora extra**, em tom neutro. Vermelho
só fala de aritmética do dia — nunca de comportamento.

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
