-- merlin · o banco
--
-- quatro tabelas e nenhuma a mais. o produto guarda um documento por dia por
-- pessoa; o resto aqui existe so para saber quem e voce sem pedir senha.

-- quem usa. o e-mail e a identidade: nao ha nome, nem perfil, nem foto.
CREATE TABLE IF NOT EXISTS pessoas (
  id       TEXT PRIMARY KEY,          -- uuid
  email    TEXT NOT NULL UNIQUE,      -- sempre normalizado em minusculas
  criada   INTEGER NOT NULL           -- epoch ms
);

-- o codigo que chega por e-mail. guardamos o HASH, nunca o codigo:
-- quem ler o banco nao consegue entrar na conta de ninguem.
CREATE TABLE IF NOT EXISTS codigos (
  hash     TEXT PRIMARY KEY,          -- sha-256 de (codigo + email)
  email    TEXT NOT NULL,
  expira   INTEGER NOT NULL,          -- epoch ms
  tentou   INTEGER NOT NULL DEFAULT 0,-- erros de digitacao; 5 e queima o codigo
  usado    INTEGER NOT NULL DEFAULT 0 -- 1 depois de trocado por sessao
);
CREATE INDEX IF NOT EXISTS codigos_email ON codigos(email);
CREATE INDEX IF NOT EXISTS codigos_expira ON codigos(expira);

-- o dia. um por pessoa por data — e a mesma forma que ja vive no localStorage.
-- guardado como texto JSON: o servidor nao precisa entender tarefa nenhuma,
-- so devolver o documento e dizer qual e mais novo.
CREATE TABLE IF NOT EXISTS dias (
  pessoa   TEXT NOT NULL,
  dia      TEXT NOT NULL,             -- 'YYYY-MM-DD', a data local de quem escreveu
  doc      TEXT NOT NULL,             -- o estado inteiro, JSON
  v        INTEGER NOT NULL,          -- o mesmo carimbo que o cliente ja usa
  PRIMARY KEY (pessoa, dia),
  FOREIGN KEY (pessoa) REFERENCES pessoas(id) ON DELETE CASCADE
);
-- "o que mudou desde a ultima vez que sincronizei" e a unica consulta que o
-- cliente faz alem de ler um dia especifico.
CREATE INDEX IF NOT EXISTS dias_pessoa_v ON dias(pessoa, v);

-- os documentos dos outros modulos: uma ideia, um cliente, um mapa, um
-- lancamento. mesma forma do dia — JSON opaco com carimbo — mas por (tipo, id)
-- em vez de por data. o servidor continua nao entendendo o que ha dentro.
CREATE TABLE IF NOT EXISTS docs (
  pessoa   TEXT NOT NULL,
  tipo     TEXT NOT NULL,             -- 'ideias', 'clientes', 'mapas', ...
  id       TEXT NOT NULL,             -- o id que o cliente deu ao documento
  doc      TEXT NOT NULL,             -- JSON; {"apagado":true} e um tumulo
  v        INTEGER NOT NULL,
  PRIMARY KEY (pessoa, tipo, id),
  FOREIGN KEY (pessoa) REFERENCES pessoas(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS docs_pessoa_tipo_v ON docs(pessoa, tipo, v);
