import { useState } from 'react'
import { CONTACT_AJAX, CONTACT_FORM } from './config'
import { ArrowRight, Check, ExternalLink, History, Mail, MapPin, ShieldCheck, Radio } from 'lucide-react'

const MAPS_URL = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent('Escola SENAI A. Jacob Lafer, Santo André - SP')

type SystemPage = 'dashboard' | 'carometro' | 'saidas' | 'reservas' | 'historico'

const flow = [
  { title: 'Pedido registrado', text: 'A portaria ou a secretaria abre a solicitação de saída com aluno, motivo e responsável.' },
  { title: 'Coordenação decide', text: 'O pedido aparece na hora para a coordenação, que aprova ou recusa em um clique.' },
  { title: 'Portaria libera', text: 'Com a aprovação na tela, a portaria confirma a saída e o registro vai para o histórico.' },
]

export default function Landing({ openSystem, goTo }: {
  openSystem: (page?: SystemPage) => void; goTo: (id: string) => void
}) {
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [viaTab, setViaTab] = useState(false)
  const [sendError, setSendError] = useState('')

  return (
    <main className="landing">
      {/* INÍCIO */}
      <section id="inicio" className="hero">
        <div className="hero-copy">
          <p className="hero-kicker"><span className="kicker-bar" />Escola SENAI A. Jacob Lafer</p>
          <h1>Conectando pessoas, organizando o futuro.</h1>
          <p className="hero-lead">
            O SENAI Connect reúne carômetro, autorizações de saída e reserva de ambientes em um só lugar.
            Coordenação, portaria e professores veem a mesma informação, ao mesmo tempo.
          </p>
          <div className="hero-actions">
            <button className="btn btn-solid" onClick={() => openSystem()}>Acessar sistema <ArrowRight size={18} /></button>
            <button className="btn btn-outline" onClick={() => goTo('sobre')}>Conhecer a escola</button>
          </div>
          <ul className="hero-points">
            <li><Check size={16} /> 4 salas e 40 alunos cadastrados</li>
            <li><Check size={16} /> Presença atualizada em tempo real</li>
          </ul>
        </div>

        <figure className="hero-visual">
          <span className="hv-block" aria-hidden="true" />
          <span className="hv-ring" aria-hidden="true" />
          <span className="hv-dots" aria-hidden="true" />
          <div className="photo-frame">
            <img src="/escola.jpg" alt="Fachada da Escola SENAI A. Jacob Lafer" />
          </div>
          <span className="photo-badge"><strong>1942</strong><small>Rede SENAI</small></span>
          <figcaption>
            <a className="photo-caption" href={MAPS_URL} target="_blank" rel="noopener noreferrer" aria-label="Ver a Escola SENAI A. Jacob Lafer no Google Maps (abre em nova aba)">
              <span className="caption-icon"><MapPin size={20} /></span>
              <span>
                <strong>Escola SENAI A. Jacob Lafer</strong>
                <small>Santo André, São Paulo · Ver no mapa <ExternalLink size={12} /></small>
              </span>
            </a>
          </figcaption>
        </figure>
      </section>

      {/* SOBRE */}
      <section id="sobre" className="block about">
        <div className="about-intro">
          <h2>Menos recado no corredor, mais controle na rotina</h2>
          <p>
            O SENAI Connect nasceu na Escola SENAI A. Jacob Lafer para tirar o bilhete de papel e o telefonema do caminho.
            A saída de um aluno, por exemplo, segue sempre o mesmo fluxo:
          </p>
          <div className="about-values">
            <span><Radio size={18} /> Comunicação direta</span>
            <span><ShieldCheck size={18} /> Mais segurança</span>
            <span><History size={18} /> Histórico confiável</span>
          </div>
        </div>
        <ol className="flow">
          {flow.map((f, i) => (
            <li key={f.title}>
              <span className="flow-step">{i + 1}</span>
              <div>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>


      <footer className="site-footer">
        <span>© 2026 SENAI Connect</span>
        <a href={MAPS_URL} target="_blank" rel="noopener noreferrer">Escola SENAI A. Jacob Lafer · Santo André, SP</a>
      </footer>
    </main>
  )
}
