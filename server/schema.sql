-- merlin · o banco
--
-- quatro tabelas e nenhuma a mais. o produto guarda um documento por dia por
-- pessoa; o resto aqui existe so para saber quem e voce sem pedir senha.

-- quem usa. o e-mail e a identidade: nao ha nome, nem perfil, nem foto.
CREATE TABLE IF NOT EXISTS people (
  id          TEXT PRIMARY KEY,          -- uuid
  email       TEXT NOT NULL UNIQUE,      -- sempre normalizado em minusculas
  created_at  INTEGER NOT NULL           -- epoch ms
);

-- o codigo que chega por e-mail. guardamos o HASH, nunca o codigo:
-- quem ler o banco nao consegue entrar na conta de ninguem.
-- nada apaga a linha vencida, e esta certo assim: entrar confere o
-- expires_at na hora, e o limite por e-mail so conta as nao vencidas.
-- num sistema de duas pessoas a tabela cresce algumas dezenas por ano.
CREATE TABLE IF NOT EXISTS codes (
  hash        TEXT PRIMARY KEY,          -- sha-256 de (codigo + email)
  email       TEXT NOT NULL,
  expires_at  INTEGER NOT NULL,          -- epoch ms
  attempts    INTEGER NOT NULL DEFAULT 0,-- erros de digitacao; 5 e queima o codigo
  used        INTEGER NOT NULL DEFAULT 0 -- 1 depois de trocado por sessao
);
CREATE INDEX IF NOT EXISTS codes_email ON codes(email);
CREATE INDEX IF NOT EXISTS codes_expires_at ON codes(expires_at);

-- o dia. um por pessoa por data — e a mesma forma que ja vive no localStorage.
-- guardado como texto JSON: o servidor nao precisa entender tarefa nenhuma,
-- so devolver o documento e dizer qual e mais novo.
CREATE TABLE IF NOT EXISTS days (
  person   TEXT NOT NULL,
  day      TEXT NOT NULL,             -- 'YYYY-MM-DD', a data local de quem escreveu
  doc      TEXT NOT NULL,             -- o estado inteiro, JSON
  v        INTEGER NOT NULL,          -- o mesmo carimbo que o cliente ja usa
  PRIMARY KEY (person, day),
  FOREIGN KEY (person) REFERENCES people(id) ON DELETE CASCADE
);
-- "o que mudou desde a ultima vez que sincronizei" e a unica consulta que o
-- cliente faz alem de ler um dia especifico.
CREATE INDEX IF NOT EXISTS days_person_v ON days(person, v);

-- os documentos dos outros modulos: uma ideia, um cliente, um mapa, um
-- lancamento. mesma forma do dia — JSON opaco com carimbo — mas por (type, id)
-- em vez de por data. o servidor continua nao entendendo o que ha dentro.
CREATE TABLE IF NOT EXISTS docs (
  person   TEXT NOT NULL,
  type     TEXT NOT NULL,             -- 'ideas', 'clients', 'maps', ...
  id       TEXT NOT NULL,             -- o id que o cliente deu ao documento
  doc      TEXT NOT NULL,             -- JSON; {"deleted":true} e um tumulo
  v        INTEGER NOT NULL,
  PRIMARY KEY (person, type, id),
  FOREIGN KEY (person) REFERENCES people(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS docs_person_type_v ON docs(person, type, v);
