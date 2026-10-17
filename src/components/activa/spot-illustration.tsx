import type { Place } from '@/lib/types';
import styles from './spot-card.module.css';

/** Reusable category artwork, deliberately distinct from a photo of the actual venue. */
export function SpotIllustration({ place, className }: { place: Place; className?: string }) {
  const tags = (place.categories || []).join(' ').toLowerCase();
  const name = place.name.toLowerCase();
  const zoo = /zoo|animal|tierpark|tiergehege/.test(`${tags} ${name}`);
  const pool = /swimming|water_park|aquatic/.test(tags) || /schwimmbad|^bad\s?\d|hallenbad/.test(name);
  const cinema = /cinema/.test(tags) || /kino|cinemotion/.test(name);
  const food = /catering|restaurant|cafe|pub|bar/.test(tags);
  const sport = /sport|activity_park|bowling|golf|fitness/.test(tags);
  const culture = /museum|culture|theatre|library|historic|tourism/.test(tags);
  const kind = zoo ? 'zoo' : pool ? 'pool' : cinema ? 'cinema' : food ? 'food' : sport ? 'sport' : culture ? 'culture' : 'park';
  return (
    <svg viewBox="0 0 360 220" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false" className={[styles.illustration, className].filter(Boolean).join(' ')} data-illustration={kind}>
      <rect width="360" height="220" fill={cinema ? '#304c59' : pool ? '#bfe3e4' : food ? '#f3e1ca' : sport ? '#e3ebcf' : culture ? '#e5e2ee' : '#d6ebe4'} />
      {cinema ? <>
        <rect x="63" y="-15" width="234" height="153" rx="24" fill="#6f7165" />
        <rect x="80" y="3" width="200" height="115" rx="12" fill="#faeac6" />
        <circle cx="239" cy="31" r="12" fill="#efa85c" />
        <path d="M96 98l43-47 36 33 34-25 49 39" fill="none" stroke="#dda45f" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        {[0, 1, 2, 3, 4, 5].map(i => <g key={i}><rect x={16 + i * 62} y="164" width="36" height="43" rx="16" fill="#25404d" /><rect x={-12 + i * 65} y="202" width="44" height="45" rx="18" fill="#1d3541" /></g>)}
      </> : pool ? <>
        <rect width="360" height="13" fill="#f4ead8" />
        <rect y="207" width="360" height="13" fill="#f4ead8" />
        {[55, 111, 167].map(y => <g key={y}>{Array.from({ length: 19 }, (_, i) => <circle key={i} cx={i * 21} cy={y} r="4.5" fill="#eeaa59" />)}</g>)}
        <g fill="none" stroke="#e5f5f0" strokeWidth="3.5" strokeLinecap="round"><path d="M27 83q22-13 44 0t44 0M215 138q22-13 44 0t44 0M104 194q22-13 44 0t44 0" /></g>
      </> : zoo ? <>
        <circle cx="295" cy="48" r="29" fill="#f5d294" />
        <path d="M0 140q80-20 170 0t190 0v80H0z" fill="#9bc8c9" />
        <ellipse cx="177" cy="132" rx="47" ry="49" fill="#91928c" />
        <ellipse cx="177" cy="158" rx="28" ry="20" fill="#c4c3b6" />
        <ellipse cx="165" cy="122" rx="6" ry="7" fill="#262f2d" /><ellipse cx="190" cy="122" rx="6" ry="7" fill="#262f2d" />
        <circle cx="167" cy="120" r="2" fill="#fff" /><circle cx="192" cy="120" r="2" fill="#fff" />
        <ellipse cx="177" cy="150" rx="9" ry="6" fill="#303734" />
        <g stroke="#f6f2e8" strokeWidth="2" strokeLinecap="round"><path d="M158 155l-32-5m32 11l-34 6m72-12l32-5m-32 11l34 6" /></g>
        <path d="M0 158q70-17 140 2t220-7v67H0z" fill="#6fa9af" /><path d="M0 191q70-11 140 7t220-9v31H0z" fill="#4f919d" />
        <g fill="none" stroke="#b5dcdb" strokeWidth="3" strokeLinecap="round"><path d="M32 192q11-8 22 0m182-15q11-8 22 0" /></g>
      </> : food ? <>
        <circle cx="289" cy="48" r="27" fill="#f5bd7c" /><ellipse cx="178" cy="187" rx="100" ry="12" fill="#ddc7ab" />
        <path d="M104 102h129v47q0 35-39 35h-51q-39 0-39-35z" fill="#fbfaf3" />
        <path d="M233 110h16q36 0 29 27-4 18-44 18" fill="none" stroke="#fbfaf3" strokeWidth="12" />
        <g fill="none" stroke="#ba926d" strokeWidth="4" strokeLinecap="round"><path d="M142 84q-15-15 0-30m35 30q-15-15 0-30m35 30q-15-15 0-30" /></g>
        <path d="M133 136q37 27 74 0" fill="none" stroke="#bad0b0" strokeWidth="5" strokeLinecap="round" />
      </> : sport ? <>
        <circle cx="292" cy="47" r="26" fill="#f4d18d" /><path d="M0 185q145-30 360 4v31H0z" fill="#b5c99c" />
        <circle cx="180" cy="126" r="63" fill="#f5bd7f" /><path d="M120 109q60 40 120 0m-111 59q51-58 102 0M180 63v126" fill="none" stroke="#bd7d4a" strokeWidth="3.5" />
        <path d="M43 145l-13 20m279-48l14 16" stroke="#89a487" strokeWidth="5" strokeLinecap="round" />
      </> : culture ? <>
        <circle cx="288" cy="47" r="26" fill="#f5d596" /><path d="M64 88l116-53 116 53z" fill="#8f9c90" /><rect x="69" y="89" width="222" height="13" rx="4" fill="#faf5e9" />
        {[92, 144, 196, 248].map(x => <rect key={x} x={x} y="102" width="21" height="77" rx="3" fill="#faf5e9" />)}
        <path d="M73 183h215m-228 17h241" stroke="#b9b4c6" strokeWidth="10" strokeLinecap="round" />
      </> : <>
        <circle cx="285" cy="47" r="28" fill="#f6d497" /><path d="M0 178q80-32 173 0t187-7v49H0z" fill="#adc8a6" />
        <path d="M142 220q64-40 18-65" fill="none" stroke="#f5ead2" strokeWidth="23" />
        {[76, 240].map((x, i) => <g key={x}><path d={`M${x} 173v-69`} stroke="#98846a" strokeWidth="9" strokeLinecap="round" /><ellipse cx={x} cy={94 - i * 8} rx="37" ry="46" fill={i ? '#7ea58b' : '#91b195'} /></g>)}
      </>}
    </svg>
  );
}
