import express from 'express'
import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import { pool, asUser } from './db.js'

const app = express()
app.use(express.json())

/* ---------------- utilidades ---------------- */

const TZ = 'America/Sao_Paulo'
const todayISO = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date())
const yesterdayISO = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(Date.now() - 86400000))
const hhmm = (t) => (t || '').slice(0, 5)
const isoToBR = (d) => { const [y, m, dd] = d.split('-'); return `${dd}/${m}/${y}` }
const brToISO = (d) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((d || '').trim())
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null
}
/** "Hoje, 11:04" / "Ontem, 16:12" / "20/10, 08:00" — mesmo formato que o front já usava */
const createdLabel = (dt) => {
  const [d, t] = dt.split(' ')
  const day = d === todayISO() ? 'Hoje' : d === yesterdayISO() ? 'Ontem' : isoToBR(d).slice(0, 5)
  return `${day}, ${hhmm(t)}`
}
/** Conserta texto com acento "bugado" (ex.: 'LÃ³gica' -> 'Lógica'), caso o banco tenha sido importado com encoding errado */
const fixText = (s) => {
  if (typeof s !== 'string' || !/[ÃÂ]/.test(s)) return s
  const fixed = Buffer.from(s, 'latin1').toString('utf8')
  return fixed.includes('\uFFFD') ? s : fixed
}
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex')
const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v || '')

/** Erros do banco viram respostas que o front consegue mostrar */
function fail(res, err) {
  if (err?.sqlState === '45000') return res.status(409).json({ error: err.sqlMessage })
  if (err?.errno === 3819) return res.status(400).json({ error: 'Valor fora do permitido (ex.: nota entre 0 e 10).' })
  if (err?.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Registro duplicado.' })
  console.error(err)
  return res.status(500).json({ error: 'Erro interno no servidor.' })
}
const wrap = (fn) => (req, res) => fn(req, res).catch((err) => fail(res, err))

/* ---------------- autenticação ---------------- */

async function openSession(userId, remember, req) {
  const token = crypto.randomBytes(32).toString('hex')
  const hours = remember ? 24 * 30 : 12
  await pool.query(
    `INSERT INTO sessoes (usuario_id, token_hash, manter_conectado, ip, user_agent, expira_em)
     VALUES (?, ?, ?, ?, ?, NOW() + INTERVAL ? HOUR)`,
    [userId, sha256(token), remember ? 1 : 0, req.ip, (req.get('user-agent') || '').slice(0, 255), hours])
  await pool.query('UPDATE usuarios SET ultimo_acesso = NOW() WHERE id = ?', [userId])
  return token
}

async function auth(req, res, next) {
  const token = (req.get('authorization') || '').replace(/^Bearer /, '')
  if (!token) return res.status(401).json({ error: 'Faça login para continuar.' })
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.nome, u.email, u.perfil FROM sessoes s JOIN usuarios u ON u.id = s.usuario_id
        WHERE s.token_hash = ? AND s.encerrada_em IS NULL AND s.expira_em > NOW() AND u.ativo = 1`, [sha256(token)])
    if (!rows.length) return res.status(401).json({ error: 'Sessão expirada. Entre novamente.' })
    req.user = rows[0]; req.tokenHash = sha256(token)
    next()
  } catch (err) { fail(res, err) }
}

app.post('/api/auth/login', wrap(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase()
  const password = String(req.body.password || '')
  if (!emailOk(email) || !password) return res.status(400).json({ error: 'Informe e-mail e senha.' })
  const [rows] = await pool.query('SELECT id, nome, email, senha_hash, ativo FROM usuarios WHERE email = ?', [email])
  const u = rows[0]
  if (!u) return res.status(404).json({ error: 'Não encontramos uma conta com esse e-mail. Crie sua conta na aba ao lado.' })
  if (!u.ativo) return res.status(403).json({ error: 'Conta desativada. Procure a coordenação.' })
  if (!(await bcrypt.compare(password, u.senha_hash))) return res.status(401).json({ error: 'Senha incorreta. Confira e tente de novo.' })
  const token = await openSession(u.id, !!req.body.remember, req)
  res.json({ token, user: { name: u.nome, email: u.email } })
}))

app.post('/api/auth/signup', wrap(async (req, res) => {
  const name = String(req.body.name || '').trim()
  const email = String(req.body.email || '').trim().toLowerCase()
  const password = String(req.body.password || '')
  if (name.length < 3) return res.status(400).json({ error: 'Digite seu nome completo.' })
  if (!emailOk(email)) return res.status(400).json({ error: 'Digite um e-mail válido.' })
  if (password.length < 6) return res.status(400).json({ error: 'A senha precisa ter pelo menos 6 caracteres.' })
  const [exists] = await pool.query('SELECT 1 FROM usuarios WHERE email = ?', [email])
  if (exists.length) return res.status(409).json({ error: 'Já existe uma conta com esse e-mail. Use a aba Entrar.' })
  const hash = await bcrypt.hash(password, 10)
  const [r] = await pool.query('INSERT INTO usuarios (nome, email, senha_hash, perfil) VALUES (?, ?, ?, ?)', [name, email, hash, 'professor'])
  const token = await openSession(r.insertId, !!req.body.remember, req)
  res.status(201).json({ token, user: { name, email } })
}))

app.post('/api/auth/logout', auth, wrap(async (req, res) => {
  await pool.query('UPDATE sessoes SET encerrada_em = NOW() WHERE token_hash = ?', [req.tokenHash])
  res.json({ ok: true })
}))

app.get('/api/auth/me', auth, (req, res) => res.json({ user: { name: req.user.nome, email: req.user.email } }))

/* ---------------- saúde (teste rápido) ---------------- */

app.get('/api/health', wrap(async (_req, res) => {
  const [[r]] = await pool.query('SELECT NOW() AS agora, (SELECT COUNT(*) FROM alunos) AS alunos')
  res.json({ ok: true, banco: 'conectado', ...r })
}))

/* ---------------- alunos / carômetro ---------------- */

app.get('/api/students', auth, wrap(async (_req, res) => {
  const [rows] = await pool.query(
    `SELECT aluno_id, aluno, turma, serie, cor_destaque, responsavel, telefone_contato, foto_url, presenca
       FROM vw_carometro_hoje ORDER BY turma_id, aluno_id`)
  res.json(rows.map((r) => ({
    id: r.aluno_id,
    name: r.aluno,
    room: r.turma,
    grade: r.serie,
    guardian: r.responsavel || 'Responsável não informado',
    phone: r.telefone_contato || '',
    attendance: r.presenca === 'ausente' ? 'ausente' : 'presente', // sem registro no dia = presente
    photo: r.foto_url || '',
    initials: r.aluno.split(' ').slice(0, 2).map((p) => p[0]).join(''),
    accent: r.cor_destaque,
  })))
}))

app.put('/api/students/:id/attendance', auth, wrap(async (req, res) => {
  const situacao = req.body.attendance === 'ausente' ? 'ausente' : 'presente'
  await pool.query('CALL sp_registrar_presenca(?, NULL, ?, ?)', [Number(req.params.id), situacao, req.user.id])
  res.json({ id: Number(req.params.id), attendance: situacao })
}))

/* ---------------- boletim ---------------- */

async function currentYear() {
  const [[r]] = await pool.query('SELECT MAX(ano_letivo) AS ano FROM turmas WHERE ativa = 1')
  return r.ano
}

app.get('/api/report-cards', auth, wrap(async (_req, res) => {
  const [rows] = await pool.query(
    `SELECT aluno_id, disciplina, nota_1bim, nota_2bim, nota_3bim, nota_4bim, faltas
       FROM vw_boletim WHERE ano_letivo = ? ORDER BY aluno_id, ordem_exibicao`, [await currentYear()])
  const cards = {}
  const num = (v) => (v === null ? null : Number(v))
  for (const r of rows) {
    cards[r.aluno_id] ??= {}
    cards[r.aluno_id][fixText(r.disciplina)] = {
      notas: [num(r.nota_1bim), num(r.nota_2bim), num(r.nota_3bim), num(r.nota_4bim)],
      faltas: Number(r.faltas),
    }
  }
  res.json(cards)
}))

/**
 * Recebe o boletim do aluno no formato do front e grava por bimestre.
 * O front trabalha com o TOTAL de faltas por disciplina; a diferença
 * é lançada no bimestre em andamento (ou retirada dele primeiro).
 */
app.put('/api/students/:id/report-card', auth, wrap(async (req, res) => {
  const alunoId = Number(req.params.id)
  const card = req.body.card || {}
  const ano = await currentYear()
  const [bims] = await pool.query('SELECT id, numero, data_inicio, data_fim FROM bimestres WHERE ano_letivo = ? ORDER BY numero', [ano])
  const hoje = todayISO()
  const atual = Math.max(0, bims.findIndex((b) => hoje >= b.data_inicio && hoje <= b.data_fim))
  const [discs] = await pool.query('SELECT id, nome FROM disciplinas')
  const discId = Object.fromEntries(discs.map((d) => [fixText(d.nome), d.id]))

  await asUser(req.user.id, async (conn) => {
    await conn.beginTransaction()
    try {
      for (const [disciplina, g] of Object.entries(card)) {
        const dId = discId[disciplina]
        if (!dId) continue
        const [atuais] = await conn.query('SELECT bimestre_id, faltas FROM notas WHERE aluno_id = ? AND disciplina_id = ?', [alunoId, dId])
        const faltas = bims.map((b) => Number(atuais.find((a) => a.bimestre_id === b.id)?.faltas || 0))
        let delta = Math.max(0, Math.floor(Number(g.faltas) || 0)) - faltas.reduce((a, b) => a + b, 0)
        if (delta >= 0) faltas[atual] += delta
        else {
          const ordem = [atual, ...faltas.map((_, i) => i).filter((i) => i !== atual).reverse()]
          for (const i of ordem) { const tira = Math.min(faltas[i], -delta); faltas[i] -= tira; delta += tira; if (!delta) break }
        }
        for (let i = 0; i < bims.length; i++) {
          const nota = g.notas?.[i]
          const valor = nota === null || nota === undefined || nota === '' ? null : Number(nota)
          await conn.query(
            `INSERT INTO notas (aluno_id, disciplina_id, bimestre_id, nota, faltas, lancado_por) VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE nota = VALUES(nota), faltas = VALUES(faltas), lancado_por = VALUES(lancado_por)`,
            [alunoId, dId, bims[i].id, valor, faltas[i], req.user.id])
        }
      }
      await conn.commit()
    } catch (err) { await conn.rollback(); throw err }
  })
  res.json({ ok: true })
}))

/* ---------------- autorizações de saída ---------------- */

const exitDTO = (r) => ({
  id: r.id, studentId: r.aluno_id, reason: r.motivo, date: isoToBR(r.data_saida), time: hhmm(r.hora_saida),
  guardian: r.responsavel_nome, notes: r.observacoes || '', status: r.status, createdAt: createdLabel(r.criado_em),
})

app.get('/api/exits', auth, wrap(async (_req, res) => {
  const [rows] = await pool.query('SELECT * FROM vw_autorizacoes_saida ORDER BY criado_em DESC')
  res.json(rows.map(exitDTO))
}))

app.post('/api/exits', auth, wrap(async (req, res) => {
  const b = req.body
  const data = brToISO(b.date) || (/^\d{4}-\d{2}-\d{2}$/.test(b.date || '') ? b.date : null)
  if (!data) return res.status(400).json({ error: 'Data inválida. Use o formato dd/mm/aaaa.' })
  if (!/^\d{2}:\d{2}$/.test(b.time || '')) return res.status(400).json({ error: 'Horário inválido.' })
  const [m] = await pool.query(
    `SELECT id FROM motivos_saida WHERE descricao = ? UNION ALL SELECT id FROM motivos_saida WHERE descricao = 'Outro' LIMIT 1`, [b.reason])
  const id = await asUser(req.user.id, async (conn) => {
    const [r] = await conn.query(
      `INSERT INTO autorizacoes_saida (aluno_id, motivo_id, data_saida, hora_saida, responsavel_nome, observacoes, solicitado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [Number(b.studentId), m[0].id, data, b.time, String(b.guardian || 'Responsável não informado').slice(0, 120), b.notes || null, req.user.id])
    return r.insertId
  })
  const [rows] = await pool.query('SELECT * FROM vw_autorizacoes_saida WHERE id = ?', [id])
  res.status(201).json(exitDTO(rows[0]))
}))

app.patch('/api/exits/:id', auth, wrap(async (req, res) => {
  await pool.query('CALL sp_decidir_autorizacao(?, ?, ?)', [Number(req.params.id), req.body.status, req.user.id])
  res.json({ id: Number(req.params.id), status: req.body.status })
}))

/* ---------------- reservas ---------------- */

const reservationDTO = (r) => ({
  id: r.id, environment: r.ambiente, requester: r.solicitante, date: r.data_reserva,
  start: hhmm(r.hora_inicio), end: hhmm(r.hora_fim), purpose: r.finalidade, status: r.status, createdAt: createdLabel(r.criado_em),
})

app.get('/api/reservations', auth, wrap(async (_req, res) => {
  const [rows] = await pool.query('SELECT * FROM vw_agenda_ambientes ORDER BY data_reserva, hora_inicio')
  res.json(rows.map(reservationDTO))
}))

app.post('/api/reservations', auth, wrap(async (req, res) => {
  const b = req.body
  const [amb] = await pool.query('SELECT id FROM ambientes WHERE nome = ? AND ativo = 1', [b.environment])
  if (!amb.length) return res.status(400).json({ error: 'Ambiente não encontrado.' })
  if (!b.requester?.trim() || !b.purpose?.trim()) return res.status(400).json({ error: 'Preencha o solicitante e a finalidade.' })
  const id = await asUser(req.user.id, async (conn) => {
    const [r] = await conn.query(
      `INSERT INTO reservas (ambiente_id, solicitante, usuario_id, data_reserva, hora_inicio, hora_fim, finalidade)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [amb[0].id, b.requester.trim(), req.user.id, b.date, b.start, b.end, b.purpose.trim()])
    return r.insertId
  })
  const [rows] = await pool.query('SELECT * FROM vw_agenda_ambientes WHERE id = ?', [id])
  res.status(201).json(reservationDTO(rows[0]))
}))

app.patch('/api/reservations/:id', auth, wrap(async (req, res) => {
  await pool.query('CALL sp_decidir_reserva(?, ?, ?)', [Number(req.params.id), req.body.status, req.user.id])
  res.json({ id: Number(req.params.id), status: req.body.status })
}))

/* ---------------- start ---------------- */

const PORT = Number(process.env.API_PORT || 3001)
app.listen(PORT, async () => {
  try {
    await pool.query('SELECT 1')
    console.log(`API do SENAI Connect rodando em http://localhost:${PORT}  ·  banco conectado ✔`)
  } catch (err) {
    console.error(`API subiu na porta ${PORT}, mas NÃO conectou no MySQL: ${err.message}`)
    console.error('Confira usuário, senha e nome do banco no arquivo server/.env')
  }
})
