# merlin

Sistema pessoal do Arthur, de uma pessoa só. Nasceu como o `artt · planner` — um controle
de tarefas de um dia — e virou um conjunto de frentes ligadas entre si: o dia, a semana, as
ideias, os clientes (com frentes e canais), os funis, os mapas mentais, o financeiro, os
hábitos e os planos. A visão completa e as decisões estão em [VISAO.md](VISAO.md).

Cada frente é **uma página**: um HTML na raiz, com o CSS dela inline, e um módulo em
[`src/`](src/) com a tela. A tela é **React 19 com JSX**, e o build é o **Vite**, que cospe as
páginas prontas em `server/site/` — a mesma pasta que o Worker serve. O que é comum vive em
[`src/shared/`](src/shared/README.md): os tokens dos dois temas, a barra de navegação, a
sessão, as coleções que sincronizam por documento e os componentes de tela.

```bash
npm run dev      # servidor de desenvolvimento, com recarga na hora
npm run build    # gera server/site/
```

A história de como o sistema chegou aqui (de HTML por string a Preact, e de Preact a React)
está em [MIGRATION.md](MIGRATION.md).

| página | o que é |
| --- | --- |
| `index.html` | o dia: a fila de hoje, a barra que se gasta, a sobra. O único lugar com minutos. |
| `week.html` | a semana em colunas (seg a sex e fim de semana), agrupada por frente. |
| `ideas.html` | o que ainda não é tarefa, numa caixa de entrada: lista por dia à esquerda, a ideia aberta à direita com corpo, estágio, passos e atividade. |
| `clients.html` | clientes por frente, com canais (Mercado Livre, Shopee, TikTok Shop…), objetivos, backlog, diário e ofertas. Também o cadastro de frentes. |
| `funnels.html` | funil como grafo com tipos de nó, vazão por etapa, criativos, automações, ofertas e gatilhos. |
| `maps.html` | mapa mental com teclado e layout automático. |
| `finance.html` | do jeito da planilha: o mês dia a dia com saldo previsto, o ano em doze colunas, e o painel com saídas fixas, entradas fixas, compras no cartão e dívidas, mais a divisão 50/30/20. |
| `habits.html` | a grade do mês: hábitos nas linhas, dias nas colunas, uma marca por dia. Sequência e taxa do mês. |
| `plans.html` | trimestre, mês e semana lado a lado: objetivos por frente, desdobrar de um horizonte para o outro, e a revisão de cada período. |

Em toda tela, criar é o mesmo gesto: um botão "+" abre uma caixa (pop-up) com os campos. Nenhuma
lista tem formulário aberto no meio, e nenhuma tela tem filtro — a busca da sidebar acha qualquer
coisa pelo nome.

O princípio que amarra tudo: **só o dia tem minutos**. Todo o resto é reservatório sem hora,
e entra no dia pelo gesto de puxar, pagando o pedágio da duração.

Em `server/` há o Worker (Cloudflare + D1 + Resend) que leva tudo para outros aparelhos e
só aceita os e-mails do dono. Sem ele nada se perde além da sincronização.

## O dia

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

Em `localStorage`, na chave `merlin:dia` (os outros módulos usam `merlin:<tipo>`), no seu próprio navegador. Duas abas abertas se
conversam pelo evento `storage` em vez de uma sobrescrever a outra.

### Levar o mesmo dia para outros aparelhos

Você entra com seu e-mail e um código de 6 dígitos — sem senha para decorar, sem conta para
criar além do próprio endereço. A partir daí o mesmo dia aparece em qualquer navegador onde
você entrar, inclusive celular e Safari.

O rodapé diz em que modo você está. `sincronizado` é o único estado em que o dia existe fora
deste navegador.

O navegador continua sendo a fonte de verdade da sessão: se a rede cair, o dia fica salvo aqui
e sobe depois. Sem conexão o produto funciona inteiro — ele só não sincroniza.

Como isso não perde trabalho: cada gravação carimba um `v` no estado, e o servidor recusa
gravação mais velha devolvendo a versão dele, para o cliente adotar. Não é merge por tarefa —
se você editar nos dois computadores ao mesmo tempo, offline, um dos lados perde o intervalo.
Para uso sequencial (manhã em casa, tarde no escritório) isso não acontece.

O servidor lê seus dados: não há cifra ponta a ponta, e isso é escolha, não esquecimento. Com
login por código, a chave teria que vir do servidor — quem consegue se convencer de que você é
você, consegue se convencer sozinho. Cifra de mentira é pior que cifra nenhuma, porque você
confia nela.

O código de acesso nunca é guardado: o banco tem só o hash dele. Como subir o servidor está em
[server/README.md](server/README.md).

## Fora de escopo, por decisão

No dia: recorrência, tags, múltiplos dias, colaboração. Todos criariam um segundo eixo de
ordenação numa fila cuja única ordem é a prioridade. A semana e o backlog dos clientes existem
justamente para que isso não precise entrar aqui: lá as coisas têm data; aqui têm minutos.

Colaboração continua fora: a fila é de uma pessoa só, e é isso que faz o número grande ser
confiável — ninguém pode te mandar tarefa.

Conta e servidor deixaram de estar aqui. A sincronização por arquivo cobria dois desktops no
Chrome, mas não cobria celular nem Safari — e era esse o limite. O login por e-mail é a menor
conta possível: um endereço, um código, nenhuma senha.

Rollover automático também: tarefa aberta não rola para amanhã sozinha — é assim que lista
vira cemitério. Mas *não rolar* e *não saber que dia é* são decisões diferentes, e só a
primeira foi tomada de propósito: a fila sabe de que dia é, e pergunta o que fazer com ela.
