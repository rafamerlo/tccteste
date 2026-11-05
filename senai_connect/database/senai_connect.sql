-- =====================================================================
--  SENAI Connect · Gestão Escolar — Banco de dados MySQL 8.0+
--  Escola SENAI A. Jacob Lafer
--
--  Cobre todos os módulos do front-end:
--    • Acesso (usuários, sessões)          • Carômetro e presença
--    • Boletim (notas e faltas/bimestre)   • Autorizações de saída
--    • Reserva de ambientes (sem conflito) • Fale com a equipe (contato)
--
--  Como rodar:  mysql -u root -p < senai_connect.sql
--  O script recria o banco do zero (DROP DATABASE). Não rode em produção
--  com dados reais sem fazer backup antes.
-- =====================================================================

-- Garante acentuação correta, mesmo rodando pelo terminal do Windows
SET NAMES utf8mb4;

DROP DATABASE IF EXISTS senai_connect;
CREATE DATABASE senai_connect
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_0900_ai_ci;   -- busca ignora acento e maiúscula
USE senai_connect;

-- Fuso de São Paulo (Brasil sem horário de verão desde 2019).
-- A aplicação deve repetir este SET ao abrir cada conexão.
SET time_zone = '-03:00';

-- =====================================================================
-- 1. ACESSO
-- =====================================================================

CREATE TABLE usuarios (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nome            VARCHAR(120) NOT NULL,
  email           VARCHAR(160) NOT NULL,
  senha_hash      VARCHAR(255) NOT NULL COMMENT 'bcrypt/argon2 gerado no back-end. Nunca senha pura.',
  perfil          ENUM('admin','coordenacao','secretaria','professor','portaria') NOT NULL DEFAULT 'professor',
  ativo           TINYINT(1)   NOT NULL DEFAULT 1,
  ultimo_acesso   DATETIME     NULL,
  criado_em       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uq_usuarios_email UNIQUE (email),
  CONSTRAINT ck_usuarios_nome  CHECK (CHAR_LENGTH(TRIM(nome)) >= 3),
  CONSTRAINT ck_usuarios_email CHECK (email REGEXP '^[^[:space:]@]+@[^[:space:]@]+\\.[^[:space:]@]{2,}$')
) ENGINE=InnoDB COMMENT='Equipe da escola com acesso ao painel';

CREATE TABLE sessoes (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  usuario_id      INT UNSIGNED NOT NULL,
  token_hash      CHAR(64)     NOT NULL COMMENT 'SHA-256 do token; o token puro fica só no cookie',
  manter_conectado TINYINT(1)  NOT NULL DEFAULT 0,
  ip              VARCHAR(45)  NULL,
  user_agent      VARCHAR(255) NULL,
  criado_em       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expira_em       DATETIME     NOT NULL,
  encerrada_em    DATETIME     NULL,
  CONSTRAINT uq_sessoes_token UNIQUE (token_hash),
  CONSTRAINT fk_sessoes_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  INDEX ix_sessoes_usuario (usuario_id, expira_em)
) ENGINE=InnoDB COMMENT='Login "Manter conectado neste computador"';

-- =====================================================================
-- 2. ESTRUTURA ACADÊMICA
-- =====================================================================

CREATE TABLE turmas (
  id              SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nome            VARCHAR(40)  NOT NULL COMMENT 'Ex.: Sala TI 01',
  serie           VARCHAR(20)  NOT NULL COMMENT 'Ex.: 1º ano',
  curso           VARCHAR(80)  NOT NULL DEFAULT 'Técnico em Informática',
  ano_letivo      YEAR         NOT NULL,
  cor_destaque    CHAR(7)      NOT NULL DEFAULT '#E3001B' COMMENT 'Cor usada no carômetro',
  ativa           TINYINT(1)   NOT NULL DEFAULT 1,
  CONSTRAINT uq_turmas UNIQUE (nome, ano_letivo),
  CONSTRAINT ck_turmas_cor CHECK (cor_destaque REGEXP '^#[0-9A-Fa-f]{6}$')
) ENGINE=InnoDB;

CREATE TABLE disciplinas (
  id              SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nome            VARCHAR(80)  NOT NULL,
  ordem_exibicao  TINYINT UNSIGNED NOT NULL DEFAULT 0,
  ativa           TINYINT(1)   NOT NULL DEFAULT 1,
  CONSTRAINT uq_disciplinas_nome UNIQUE (nome)
) ENGINE=InnoDB;

CREATE TABLE turma_disciplinas (
  turma_id        SMALLINT UNSIGNED NOT NULL,
  disciplina_id   SMALLINT UNSIGNED NOT NULL,
  professor_id    INT UNSIGNED NULL,
  PRIMARY KEY (turma_id, disciplina_id),
  CONSTRAINT fk_td_turma      FOREIGN KEY (turma_id)      REFERENCES turmas(id)      ON DELETE CASCADE,
  CONSTRAINT fk_td_disciplina FOREIGN KEY (disciplina_id) REFERENCES disciplinas(id),
  CONSTRAINT fk_td_professor  FOREIGN KEY (professor_id)  REFERENCES usuarios(id)    ON DELETE SET NULL
) ENGINE=InnoDB COMMENT='Grade da turma e professor responsável';

CREATE TABLE bimestres (
  id              SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ano_letivo      YEAR         NOT NULL,
  numero          TINYINT UNSIGNED NOT NULL,
  data_inicio     DATE         NOT NULL,
  data_fim        DATE         NOT NULL,
  CONSTRAINT uq_bimestres UNIQUE (ano_letivo, numero),
  CONSTRAINT ck_bimestres_numero CHECK (numero BETWEEN 1 AND 4),
  CONSTRAINT ck_bimestres_datas  CHECK (data_fim > data_inicio)
) ENGINE=InnoDB;

-- =====================================================================
-- 3. ALUNOS E RESPONSÁVEIS
-- =====================================================================

CREATE TABLE alunos (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  matricula        VARCHAR(20)  NOT NULL COMMENT 'Formato atual do front: NX-001',
  nome             VARCHAR(120) NOT NULL,
  turma_id         SMALLINT UNSIGNED NOT NULL,
  data_nascimento  DATE         NULL,
  telefone_contato VARCHAR(20)  NULL,
  foto_url         VARCHAR(255) NULL COMMENT 'Foto 4x4. Ex.: /alunos/aluno-01.svg',
  ativo            TINYINT(1)   NOT NULL DEFAULT 1,
  criado_em        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uq_alunos_matricula UNIQUE (matricula),
  CONSTRAINT fk_alunos_turma FOREIGN KEY (turma_id) REFERENCES turmas(id),
  INDEX ix_alunos_turma (turma_id, nome),
  INDEX ix_alunos_nome (nome)
) ENGINE=InnoDB;

CREATE TABLE responsaveis (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nome            VARCHAR(120) NOT NULL,
  telefone        VARCHAR(20)  NULL,
  email           VARCHAR(160) NULL,
  criado_em       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE aluno_responsaveis (
  aluno_id        INT UNSIGNED NOT NULL,
  responsavel_id  INT UNSIGNED NOT NULL,
  parentesco      VARCHAR(30)  NULL,
  principal       TINYINT(1)   NOT NULL DEFAULT 1,
  autorizado_buscar TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Pode retirar o aluno na portaria',
  PRIMARY KEY (aluno_id, responsavel_id),
  CONSTRAINT fk_ar_aluno       FOREIGN KEY (aluno_id)       REFERENCES alunos(id)       ON DELETE CASCADE,
  CONSTRAINT fk_ar_responsavel FOREIGN KEY (responsavel_id) REFERENCES responsaveis(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- =====================================================================
-- 4. CARÔMETRO / PRESENÇA
-- =====================================================================

CREATE TABLE presencas (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  aluno_id        INT UNSIGNED NOT NULL,
  data_aula       DATE         NOT NULL,
  situacao        ENUM('presente','ausente') NOT NULL,
  registrado_por  INT UNSIGNED NULL,
  registrado_em   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uq_presenca_dia UNIQUE (aluno_id, data_aula),
  CONSTRAINT fk_presenca_aluno   FOREIGN KEY (aluno_id)       REFERENCES alunos(id)   ON DELETE CASCADE,
  CONSTRAINT fk_presenca_usuario FOREIGN KEY (registrado_por) REFERENCES usuarios(id) ON DELETE SET NULL,
  INDEX ix_presenca_data (data_aula, situacao)
) ENGINE=InnoDB COMMENT='Um registro por aluno por dia';

-- =====================================================================
-- 5. BOLETIM
-- =====================================================================

CREATE TABLE notas (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  aluno_id        INT UNSIGNED      NOT NULL,
  disciplina_id   SMALLINT UNSIGNED NOT NULL,
  bimestre_id     SMALLINT UNSIGNED NOT NULL,
  nota            DECIMAL(4,2)      NULL COMMENT 'NULL = ainda não lançada',
  faltas          SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  lancado_por     INT UNSIGNED      NULL,
  atualizado_em   DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uq_notas UNIQUE (aluno_id, disciplina_id, bimestre_id),
  CONSTRAINT ck_notas_escala CHECK (nota IS NULL OR nota BETWEEN 0 AND 10),
  CONSTRAINT fk_notas_aluno      FOREIGN KEY (aluno_id)      REFERENCES alunos(id)      ON DELETE CASCADE,
  CONSTRAINT fk_notas_disciplina FOREIGN KEY (disciplina_id) REFERENCES disciplinas(id),
  CONSTRAINT fk_notas_bimestre   FOREIGN KEY (bimestre_id)   REFERENCES bimestres(id),
  CONSTRAINT fk_notas_usuario    FOREIGN KEY (lancado_por)   REFERENCES usuarios(id)    ON DELETE SET NULL
) ENGINE=InnoDB COMMENT='Nota e faltas por aluno, disciplina e bimestre';

-- =====================================================================
-- 6. AUTORIZAÇÕES DE SAÍDA
--    Fluxo: Pendente → Aprovada → Liberada  (ou Recusada / Cancelada)
-- =====================================================================

CREATE TABLE motivos_saida (
  id              SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  descricao       VARCHAR(80) NOT NULL,
  ativo           TINYINT(1)  NOT NULL DEFAULT 1,
  CONSTRAINT uq_motivos UNIQUE (descricao)
) ENGINE=InnoDB;

CREATE TABLE autorizacoes_saida (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  aluno_id         INT UNSIGNED      NOT NULL,
  motivo_id        SMALLINT UNSIGNED NOT NULL,
  data_saida       DATE              NOT NULL,
  hora_saida       TIME              NOT NULL,
  responsavel_nome VARCHAR(120)      NOT NULL COMMENT 'Quem busca o aluno',
  observacoes      VARCHAR(500)      NULL,
  status           ENUM('Pendente','Aprovada','Liberada','Recusada','Cancelada') NOT NULL DEFAULT 'Pendente',
  solicitado_por   INT UNSIGNED      NULL,
  criado_em        DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em    DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_saida_aluno   FOREIGN KEY (aluno_id)       REFERENCES alunos(id),
  CONSTRAINT fk_saida_motivo  FOREIGN KEY (motivo_id)      REFERENCES motivos_saida(id),
  CONSTRAINT fk_saida_usuario FOREIGN KEY (solicitado_por) REFERENCES usuarios(id) ON DELETE SET NULL,
  INDEX ix_saida_status (status, data_saida),
  INDEX ix_saida_aluno  (aluno_id, data_saida)
) ENGINE=InnoDB;

CREATE TABLE autorizacoes_saida_historico (
  id               BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  autorizacao_id   INT UNSIGNED NOT NULL,
  status_anterior  ENUM('Pendente','Aprovada','Liberada','Recusada','Cancelada') NULL,
  status_novo      ENUM('Pendente','Aprovada','Liberada','Recusada','Cancelada') NOT NULL,
  usuario_id       INT UNSIGNED NULL,
  ocorrido_em      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_hsaida_aut     FOREIGN KEY (autorizacao_id) REFERENCES autorizacoes_saida(id) ON DELETE CASCADE,
  CONSTRAINT fk_hsaida_usuario FOREIGN KEY (usuario_id)     REFERENCES usuarios(id) ON DELETE SET NULL,
  INDEX ix_hsaida (autorizacao_id, ocorrido_em)
) ENGINE=InnoDB COMMENT='Histórico de decisões (preenchido por trigger)';

-- =====================================================================
-- 7. RESERVA DE AMBIENTES
-- =====================================================================

CREATE TABLE ambientes (
  id              SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nome            VARCHAR(80)  NOT NULL,
  tipo            ENUM('laboratorio','biblioteca','reuniao','auditorio','sala') NOT NULL,
  capacidade      SMALLINT UNSIGNED NULL,
  ativo           TINYINT(1)   NOT NULL DEFAULT 1,
  CONSTRAINT uq_ambientes_nome UNIQUE (nome)
) ENGINE=InnoDB;

CREATE TABLE reservas (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ambiente_id     SMALLINT UNSIGNED NOT NULL,
  solicitante     VARCHAR(120) NOT NULL COMMENT 'Texto livre do formulário (ex.: Prof.ª Camila)',
  usuario_id      INT UNSIGNED NULL COMMENT 'Quem registrou no sistema',
  data_reserva    DATE         NOT NULL,
  hora_inicio     TIME         NOT NULL,
  hora_fim        TIME         NOT NULL,
  finalidade      VARCHAR(255) NOT NULL,
  status          ENUM('Pendente','Aprovada','Recusada','Cancelada') NOT NULL DEFAULT 'Pendente',
  criado_em       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT ck_reservas_horario CHECK (hora_fim > hora_inicio),
  CONSTRAINT fk_reservas_ambiente FOREIGN KEY (ambiente_id) REFERENCES ambientes(id),
  CONSTRAINT fk_reservas_usuario  FOREIGN KEY (usuario_id)  REFERENCES usuarios(id) ON DELETE SET NULL,
  INDEX ix_reservas_agenda (ambiente_id, data_reserva, status, hora_inicio)
) ENGINE=InnoDB;

CREATE TABLE reservas_historico (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  reserva_id      INT UNSIGNED NOT NULL,
  status_anterior ENUM('Pendente','Aprovada','Recusada','Cancelada') NULL,
  status_novo     ENUM('Pendente','Aprovada','Recusada','Cancelada') NOT NULL,
  usuario_id      INT UNSIGNED NULL,
  ocorrido_em     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_hres_reserva FOREIGN KEY (reserva_id) REFERENCES reservas(id) ON DELETE CASCADE,
  CONSTRAINT fk_hres_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- =====================================================================
-- 8. FALE COM A EQUIPE (landing page)
-- =====================================================================

CREATE TABLE mensagens_contato (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nome            VARCHAR(120) NOT NULL,
  email           VARCHAR(160) NOT NULL,
  mensagem        TEXT         NOT NULL,
  status          ENUM('Nova','Respondida','Arquivada') NOT NULL DEFAULT 'Nova',
  ip_origem       VARCHAR(45)  NULL,
  recebido_em     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX ix_contato_status (status, recebido_em)
) ENGINE=InnoDB;

-- =====================================================================
-- 9. REGRAS DE NEGÓCIO (TRIGGERS)
--    A aplicação informa quem está agindo com:  SET @app_usuario_id = <id>;
-- =====================================================================

DELIMITER $$

-- Reserva: impede choque de horário no mesmo ambiente (Pendente/Aprovada contam)
CREATE TRIGGER trg_reservas_bi_conflito BEFORE INSERT ON reservas
FOR EACH ROW
BEGIN
  IF NEW.status IN ('Pendente','Aprovada') AND EXISTS (
       SELECT 1 FROM reservas r
        WHERE r.ambiente_id  = NEW.ambiente_id
          AND r.data_reserva = NEW.data_reserva
          AND r.status IN ('Pendente','Aprovada')
          AND NEW.hora_inicio < r.hora_fim
          AND NEW.hora_fim    > r.hora_inicio) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Conflito de horário: já existe reserva para este ambiente nesse período.';
  END IF;
END$$

CREATE TRIGGER trg_reservas_bu_regras BEFORE UPDATE ON reservas
FOR EACH ROW
BEGIN
  -- Fluxo de status
  IF NEW.status <> OLD.status AND NOT (
       (OLD.status = 'Pendente' AND NEW.status IN ('Aprovada','Recusada','Cancelada')) OR
       (OLD.status = 'Aprovada' AND NEW.status = 'Cancelada')) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Mudança de status de reserva não permitida.';
  END IF;
  -- Conflito ao reativar/alterar horário
  IF NEW.status IN ('Pendente','Aprovada') AND EXISTS (
       SELECT 1 FROM reservas r
        WHERE r.id <> NEW.id
          AND r.ambiente_id  = NEW.ambiente_id
          AND r.data_reserva = NEW.data_reserva
          AND r.status IN ('Pendente','Aprovada')
          AND NEW.hora_inicio < r.hora_fim
          AND NEW.hora_fim    > r.hora_inicio) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Conflito de horário: já existe reserva para este ambiente nesse período.';
  END IF;
END$$

CREATE TRIGGER trg_reservas_ai_hist AFTER INSERT ON reservas
FOR EACH ROW
  INSERT INTO reservas_historico (reserva_id, status_anterior, status_novo, usuario_id)
  VALUES (NEW.id, NULL, NEW.status, COALESCE(@app_usuario_id, NEW.usuario_id))$$

CREATE TRIGGER trg_reservas_au_hist AFTER UPDATE ON reservas
FOR EACH ROW
BEGIN
  IF NEW.status <> OLD.status THEN
    INSERT INTO reservas_historico (reserva_id, status_anterior, status_novo, usuario_id)
    VALUES (NEW.id, OLD.status, NEW.status, @app_usuario_id);
  END IF;
END$$

-- Autorização de saída: valida o fluxo Pendente → Aprovada → Liberada
CREATE TRIGGER trg_saida_bu_fluxo BEFORE UPDATE ON autorizacoes_saida
FOR EACH ROW
BEGIN
  IF NEW.status <> OLD.status AND NOT (
       (OLD.status = 'Pendente' AND NEW.status IN ('Aprovada','Recusada','Cancelada')) OR
       (OLD.status = 'Aprovada' AND NEW.status IN ('Liberada','Cancelada'))) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Mudança de status não permitida. Fluxo: Pendente > Aprovada > Liberada.';
  END IF;
END$$

CREATE TRIGGER trg_saida_ai_hist AFTER INSERT ON autorizacoes_saida
FOR EACH ROW
  INSERT INTO autorizacoes_saida_historico (autorizacao_id, status_anterior, status_novo, usuario_id)
  VALUES (NEW.id, NULL, NEW.status, COALESCE(@app_usuario_id, NEW.solicitado_por))$$

CREATE TRIGGER trg_saida_au_hist AFTER UPDATE ON autorizacoes_saida
FOR EACH ROW
BEGIN
  IF NEW.status <> OLD.status THEN
    INSERT INTO autorizacoes_saida_historico (autorizacao_id, status_anterior, status_novo, usuario_id)
    VALUES (NEW.id, OLD.status, NEW.status, @app_usuario_id);
  END IF;
END$$

DELIMITER ;

-- =====================================================================
-- 10. VIEWS (o que as telas consomem)
-- =====================================================================

-- Boletim completo: uma linha por aluno x disciplina, com os 4 bimestres
CREATE OR REPLACE VIEW vw_boletim AS
SELECT
  a.id                         AS aluno_id,
  a.matricula,
  a.nome                       AS aluno,
  t.nome                       AS turma,
  t.ano_letivo,
  d.id                         AS disciplina_id,
  d.nome                       AS disciplina,
  d.ordem_exibicao,
  MAX(CASE WHEN b.numero = 1 THEN n.nota END) AS nota_1bim,
  MAX(CASE WHEN b.numero = 2 THEN n.nota END) AS nota_2bim,
  MAX(CASE WHEN b.numero = 3 THEN n.nota END) AS nota_3bim,
  MAX(CASE WHEN b.numero = 4 THEN n.nota END) AS nota_4bim,
  ROUND(AVG(n.nota), 2)        AS media,
  COALESCE(SUM(n.faltas), 0)   AS faltas,
  CASE WHEN AVG(n.nota) IS NULL THEN 'Sem notas'
       WHEN AVG(n.nota) >= 6   THEN 'Na média'
       ELSE 'Recuperação' END  AS situacao
FROM alunos a
JOIN turmas t             ON t.id = a.turma_id
JOIN turma_disciplinas td ON td.turma_id = t.id
JOIN disciplinas d        ON d.id = td.disciplina_id
LEFT JOIN bimestres b     ON b.ano_letivo = t.ano_letivo
LEFT JOIN notas n         ON n.aluno_id = a.id AND n.disciplina_id = d.id AND n.bimestre_id = b.id
WHERE a.ativo = 1
GROUP BY a.id, a.matricula, a.nome, t.nome, t.ano_letivo, d.id, d.nome, d.ordem_exibicao;

-- Média geral do aluno (média das médias por disciplina, igual ao front)
CREATE OR REPLACE VIEW vw_media_aluno AS
SELECT
  aluno_id, matricula, aluno, turma, ano_letivo,
  ROUND(AVG(media), 2)                          AS media_geral,
  SUM(CASE WHEN media < 6 THEN 1 ELSE 0 END)    AS disciplinas_abaixo_media,
  SUM(faltas)                                   AS faltas_ano,
  CASE WHEN AVG(media) IS NULL THEN 'Sem notas'
       WHEN AVG(media) >= 6   THEN 'Na média'
       ELSE 'Recuperação' END                   AS situacao
FROM vw_boletim
GROUP BY aluno_id, matricula, aluno, turma, ano_letivo;

-- Média por sala
CREATE OR REPLACE VIEW vw_media_turma AS
SELECT
  turma, ano_letivo,
  COUNT(*)                                        AS alunos,
  ROUND(AVG(media_geral), 2)                      AS media_turma,
  SUM(CASE WHEN media_geral < 6 THEN 1 ELSE 0 END) AS alunos_em_recuperacao
FROM vw_media_aluno
GROUP BY turma, ano_letivo;

-- Carômetro do dia (CURDATE respeita o time_zone da conexão)
CREATE OR REPLACE VIEW vw_carometro_hoje AS
SELECT
  a.id AS aluno_id, a.matricula, a.nome AS aluno, a.foto_url,
  t.id AS turma_id, t.nome AS turma, t.serie, t.cor_destaque,
  r.nome AS responsavel, a.telefone_contato,
  COALESCE(p.situacao, 'sem registro') AS presenca
FROM alunos a
JOIN turmas t ON t.id = a.turma_id
LEFT JOIN aluno_responsaveis ar ON ar.aluno_id = a.id AND ar.principal = 1
LEFT JOIN responsaveis r        ON r.id = ar.responsavel_id
LEFT JOIN presencas p           ON p.aluno_id = a.id AND p.data_aula = CURDATE()
WHERE a.ativo = 1;

-- Autorizações com dados do aluno (tela Saídas e Histórico)
CREATE OR REPLACE VIEW vw_autorizacoes_saida AS
SELECT
  s.id, s.status, s.data_saida, s.hora_saida,
  a.id AS aluno_id, a.matricula, a.nome AS aluno, a.foto_url, t.nome AS turma,
  m.descricao AS motivo, s.responsavel_nome, s.observacoes,
  u.nome AS solicitado_por, s.criado_em, s.atualizado_em
FROM autorizacoes_saida s
JOIN alunos a        ON a.id = s.aluno_id
JOIN turmas t        ON t.id = a.turma_id
JOIN motivos_saida m ON m.id = s.motivo_id
LEFT JOIN usuarios u ON u.id = s.solicitado_por;

-- Agenda de ambientes
CREATE OR REPLACE VIEW vw_agenda_ambientes AS
SELECT
  r.id, amb.nome AS ambiente, amb.tipo, r.data_reserva, r.hora_inicio, r.hora_fim,
  r.solicitante, r.finalidade, r.status, r.criado_em
FROM reservas r
JOIN ambientes amb ON amb.id = r.ambiente_id;

-- Cards do dashboard
CREATE OR REPLACE VIEW vw_dashboard AS
SELECT
  (SELECT COUNT(*) FROM alunos WHERE ativo = 1)                                          AS total_alunos,
  (SELECT COUNT(*) FROM turmas WHERE ativa = 1)                                          AS total_turmas,
  (SELECT COUNT(*) FROM presencas WHERE data_aula = CURDATE() AND situacao = 'presente') AS presentes_hoje,
  (SELECT COUNT(*) FROM presencas WHERE data_aula = CURDATE() AND situacao = 'ausente')  AS ausentes_hoje,
  (SELECT COUNT(*) FROM autorizacoes_saida WHERE status = 'Pendente')                    AS saidas_pendentes,
  (SELECT COUNT(*) FROM autorizacoes_saida WHERE status = 'Aprovada')                    AS saidas_aprovadas,
  (SELECT COUNT(*) FROM reservas WHERE status = 'Pendente')                              AS reservas_pendentes,
  (SELECT COUNT(*) FROM reservas WHERE status = 'Aprovada' AND data_reserva = CURDATE()) AS reservas_hoje,
  (SELECT COUNT(*) FROM mensagens_contato WHERE status = 'Nova')                         AS mensagens_novas;

-- =====================================================================
-- 11. PROCEDURES (ações das telas)
-- =====================================================================

DELIMITER $$

-- Carômetro: marca presença/ausência (cria ou atualiza o registro do dia)
CREATE PROCEDURE sp_registrar_presenca(
  IN p_aluno_id INT UNSIGNED, IN p_data DATE,
  IN p_situacao VARCHAR(10), IN p_usuario_id INT UNSIGNED)
BEGIN
  INSERT INTO presencas (aluno_id, data_aula, situacao, registrado_por)
  VALUES (p_aluno_id, COALESCE(p_data, CURDATE()), p_situacao, p_usuario_id)
  ON DUPLICATE KEY UPDATE situacao = VALUES(situacao), registrado_por = VALUES(registrado_por);
END$$

-- Boletim: lança/atualiza nota e faltas de um bimestre
CREATE PROCEDURE sp_lancar_nota(
  IN p_aluno_id INT UNSIGNED, IN p_disciplina_id SMALLINT UNSIGNED,
  IN p_ano YEAR, IN p_bimestre TINYINT UNSIGNED,
  IN p_nota DECIMAL(4,2), IN p_faltas SMALLINT UNSIGNED, IN p_usuario_id INT UNSIGNED)
BEGIN
  DECLARE v_bimestre_id SMALLINT UNSIGNED;
  SELECT id INTO v_bimestre_id FROM bimestres WHERE ano_letivo = p_ano AND numero = p_bimestre;
  IF v_bimestre_id IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Bimestre não cadastrado para esse ano letivo.';
  END IF;
  INSERT INTO notas (aluno_id, disciplina_id, bimestre_id, nota, faltas, lancado_por)
  VALUES (p_aluno_id, p_disciplina_id, v_bimestre_id, p_nota, COALESCE(p_faltas, 0), p_usuario_id)
  ON DUPLICATE KEY UPDATE nota = VALUES(nota), faltas = VALUES(faltas), lancado_por = VALUES(lancado_por);
END$$

-- Saídas: aprovar, recusar, confirmar saída (Liberada) ou cancelar
CREATE PROCEDURE sp_decidir_autorizacao(
  IN p_id INT UNSIGNED, IN p_status VARCHAR(10), IN p_usuario_id INT UNSIGNED)
BEGIN
  SET @app_usuario_id = p_usuario_id;
  UPDATE autorizacoes_saida SET status = p_status WHERE id = p_id;
  IF ROW_COUNT() = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Autorização não encontrada ou status inalterado.';
  END IF;
  SET @app_usuario_id = NULL;
END$$

-- Reservas: aprovar, recusar ou cancelar
CREATE PROCEDURE sp_decidir_reserva(
  IN p_id INT UNSIGNED, IN p_status VARCHAR(10), IN p_usuario_id INT UNSIGNED)
BEGIN
  SET @app_usuario_id = p_usuario_id;
  UPDATE reservas SET status = p_status WHERE id = p_id;
  IF ROW_COUNT() = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Reserva não encontrada ou status inalterado.';
  END IF;
  SET @app_usuario_id = NULL;
END$$

DELIMITER ;

-- =====================================================================
-- 12. DADOS INICIAIS (mesma base demonstrativa do front-end)
-- =====================================================================

-- Conta de demonstração: demo@senaiconnect.com / senai123  (hash bcrypt)
-- TROQUE essa senha antes de colocar o sistema no ar.
INSERT INTO usuarios (id, nome, email, senha_hash, perfil) VALUES
  (1, 'Equipe Jacob Lafer', 'demo@senaiconnect.com', '$2b$10$/AJUn29smATxFRwpAvYZCe.mHwVXCij4kvLzPSthrKpv5/2w/8Nli', 'admin');

INSERT INTO turmas (id, nome, serie, ano_letivo, cor_destaque) VALUES
  (1, 'Sala TI 01', '1º ano', 2026, '#E3001B'),
  (2, 'Sala TI 02', '2º ano', 2026, '#E8770E'),
  (3, 'Sala TI 03', '3º ano', 2026, '#12876A'),
  (4, 'Sala TI 04', '4º ano', 2026, '#5B4BC4');

INSERT INTO disciplinas (id, nome, ordem_exibicao) VALUES
  (1, 'Lógica de Programação', 1),
  (2, 'Desenvolvimento Web', 2),
  (3, 'Banco de Dados', 3),
  (4, 'Redes de Computadores', 4),
  (5, 'Inglês Técnico', 5),
  (6, 'Projeto Integrador', 6);

INSERT INTO turma_disciplinas (turma_id, disciplina_id)
SELECT t.id, d.id FROM turmas t CROSS JOIN disciplinas d;

INSERT INTO bimestres (id, ano_letivo, numero, data_inicio, data_fim) VALUES
  (1, 2026, 1, '2026-02-02', '2026-04-17'),
  (2, 2026, 2, '2026-04-22', '2026-07-03'),
  (3, 2026, 3, '2026-07-27', '2026-10-02'),
  (4, 2026, 4, '2026-10-05', '2026-12-18');

INSERT INTO responsaveis (id, nome) VALUES
  (1, 'Mariana Duarte'),
  (2, 'Ricardo Nascimento'),
  (3, 'Patrícia Martins'),
  (4, 'Carlos Tavares');

INSERT INTO alunos (id, matricula, nome, turma_id, telefone_contato, foto_url) VALUES
  (1, 'NX-001', 'Helena Duarte', 1, '(11) 9 8120-01', '/alunos/aluno-01.svg'),
  (2, 'NX-002', 'Caio Nascimento', 1, '(11) 9 8121-02', '/alunos/aluno-02.svg'),
  (3, 'NX-003', 'Lívia Martins', 1, '(11) 9 8122-03', '/alunos/aluno-03.svg'),
  (4, 'NX-004', 'Rafael Tavares', 1, '(11) 9 8123-04', '/alunos/aluno-04.svg'),
  (5, 'NX-005', 'Manuela Costa', 1, '(11) 9 8124-05', '/alunos/aluno-05.svg'),
  (6, 'NX-006', 'Enzo Ribeiro', 1, '(11) 9 8125-06', '/alunos/aluno-06.svg'),
  (7, 'NX-007', 'Yasmin Alves', 1, '(11) 9 8126-07', '/alunos/aluno-07.svg'),
  (8, 'NX-008', 'Breno Cardoso', 1, '(11) 9 8127-08', '/alunos/aluno-08.svg'),
  (9, 'NX-009', 'Clara Mendes', 1, '(11) 9 8128-09', '/alunos/aluno-09.svg'),
  (10, 'NX-010', 'João Pedro Lima', 1, '(11) 9 8129-010', '/alunos/aluno-10.svg'),
  (11, 'NX-011', 'Sofia Azevedo', 2, '(11) 9 8134-01', '/alunos/aluno-11.svg'),
  (12, 'NX-012', 'Miguel Rocha', 2, '(11) 9 8135-02', '/alunos/aluno-12.svg'),
  (13, 'NX-013', 'Laura Castro', 2, '(11) 9 8136-03', '/alunos/aluno-13.svg'),
  (14, 'NX-014', 'Arthur Pires', 2, '(11) 9 8137-04', '/alunos/aluno-14.svg'),
  (15, 'NX-015', 'Isadora Freitas', 2, '(11) 9 8138-05', '/alunos/aluno-15.svg'),
  (16, 'NX-016', 'Theo Carvalho', 2, '(11) 9 8139-06', '/alunos/aluno-16.svg'),
  (17, 'NX-017', 'Beatriz Moura', 2, '(11) 9 8140-07', '/alunos/aluno-17.svg'),
  (18, 'NX-018', 'Gabriel Neves', 2, '(11) 9 8141-08', '/alunos/aluno-18.svg'),
  (19, 'NX-019', 'Valentina Reis', 2, '(11) 9 8142-09', '/alunos/aluno-19.svg'),
  (20, 'NX-020', 'Lucas Farias', 2, '(11) 9 8143-010', '/alunos/aluno-20.svg'),
  (21, 'NX-021', 'Alice Monteiro', 3, '(11) 9 8148-01', '/alunos/aluno-21.svg'),
  (22, 'NX-022', 'Davi Barros', 3, '(11) 9 8149-02', '/alunos/aluno-22.svg'),
  (23, 'NX-023', 'Marina Vieira', 3, '(11) 9 8150-03', '/alunos/aluno-23.svg'),
  (24, 'NX-024', 'Nicolas Campos', 3, '(11) 9 8151-04', '/alunos/aluno-24.svg'),
  (25, 'NX-025', 'Ana Luiza Ramos', 3, '(11) 9 8152-05', '/alunos/aluno-25.svg'),
  (26, 'NX-026', 'Gustavo Diniz', 3, '(11) 9 8153-06', '/alunos/aluno-26.svg'),
  (27, 'NX-027', 'Eloá Ferreira', 3, '(11) 9 8154-07', '/alunos/aluno-27.svg'),
  (28, 'NX-028', 'Matheus Dias', 3, '(11) 9 8155-08', '/alunos/aluno-28.svg'),
  (29, 'NX-029', 'Cecília Nunes', 3, '(11) 9 8156-09', '/alunos/aluno-29.svg'),
  (30, 'NX-030', 'Bernardo Sales', 3, '(11) 9 8157-010', '/alunos/aluno-30.svg'),
  (31, 'NX-031', 'Lorena Braga', 4, '(11) 9 8162-01', '/alunos/aluno-31.svg'),
  (32, 'NX-032', 'Samuel Teixeira', 4, '(11) 9 8163-02', '/alunos/aluno-32.svg'),
  (33, 'NX-033', 'Maitê Moraes', 4, '(11) 9 8164-03', '/alunos/aluno-33.svg'),
  (34, 'NX-034', 'Heitor Viana', 4, '(11) 9 8165-04', '/alunos/aluno-34.svg'),
  (35, 'NX-035', 'Heloísa Paiva', 4, '(11) 9 8166-05', '/alunos/aluno-35.svg'),
  (36, 'NX-036', 'Pedro Henrique Silva', 4, '(11) 9 8167-06', '/alunos/aluno-36.svg'),
  (37, 'NX-037', 'Agatha Lopes', 4, '(11) 9 8168-07', '/alunos/aluno-37.svg'),
  (38, 'NX-038', 'Murilo Rezende', 4, '(11) 9 8169-08', '/alunos/aluno-38.svg'),
  (39, 'NX-039', 'Isabelly Pinto', 4, '(11) 9 8170-09', '/alunos/aluno-39.svg'),
  (40, 'NX-040', 'Eduardo César', 4, '(11) 9 8171-010', '/alunos/aluno-40.svg');

INSERT INTO aluno_responsaveis (aluno_id, responsavel_id, principal) VALUES
  (1, 1, 1),
  (2, 2, 1),
  (3, 3, 1),
  (4, 4, 1),
  (5, 1, 1),
  (6, 2, 1),
  (7, 3, 1),
  (8, 4, 1),
  (9, 1, 1),
  (10, 2, 1),
  (11, 1, 1),
  (12, 2, 1),
  (13, 3, 1),
  (14, 4, 1),
  (15, 1, 1),
  (16, 2, 1),
  (17, 3, 1),
  (18, 4, 1),
  (19, 1, 1),
  (20, 2, 1),
  (21, 1, 1),
  (22, 2, 1),
  (23, 3, 1),
  (24, 4, 1),
  (25, 1, 1),
  (26, 2, 1),
  (27, 3, 1),
  (28, 4, 1),
  (29, 1, 1),
  (30, 2, 1),
  (31, 1, 1),
  (32, 2, 1),
  (33, 3, 1),
  (34, 4, 1),
  (35, 1, 1),
  (36, 2, 1),
  (37, 3, 1),
  (38, 4, 1),
  (39, 1, 1),
  (40, 2, 1);

-- Presença do dia 23/10/2026 (estado inicial do carômetro)
INSERT INTO presencas (aluno_id, data_aula, situacao, registrado_por) VALUES
  (1, '2026-10-23', 'ausente', 1),
  (2, '2026-10-23', 'presente', 1),
  (3, '2026-10-23', 'presente', 1),
  (4, '2026-10-23', 'presente', 1),
  (5, '2026-10-23', 'presente', 1),
  (6, '2026-10-23', 'ausente', 1),
  (7, '2026-10-23', 'presente', 1),
  (8, '2026-10-23', 'presente', 1),
  (9, '2026-10-23', 'presente', 1),
  (10, '2026-10-23', 'presente', 1),
  (11, '2026-10-23', 'presente', 1),
  (12, '2026-10-23', 'presente', 1),
  (13, '2026-10-23', 'presente', 1),
  (14, '2026-10-23', 'presente', 1),
  (15, '2026-10-23', 'ausente', 1),
  (16, '2026-10-23', 'presente', 1),
  (17, '2026-10-23', 'presente', 1),
  (18, '2026-10-23', 'presente', 1),
  (19, '2026-10-23', 'presente', 1),
  (20, '2026-10-23', 'ausente', 1),
  (21, '2026-10-23', 'presente', 1),
  (22, '2026-10-23', 'presente', 1),
  (23, '2026-10-23', 'presente', 1),
  (24, '2026-10-23', 'ausente', 1),
  (25, '2026-10-23', 'presente', 1),
  (26, '2026-10-23', 'presente', 1),
  (27, '2026-10-23', 'presente', 1),
  (28, '2026-10-23', 'presente', 1),
  (29, '2026-10-23', 'ausente', 1),
  (30, '2026-10-23', 'presente', 1),
  (31, '2026-10-23', 'presente', 1),
  (32, '2026-10-23', 'presente', 1),
  (33, '2026-10-23', 'ausente', 1),
  (34, '2026-10-23', 'presente', 1),
  (35, '2026-10-23', 'presente', 1),
  (36, '2026-10-23', 'presente', 1),
  (37, '2026-10-23', 'presente', 1),
  (38, '2026-10-23', 'ausente', 1),
  (39, '2026-10-23', 'presente', 1),
  (40, '2026-10-23', 'presente', 1);

-- Boletim: 1º a 3º bimestre lançados; 4º em andamento (sem notas)
INSERT INTO notas (aluno_id, disciplina_id, bimestre_id, nota, faltas, lancado_por) VALUES
  (1, 1, 1, 8.0, 2, 1),
  (1, 1, 2, 7.5, 2, 1),
  (1, 1, 3, 6.5, 2, 1),
  (1, 2, 1, 8.5, 2, 1),
  (1, 2, 2, 8.0, 1, 1),
  (1, 2, 3, 8.5, 1, 1),
  (1, 3, 1, 6.5, 0, 1),
  (1, 3, 2, 6.5, 0, 1),
  (1, 3, 3, 6.5, 0, 1),
  (1, 4, 1, 6.5, 2, 1),
  (1, 4, 2, 7.5, 2, 1),
  (1, 4, 3, 6.0, 2, 1),
  (1, 5, 1, 8.0, 2, 1),
  (1, 5, 2, 7.5, 2, 1),
  (1, 5, 3, 9.0, 2, 1),
  (1, 6, 1, 7.5, 1, 1),
  (1, 6, 2, 7.0, 0, 1),
  (1, 6, 3, 7.5, 0, 1),
  (2, 1, 1, 5.5, 1, 1),
  (2, 1, 2, 6.5, 1, 1),
  (2, 1, 3, 5.5, 1, 1),
  (2, 2, 1, 7.0, 2, 1),
  (2, 2, 2, 7.0, 1, 1),
  (2, 2, 3, 6.5, 1, 1),
  (2, 3, 1, 7.5, 1, 1),
  (2, 3, 2, 8.5, 1, 1),
  (2, 3, 3, 8.0, 1, 1),
  (2, 4, 1, 8.0, 0, 1),
  (2, 4, 2, 8.0, 0, 1),
  (2, 4, 3, 8.0, 0, 1),
  (2, 5, 1, 5.5, 1, 1),
  (2, 5, 2, 6.5, 0, 1),
  (2, 5, 3, 5.5, 0, 1),
  (2, 6, 1, 5.5, 1, 1),
  (2, 6, 2, 6.0, 1, 1),
  (2, 6, 3, 6.0, 0, 1),
  (3, 1, 1, 7.0, 2, 1),
  (3, 1, 2, 7.5, 2, 1),
  (3, 1, 3, 6.5, 2, 1),
  (3, 2, 1, 5.5, 2, 1),
  (3, 2, 2, 6.0, 2, 1),
  (3, 2, 3, 7.0, 1, 1),
  (3, 3, 1, 6.0, 2, 1),
  (3, 3, 2, 6.0, 2, 1),
  (3, 3, 3, 5.0, 2, 1),
  (3, 4, 1, 7.5, 1, 1),
  (3, 4, 2, 6.0, 1, 1),
  (3, 4, 3, 6.0, 0, 1),
  (3, 5, 1, 7.0, 1, 1),
  (3, 5, 2, 7.5, 1, 1),
  (3, 5, 3, 6.5, 0, 1),
  (3, 6, 1, 6.0, 1, 1),
  (3, 6, 2, 7.0, 1, 1),
  (3, 6, 3, 6.5, 1, 1),
  (4, 1, 1, 6.0, 1, 1),
  (4, 1, 2, 6.0, 1, 1),
  (4, 1, 3, 5.5, 1, 1),
  (4, 2, 1, 4.5, 2, 1),
  (4, 2, 2, 5.0, 2, 1),
  (4, 2, 3, 5.0, 1, 1),
  (4, 3, 1, 7.0, 1, 1),
  (4, 3, 2, 6.5, 1, 1),
  (4, 3, 3, 6.0, 0, 1),
  (4, 4, 1, 4.5, 1, 1),
  (4, 4, 2, 6.0, 1, 1),
  (4, 4, 3, 6.0, 1, 1),
  (4, 5, 1, 4.5, 1, 1),
  (4, 5, 2, 4.5, 1, 1),
  (4, 5, 3, 5.5, 1, 1),
  (4, 6, 1, 6.0, 2, 1),
  (4, 6, 2, 6.0, 1, 1),
  (4, 6, 3, 5.0, 1, 1),
  (5, 1, 1, 9.5, 0, 1),
  (5, 1, 2, 9.0, 0, 1),
  (5, 1, 3, 9.0, 0, 1),
  (5, 2, 1, 9.0, 2, 1),
  (5, 2, 2, 8.0, 2, 1),
  (5, 2, 3, 7.5, 1, 1),
  (5, 3, 1, 10.0, 2, 1),
  (5, 3, 2, 8.0, 2, 1),
  (5, 3, 3, 9.5, 1, 1),
  (5, 4, 1, 8.5, 2, 1),
  (5, 4, 2, 8.5, 1, 1),
  (5, 4, 3, 8.5, 1, 1),
  (5, 5, 1, 10.0, 2, 1),
  (5, 5, 2, 10.0, 1, 1),
  (5, 5, 3, 10.0, 1, 1),
  (5, 6, 1, 10.0, 2, 1),
  (5, 6, 2, 9.5, 2, 1),
  (5, 6, 3, 10.0, 2, 1),
  (6, 1, 1, 7.0, 1, 1),
  (6, 1, 2, 8.0, 1, 1),
  (6, 1, 3, 8.0, 1, 1),
  (6, 2, 1, 7.5, 2, 1),
  (6, 2, 2, 7.0, 2, 1),
  (6, 2, 3, 7.5, 1, 1),
  (6, 3, 1, 8.0, 1, 1),
  (6, 3, 2, 8.0, 0, 1),
  (6, 3, 3, 8.0, 0, 1),
  (6, 4, 1, 7.5, 2, 1),
  (6, 4, 2, 8.5, 2, 1),
  (6, 4, 3, 8.0, 2, 1),
  (6, 5, 1, 8.0, 2, 1),
  (6, 5, 2, 8.5, 2, 1),
  (6, 5, 3, 7.5, 1, 1),
  (6, 6, 1, 8.5, 0, 1),
  (6, 6, 2, 8.0, 0, 1),
  (6, 6, 3, 9.0, 0, 1),
  (7, 1, 1, 6.0, 0, 1),
  (7, 1, 2, 6.5, 0, 1),
  (7, 1, 3, 6.5, 0, 1),
  (7, 2, 1, 8.5, 2, 1),
  (7, 2, 2, 8.5, 2, 1),
  (7, 2, 3, 8.0, 1, 1),
  (7, 3, 1, 7.0, 2, 1),
  (7, 3, 2, 8.0, 1, 1),
  (7, 3, 3, 7.5, 1, 1),
  (7, 4, 1, 7.0, 0, 1),
  (7, 4, 2, 7.0, 0, 1),
  (7, 4, 3, 6.0, 0, 1),
  (7, 5, 1, 9.5, 2, 1),
  (7, 5, 2, 8.0, 2, 1),
  (7, 5, 3, 8.5, 2, 1),
  (7, 6, 1, 6.5, 1, 1),
  (7, 6, 2, 7.0, 0, 1),
  (7, 6, 3, 7.0, 0, 1),
  (8, 1, 1, 8.0, 2, 1),
  (8, 1, 2, 7.5, 1, 1),
  (8, 1, 3, 8.0, 1, 1),
  (8, 2, 1, 7.5, 2, 1),
  (8, 2, 2, 7.5, 2, 1),
  (8, 2, 3, 8.0, 1, 1),
  (8, 3, 1, 5.5, 0, 1),
  (8, 3, 2, 5.5, 0, 1),
  (8, 3, 3, 6.5, 0, 1),
  (8, 4, 1, 6.0, 1, 1),
  (8, 4, 2, 5.0, 0, 1),
  (8, 4, 3, 6.0, 0, 1),
  (8, 5, 1, 7.0, 0, 1),
  (8, 5, 2, 6.5, 0, 1),
  (8, 5, 3, 7.5, 0, 1),
  (8, 6, 1, 7.0, 1, 1),
  (8, 6, 2, 8.0, 1, 1),
  (8, 6, 3, 8.0, 1, 1),
  (9, 1, 1, 7.0, 0, 1),
  (9, 1, 2, 6.5, 0, 1),
  (9, 1, 3, 7.0, 0, 1),
  (9, 2, 1, 6.0, 2, 1),
  (9, 2, 2, 6.0, 2, 1),
  (9, 2, 3, 6.5, 1, 1),
  (9, 3, 1, 6.5, 1, 1),
  (9, 3, 2, 7.5, 1, 1),
  (9, 3, 3, 7.5, 1, 1),
  (9, 4, 1, 8.0, 1, 1),
  (9, 4, 2, 7.5, 1, 1),
  (9, 4, 3, 6.5, 0, 1),
  (9, 5, 1, 6.5, 1, 1),
  (9, 5, 2, 8.0, 0, 1),
  (9, 5, 3, 8.5, 0, 1),
  (9, 6, 1, 5.0, 2, 1),
  (9, 6, 2, 7.0, 1, 1),
  (9, 6, 3, 6.5, 1, 1),
  (10, 1, 1, 6.5, 2, 1),
  (10, 1, 2, 5.0, 1, 1),
  (10, 1, 3, 6.0, 1, 1),
  (10, 2, 1, 6.5, 2, 1),
  (10, 2, 2, 5.0, 2, 1),
  (10, 2, 3, 4.5, 1, 1),
  (10, 3, 1, 5.0, 0, 1),
  (10, 3, 2, 5.5, 0, 1),
  (10, 3, 3, 4.5, 0, 1),
  (10, 4, 1, 5.0, 2, 1),
  (10, 4, 2, 5.5, 1, 1),
  (10, 4, 3, 6.5, 1, 1),
  (10, 5, 1, 6.0, 1, 1),
  (10, 5, 2, 4.5, 1, 1),
  (10, 5, 3, 5.0, 1, 1),
  (10, 6, 1, 5.0, 2, 1),
  (10, 6, 2, 3.5, 2, 1),
  (10, 6, 3, 5.0, 1, 1),
  (11, 1, 1, 8.0, 1, 1),
  (11, 1, 2, 8.0, 0, 1),
  (11, 1, 3, 9.0, 0, 1),
  (11, 2, 1, 9.5, 2, 1),
  (11, 2, 2, 8.5, 2, 1),
  (11, 2, 3, 9.0, 1, 1),
  (11, 3, 1, 10.0, 1, 1),
  (11, 3, 2, 10.0, 1, 1),
  (11, 3, 3, 10.0, 1, 1),
  (11, 4, 1, 9.0, 2, 1),
  (11, 4, 2, 10.0, 2, 1),
  (11, 4, 3, 8.5, 1, 1),
  (11, 5, 1, 7.5, 2, 1),
  (11, 5, 2, 8.0, 1, 1),
  (11, 5, 3, 8.0, 1, 1),
  (11, 6, 1, 10.0, 0, 1),
  (11, 6, 2, 9.0, 0, 1),
  (11, 6, 3, 10.0, 0, 1),
  (12, 1, 1, 7.0, 2, 1),
  (12, 1, 2, 7.0, 2, 1),
  (12, 1, 3, 8.0, 1, 1),
  (12, 2, 1, 8.0, 2, 1),
  (12, 2, 2, 7.5, 2, 1),
  (12, 2, 3, 7.0, 2, 1),
  (12, 3, 1, 8.5, 2, 1),
  (12, 3, 2, 9.5, 2, 1),
  (12, 3, 3, 9.0, 2, 1),
  (12, 4, 1, 8.0, 2, 1),
  (12, 4, 2, 8.0, 2, 1),
  (12, 4, 3, 8.5, 2, 1),
  (12, 5, 1, 9.5, 2, 1),
  (12, 5, 2, 9.0, 2, 1),
  (12, 5, 3, 9.0, 1, 1),
  (12, 6, 1, 8.0, 1, 1),
  (12, 6, 2, 8.0, 0, 1),
  (12, 6, 3, 8.5, 0, 1),
  (13, 1, 1, 8.5, 1, 1),
  (13, 1, 2, 8.0, 0, 1),
  (13, 1, 3, 9.5, 0, 1),
  (13, 2, 1, 6.5, 2, 1),
  (13, 2, 2, 6.0, 2, 1),
  (13, 2, 3, 7.0, 2, 1),
  (13, 3, 1, 7.0, 1, 1),
  (13, 3, 2, 7.0, 1, 1),
  (13, 3, 3, 6.0, 0, 1),
  (13, 4, 1, 7.5, 1, 1),
  (13, 4, 2, 8.0, 0, 1),
  (13, 4, 3, 6.5, 0, 1),
  (13, 5, 1, 6.5, 2, 1),
  (13, 5, 2, 6.0, 2, 1),
  (13, 5, 3, 6.0, 2, 1),
  (13, 6, 1, 8.5, 1, 1),
  (13, 6, 2, 9.0, 1, 1),
  (13, 6, 3, 9.5, 0, 1),
  (14, 1, 1, 8.0, 2, 1),
  (14, 1, 2, 6.5, 2, 1),
  (14, 1, 3, 8.5, 1, 1),
  (14, 2, 1, 7.5, 2, 1),
  (14, 2, 2, 7.5, 2, 1),
  (14, 2, 3, 7.5, 2, 1),
  (14, 3, 1, 8.0, 2, 1),
  (14, 3, 2, 7.0, 2, 1),
  (14, 3, 3, 7.0, 1, 1),
  (14, 4, 1, 6.5, 1, 1),
  (14, 4, 2, 6.5, 1, 1),
  (14, 4, 3, 6.5, 0, 1),
  (14, 5, 1, 6.5, 0, 1),
  (14, 5, 2, 7.0, 0, 1),
  (14, 5, 3, 7.0, 0, 1),
  (14, 6, 1, 6.5, 2, 1),
  (14, 6, 2, 8.0, 1, 1),
  (14, 6, 3, 8.0, 1, 1),
  (15, 1, 1, 7.0, 1, 1),
  (15, 1, 2, 5.0, 1, 1),
  (15, 1, 3, 5.0, 0, 1),
  (15, 2, 1, 6.0, 2, 1),
  (15, 2, 2, 6.5, 2, 1),
  (15, 2, 3, 8.0, 2, 1),
  (15, 3, 1, 6.5, 1, 1),
  (15, 3, 2, 5.0, 0, 1),
  (15, 3, 3, 6.0, 0, 1),
  (15, 4, 1, 6.0, 1, 1),
  (15, 4, 2, 4.5, 1, 1),
  (15, 4, 3, 4.0, 1, 1),
  (15, 5, 1, 5.5, 1, 1),
  (15, 5, 2, 6.0, 0, 1),
  (15, 5, 3, 5.5, 0, 1),
  (15, 6, 1, 4.5, 2, 1),
  (15, 6, 2, 4.5, 2, 1),
  (15, 6, 3, 4.5, 1, 1),
  (16, 1, 1, 4.5, 2, 1),
  (16, 1, 2, 6.0, 2, 1),
  (16, 1, 3, 4.0, 1, 1),
  (16, 2, 1, 6.5, 2, 1),
  (16, 2, 2, 5.5, 2, 1),
  (16, 2, 3, 6.0, 2, 1),
  (16, 3, 1, 5.5, 2, 1),
  (16, 3, 2, 7.0, 1, 1),
  (16, 3, 3, 7.5, 1, 1),
  (16, 4, 1, 5.5, 2, 1),
  (16, 4, 2, 7.0, 1, 1),
  (16, 4, 3, 6.5, 1, 1),
  (16, 5, 1, 5.5, 1, 1),
  (16, 5, 2, 5.0, 1, 1),
  (16, 5, 3, 7.0, 0, 1),
  (16, 6, 1, 7.0, 2, 1),
  (16, 6, 2, 6.0, 2, 1),
  (16, 6, 3, 5.0, 2, 1),
  (17, 1, 1, 8.0, 1, 1),
  (17, 1, 2, 9.0, 1, 1),
  (17, 1, 3, 7.5, 0, 1),
  (17, 2, 1, 9.5, 2, 1),
  (17, 2, 2, 8.5, 2, 1),
  (17, 2, 3, 8.5, 2, 1),
  (17, 3, 1, 8.5, 0, 1),
  (17, 3, 2, 9.0, 0, 1),
  (17, 3, 3, 8.5, 0, 1),
  (17, 4, 1, 9.5, 2, 1),
  (17, 4, 2, 9.5, 2, 1),
  (17, 4, 3, 8.5, 2, 1),
  (17, 5, 1, 9.0, 1, 1),
  (17, 5, 2, 8.0, 1, 1),
  (17, 5, 3, 8.0, 1, 1),
  (17, 6, 1, 9.0, 1, 1),
  (17, 6, 2, 9.0, 0, 1),
  (17, 6, 3, 8.0, 0, 1),
  (18, 1, 1, 9.5, 2, 1),
  (18, 1, 2, 10.0, 2, 1),
  (18, 1, 3, 8.5, 2, 1),
  (18, 2, 1, 8.0, 2, 1),
  (18, 2, 2, 7.5, 2, 1),
  (18, 2, 3, 8.5, 2, 1),
  (18, 3, 1, 9.0, 1, 1),
  (18, 3, 2, 9.0, 1, 1),
  (18, 3, 3, 9.5, 1, 1),
  (18, 4, 1, 8.5, 0, 1),
  (18, 4, 2, 9.5, 0, 1),
  (18, 4, 3, 8.5, 0, 1),
  (18, 5, 1, 9.0, 2, 1),
  (18, 5, 2, 9.5, 1, 1),
  (18, 5, 3, 9.0, 1, 1),
  (18, 6, 1, 9.5, 1, 1),
  (18, 6, 2, 10.0, 1, 1),
  (18, 6, 3, 9.0, 0, 1),
  (19, 1, 1, 9.0, 1, 1),
  (19, 1, 2, 8.5, 1, 1),
  (19, 1, 3, 7.5, 0, 1),
  (19, 2, 1, 6.5, 2, 1),
  (19, 2, 2, 6.5, 2, 1),
  (19, 2, 3, 6.5, 2, 1),
  (19, 3, 1, 7.5, 2, 1),
  (19, 3, 2, 8.5, 2, 1),
  (19, 3, 3, 8.5, 2, 1),
  (19, 4, 1, 8.0, 1, 1),
  (19, 4, 2, 7.5, 0, 1),
  (19, 4, 3, 6.5, 0, 1),
  (19, 5, 1, 6.0, 2, 1),
  (19, 5, 2, 6.5, 2, 1),
  (19, 5, 3, 7.5, 2, 1),
  (19, 6, 1, 7.5, 1, 1),
  (19, 6, 2, 7.0, 1, 1),
  (19, 6, 3, 7.5, 1, 1),
  (20, 1, 1, 6.0, 2, 1),
  (20, 1, 2, 7.5, 2, 1),
  (20, 1, 3, 6.5, 2, 1),
  (20, 2, 1, 5.0, 2, 1),
  (20, 2, 2, 5.5, 2, 1),
  (20, 2, 3, 7.0, 2, 1),
  (20, 3, 1, 6.0, 1, 1),
  (20, 3, 2, 6.5, 1, 1),
  (20, 3, 3, 5.5, 1, 1),
  (20, 4, 1, 7.0, 1, 1),
  (20, 4, 2, 5.5, 1, 1),
  (20, 4, 3, 6.5, 0, 1),
  (20, 5, 1, 8.0, 0, 1),
  (20, 5, 2, 7.5, 0, 1),
  (20, 5, 3, 6.5, 0, 1),
  (20, 6, 1, 5.5, 2, 1),
  (20, 6, 2, 6.0, 2, 1),
  (20, 6, 3, 5.5, 1, 1),
  (21, 1, 1, 5.0, 1, 1),
  (21, 1, 2, 6.0, 1, 1),
  (21, 1, 3, 5.5, 1, 1),
  (21, 2, 1, 8.0, 2, 1),
  (21, 2, 2, 6.5, 2, 1),
  (21, 2, 3, 7.5, 2, 1),
  (21, 3, 1, 7.0, 2, 1),
  (21, 3, 2, 6.5, 2, 1),
  (21, 3, 3, 7.0, 2, 1),
  (21, 4, 1, 6.5, 2, 1),
  (21, 4, 2, 5.5, 1, 1),
  (21, 4, 3, 6.5, 1, 1),
  (21, 5, 1, 5.0, 1, 1),
  (21, 5, 2, 6.5, 0, 1),
  (21, 5, 3, 5.5, 0, 1),
  (21, 6, 1, 6.0, 2, 1),
  (21, 6, 2, 7.0, 2, 1),
  (21, 6, 3, 6.5, 2, 1),
  (22, 1, 1, 4.5, 0, 1),
  (22, 1, 2, 5.0, 0, 1),
  (22, 1, 3, 4.5, 0, 1),
  (22, 2, 1, 6.5, 0, 1),
  (22, 2, 2, 5.5, 0, 1),
  (22, 2, 3, 5.5, 0, 1),
  (22, 3, 1, 5.5, 1, 1),
  (22, 3, 2, 6.0, 1, 1),
  (22, 3, 3, 5.5, 0, 1),
  (22, 4, 1, 4.0, 2, 1),
  (22, 4, 2, 4.0, 2, 1),
  (22, 4, 3, 4.5, 1, 1),
  (22, 5, 1, 7.0, 1, 1),
  (22, 5, 2, 5.5, 1, 1),
  (22, 5, 3, 6.5, 0, 1),
  (22, 6, 1, 6.0, 0, 1),
  (22, 6, 2, 5.5, 0, 1),
  (22, 6, 3, 5.0, 0, 1),
  (23, 1, 1, 10.0, 1, 1),
  (23, 1, 2, 10.0, 1, 1),
  (23, 1, 3, 10.0, 1, 1),
  (23, 2, 1, 9.5, 0, 1),
  (23, 2, 2, 9.0, 0, 1),
  (23, 2, 3, 10.0, 0, 1),
  (23, 3, 1, 10.0, 2, 1),
  (23, 3, 2, 10.0, 2, 1),
  (23, 3, 3, 9.0, 1, 1),
  (23, 4, 1, 10.0, 2, 1),
  (23, 4, 2, 10.0, 2, 1),
  (23, 4, 3, 10.0, 2, 1),
  (23, 5, 1, 8.5, 1, 1),
  (23, 5, 2, 8.5, 1, 1),
  (23, 5, 3, 9.5, 1, 1),
  (23, 6, 1, 8.5, 1, 1),
  (23, 6, 2, 9.0, 1, 1),
  (23, 6, 3, 8.0, 0, 1),
  (24, 1, 1, 9.5, 0, 1),
  (24, 1, 2, 9.0, 0, 1),
  (24, 1, 3, 9.0, 0, 1),
  (24, 2, 1, 8.0, 0, 1),
  (24, 2, 2, 8.0, 0, 1),
  (24, 2, 3, 8.0, 0, 1),
  (24, 3, 1, 9.0, 1, 1),
  (24, 3, 2, 8.0, 0, 1),
  (24, 3, 3, 8.0, 0, 1),
  (24, 4, 1, 9.0, 1, 1),
  (24, 4, 2, 9.0, 0, 1),
  (24, 4, 3, 9.0, 0, 1),
  (24, 5, 1, 10.0, 2, 1),
  (24, 5, 2, 10.0, 1, 1),
  (24, 5, 3, 8.5, 1, 1),
  (24, 6, 1, 9.0, 1, 1),
  (24, 6, 2, 8.0, 1, 1),
  (24, 6, 3, 8.5, 1, 1),
  (25, 1, 1, 7.0, 2, 1),
  (25, 1, 2, 7.5, 1, 1),
  (25, 1, 3, 8.0, 1, 1),
  (25, 2, 1, 6.5, 0, 1),
  (25, 2, 2, 6.5, 0, 1),
  (25, 2, 3, 8.0, 0, 1),
  (25, 3, 1, 8.0, 2, 1),
  (25, 3, 2, 8.0, 1, 1),
  (25, 3, 3, 9.5, 1, 1),
  (25, 4, 1, 8.5, 1, 1),
  (25, 4, 2, 9.0, 1, 1),
  (25, 4, 3, 9.0, 0, 1),
  (25, 5, 1, 7.5, 2, 1),
  (25, 5, 2, 6.5, 2, 1),
  (25, 5, 3, 7.5, 1, 1),
  (25, 6, 1, 7.0, 2, 1),
  (25, 6, 2, 7.0, 1, 1),
  (25, 6, 3, 7.0, 1, 1),
  (26, 1, 1, 6.0, 0, 1),
  (26, 1, 2, 6.5, 0, 1),
  (26, 1, 3, 7.0, 0, 1),
  (26, 2, 1, 7.0, 0, 1),
  (26, 2, 2, 5.5, 0, 1),
  (26, 2, 3, 6.5, 0, 1),
  (26, 3, 1, 6.5, 0, 1),
  (26, 3, 2, 8.0, 0, 1),
  (26, 3, 3, 6.5, 0, 1),
  (26, 4, 1, 7.5, 1, 1),
  (26, 4, 2, 7.0, 1, 1),
  (26, 4, 3, 6.5, 1, 1),
  (26, 5, 1, 7.5, 2, 1),
  (26, 5, 2, 8.0, 2, 1),
  (26, 5, 3, 8.5, 2, 1),
  (26, 6, 1, 7.5, 2, 1),
  (26, 6, 2, 8.0, 2, 1),
  (26, 6, 3, 8.0, 2, 1),
  (27, 1, 1, 5.5, 2, 1),
  (27, 1, 2, 5.0, 1, 1),
  (27, 1, 3, 6.0, 1, 1),
  (27, 2, 1, 6.0, 0, 1),
  (27, 2, 2, 4.5, 0, 1),
  (27, 2, 3, 6.5, 0, 1),
  (27, 3, 1, 5.0, 1, 1),
  (27, 3, 2, 5.5, 1, 1),
  (27, 3, 3, 5.0, 1, 1),
  (27, 4, 1, 5.0, 2, 1),
  (27, 4, 2, 5.0, 1, 1),
  (27, 4, 3, 6.5, 1, 1),
  (27, 5, 1, 6.5, 1, 1),
  (27, 5, 2, 6.5, 0, 1),
  (27, 5, 3, 7.0, 0, 1),
  (27, 6, 1, 7.5, 0, 1),
  (27, 6, 2, 6.5, 0, 1),
  (27, 6, 3, 6.5, 0, 1),
  (28, 1, 1, 7.0, 1, 1),
  (28, 1, 2, 6.0, 0, 1),
  (28, 1, 3, 7.0, 0, 1),
  (28, 2, 1, 7.0, 0, 1),
  (28, 2, 2, 6.0, 0, 1),
  (28, 2, 3, 7.0, 0, 1),
  (28, 3, 1, 6.0, 2, 1),
  (28, 3, 2, 5.5, 2, 1),
  (28, 3, 3, 6.5, 2, 1),
  (28, 4, 1, 4.5, 2, 1),
  (28, 4, 2, 5.0, 2, 1),
  (28, 4, 3, 4.5, 2, 1),
  (28, 5, 1, 6.5, 1, 1),
  (28, 5, 2, 6.0, 1, 1),
  (28, 5, 3, 6.0, 0, 1),
  (28, 6, 1, 5.5, 1, 1),
  (28, 6, 2, 5.5, 0, 1),
  (28, 6, 3, 5.0, 0, 1),
  (29, 1, 1, 10.0, 2, 1),
  (29, 1, 2, 9.0, 2, 1),
  (29, 1, 3, 10.0, 1, 1),
  (29, 2, 1, 9.5, 0, 1),
  (29, 2, 2, 9.0, 0, 1),
  (29, 2, 3, 9.5, 0, 1),
  (29, 3, 1, 9.0, 1, 1),
  (29, 3, 2, 9.5, 1, 1),
  (29, 3, 3, 9.5, 0, 1),
  (29, 4, 1, 8.0, 0, 1),
  (29, 4, 2, 7.5, 0, 1),
  (29, 4, 3, 9.0, 0, 1),
  (29, 5, 1, 10.0, 1, 1),
  (29, 5, 2, 9.0, 1, 1),
  (29, 5, 3, 9.0, 1, 1),
  (29, 6, 1, 10.0, 1, 1),
  (29, 6, 2, 9.0, 1, 1),
  (29, 6, 3, 10.0, 1, 1),
  (30, 1, 1, 8.0, 1, 1),
  (30, 1, 2, 8.0, 0, 1),
  (30, 1, 3, 9.5, 0, 1),
  (30, 2, 1, 8.0, 0, 1),
  (30, 2, 2, 10.0, 0, 1),
  (30, 2, 3, 9.5, 0, 1),
  (30, 3, 1, 9.5, 2, 1),
  (30, 3, 2, 9.5, 2, 1),
  (30, 3, 3, 9.0, 2, 1),
  (30, 4, 1, 9.5, 1, 1),
  (30, 4, 2, 10.0, 0, 1),
  (30, 4, 3, 9.0, 0, 1),
  (30, 5, 1, 7.5, 2, 1),
  (30, 5, 2, 8.0, 1, 1),
  (30, 5, 3, 8.0, 1, 1),
  (30, 6, 1, 8.0, 2, 1),
  (30, 6, 2, 8.0, 1, 1),
  (30, 6, 3, 8.5, 1, 1),
  (31, 1, 1, 7.0, 2, 1),
  (31, 1, 2, 6.5, 2, 1),
  (31, 1, 3, 6.0, 1, 1),
  (31, 2, 1, 9.0, 1, 1),
  (31, 2, 2, 9.0, 0, 1),
  (31, 2, 3, 7.5, 0, 1),
  (31, 3, 1, 8.0, 1, 1),
  (31, 3, 2, 7.5, 1, 1),
  (31, 3, 3, 8.0, 0, 1),
  (31, 4, 1, 9.0, 1, 1),
  (31, 4, 2, 8.5, 1, 1),
  (31, 4, 3, 9.0, 1, 1),
  (31, 5, 1, 7.0, 2, 1),
  (31, 5, 2, 7.0, 2, 1),
  (31, 5, 3, 7.0, 1, 1),
  (31, 6, 1, 8.5, 2, 1),
  (31, 6, 2, 9.0, 2, 1),
  (31, 6, 3, 9.5, 1, 1),
  (32, 1, 1, 6.0, 1, 1),
  (32, 1, 2, 5.0, 1, 1),
  (32, 1, 3, 5.0, 0, 1),
  (32, 2, 1, 7.5, 1, 1),
  (32, 2, 2, 8.0, 0, 1),
  (32, 2, 3, 8.0, 0, 1),
  (32, 3, 1, 6.5, 2, 1),
  (32, 3, 2, 7.0, 2, 1),
  (32, 3, 3, 6.5, 1, 1),
  (32, 4, 1, 8.0, 2, 1),
  (32, 4, 2, 6.5, 1, 1),
  (32, 4, 3, 7.0, 1, 1),
  (32, 5, 1, 6.5, 2, 1),
  (32, 5, 2, 6.0, 2, 1),
  (32, 5, 3, 5.5, 2, 1),
  (32, 6, 1, 6.5, 0, 1),
  (32, 6, 2, 8.0, 0, 1),
  (32, 6, 3, 8.0, 0, 1),
  (33, 1, 1, 8.0, 2, 1),
  (33, 1, 2, 6.5, 2, 1),
  (33, 1, 3, 6.5, 1, 1),
  (33, 2, 1, 6.0, 1, 1),
  (33, 2, 2, 7.0, 0, 1),
  (33, 2, 3, 6.0, 0, 1),
  (33, 3, 1, 7.5, 1, 1),
  (33, 3, 2, 7.0, 0, 1),
  (33, 3, 3, 6.0, 0, 1),
  (33, 4, 1, 5.5, 2, 1),
  (33, 4, 2, 6.5, 2, 1),
  (33, 4, 3, 7.0, 1, 1),
  (33, 5, 1, 6.0, 0, 1),
  (33, 5, 2, 7.0, 0, 1),
  (33, 5, 3, 7.0, 0, 1),
  (33, 6, 1, 6.5, 1, 1),
  (33, 6, 2, 6.5, 0, 1),
  (33, 6, 3, 6.5, 0, 1),
  (34, 1, 1, 5.0, 1, 1),
  (34, 1, 2, 7.0, 1, 1),
  (34, 1, 3, 5.5, 0, 1),
  (34, 2, 1, 4.5, 1, 1),
  (34, 2, 2, 6.0, 0, 1),
  (34, 2, 3, 4.0, 0, 1),
  (34, 3, 1, 4.0, 2, 1),
  (34, 3, 2, 4.5, 1, 1),
  (34, 3, 3, 5.0, 1, 1),
  (34, 4, 1, 5.0, 2, 1),
  (34, 4, 2, 4.5, 2, 1),
  (34, 4, 3, 5.0, 2, 1),
  (34, 5, 1, 5.5, 1, 1),
  (34, 5, 2, 4.0, 0, 1),
  (34, 5, 3, 5.5, 0, 1),
  (34, 6, 1, 7.0, 1, 1),
  (34, 6, 2, 5.5, 1, 1),
  (34, 6, 3, 7.0, 0, 1),
  (35, 1, 1, 8.5, 2, 1),
  (35, 1, 2, 10.0, 2, 1),
  (35, 1, 3, 8.5, 2, 1),
  (35, 2, 1, 7.5, 1, 1),
  (35, 2, 2, 9.0, 0, 1),
  (35, 2, 3, 8.5, 0, 1),
  (35, 3, 1, 9.0, 0, 1),
  (35, 3, 2, 9.0, 0, 1),
  (35, 3, 3, 10.0, 0, 1),
  (35, 4, 1, 8.5, 1, 1),
  (35, 4, 2, 9.0, 0, 1),
  (35, 4, 3, 9.0, 0, 1),
  (35, 5, 1, 9.5, 1, 1),
  (35, 5, 2, 9.5, 1, 1),
  (35, 5, 3, 9.0, 0, 1),
  (35, 6, 1, 9.5, 2, 1),
  (35, 6, 2, 9.0, 1, 1),
  (35, 6, 3, 10.0, 1, 1),
  (36, 1, 1, 8.0, 1, 1),
  (36, 1, 2, 8.5, 1, 1),
  (36, 1, 3, 7.5, 0, 1),
  (36, 2, 1, 10.0, 1, 1),
  (36, 2, 2, 10.0, 0, 1),
  (36, 2, 3, 9.0, 0, 1),
  (36, 3, 1, 7.5, 1, 1),
  (36, 3, 2, 9.0, 1, 1),
  (36, 3, 3, 7.5, 1, 1),
  (36, 4, 1, 10.0, 1, 1),
  (36, 4, 2, 9.5, 1, 1),
  (36, 4, 3, 9.5, 0, 1),
  (36, 5, 1, 9.0, 2, 1),
  (36, 5, 2, 8.0, 1, 1),
  (36, 5, 3, 7.5, 1, 1),
  (36, 6, 1, 7.5, 2, 1),
  (36, 6, 2, 7.5, 2, 1),
  (36, 6, 3, 8.5, 1, 1),
  (37, 1, 1, 9.5, 2, 1),
  (37, 1, 2, 10.0, 2, 1),
  (37, 1, 3, 9.0, 2, 1),
  (37, 2, 1, 9.0, 1, 1),
  (37, 2, 2, 9.5, 0, 1),
  (37, 2, 3, 9.0, 0, 1),
  (37, 3, 1, 8.5, 2, 1),
  (37, 3, 2, 9.0, 2, 1),
  (37, 3, 3, 8.5, 2, 1),
  (37, 4, 1, 9.5, 1, 1),
  (37, 4, 2, 9.5, 1, 1),
  (37, 4, 3, 9.5, 1, 1),
  (37, 5, 1, 8.5, 2, 1),
  (37, 5, 2, 7.5, 2, 1),
  (37, 5, 3, 8.5, 1, 1),
  (37, 6, 1, 8.0, 2, 1),
  (37, 6, 2, 9.0, 2, 1),
  (37, 6, 3, 9.0, 2, 1),
  (38, 1, 1, 8.5, 1, 1),
  (38, 1, 2, 8.5, 1, 1),
  (38, 1, 3, 8.0, 1, 1),
  (38, 2, 1, 7.5, 1, 1),
  (38, 2, 2, 8.0, 0, 1),
  (38, 2, 3, 7.0, 0, 1),
  (38, 3, 1, 7.0, 1, 1),
  (38, 3, 2, 6.5, 1, 1),
  (38, 3, 3, 7.5, 0, 1),
  (38, 4, 1, 8.5, 2, 1),
  (38, 4, 2, 8.0, 1, 1),
  (38, 4, 3, 7.0, 1, 1),
  (38, 5, 1, 6.0, 2, 1),
  (38, 5, 2, 6.0, 2, 1),
  (38, 5, 3, 7.5, 2, 1),
  (38, 6, 1, 6.0, 1, 1),
  (38, 6, 2, 7.5, 0, 1),
  (38, 6, 3, 7.5, 0, 1),
  (39, 1, 1, 6.0, 0, 1),
  (39, 1, 2, 7.0, 0, 1),
  (39, 1, 3, 7.0, 0, 1),
  (39, 2, 1, 6.0, 1, 1),
  (39, 2, 2, 7.0, 0, 1),
  (39, 2, 3, 7.5, 0, 1),
  (39, 3, 1, 5.5, 2, 1),
  (39, 3, 2, 6.0, 2, 1),
  (39, 3, 3, 6.5, 1, 1),
  (39, 4, 1, 6.0, 2, 1),
  (39, 4, 2, 6.0, 2, 1),
  (39, 4, 3, 7.0, 2, 1),
  (39, 5, 1, 7.5, 0, 1),
  (39, 5, 2, 7.5, 0, 1),
  (39, 5, 3, 6.5, 0, 1),
  (39, 6, 1, 8.5, 1, 1),
  (39, 6, 2, 7.0, 1, 1),
  (39, 6, 3, 8.5, 0, 1),
  (40, 1, 1, 5.0, 1, 1),
  (40, 1, 2, 6.0, 1, 1),
  (40, 1, 3, 5.5, 1, 1),
  (40, 2, 1, 4.5, 1, 1),
  (40, 2, 2, 6.0, 1, 1),
  (40, 2, 3, 5.5, 0, 1),
  (40, 3, 1, 6.5, 1, 1),
  (40, 3, 2, 6.0, 1, 1),
  (40, 3, 3, 5.5, 0, 1),
  (40, 4, 1, 5.5, 0, 1),
  (40, 4, 2, 6.0, 0, 1),
  (40, 4, 3, 5.0, 0, 1),
  (40, 5, 1, 5.0, 1, 1),
  (40, 5, 2, 4.5, 0, 1),
  (40, 5, 3, 5.0, 0, 1),
  (40, 6, 1, 6.5, 1, 1),
  (40, 6, 2, 5.5, 1, 1),
  (40, 6, 3, 5.0, 1, 1);

INSERT INTO motivos_saida (id, descricao) VALUES
  (1, 'Consulta médica'), (2, 'Consulta odontológica'), (3, 'Compromisso familiar'),
  (4, 'Atividade esportiva'), (5, 'Outro');

INSERT INTO ambientes (id, nome, tipo, capacidade) VALUES
  (1, 'Laboratório de Informática 1', 'laboratorio', 40),
  (2, 'Laboratório de Informática 2', 'laboratorio', 40),
  (3, 'Biblioteca', 'biblioteca', 60),
  (4, 'Sala de Reuniões', 'reuniao', 12),
  (5, 'Auditório', 'auditorio', 200);

-- Autorizações (status inicial Pendente; as decisões passam pela procedure para gerar histórico)
INSERT INTO autorizacoes_saida (id, aluno_id, motivo_id, data_saida, hora_saida, responsavel_nome, observacoes, solicitado_por, criado_em) VALUES
  (101,  6, 1, '2026-10-23', '14:30', 'Mariana Duarte',     'Retorno previsto às 16h.',       1, '2026-10-23 11:04:00'),
  (102, 24, 3, '2026-10-23', '15:10', 'Carlos Tavares',     'Responsável busca na recepção.', 1, '2026-10-23 09:42:00'),
  (103, 33, 4, '2026-10-24', '12:00', 'Patrícia Martins',   'Saída após o almoço.',           1, '2026-10-23 08:18:00'),
  (104, 11, 2, '2026-10-22', '10:40', 'Ricardo Nascimento', NULL,                             1, '2026-10-22 16:12:00');
CALL sp_decidir_autorizacao(102, 'Aprovada', 1);
CALL sp_decidir_autorizacao(104, 'Recusada', 1);

INSERT INTO reservas (id, ambiente_id, solicitante, usuario_id, data_reserva, hora_inicio, hora_fim, finalidade) VALUES
  (201, 1, 'Coordenação de TI', 1, '2026-10-23', '09:00', '10:30', 'Aula prática de desenvolvimento'),
  (202, 4, 'Prof.ª Camila',     1, '2026-10-23', '13:00', '14:00', 'Reunião pedagógica'),
  (203, 3, 'Prof. Ricardo',     1, '2026-10-26', '10:00', '11:30', 'Pesquisa orientada para o TCC');
CALL sp_decidir_reserva(201, 'Aprovada', 1);
CALL sp_decidir_reserva(203, 'Aprovada', 1);

-- =====================================================================
-- 13. USUÁRIO DA APLICAÇÃO (opcional — descomente e troque a senha)
--     O back-end não deve conectar como root.
-- =====================================================================
-- CREATE USER 'senai_app'@'%' IDENTIFIED BY 'TroqueEstaSenha!2026';
-- GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE ON senai_connect.* TO 'senai_app'@'%';
-- FLUSH PRIVILEGES;
