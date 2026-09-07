# o servidor

Um Worker, um banco D1 e o Resend. Sem framework e sem dependência — a mesma
disciplina do `index.html`, pelo mesmo motivo: dá pra ler inteiro.

O que ele faz: serve o site, diz quem é você (código de 6 dígitos por e-mail),
guarda um documento por dia (tabela `dias`) e guarda os documentos dos outros
módulos por tipo e id (tabela `docs`: ideias, clientes, mapas, funis,
financeiro, semana). Ele **não** entende nada do que há dentro — só devolve e
diz qual versão é mais nova.

É um sistema de uma pessoa: `EMAILS_DONO` no `wrangler.toml` lista quem pode
entrar. Outro e-mail recebe a mesma resposta de sucesso e nenhum código.

As páginas da raiz, a pasta `compartilhado/` e a API saem do mesmo Worker, no mesmo domínio. Não é
economia: é o que permite o cookie de sessão ser `SameSite=Lax`. Em domínios
separados ele seria cookie de terceiro, e Safari e Firefox o bloqueiam — o
login não gruda.

## Subir do zero

Uma vez só, uns 10 minutos.

### 1. O banco

```bash
cd servidor
npx wrangler d1 create artt-planner   # o nome do banco não mudou com o do produto
```

Copie o `database_id` que aparece e cole em `wrangler.toml`. Depois crie as
tabelas, em produção (o schema é idempotente: rodar de novo num banco que já
existe só cria a tabela `docs` que faltava):

```bash
npx wrangler d1 execute artt-planner --remote --file schema.sql
```

### 2. O e-mail

Crie a conta no [Resend](https://resend.com) e **verifique um domínio seu**.
Isso não é opcional: o remetente de teste (`onboarding@resend.dev`) só entrega
no e-mail da própria conta, e qualquer outro destinatário volta 403.

Ajuste `EMAIL_REMETENTE` no `wrangler.toml` para um endereço desse domínio.

### 3. Os segredos

Três, e nenhum deles fica em arquivo:

```bash
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put SEGREDO_SESSAO
npx wrangler secret put ANTHROPIC_API_KEY
```

O `ANTHROPIC_API_KEY` é do Merlin conselheiro (a rota `/api/merlin`, que sugere
ramos no mapa mental e o que falta num funil). É opcional: sem ele a rota
responde 503 e as telas dizem que falta a chave. A chave sai de
console.anthropic.com; o modelo é o `claude-opus-5` e cada pedido custa centavos.

O `SEGREDO_SESSAO` assina os cookies de sessão. Gere um forte e guarde:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Trocar esse segredo desloga todo mundo — é o botão de pânico se um dia você
achar que vazou.

### 4. O domínio

No `wrangler.toml`, ponha o **seu** domínio no bloco `[[routes]]`:

```toml
[[routes]]
pattern = "planner.seudominio.com.br"
custom_domain = true
```

É `custom_domain`, não route: a Cloudflare reserva route para quando existe uma
origem externa a ser interceptada. Aqui o Worker **é** a origem, e o custom
domain cria o registro DNS e o certificado sozinho.

Se já houver um CNAME nesse hostname (apontando para outra hospedagem, por
exemplo), **apague antes** — a Cloudflare recusa criar custom domain por cima
de um CNAME existente, e o deploy falha.

### 5. Publicar

```bash
npm run deploy
```

Isso roda os testes, copia o `index.html` da raiz para `site/` e publica. Se
algum teste falhar, nada sobe.

## Mexer sem quebrar nada

```bash
npx wrangler d1 execute artt-planner --local --file schema.sql
npm run dev
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
