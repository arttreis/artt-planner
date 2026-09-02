# artt · planner

Controle de tarefas pessoal, de uso individual. Um arquivo só: `index.html`, com HTML, CSS e JS
inline — sem build, sem framework, sem backend, sem conta. Abre com duplo clique ou serve como
estático em qualquer lugar.

## A ideia

A tela não lista o que existe, ela mostra **quanto ainda cabe**.

Você define a janela do seu dia (padrão 09:00 → 19:00). A barra do topo é essa janela em escala
real de minutos e **se gasta sozinha** conforme o relógio anda. O número grande é sempre a
**sobra** — quanto ainda resta depois do que já está na fila — e ele desce ao longo do dia.

Cada tarefa vira uma banda na barra, na ordem da fila; o horário projetado (`14:23–16:53`) fica
no `title` da linha.

Para a conta ser honesta, **toda tarefa tem duração**. Se o texto não trouxer uma, ela é
perguntada antes de a tarefa existir — nada entra na fila sem ocupar espaço no dia.

O que ocupa o dia sem ser trabalho seu — almoço, reunião, deslocamento — vira **reserva**: sai
da janela antes de qualquer promessa de folga, e não se conclui para devolver tempo que nunca
esteve lá.

Quando o dia acaba com coisa aberta, o produto não troca de assunto: continua dizendo quanto
não cabe, agora qualificado por **passou das 19:00**. Em tom neutro — é um fato, não uma
acusação.

A fila é sempre de um dia só, e ela sabe de qual. Se você abrir e a fila for de ontem, isso
é dito na cara — com a escolha de trazer o que ficou aberto ou fechar o dia como ele ficou.
Nada rola sozinho.

## Design system

Usa o design system do [arttreis.com.br](https://arttreis.com.br) — o lado escuro dos tokens,
copiados do `:root` do site: `--bg #0d0d0d`, `--surface #141414`, escala de tinta `--ink`
(70/50/32), `--line`/`--fill`, raios 16/8 e pílula 100, espaçamento 16/8/4, **Sora** para
texto e **JetBrains Mono** para medida, e `#2EE86B` como único acento.

A única adição é `--br3` (12px), um passo entre `--br2` e `--br` para os ladrilhos de 44px.

Como o sistema é monocromático + um verde, quando o dia estoura **não existe vermelho** — o
verde simplesmente some e sobra a barra hachurada.

Não há campo de prioridade: a ordem da fila é a prioridade. O que importa você arrasta pro
topo, e a linha de corte diz onde o dia para.

## Como usar

Escreva a tarefa com a duração no fim e ela é lida sozinha:

```
revisar proposta 45m
gravar vídeo 1h30
call de alinhamento 2h 15m
escrever roteiro meia hora
apresentação 1,5h
ligar pro contador 15 minutos
```

A duração sai do título e entra na barra do dia. Enquanto você digita, uma prévia mostra o que
foi entendido — e avisa se aquilo não cabe hoje.

Se você não escrever duração nenhuma, o `Enter` não cria a tarefa: ele pergunta, com chips de
`15m` `30m` `1h` `2h` (ou um valor livre). Para mudar depois, clique na duração na própria
linha.

Minuto solto continua não contando: `revisar 1h 20 slides` vira uma tarefa de 1h chamada
"revisar 20 slides" — o parser prefere não entender a entender errado.

Almoço, reunião, café, deslocamento e afins viram **reserva** automaticamente. Qualquer outro
título vira reserva com um `-` na frente:

```
- buscar as crianças 40m
```

| Atalho | O que faz |
| --- | --- |
| `/` | foca o campo de nova tarefa |
| `Enter` | conclui a tarefa em foco |
| `Alt` + `↑` `↓` | reordena |
| `Delete` | exclui (com desfazer) |
| `←` `→` | escolhe a duração, quando os chips estão abertos |
| `Esc` | sai do campo / fecha os chips / fecha o aviso |

Concluir, excluir, limpar concluídas, mudar duração e as ações de fila de ontem passam pelo
desfazer — e ele empilha: desfazer duas vezes volta duas ações, na ordem inversa.

## Onde ficam os dados

Em `localStorage`, na chave `artt-planner:v2`, no seu próprio navegador. Não há servidor nem
conta. Duas abas abertas se conversam pelo evento `storage` em vez de uma sobrescrever a outra.

### Levar o mesmo dia para outro computador

**Exportar / importar** funciona em qualquer navegador. Exportar baixa um `.json` com o dia
inteiro — é também o único backup que existe, já que limpar o cache apaga tudo sem aviso.

**Sincronizar num arquivo** é o caminho sem ato manual: você aponta um arquivo dentro de uma
pasta que o iCloud, o Drive ou o Dropbox já sincroniza, e os dois computadores passam a ler e
escrever nele. Não há servidor no meio — quem sincroniza é a sua nuvem.

O rodapé diz em que modo você está. `sincronizando no arquivo` é o único estado em que o dia
existe fora deste navegador.

Como isso não perde trabalho: cada gravação carimba um `v` no estado, e antes de escrever o app
lê o arquivo. Se o carimbo de lá for mais novo, ele adota em vez de sobrescrever — quem chegou
depois foi o outro computador. A escrita tem 2s de espera para não acordar o cliente de sync a
cada tecla, e é atômica: se a aba fechar no meio, o arquivo mantém o conteúdo anterior inteiro.

Se o cliente de sync trocar o arquivo por baixo (conflito, ou *evicted* no iCloud), o app diz
que perdeu o arquivo de vista e pede outro — em vez de falhar calado.

**Só funciona em Chrome e Edge no desktop.** Safari, Firefox e qualquer navegador de celular
não têm a API; lá sobra exportar e importar. O navegador continua sendo a fonte de verdade da
sessão: se o arquivo falhar, o dia não vai junto.

## Fora de escopo, por decisão

Recorrência, tags, múltiplos dias, colaboração. Todos criariam um segundo eixo de ordenação
numa fila cuja única ordem é a prioridade.

Conta e servidor também — por enquanto. A sincronização por arquivo cobre dois computadores
sem nenhum dos dois; o dia em que ela não bastar (celular, ou duas pessoas na mesma fila) é o
dia de reabrir essa decisão.

Rollover automático também: tarefa aberta não rola para amanhã sozinha — é assim que lista
vira cemitério. Mas *não rolar* e *não saber que dia é* são decisões diferentes, e só a
primeira foi tomada de propósito: a fila sabe de que dia é, e pergunta o que fazer com ela.
