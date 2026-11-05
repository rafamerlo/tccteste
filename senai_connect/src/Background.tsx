/**
 * Fundo abstrato fixo: base branca com formas vermelhas bem marcadas
 * nas bordas da tela, deixando a área central livre para o conteúdo.
 */
export default function Background() {
  return (
    <div className="abstract-bg" aria-hidden="true">
      <svg viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bgRed" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#FF2E4A" />
            <stop offset=".55" stopColor="#E3001B" />
            <stop offset="1" stopColor="#A60014" />
          </linearGradient>
          <linearGradient id="bgRedSoft" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#E3001B" stopOpacity=".0" />
            <stop offset=".5" stopColor="#E3001B" stopOpacity=".18" />
            <stop offset="1" stopColor="#E3001B" stopOpacity=".0" />
          </linearGradient>
          <pattern id="bgDots" width="26" height="26" patternUnits="userSpaceOnUse">
            <circle cx="3" cy="3" r="2.6" fill="#E3001B" />
          </pattern>
          <pattern id="bgStripes" width="34" height="34" patternUnits="userSpaceOnUse" patternTransform="rotate(-35)">
            <rect width="14" height="34" fill="#E3001B" />
          </pattern>
          <clipPath id="bgStripeClip">
            <path d="M0 880 L380 1080 L0 1080 Z" />
          </clipPath>
        </defs>

        <rect width="1920" height="1080" fill="#FFFFFF" />

        {/* Bloco vermelho principal, canto superior direito */}
        <path d="M1500 -40 C1640 40 1700 150 1820 190 C1890 214 1950 200 1990 180 V-40 Z" fill="url(#bgRed)" />
        <path d="M1280 -40 C1360 120 1520 210 1700 330 C1820 410 1900 520 1960 640 V-40 Z" fill="url(#bgRed)" opacity=".14" />

        {/* Anéis concêntricos */}
        <g fill="none" stroke="#E3001B">
          <circle cx="1700" cy="820" r="150" strokeWidth="3" opacity=".55" />
          <circle cx="1700" cy="820" r="210" strokeWidth="2" opacity=".32" />
          <circle cx="1700" cy="820" r="270" strokeWidth="1.5" opacity=".18" />
          <circle cx="90" cy="120" r="70" strokeWidth="3" opacity=".45" />
          <circle cx="90" cy="120" r="115" strokeWidth="1.5" opacity=".25" />
        </g>
        <circle cx="1700" cy="820" r="58" fill="url(#bgRed)" opacity=".9" />

        {/* Faixa listrada, canto inferior esquerdo */}
        <rect x="0" y="860" width="420" height="240" fill="url(#bgStripes)" clipPath="url(#bgStripeClip)" opacity=".85" />
        <path d="M0 840 L460 1080" stroke="#E3001B" strokeWidth="6" />

        {/* Malha de pontos */}
        <rect x="520" y="930" width="182" height="104" fill="url(#bgDots)" opacity=".55" />
        <rect x="1560" y="340" width="156" height="104" fill="url(#bgDots)" opacity=".45" />

        {/* Linha de conexão atravessando a tela */}
        <path d="M-20 640 C320 560 560 700 900 640 C1240 580 1460 470 1940 520" fill="none" stroke="url(#bgRedSoft)" strokeWidth="2.5" />
        <path d="M-20 668 C320 588 560 728 900 668 C1240 608 1460 498 1940 548" fill="none" stroke="url(#bgRedSoft)" strokeWidth="1.5" />

        {/* Marcas geométricas */}
        <path d="M1240 980 l26 -46 l26 46 z" fill="#E3001B" opacity=".85" />
        <g stroke="#E3001B" strokeWidth="4" strokeLinecap="round" opacity=".7">
          <path d="M700 1000 v28 M686 1014 h28" />
          <path d="M1840 980 v22 M1829 991 h22" />
          <path d="M880 1040 v20 M870 1050 h20" />
        </g>
        <rect x="1060" y="1010" width="120" height="10" rx="5" fill="#E3001B" opacity=".75" transform="rotate(-18 1120 1015)" />
      </svg>
    </div>
  )
}
