# o servidor

Um Worker, um banco D1 e o Resend. Sem framework e sem dependência — a mesma
disciplina do `index.html`, pelo mesmo motivo: dá pra ler inteiro.

O que ele faz: diz quem é você (código de 6 dígitos por e-mail) e guarda um
documento por dia. Ele **não** entende tarefa, não ordena fila, não calcula
sobra — essa conta continua sendo do cliente.

## Subir do zero

Uma vez só, uns 10 minutos.

### 1. O banco

```bash
cd servidor
npx wrangler d1 create artt-planner
```

Copie o `database_id` que aparece e cole em `wrangler.toml`. Depois crie as
tabelas, em produção:

```bash
npx wrangler d1 execute artt-planner --remote --file schema.sql
```

### 2. O e-mail

Crie a conta no [Resend](https://resend.com) e **verifique um domínio seu**.
Isso não é opcional: o remetente de teste (`onboarding@resend.dev`) só entrega
no e-mail da própria conta, e qualquer outro destinatário volta 403.

Ajuste `EMAIL_REMETENTE` no `wrangler.toml` para um endereço desse domínio.

### 3. Os segredos

Dois, e nenhum deles fica em arquivo:

```bash
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put SEGREDO_SESSAO
```

O `SEGREDO_SESSAO` assina os cookies de sessão. Gere um forte e guarde:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Trocar esse segredo desloga todo mundo — é o botão de pânico se um dia você
achar que vazou.

### 4. A rota

Descomente o bloco `[[routes]]` no `wrangler.toml` e ponha o **seu** domínio.

Isso importa mais do que parece: o Worker precisa responder no mesmo domínio
do site, em `/api/*`. Em domínios diferentes o cookie de sessão exigiria
`SameSite=None`, que Safari e Firefox bloqueiam como cookie de terceiro — e o
login simplesmente não gruda.

### 5. Publicar

```bash
npx wrangler deploy
```

## Mexer sem quebrar nada

```bash
npx wrangler d1 execute artt-planner-local --local --file schema.sql
npx wrangler dev --port 8788
```

Em desenvolvimento, se `RESEND_API_KEY` contiver `fake`, nenhum e-mail sai — o
código aparece no log do Worker. É o que permite testar o login inteiro sem
mandar mensagem para ninguém.

Crie um `.dev.vars` (que o git ignora):

```
RESEND_API_KEY=re_fake_para_teste_local
EMAIL_REMETENTE=planner@exemplo.com
SEGREDO_SESSAO=qualquer-coisa-longa-em-desenvolvimento
```

## As rotas

| Rota | O que faz |
| --- | --- |
| `POST /api/codigo` | manda um código de 6 dígitos para o e-mail |
| `POST /api/entrar` | troca o código por uma sessão (cookie) |
| `POST /api/sair` | apaga o cookie |
| `GET /api/eu` | diz se há sessão e de quem |
| `GET /api/dias?desde=V` | devolve os dias com carimbo maior que `V` |
| `POST /api/dias` | grava um dia; recusa se o servidor estiver na frente |

## Decisões que valem saber

**O servidor lê seus dados.** Não há cifra ponta a ponta, e isso foi escolha,
não esquecimento: com login por código, a chave teria que vir do servidor —
quem consegue se convencer de que você é você, consegue se convencer sozinho.
Cifra de mentira é pior que cifra nenhuma, porque você confia nela.

**O código nunca é guardado.** O banco tem o SHA-256 de `código + e-mail`.
Quem ler o banco não entra na conta de ninguém.

**Uso único, de verdade.** O gasto do código é um `UPDATE ... WHERE usado = 0`:
dois pedidos simultâneos com o mesmo código, só um passa.

**Errar custa igual a acertar.** Código inexistente também conta tentativa, e
5 erros queimam o código. Sem isso dava pra varrer os seis dígitos.

**Pedir código para um e-mail que não existe responde igual.** Dizer "essa
conta não existe" entregaria quem tem conta a quem estiver testando endereços.

**Quem chegou depois ganha.** O `v` do documento decide, e o servidor recusa
gravação mais velha devolvendo a versão dele — em vez de deixar os dois lados
discordando em silêncio. Não é merge por tarefa: se você editar nos dois
computadores ao mesmo tempo, offline, um dos lados perde o intervalo. Para uso
sequencial (manhã em casa, tarde no escritório) isso não acontece.

## O que custa

Nada, nesta escala. D1 e Workers têm tier gratuito folgado (100 mil
requisições/dia), e o Resend entrega 3 mil e-mails/mês de graça — um dia inteiro
de uso são alguns KB e alguns logins por mês.
