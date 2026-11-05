import mysql from 'mysql2/promise'
import 'dotenv/config'

export const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'Senai@118',
  database: process.env.DB_NAME || 'senai_connect',
  connectionLimit: 10,
  dateStrings: true,        // datas chegam como texto: '2026-10-23', '2026-10-23 14:30:00'
  timezone: '-03:00',
  charset: 'utf8mb4',        // garante acentos (ç, ã, é...) vindo e indo do banco
})

// Toda conexão nova trabalha no horário de São Paulo (CURDATE, NOW, etc.)
pool.pool.on('connection', (conn) => { conn.query("SET time_zone = '-03:00'") })

/**
 * Executa operações que mudam dados informando ao banco quem está agindo.
 * Os triggers usam @app_usuario_id para gravar o histórico.
 */
export async function asUser(userId, fn) {
  const conn = await pool.getConnection()
  try {
    await conn.query('SET @app_usuario_id = ?', [userId])
    return await fn(conn)
  } finally {
    await conn.query('SET @app_usuario_id = NULL').catch(() => {})
    conn.release()
  }
}
