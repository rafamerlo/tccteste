import { useEffect, useState } from 'react'
import { Clock3, Menu, X } from 'lucide-react'

export type NavLink = { id: string; label: string; badge?: number }

/** Marca do SENAI Connect: ícone de conexão + nome do sistema. */
export function Logo({ onClick, compact = false }: { onClick?: () => void; compact?: boolean }) {
  return (
    <button className={`logo ${compact ? 'logo-compact' : ''}`} onClick={onClick} aria-label="SENAI Connect, ir para o início">
      <svg className="logo-mark" viewBox="0 0 56 56" aria-hidden="true">
        <defs>
          <linearGradient id="logoGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#FF2E4A" />
            <stop offset="1" stopColor="#B80016" />
          </linearGradient>
        </defs>
        <path d="M12 4 H52 L44 52 H4 Z" fill="url(#logoGrad)" />
        <path d="M19 37 L28 20 L39 33" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="19" cy="37" r="4.6" fill="#fff" />
        <circle cx="28" cy="20" r="4.6" fill="#fff" />
        <circle cx="39" cy="33" r="4.6" fill="#fff" />
      </svg>
      <span className="logo-text">
        <span className="logo-name"><strong>SENAI</strong> <em>Connect</em></span>
        {!compact && <small>Escola SENAI A. Jacob Lafer</small>}
      </span>
    </button>
  )
}

function Clock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  const tz = 'America/Sao_Paulo'
  const date = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', timeZone: tz }).format(now)
  const time = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz }).format(now)
  const clean = date.replace(/\./g, '')
  const label = clean.charAt(0).toUpperCase() + clean.slice(1)
  return (
    <div className="clock" title="Horário de São Paulo">
      <Clock3 size={16} strokeWidth={2} />
      <strong>{time}</strong>
      <span>{label}</span>
    </div>
  )
}

export default function Header({ links, active, onSelect, onLogo, cta, user }: {
  links: NavLink[]; active: string; onSelect: (id: string) => void; onLogo: () => void
  user?: { name: string; email: string } | null
  cta: { label: string; onClick: () => void; variant?: 'solid' | 'ghost' }
}) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const close = () => { if (window.innerWidth > 1080) setOpen(false) }
    window.addEventListener('resize', close)
    return () => window.removeEventListener('resize', close)
  }, [])

  return (
    <header className={`site-header ${open ? 'is-open' : ''}`}>
      <div className="header-inner">
        <Logo onClick={() => { onLogo(); setOpen(false) }} />

        <nav className="site-nav" aria-label="Menu principal">
          {links.map((l) => (
            <button
              key={l.id}
              className={`site-link ${active === l.id ? 'active' : ''}`}
              aria-current={active === l.id ? 'page' : undefined}
              onClick={() => { onSelect(l.id); setOpen(false) }}
            >
              {l.label}
              {l.badge ? <b className="nav-badge">{l.badge}</b> : null}
            </button>
          ))}
          <button className="site-link nav-cta" onClick={() => { cta.onClick(); setOpen(false) }}>{cta.label}</button>
        </nav>

        <div className="header-actions">
          <Clock />
          {user && (
            <span className="user-chip" title={user.name}>
              <span className="user-avatar">{user.name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase()}</span>
              <span className="user-info"><strong>{user.name.split(' ')[0]}</strong><small>{user.email}</small></span>
            </span>
          )}
          <button className={`header-cta ${cta.variant === 'ghost' ? 'ghost' : ''}`} onClick={() => { cta.onClick(); setOpen(false) }}>
            {cta.label}
          </button>
          <button className="nav-toggle" onClick={() => setOpen(!open)} aria-label={open ? 'Fechar menu' : 'Abrir menu'} aria-expanded={open}>
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>
    </header>
  )
}
