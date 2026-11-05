import { useEffect, useState } from 'react'
import {
  ArrowUpRight, BookOpen, CalendarDays, Check, ChevronRight,
  Clock3, DoorOpen, FileCheck2,
  Search, ShieldCheck, UserRound, Users, X,
} from 'lucide-react'
import Background from './Background'
import Header, { type NavLink } from './Header'
import Landing from './Landing'
import Auth, { type SessionUser } from './Auth'
import { api, ApiError, setToken } from './api'
import { BoletimPanel, fmt, gradeTone, overallAverage, PASSING, situation, type ReportCard, type ReportCards } from './Boletim'

type Page = 'dashboard' | 'carometro' | 'saidas' | 'reservas' | 'historico'
type Attendance = 'presente' | 'ausente'
type ExitStatus = 'Pendente' | 'Aprovada' | 'Liberada' | 'Recusada' | 'Cancelada'
type ReservationStatus = 'Pendente' | 'Aprovada' | 'Recusada' | 'Cancelada'
type Reservation = { id: number; environment: string; requester: string; date: string; start: string; end: string; purpose: string; status: ReservationStatus; createdAt: string }
type Student = {
  id: number; name: string; room: string; grade: string; guardian: string; phone: string; attendance: Attendance; photo: string; initials: string; accent: string
}
type ExitRequest = {
  id: number; studentId: number; reason: string; date: string; time: string; guardian: string; notes: string; status: ExitStatus; createdAt: string
}

const rooms = ['Sala TI 01', 'Sala TI 02', 'Sala TI 03', 'Sala TI 04']
const accents = ['#E3001B', '#E8770E', '#12876A', '#5B4BC4']
const ALL_ROOMS = 'Todas as salas'
const shortRoom = (room: string) => room.split(' · ')[0]

// Salas e ambientes fixos (os mesmos cadastrados no banco)
const environments = ['Laboratório de Informática 1', 'Laboratório de Informática 2', 'Biblioteca', 'Sala de Reuniões', 'Auditório']

const SESSION_KEY = 'senai-connect-session'

function App() {
  const [page, setPage] = useState<Page>('dashboard')
  const [students, setStudents] = useState<Student[]>([])
  const [requests, setRequests] = useState<ExitRequest[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [roomFilter, setRoomFilter] = useState(ALL_ROOMS)
  const [exitFilter, setExitFilter] = useState<'Todas' | ExitStatus>('Todas')
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [modalTab, setModalTab] = useState<'dados' | 'boletim'>('dados')
  const [reportCards, setReportCards] = useState<ReportCards>({})
  const openStudent = (s: Student, tab: 'dados' | 'boletim' = 'dados') => { setModalTab(tab); setSelectedStudent(s) }
  const saveReportCard = async (id: number, card: ReportCard) => {
    try {
      await api(`/students/${id}/report-card`, { method: 'PUT', body: { card } })
      setReportCards((c) => ({ ...c, [id]: card })); setToast('Notas salvas no boletim.')
    } catch (err) { handleError(err) }
  }
  const [showExitModal, setShowExitModal] = useState(false)
  const [toast, setToast] = useState('')
  const [view, setView] = useState<'landing' | 'auth' | 'system'>('landing')
  const [user, setUser] = useState<SessionUser | null>(() => {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY) || 'null') } catch { return null }
  })
  const [pendingPage, setPendingPage] = useState<Page>('dashboard')
  const [section, setSection] = useState('inicio')

  // Carrega tudo do banco (via API) quando há usuário logado
  const loadAll = async () => {
    setLoading(true); setLoadError('')
    try {
      const [st, ex, rs, rc] = await Promise.all([
        api<Student[]>('/students'), api<ExitRequest[]>('/exits'),
        api<Reservation[]>('/reservations'), api<ReportCards>('/report-cards'),
      ])
      setStudents(st); setRequests(ex); setReservations(rs); setReportCards(rc)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) { endSession('Sua sessão expirou. Entre novamente.'); return }
      setLoadError((err as Error).message)
    } finally { setLoading(false) }
  }
  useEffect(() => { if (user) loadAll() }, [user]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (toast) { const timer = setTimeout(() => setToast(''), 2800); return () => clearTimeout(timer) } }, [toast])
  useEffect(() => {
    if (selectedStudent) setSelectedStudent(students.find((s) => s.id === selectedStudent.id) || null)
  }, [students]) // eslint-disable-line react-hooks/exhaustive-deps

  const presentCount = students.filter((s) => s.attendance === 'presente').length
  const pendingCount = requests.filter((r) => r.status === 'Pendente').length
  const approvedCount = requests.filter((r) => r.status === 'Aprovada').length
  const filteredRequests = requests.filter((r) => exitFilter === 'Todas' || r.status === exitFilter)

  const navigate = (next: Page) => { setPage(next); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const openSystem = (next: Page = 'dashboard') => {
    if (!user) { setPendingPage(next); setView('auth'); window.scrollTo({ top: 0 }); return }
    setView('system'); setPage(next); window.scrollTo({ top: 0 })
  }
  const handleAuth = (u: SessionUser, remember: boolean) => {
    try {
      localStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(SESSION_KEY)
      ;(remember ? localStorage : sessionStorage).setItem(SESSION_KEY, JSON.stringify(u))
    } catch { /* armazenamento indisponível */ }
    setUser(u); setView('system'); setPage(pendingPage); window.scrollTo({ top: 0 })
    setToast(`Bem-vindo(a), ${u.name.split(' ')[0]}!`)
  }
  const endSession = (message: string, toLogin = true) => {
    try { localStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(SESSION_KEY) } catch { /* ok */ }
    setToken(null)
    setUser(null); setStudents([]); setRequests([]); setReservations([]); setReportCards({})
    setView(toLogin ? 'auth' : 'landing'); setSection('inicio'); window.scrollTo({ top: 0 })
    setToast(message)
  }
  const logout = () => {
    api('/auth/logout', { method: 'POST' }).catch(() => { /* sessão já encerrada */ })
    endSession('Você saiu da sua conta.', false)
  }
  /** Mostra o erro da API; se a sessão caiu, volta para o login */
  const handleError = (err: unknown) => {
    if (err instanceof ApiError && err.status === 401) { endSession('Sua sessão expirou. Entre novamente.'); return }
    setToast((err as Error).message)
  }
  const goHome = () => { setView('landing'); setSection('inicio'); window.scrollTo({ top: 0 }) }
  const goToSection = (id: string) => {
    setView('landing')
    setSection(id)
    setTimeout(() => {
      if (id === 'inicio') window.scrollTo({ top: 0, behavior: 'smooth' })
      else document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 0)
  }

  const toggleAttendance = async (id: number) => {
    const current = students.find((s) => s.id === id)
    if (!current) return
    const attendance: Attendance = current.attendance === 'presente' ? 'ausente' : 'presente'
    try {
      await api(`/students/${id}/attendance`, { method: 'PUT', body: { attendance } })
      setStudents((list) => list.map((s) => s.id === id ? { ...s, attendance } : s))
      setToast('Presença atualizada.')
    } catch (err) { handleError(err) }
  }
  const decideRequest = async (id: number, status: 'Aprovada' | 'Liberada' | 'Recusada') => {
    try {
      await api(`/exits/${id}`, { method: 'PATCH', body: { status } })
      setRequests((current) => current.map((r) => r.id === id ? { ...r, status } : r))
      setToast(status === 'Aprovada' ? 'Autorização aprovada e enviada à portaria.' : status === 'Liberada' ? 'Saída confirmada pela portaria.' : 'Solicitação recusada.')
    } catch (err) { handleError(err) }
  }
  const decideReservation = async (id: number, status: ReservationStatus) => {
    try {
      await api(`/reservations/${id}`, { method: 'PATCH', body: { status } })
      setReservations((current) => current.map((r) => r.id === id ? { ...r, status } : r))
      setToast(status === 'Aprovada' ? 'Reserva aprovada.' : status === 'Recusada' ? 'Reserva recusada.' : 'Reserva cancelada.')
    } catch (err) { handleError(err) }
  }
  // O banco é quem barra conflito de horário (trigger) — vale para todos os computadores
  const createReservation = async (reservation: Reservation) => {
    try {
      const created = await api<Reservation>('/reservations', { method: 'POST', body: reservation })
      setReservations((current) => [created, ...current]); setToast('Reserva solicitada.'); return true
    } catch (err) { handleError(err); return false }
  }
  const createExit = async (request: ExitRequest) => {
    try {
      const created = await api<ExitRequest>('/exits', { method: 'POST', body: request })
      setRequests((current) => [created, ...current]); setShowExitModal(false)
      setToast('Autorização criada e enviada para a coordenação.')
    } catch (err) { handleError(err) }
  }
  const studentById = (id: number) => students.find((s) => s.id === id) || students[0]

  const landingLinks: NavLink[] = [
  { id: 'inicio', label: 'Início' },
  { id: 'sobre', label: 'Sobre' },
]
  const systemLinks: NavLink[] = [
    { id: 'dashboard', label: 'Visão geral' }, { id: 'carometro', label: 'Carômetro' },
    { id: 'saidas', label: 'Autorizações', badge: pendingCount }, { id: 'reservas', label: 'Reservas' }, { id: 'historico', label: 'Histórico' },
  ]

  const inSystem = view === 'system' && user
  return <div className={`app-shell ${view === 'system' ? 'is-system' : 'is-landing'}`}>
    <Background />
    <Header
      links={inSystem ? systemLinks : landingLinks}
      active={inSystem ? page : view === 'auth' ? '' : section}
      onLogo={goHome}
      onSelect={(id) => inSystem ? navigate(id as Page) : goToSection(id)}
      user={inSystem ? user : null}
      cta={inSystem ? { label: 'Sair', onClick: logout, variant: 'ghost' } : user ? { label: 'Abrir sistema', onClick: () => openSystem() } : view === 'auth' ? { label: 'Voltar ao site', onClick: goHome, variant: 'ghost' } : { label: 'Entrar', onClick: () => openSystem() }}
    />
    {view === 'landing' && <Landing openSystem={openSystem} goTo={goToSection} />}
    {view === 'auth' && <Auth onAuth={handleAuth} onBack={goHome} />}
    {inSystem && (loading || loadError || students.length === 0) && <main className="main-content">
      <div className="panel" style={{ textAlign: 'center', padding: '48px 24px' }}>
        {loading ? <p>Carregando dados do banco…</p> : <>
          <p>{loadError || 'Nenhum dado encontrado no banco.'}</p>
          <button className="primary-button" style={{ marginTop: 16 }} onClick={loadAll}>Tentar de novo</button>
        </>}
      </div>
    </main>}
    {inSystem && !loading && !loadError && students.length > 0 && <main className="main-content">
      {page === 'dashboard' && <Dashboard userName={user.name} navigate={navigate} students={students} presentCount={presentCount} pendingCount={pendingCount} approvedCount={approvedCount} requests={requests} studentById={studentById} />}
      {page === 'carometro' && <Carometro students={students} roomFilter={roomFilter} setRoomFilter={setRoomFilter} toggleAttendance={toggleAttendance} openStudent={openStudent} reportCards={reportCards} />}
      {page === 'saidas' && <ExitsPage allRequests={requests} requests={filteredRequests} filter={exitFilter} setFilter={setExitFilter} studentById={studentById} decideRequest={decideRequest} setShowExitModal={setShowExitModal} />}
      {page === 'reservas' && <ReservationsPage reservations={reservations} onCreate={createReservation} onDecide={decideReservation} />}
      {page === 'historico' && <HistoryPage requests={requests} reservations={reservations} studentById={studentById} />}
    </main>}
    {selectedStudent && <StudentModal student={selectedStudent} close={() => setSelectedStudent(null)} toggleAttendance={toggleAttendance} tab={modalTab} setTab={setModalTab} card={reportCards[selectedStudent.id]} onSaveCard={(card) => saveReportCard(selectedStudent.id, card)} />}
    {showExitModal && <ExitModal students={students} close={() => setShowExitModal(false)} onCreate={createExit} />}
    {toast && <div className="toast" role="status"><Check size={17} /> {toast}</div>}
  </div>
}

/* ---------- Componentes compartilhados ---------- */

function PageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: React.ReactNode; description: string; action?: React.ReactNode }) {
  return <div className="page-header">
    <div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>
    {action}
  </div>
}

function RoomChips({ value, onChange, students }: { value: string; onChange: (v: string) => void; students: Student[] }) {
  const options = [ALL_ROOMS, ...rooms]
  return <div className="room-chips" role="group" aria-label="Filtrar por sala">
    {options.map((room) => {
      const count = room === ALL_ROOMS ? students.length : students.filter((s) => s.room === room).length
      const idx = rooms.indexOf(room)
      return <button key={room} className={`room-chip ${value === room ? 'active' : ''}`} aria-pressed={value === room} onClick={() => onChange(room)}>
        {idx >= 0 && <i style={{ background: accents[idx] }} />}
        {room === ALL_ROOMS ? room : shortRoom(room)}
        <b>{count}</b>
      </button>
    })}
  </div>
}

function StatCard({ label, value, detail, tone, icon: Icon, progress }: { label: string; value: string | number; detail: string; tone: string; icon: typeof Users; progress: number }) {
  return <div className={`stat-card tone-${tone}`}>
    <div className="stat-top"><span>{label}</span><div className="stat-icon"><Icon size={17} /></div></div>
    <strong>{value}</strong>
    <small>{detail}</small>
    <div className="stat-line"><i style={{ width: `${progress}%` }} /></div>
  </div>
}

function StatusBadge({ status }: { status: ExitStatus | ReservationStatus }) {
  return <span className={`status-badge ${status.toLowerCase()}`}><i />{status}</span>
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="empty-state"><ShieldCheck size={25} /><strong>{title}</strong><span>{detail}</span></div>
}

/* ---------- Visão geral ---------- */

function Dashboard({ userName, navigate, students, presentCount, pendingCount, approvedCount, requests, studentById }: { userName: string; navigate: (page: Page) => void; students: Student[]; presentCount: number; pendingCount: number; approvedCount: number; requests: ExitRequest[]; studentById: (id: number) => Student }) {
  const recent = requests.slice(0, 4)
  const now = new Date()
  const tz = 'America/Sao_Paulo'
  const hour = Number(new Intl.DateTimeFormat('pt-BR', { hour: 'numeric', hour12: false, timeZone: tz }).format(now))
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'
  const today = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: tz }).format(now)
  const pct = Math.round(presentCount / students.length * 100)

  return <>
    <PageHeader eyebrow={today.charAt(0).toUpperCase() + today.slice(1)} title={`${greeting}, ${userName.split(' ')[0]}`} description="Veja quem está na escola e o que espera decisão." />
    <div className="stat-grid">
      <StatCard label="Alunos ativos" value={students.length} detail="4 salas cadastradas" tone="red" icon={Users} progress={100} />
      <StatCard label="Presença hoje" value={`${pct}%`} detail={`${presentCount} de ${students.length} presentes`} tone="green" icon={Check} progress={pct} />
      <StatCard label="Saídas pendentes" value={pendingCount} detail="Aguardando coordenação" tone="orange" icon={Clock3} progress={Math.min(100, pendingCount * 20)} />
      <StatCard label="Aprovadas" value={approvedCount} detail="Prontas para a portaria" tone="violet" icon={FileCheck2} progress={Math.min(100, approvedCount * 20)} />
    </div>
    <div className="dashboard-grid">
      <section className="panel">
        <div className="panel-heading">
          <div><span className="section-kicker">Presença</span><h2>Quem está na escola</h2></div>
          <button className="text-button" onClick={() => navigate('carometro')}>Abrir carômetro <ArrowUpRight size={15} /></button>
        </div>
        <div className="presence-main">
          <div className="ring-chart" style={{ '--progress': `${presentCount / students.length * 360}deg` } as React.CSSProperties}>
            <div><strong>{presentCount}</strong><span>presentes</span></div>
          </div>
          <div className="legend">
            <div><i className="legend-dot green" /><span>Presentes</span><strong>{presentCount}</strong></div>
            <div><i className="legend-dot muted" /><span>Ausentes</span><strong>{students.length - presentCount}</strong></div>
            <div><i className="legend-dot red" /><span>Salas</span><strong>{rooms.length}</strong></div>
          </div>
        </div>
        <div className="room-bars">{rooms.map((room, i) => {
          const rs = students.filter((s) => s.room === room)
          const rp = rs.filter((s) => s.attendance === 'presente').length
          return <div className="room-bar" key={room}>
            <div><span>{room}</span><strong>{rp}/{rs.length}</strong></div>
            <div className="bar-track"><i style={{ width: `${rp / rs.length * 100}%`, background: accents[i] }} /></div>
          </div>
        })}</div>
      </section>
      <section className="panel">
        <div className="panel-heading">
          <div><span className="section-kicker">Saídas</span><h2>Autorizações recentes</h2></div>
          <button className="round-button" onClick={() => navigate('saidas')} aria-label="Abrir autorizações"><ChevronRight size={18} /></button>
        </div>
        <div className="request-list">{recent.map((r) => {
          const s = studentById(r.studentId)
          return <div className="request-row" key={r.id}>
            <img src={s.photo} alt="" />
            <div className="request-info"><strong>{s.name}</strong><small>{r.reason} · {r.time}</small></div>
            <StatusBadge status={r.status} />
          </div>
        })}</div>
        <button className="full-link" onClick={() => navigate('saidas')}>Ver todas as autorizações <ArrowUpRight size={15} /></button>
      </section>
    </div>
  </>
}


/* ---------- Carômetro ---------- */

function Carometro({ students, roomFilter, setRoomFilter, toggleAttendance, openStudent, reportCards }: { students: Student[]; roomFilter: string; setRoomFilter: (v: string) => void; toggleAttendance: (id: number) => void; openStudent: (s: Student, tab?: 'dados' | 'boletim') => void; reportCards: ReportCards }) {
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<'presenca' | 'boletim'>('presenca')
  const inRoom = students.filter((s) => roomFilter === ALL_ROOMS || s.room === roomFilter)
  const visible = inRoom.filter((s) => `${s.name} ${s.grade} ${s.room} NX-${String(s.id).padStart(3, '0')}`.toLowerCase().includes(query.toLowerCase()))
  const present = inRoom.filter((s) => s.attendance === 'presente').length
  const absent = inRoom.length - present
  const avgOf = (s: Student) => overallAverage(reportCards[s.id])
  const okCount = inRoom.filter((s) => { const a = avgOf(s); return a !== null && a >= PASSING }).length
  const lowCount = inRoom.filter((s) => { const a = avgOf(s); return a !== null && a < PASSING }).length
  const groupAvg = (list: Student[]) => { const v = list.map(avgOf).filter((n): n is number => n !== null); return v.length ? v.reduce((x, y) => x + y, 0) / v.length : null }

  return <>
    <PageHeader eyebrow={`Carômetro · ${students.length} alunos`} title="Carômetro"
      description={mode === 'presenca' ? 'Pesquise por nome, matrícula ou sala. Toque na foto para abrir a ficha e no status para mudar a presença.' : 'Veja a média de cada aluno. Toque na foto ou na média para abrir o boletim completo e lançar notas.'}
      action={<div className="mode-switch" role="tablist" aria-label="Modo do carômetro">
        <button role="tab" aria-selected={mode === 'presenca'} className={mode === 'presenca' ? 'active' : ''} onClick={() => setMode('presenca')}><Check size={16} /> Presença</button>
        <button role="tab" aria-selected={mode === 'boletim'} className={mode === 'boletim' ? 'active' : ''} onClick={() => setMode('boletim')}><BookOpen size={16} /> Boletim</button>
      </div>} />
    <div className="carometro-search">
      <Search size={18} />
      <input aria-label="Pesquisar aluno" placeholder="Buscar por nome, matrícula ou sala" value={query} onChange={(e) => setQuery(e.target.value)} />
      <span>{visible.length} {visible.length === 1 ? 'aluno' : 'alunos'}</span>
    </div>
    <RoomChips value={roomFilter} onChange={setRoomFilter} students={students} />
    <div className="carometro-summary">
      {mode === 'presenca' ? <>
        <div className="summary-chip present"><span className="summary-num">{present}</span><span>presentes</span></div>
        <div className="summary-chip absent"><span className="summary-num">{absent}</span><span>ausentes</span></div>
      </> : <>
        <div className="summary-chip present"><span className="summary-num">{okCount}</span><span>na média</span></div>
        <div className="summary-chip absent"><span className="summary-num">{lowCount}</span><span>em recuperação</span></div>
        <div className="summary-chip neutral"><span className="summary-num">{fmt(groupAvg(inRoom))}</span><span>média da seleção</span></div>
      </>}
      <span className="summary-note"><Clock3 size={14} /> Alterações salvas automaticamente</span>
    </div>
    <div className="carometro-rooms">
      {rooms.filter((room) => roomFilter === ALL_ROOMS || room === roomFilter).map((room) => {
        const idx = rooms.indexOf(room)
        const list = visible.filter((s) => s.room === room)
        if (list.length === 0) return null
        return <section className="room-section" key={room}>
          <div className="room-title">
            <div><i style={{ background: accents[idx] }} /><h2>{room}</h2></div>
            {mode === 'presenca'
              ? <span><strong>{list.filter((s) => s.attendance === 'presente').length}</strong> de {list.length} presentes</span>
              : <span>Média da sala <strong className={`tone-text-${gradeTone(groupAvg(list))}`}>{fmt(groupAvg(list))}</strong></span>}
          </div>
          <div className="face-grid">{list.map((s) => {
            const a = avgOf(s)
            return <article className={`face-card ${mode === 'presenca' ? s.attendance : 'boletim-mode'}`} key={s.id}>
              <button className="face-open" onClick={() => openStudent(s, mode === 'boletim' ? 'boletim' : 'dados')} aria-label={`Abrir ficha de ${s.name}`}>
                <span className="face-image"><img src={s.photo} alt={`Foto 4x4 de ${s.name}`} loading="lazy" /></span>
                <strong>{s.name.split(' ').slice(0, 2).join(' ')}</strong>
                <small>NX-{String(s.id).padStart(3, '0')}</small>
              </button>
              {mode === 'presenca'
                ? <button className="face-status" onClick={() => toggleAttendance(s.id)} aria-label={`Marcar ${s.name} como ${s.attendance === 'presente' ? 'ausente' : 'presente'}`}>
                    {s.attendance === 'presente' ? <Check size={13} /> : <X size={13} />}
                    {s.attendance === 'presente' ? 'Presente' : 'Ausente'}
                  </button>
                : <button className={`face-grade tone-${gradeTone(a)}`} onClick={() => openStudent(s, 'boletim')} aria-label={`Abrir boletim de ${s.name}`}>
                    <span>Média</span><strong>{fmt(a)}</strong>
                  </button>}
            </article>
          })}</div>
        </section>
      })}
      {visible.length === 0 && <EmptyState title="Nenhum aluno encontrado" detail="Confira a busca ou escolha outra sala." />}
    </div>
  </>
}

/* ---------- Autorizações ---------- */

function ExitsPage({ allRequests, requests, filter, setFilter, studentById, decideRequest, setShowExitModal }: { allRequests: ExitRequest[]; requests: ExitRequest[]; filter: 'Todas' | ExitStatus; setFilter: (v: 'Todas' | ExitStatus) => void; studentById: (id: number) => Student; decideRequest: (id: number, status: 'Aprovada' | 'Liberada' | 'Recusada') => void; setShowExitModal: (v: boolean) => void }) {
  return <>
    <PageHeader eyebrow="Portaria" title="Autorizações de saída" description="Analise os pedidos e acompanhe cada saída até a portaria."
      action={<button className="primary-button" onClick={() => setShowExitModal(true)}><DoorOpen size={17} /> Nova autorização</button>} />
    <div className="exit-tabs">{(['Todas', 'Pendente', 'Aprovada', 'Liberada', 'Recusada'] as const).map((status) =>
      <button key={status} className={filter === status ? 'active' : ''} onClick={() => setFilter(status)}>
        {status}<b>{status === 'Todas' ? allRequests.length : allRequests.filter((r) => r.status === status).length}</b>
      </button>)}
    </div>
    <div className="exit-list">
      {requests.map((r) => {
        const s = studentById(r.studentId)
        return <div className="exit-card panel" key={r.id}>
          <div className="exit-student"><img src={s.photo} alt="" /><div><strong>{s.name}</strong><small>{shortRoom(s.room)} · Matrícula NX-{String(s.id).padStart(3, '0')}</small></div></div>
          <div className="exit-detail">
            <strong>{r.reason}</strong>
            <span><CalendarDays size={14} /> {r.date}</span><span><Clock3 size={14} /> {r.time}</span><span><UserRound size={14} /> {r.guardian}</span>
          </div>
          <div className="exit-actions">
            <StatusBadge status={r.status} />
            {r.status === 'Pendente' && <div className="decision-buttons">
              <button className="approve" onClick={() => decideRequest(r.id, 'Aprovada')}><Check size={15} /> Aprovar</button>
              <button className="deny" onClick={() => decideRequest(r.id, 'Recusada')}><X size={15} /> Recusar</button>
            </div>}
            {r.status === 'Aprovada' && <button className="approve" onClick={() => decideRequest(r.id, 'Liberada')}><Check size={15} /> Confirmar saída</button>}
          </div>
        </div>
      })}
      {requests.length === 0 && <EmptyState title="Nenhuma autorização com esse status" detail="Escolha outra aba para ver os demais registros." />}
    </div>
  </>
}

/* ---------- Reservas ---------- */

function ReservationsPage({ reservations, onCreate, onDecide }: { reservations: Reservation[]; onCreate: (reservation: Reservation) => Promise<boolean>; onDecide: (id: number, status: ReservationStatus) => void }) {
  const [environment, setEnvironment] = useState(environments[0])
  const [requester, setRequester] = useState('')
  const [date, setDate] = useState(() => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date()))
  const [start, setStart] = useState('09:00')
  const [end, setEnd] = useState('10:00')
  const [purpose, setPurpose] = useState('')
  const [error, setError] = useState('')
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!requester.trim() || !purpose.trim()) { setError('Preencha o solicitante e a finalidade.'); return }
    if (start >= end) { setError('O término precisa ser depois do início.'); return }
    const created = await onCreate({ id: Date.now(), environment, requester: requester.trim(), date, start, end, purpose: purpose.trim(), status: 'Pendente', createdAt: 'Agora' })
    if (created) { setRequester(''); setPurpose(''); setError('') }
  }
  const dateLabel = (value: string) => { const [y, m, d] = value.split('-'); return `${d}/${m}/${y}` }
  return <>
    <PageHeader eyebrow="Agenda da escola" title="Reservas de ambientes" description="Solicite laboratórios e salas sem conflito de horário." />
    <div className="reservation-layout">
      <form className="panel reservation-form" onSubmit={submit}>
        <div className="panel-heading"><div><span className="section-kicker">Nova solicitação</span><h2>Reservar um ambiente</h2></div></div>
        <label>Ambiente<select value={environment} onChange={(e) => setEnvironment(e.target.value)}>{environments.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Solicitante<input value={requester} onChange={(e) => setRequester(e.target.value)} placeholder="Nome do professor ou funcionário" /></label>
        <label>Data<input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></label>
        <div className="form-row">
          <label>Início<input type="time" value={start} onChange={(e) => setStart(e.target.value)} required /></label>
          <label>Término<input type="time" value={end} onChange={(e) => setEnd(e.target.value)} required /></label>
        </div>
        <label>Finalidade<textarea value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Ex.: aula prática, reunião, apresentação" /></label>
        {error && <p className="reservation-error">{error}</p>}
        <button className="primary-button" type="submit"><CalendarDays size={16} /> Solicitar reserva</button>
        <small className="reservation-hint">O sistema bloqueia reservas no mesmo ambiente e horário.</small>
      </form>
      <section className="reservation-list-wrap">
        <div className="panel-heading reservation-list-heading">
          <div><span className="section-kicker">Agenda</span><h2>Solicitações</h2></div>
          <span className="reservation-count">{reservations.length} registros</span>
        </div>
        <div className="reservation-list">
          {reservations.slice().sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`)).map((item) => <article className="panel reservation-card" key={item.id}>
            <div className="reservation-card-top"><span className="reservation-room-icon"><CalendarDays size={18} /></span><StatusBadge status={item.status} /></div>
            <h3>{item.environment}</h3>
            <p>{item.purpose}</p>
            <div className="reservation-meta"><span><CalendarDays size={14} />{dateLabel(item.date)}</span><span><Clock3 size={14} />{item.start}–{item.end}</span></div>
            <div className="reservation-requester">Solicitado por <strong>{item.requester}</strong></div>
            {item.status === 'Pendente' && <div className="decision-buttons">
              <button className="approve" onClick={() => onDecide(item.id, 'Aprovada')}><Check size={15} /> Aprovar</button>
              <button className="deny" onClick={() => onDecide(item.id, 'Recusada')}><X size={15} /> Recusar</button>
            </div>}
            {item.status === 'Aprovada' && <button className="secondary-button" onClick={() => onDecide(item.id, 'Cancelada')}>Cancelar reserva</button>}
          </article>)}
          {reservations.length === 0 && <EmptyState title="Nenhuma reserva ainda" detail="Use o formulário ao lado para criar a primeira." />}
        </div>
      </section>
    </div>
  </>
}

/* ---------- Histórico ---------- */

function HistoryPage({ requests, reservations, studentById }: { requests: ExitRequest[]; reservations: Reservation[]; studentById: (id: number) => Student }) {
  const exits = requests.filter((r) => r.status !== 'Pendente')
  const booked = reservations.filter((r) => r.status !== 'Pendente').slice().sort((a, b) => `${b.date}${b.start}`.localeCompare(`${a.date}${a.start}`))
  const dateLabel = (value: string) => { const [y, m, d] = value.split('-'); return `${d}/${m}/${y}` }
  return <>
    <PageHeader eyebrow="Registros" title="Histórico" description="Decisões de liberação de saída e de reservas de ambientes, separadas para consulta." />
    <div className="history-banner">
      <div className="history-icon"><ShieldCheck size={21} /></div>
      <div><strong>Rastreabilidade ativa</strong><span>Os registros ficam salvos no banco de dados e valem para todos os computadores.</span></div>
      <span className="history-count">{exits.length + booked.length} registros</span>
    </div>
    <div className="history-columns">
      <section className="panel history-box">
        <div className="history-box-head">
          <span className="history-box-icon"><DoorOpen size={20} /></span>
          <div><h2>Liberações de saída</h2><small>Aprovadas, liberadas e recusadas</small></div>
          <b>{exits.length}</b>
        </div>
        <div className="history-list">
          {exits.map((r) => {
            const s = studentById(r.studentId)
            const ok = r.status === 'Aprovada' || r.status === 'Liberada'
            return <div className="history-row" key={r.id}>
              <div className={`history-symbol ${ok ? 'ok' : 'no'}`}>{ok ? <Check size={17} /> : <X size={17} />}</div>
              <img className="history-photo" src={s.photo} alt="" />
              <div className="history-main"><strong>{s.name}</strong><span>{r.reason} · {r.date} às {r.time}</span><span>{shortRoom(s.room)} · Responsável: {r.guardian}</span></div>
              <StatusBadge status={r.status} />
            </div>
          })}
          {exits.length === 0 && <EmptyState title="Nenhuma liberação registrada" detail="As saídas aprovadas ou recusadas aparecem aqui." />}
        </div>
      </section>
      <section className="panel history-box">
        <div className="history-box-head">
          <span className="history-box-icon"><CalendarDays size={20} /></span>
          <div><h2>Reservas de ambientes</h2><small>Aprovadas, recusadas e canceladas</small></div>
          <b>{booked.length}</b>
        </div>
        <div className="history-list">
          {booked.map((r) => {
            const ok = r.status === 'Aprovada'
            return <div className="history-row" key={r.id}>
              <div className={`history-symbol ${ok ? 'ok' : 'no'}`}>{ok ? <Check size={17} /> : <X size={17} />}</div>
              <div className="history-main"><strong>{r.environment}</strong><span>{dateLabel(r.date)} · {r.start}–{r.end}</span><span>{r.purpose} · {r.requester}</span></div>
              <StatusBadge status={r.status} />
            </div>
          })}
          {booked.length === 0 && <EmptyState title="Nenhuma reserva registrada" detail="As reservas aprovadas, recusadas ou canceladas aparecem aqui." />}
        </div>
      </section>
    </div>
  </>
}

/* ---------- Modais ---------- */

function StudentModal({ student, close, toggleAttendance, tab, setTab, card, onSaveCard }: { student: Student; close: () => void; toggleAttendance: (id: number) => void; tab: 'dados' | 'boletim'; setTab: (t: 'dados' | 'boletim') => void; card?: ReportCard; onSaveCard: (card: ReportCard) => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close])
  const avg = overallAverage(card)
  return <div className="modal-backdrop" onMouseDown={close}>
    <div className={`modal student-modal ${tab === 'boletim' ? 'is-wide' : ''}`} role="dialog" aria-modal="true" aria-label={`Ficha de ${student.name}`} onMouseDown={(e) => e.stopPropagation()}>
      <button className="modal-close" onClick={close} aria-label="Fechar"><X size={18} /></button>
      <div className="student-profile-head">
        <img src={student.photo} alt={`Foto 4x4 de ${student.name}`} />
        <div>
          <span className="eyebrow">{tab === 'boletim' ? 'Boletim escolar · 2026' : 'Ficha do aluno'}</span>
          <h2>{student.name}</h2>
          <p>Matrícula NX-{String(student.id).padStart(3, '0')} · {student.room}</p>
          <div className="profile-pills">
            <button className={`attendance-pill ${student.attendance}`} onClick={() => toggleAttendance(student.id)}>
              {student.attendance === 'presente' ? <Check size={13} /> : <X size={13} />} {student.attendance === 'presente' ? 'Presente hoje' : 'Ausente hoje'}
            </button>
            <span className={`grade-pill tone-${gradeTone(avg)}`}>Média {fmt(avg)} · {situation(avg)}</span>
          </div>
        </div>
      </div>
      <div className="modal-tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'dados'} className={tab === 'dados' ? 'active' : ''} onClick={() => setTab('dados')}><UserRound size={15} /> Dados</button>
        <button role="tab" aria-selected={tab === 'boletim'} className={tab === 'boletim' ? 'active' : ''} onClick={() => setTab('boletim')}><BookOpen size={15} /> Boletim</button>
      </div>
      {tab === 'dados' ? <>
        <div className="profile-grid">
          <div><span>Sala</span><strong>{student.room}</strong></div>
          <div><span>Série</span><strong>{student.grade}</strong></div>
          <div><span>Responsável</span><strong>{student.guardian}</strong></div>
          <div><span>Contato</span><strong>{student.phone}</strong></div>
        </div>
      </> : card ? <BoletimPanel studentName={student.name} card={card} onSave={onSaveCard} /> : <EmptyState title="Boletim ainda não lançado" detail="As notas aparecem aqui assim que forem registradas." />}
    </div>
  </div>
}

function ExitModal({ students, close, onCreate }: { students: Student[]; close: () => void; onCreate: (request: ExitRequest) => void }) {
  const [studentId, setStudentId] = useState('1')
  const [reason, setReason] = useState('Consulta médica')
  const [date, setDate] = useState(new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' }).format(new Date()))
  const [time, setTime] = useState('14:30')
  const [guardian, setGuardian] = useState('')
  const [notes, setNotes] = useState('')
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    onCreate({ id: Date.now(), studentId: Number(studentId), reason, date, time, guardian: guardian || students.find((s) => s.id === Number(studentId))?.guardian || 'Responsável não informado', notes, status: 'Pendente', createdAt: 'Agora' })
  }
  return <div className="modal-backdrop" onMouseDown={close}>
    <form className="modal exit-modal" onSubmit={submit} onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Nova autorização de saída">
      <button type="button" className="modal-close" onClick={close} aria-label="Fechar"><X size={18} /></button>
      <span className="eyebrow">Portaria</span>
      <h2>Nova autorização de saída</h2>
      <p className="modal-subtitle">Preencha os dados para enviar o pedido à coordenação.</p>
      <label>Aluno<select value={studentId} onChange={(e) => setStudentId(e.target.value)}>{students.map((s) => <option value={s.id} key={s.id}>{s.name} · {shortRoom(s.room)}</option>)}</select></label>
      <div className="form-row">
        <label>Data<input value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label>Horário<input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></label>
      </div>
      <label>Motivo<select value={reason} onChange={(e) => setReason(e.target.value)}><option>Consulta médica</option><option>Compromisso familiar</option><option>Atividade esportiva</option><option>Outro</option></select></label>
      <label>Responsável pela retirada<input placeholder="Nome do responsável" value={guardian} onChange={(e) => setGuardian(e.target.value)} /></label>
      <label>Observações<textarea placeholder="Informações para a portaria" value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
      <div className="modal-actions">
        <button type="button" className="secondary-button" onClick={close}>Cancelar</button>
        <button type="submit" className="primary-button"><FileCheck2 size={16} /> Criar autorização</button>
      </div>
    </form>
  </div>
}

export default App
