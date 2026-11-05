import { useState } from 'react'
import { api, setToken } from './api'
import { ArrowLeft, ArrowRight, Eye, EyeOff, LogIn, ShieldCheck, UserPlus } from 'lucide-react'

export type SessionUser = { name: string; email: string }

const DEMO = { email: 'demo@senaiconnect.com', password: 'senai123' }

const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim())

export default function Auth({ onAuth, onBack }: { onAuth: (user: SessionUser, remember: boolean) => void; onBack: () => void }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const switchMode = (m: 'login' | 'signup') => { setMode(m); setError(''); setPassword(''); setConfirm('') }

  const login = async (e?: React.FormEvent, override?: { email: string; password: string }) => {
    e?.preventDefault()
    const em = (override?.email ?? email).trim().toLowerCase()
    const pw = override?.password ?? password
    if (!emailOk(em)) { setError('Digite um e-mail válido.'); return }
    if (!pw) { setError('Digite sua senha.'); return }
    setBusy(true)
    try {
      const r = await api<{ token: string; user: SessionUser }>('/auth/login', { method: 'POST', body: { email: em, password: pw, remember } })
      setToken(r.token, remember)
      onAuth(r.user, remember)
    } catch (err) {
      setError((err as Error).message)
    } finally { setBusy(false) }
  }

  const signup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (name.trim().length < 3) { setError('Digite seu nome completo.'); return }
    if (!emailOk(email)) { setError('Digite um e-mail válido.'); return }
    if (password.length < 6) { setError('A senha precisa ter pelo menos 6 caracteres.'); return }
    if (password !== confirm) { setError('As senhas não conferem.'); return }
    setBusy(true)
    try {
      const r = await api<{ token: string; user: SessionUser }>('/auth/signup', { method: 'POST', body: { name: name.trim(), email: email.trim().toLowerCase(), password, remember } })
      setToken(r.token, remember)
      onAuth(r.user, remember)
    } catch (err) {
      setError((err as Error).message)
    } finally { setBusy(false) }
  }

  const useDemo = () => { setMode('login'); setEmail(DEMO.email); setPassword(DEMO.password); login(undefined, { email: DEMO.email, password: DEMO.password }) }

  return (
    <main className="auth">
      <div className="auth-card">
        <aside className="auth-side">
          <img src="/escola.jpg" alt="" />
          <div className="auth-side-content">
            <span className="auth-side-tag">SENAI Connect</span>
            <h2>A rotina da escola em um só lugar.</h2>
            <p>Carômetro, autorizações de saída e reservas de ambientes para a equipe da Escola SENAI A. Jacob Lafer.</p>
            <span className="auth-side-note"><ShieldCheck size={16} /> Acesso restrito à equipe da escola</span>
          </div>
        </aside>

        <section className="auth-main">
          <button className="auth-back" onClick={onBack}><ArrowLeft size={16} /> Voltar ao site</button>
          <h1>{mode === 'login' ? 'Entrar na sua conta' : 'Criar conta'}</h1>
          <p className="auth-sub">{mode === 'login' ? 'Use o e-mail e a senha cadastrados.' : 'Preencha seus dados para acessar o sistema.'}</p>

          <div className="auth-tabs" role="tablist">
            <button role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'active' : ''} onClick={() => switchMode('login')}><LogIn size={16} /> Entrar</button>
            <button role="tab" aria-selected={mode === 'signup'} className={mode === 'signup' ? 'active' : ''} onClick={() => switchMode('signup')}><UserPlus size={16} /> Criar conta</button>
          </div>

          <form className="auth-form" onSubmit={mode === 'login' ? login : signup} noValidate>
            {mode === 'signup' && <label>Nome completo<input autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" /></label>}
            <label>E-mail<input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@escola.com" /></label>
            <label>Senha
              <span className="pw-field">
                <input type={show ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === 'signup' ? 'Mínimo de 6 caracteres' : 'Sua senha'} />
                <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button>
              </span>
            </label>
            {mode === 'signup' && <label>Confirmar senha<input type={show ? 'text' : 'password'} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repita a senha" /></label>}
            <label className="auth-check"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Manter conectado neste computador</label>
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button className="btn btn-solid auth-submit" type="submit" disabled={busy}>
              {busy ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Criar conta e entrar'} <ArrowRight size={18} />
            </button>
          </form>

          {mode === 'login' && (
            <div className="auth-demo">
              <span>Só quer conhecer o sistema?</span>
              <button onClick={useDemo}>Entrar com a conta de demonstração</button>
            </div>
          )}
          <p className="auth-switch">
            {mode === 'login' ? <>Ainda não tem conta? <button onClick={() => switchMode('signup')}>Criar conta</button></> : <>Já tem conta? <button onClick={() => switchMode('login')}>Entrar</button></>}
          </p>
        </section>
      </div>
    </main>
  )
}
