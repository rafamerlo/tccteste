import { useEffect, useState } from 'react'
import { Pencil, Printer, Save, X } from 'lucide-react'

export const SUBJECTS = [
  'Lógica de Programação',
  'Desenvolvimento Web',
  'Banco de Dados',
  'Redes de Computadores',
  'Inglês Técnico',
  'Projeto Integrador',
]
export const TERMS = ['1º bim.', '2º bim.', '3º bim.', '4º bim.']
export const PASSING = 6

export type SubjectGrades = { notas: (number | null)[]; faltas: number }
export type ReportCard = Record<string, SubjectGrades>
export type ReportCards = Record<number, ReportCard>

/** Gera notas de demonstração estáveis para cada aluno (4º bimestre ainda em andamento). */
export function makeReportCard(studentId: number): ReportCard {
  let seed = studentId * 9301 + 49297
  const rand = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280 }
  const profile = 5.2 + rand() * 4.3 // perfil geral do aluno
  const card: ReportCard = {}
  SUBJECTS.forEach((subject) => {
    const bias = (rand() - 0.5) * 2.4
    const notas: (number | null)[] = [0, 1, 2].map(() => Math.round(Math.min(10, Math.max(2, profile + bias + (rand() - 0.5) * 2)) * 2) / 2)
    notas.push(null)
    card[subject] = { notas, faltas: Math.floor(rand() * 7) }
  })
  return card
}

/** Garante que o boletim tenha todas as disciplinas e os 4 bimestres (evita tela quebrada se faltar algo no banco). */
export function normalizeCard(card?: ReportCard): ReportCard {
  const out: ReportCard = {}
  SUBJECTS.forEach((s) => {
    const g = card?.[s]
    const notas = TERMS.map((_, i) => {
      const n = g?.notas?.[i]
      return typeof n === 'number' && !Number.isNaN(n) ? n : null
    })
    out[s] = { notas, faltas: Number(g?.faltas) || 0 }
  })
  return out
}

export const makeAllReportCards = (ids: number[]): ReportCards => Object.fromEntries(ids.map((id) => [id, makeReportCard(id)]))

export function subjectAverage(g?: SubjectGrades): number | null {
  if (!g) return null
  const v = g.notas.filter((n): n is number => typeof n === 'number')
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
}
export function overallAverage(card?: ReportCard): number | null {
  if (!card) return null
  const v = SUBJECTS.map((s) => (card[s] ? subjectAverage(card[s]) : null)).filter((n): n is number => n !== null)
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
}
export const fmt = (n: number | null) => (n === null ? '—' : n.toFixed(1).replace('.', ','))
export const gradeTone = (n: number | null) => (n === null ? 'none' : n >= 8 ? 'high' : n >= PASSING ? 'ok' : 'low')
export const situation = (n: number | null) => (n === null ? 'Sem notas' : n >= PASSING ? 'Na média' : 'Recuperação')

export function BoletimPanel({ studentName, card: rawCard, onSave }: { studentName: string; card: ReportCard; onSave: (card: ReportCard) => void }) {
  const card = normalizeCard(rawCard)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<ReportCard>(card)
  const [error, setError] = useState('')
  useEffect(() => { if (!editing) setDraft(normalizeCard(rawCard)) }, [rawCard, editing])

  const avg = overallAverage(editing ? draft : card)
  const totalFaltas = SUBJECTS.reduce((t, s) => t + (card[s]?.faltas || 0), 0)
  const below = SUBJECTS.filter((s) => { const a = subjectAverage(card[s]); return a !== null && a < PASSING }).length

  const setNota = (subject: string, i: number, value: string) => {
    setDraft((d) => {
      const notas = [...d[subject].notas]
      const v = value.replace(',', '.').trim()
      notas[i] = v === '' ? null : Number(v)
      return { ...d, [subject]: { ...d[subject], notas } }
    })
  }
  const setFaltas = (subject: string, value: string) => {
    setDraft((d) => ({ ...d, [subject]: { ...d[subject], faltas: Math.max(0, Math.floor(Number(value) || 0)) } }))
  }
  const save = () => {
    const invalid = SUBJECTS.some((s) => draft[s].notas.some((n) => n !== null && (Number.isNaN(n) || n < 0 || n > 10)))
    if (invalid) { setError('As notas precisam estar entre 0 e 10.'); return }
    setError(''); onSave(draft); setEditing(false)
  }
  const data = editing ? draft : card

  return (
    <div className="boletim">
      <div className="boletim-summary">
        <div className={`boletim-avg tone-${gradeTone(avg)}`}>
          <span>Média geral</span><strong>{fmt(avg)}</strong><small>{situation(avg)}</small>
        </div>
        <div className="boletim-kpi"><span>Disciplinas abaixo de {PASSING},0</span><strong>{below}</strong></div>
        <div className="boletim-kpi"><span>Faltas no ano</span><strong>{totalFaltas}</strong></div>
        <div className="boletim-actions">
          {editing ? <>
            <button className="secondary-button" onClick={() => { setEditing(false); setDraft(card); setError('') }}><X size={15} /> Cancelar</button>
            <button className="primary-button" onClick={save}><Save size={15} /> Salvar notas</button>
          </> : <>
            <button className="secondary-button" onClick={() => window.print()} aria-label={`Imprimir boletim de ${studentName}`}><Printer size={15} /> Imprimir</button>
            <button className="primary-button" onClick={() => setEditing(true)}><Pencil size={15} /> Lançar notas</button>
          </>}
        </div>
      </div>
      {error && <p className="reservation-error">{error}</p>}
      <div className="boletim-table-wrap">
        <table className="boletim-table">
          <thead>
            <tr><th>Disciplina</th>{TERMS.map((t) => <th key={t}>{t}</th>)}<th>Média</th><th>Faltas</th><th>Situação</th></tr>
          </thead>
          <tbody>
            {SUBJECTS.map((s) => {
              const g = data[s]; const a = subjectAverage(g)
              return <tr key={s}>
                <th scope="row">{s}</th>
                {g.notas.map((n, i) => <td key={i}>
                  {editing
                    ? <input aria-label={`${s}, ${TERMS[i]}`} inputMode="decimal" value={n === null ? '' : String(n).replace('.', ',')} onChange={(e) => setNota(s, i, e.target.value)} placeholder="—" />
                    : <span className={`nota tone-${gradeTone(n)}`}>{fmt(n)}</span>}
                </td>)}
                <td><span className={`nota nota-avg tone-${gradeTone(a)}`}>{fmt(a)}</span></td>
                <td>{editing ? <input aria-label={`Faltas em ${s}`} inputMode="numeric" value={g.faltas} onChange={(e) => setFaltas(s, e.target.value)} /> : g.faltas}</td>
                <td><span className={`situacao ${a !== null && a < PASSING ? 'low' : 'ok'}`}>{situation(a)}</span></td>
              </tr>
            })}
          </tbody>
        </table>
      </div>
      <p className="boletim-note">Escala de 0 a 10 · média mínima {PASSING},0 · o 4º bimestre está em andamento.</p>
    </div>
  )
}
