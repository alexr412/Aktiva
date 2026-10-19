import type { Place } from '@/lib/types';
import { getSpotIllustrationKind } from './spot-illustration-kind';
import styles from './spot-card.module.css';

/** Category artwork, not a venue photograph. Composed for a shallow card cover. */
export function SpotIllustration({ place, className }: { place: Place; className?: string }) {
  const kind = getSpotIllustrationKind(place);
  const backgrounds = {seal:'#b9deda',deer:'#e2e8c7',pool:'#b8e0e6',cinema:'#e5c8ae',minigolf:'#cdddb9',bowling:'#ead3bf',music:'#d9cdea',bar:'#e7cfb7',coffee:'#efddc5',food:'#eddbc6',sport:'#dce6c2',culture:'#dcd9e8',park:'#d5e5cd',explore:'#d3e5e2'};
  return <svg viewBox="0 0 360 144" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false" className={[styles.illustration,className].filter(Boolean).join(' ')} data-illustration={kind}>
    <rect width="360" height="144" fill={backgrounds[kind]} />
    <circle cx="290" cy="30" r="29" fill="#f5c578" opacity=".85" />
    {kind === 'seal' ? <>
      <path d="M0 96Q90 75 180 96T360 92V144H0Z" fill="#7fb8bc" />
      <path d="M0 127Q95 104 190 127T360 121V144H0Z" fill="#5095a2" />
      <ellipse cx="182" cy="104" rx="38" ry="34" fill="#838e8a" /><ellipse cx="182" cy="119" rx="22" ry="14" fill="#d3d0ba" />
      <g fill="#263e3e"><circle cx="170" cy="99" r="4"/><circle cx="195" cy="99" r="4"/><ellipse cx="182" cy="113" rx="6" ry="4"/></g>
      <path d="M165 118l-21-4m21 9l-24 3m58-8l22-4m-22 9l24 3" stroke="#f4f1de" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M40 123q13-8 26 0m204 6q13-8 26 0" fill="none" stroke="#bde4df" strokeWidth="3" strokeLinecap="round"/>
    </> : kind === 'deer' ? <>
      <path d="M0 119Q100 95 190 117T360 112V144H0Z" fill="#a7c194"/>
      <path d="M67 108V47m222 58V44" stroke="#8d9670" strokeWidth="7"/>
      <ellipse cx="67" cy="40" rx="28" ry="31" fill="#8ca783"/><ellipse cx="289" cy="37" rx="30" ry="33" fill="#9ab38c"/>
      <path d="M158 111v23m31-23v23" stroke="#9f7955" strokeWidth="7" strokeLinecap="round"/>
      <ellipse cx="177" cy="96" rx="31" ry="23" fill="#be9468"/>
      <path d="M192 98l7-34 16 3-8 36" fill="#be9468"/><ellipse cx="207" cy="62" rx="14" ry="18" fill="#c9a77c"/>
      <path d="M200 46l-8-19m20 18l8-19m-26 10l-10-3m34 1l10-3" stroke="#8d7454" strokeWidth="3" strokeLinecap="round"/>
      <circle cx="213" cy="60" r="2.5" fill="#33483b"/><path d="M199 57l-14-6 8 13" fill="#b28b61"/>
      <g fill="#ead5b0"><circle cx="164" cy="91" r="3"/><circle cx="176" cy="99" r="3"/><circle cx="183" cy="87" r="3"/></g>
    </> : kind === 'pool' ? <>
      <path d="M0 30H360M0 130H360" stroke="#f1e9ce" strokeWidth="10"/>
      {[56,91].map(y=><path key={y} d={'M0 '+y+'H360'} stroke="#e8b46a" strokeWidth="4" strokeDasharray="5 9"/>)}
      <path d="M54 76q18-9 36 0t36 0m111 36q18-9 36 0t36 0" fill="none" stroke="#e7f8f2" strokeWidth="3" strokeLinecap="round"/>
      <g transform="translate(174 71) rotate(-18)"><ellipse rx="22" ry="15" fill="#f3e5bf"/><ellipse rx="12" ry="7" fill="#85bec8"/><path d="M-17-10l9 6m16 9l9 6" stroke="#dc9972" strokeWidth="6"/></g>
    </> : kind === 'cinema' ? <>
      <rect x="92" y="16" width="177" height="99" rx="9" fill="#6f7b78"/><rect x="100" y="23" width="161" height="81" rx="4" fill="#fff0ca"/>
      <path d="M164 43l35 20-35 20z" fill="#c78455"/>
      {[50,99,148,197,246,295].map(x=><g key={x}><rect x={x} y="112" width="35" height="41" rx="12" fill="#a25e50"/><path d={'M'+(x+4)+' 139h27'} stroke="#784e49" strokeWidth="5"/></g>)}
    </> : kind === 'minigolf' ? <>
      <path d="M0 113Q78 82 180 110T360 109V144H0Z" fill="#a2bd83"/>
      <ellipse cx="184" cy="116" rx="60" ry="17" fill="#82a56d"/><ellipse cx="193" cy="113" rx="14" ry="4" fill="#526f4b"/>
      <path d="M193 110V37" stroke="#faf4d7" strokeWidth="3"/><path d="M195 38l34 12-34 11z" fill="#da8961"/>
      <path d="M136 71l-22 42 23 2" fill="none" stroke="#738778" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="157" cy="119" r="6" fill="#fff6d9"/>
    </> : kind === 'bowling' ? <>
      <path d="M122 0h114l35 144H87Z" fill="#d8b28c"/><path d="M153 0l-11 144m65-144l11 144" stroke="#c89d75" strokeWidth="2"/>
      {[161,190,219].map((x,i)=><g key={x} transform={'translate('+x+' '+(i===1?46:35)+')'}><path d="M-5 0q-5 7-1 14l-8 26q-2 10 14 10t14-10L6 14Q10 7 5 0Z" fill="#fff2d8"/><path d="M-7 18H7" stroke="#cf856d" strokeWidth="4"/></g>)}
      <circle cx="151" cy="117" r="24" fill="#657d87"/><g fill="#314e59"><circle cx="146" cy="109" r="3"/><circle cx="155" cy="107" r="3"/><circle cx="153" cy="116" r="3"/></g>
    </> : kind === 'music' ? <>
      <path d="M65 0l38 144h54L133 0m103 0l-30 144h60L298 0" fill="#eee4f0" opacity=".55"/>
      <circle cx="180" cy="67" r="37" fill="#9a9eb6"/><path d="M143 67h74m-69-18h64m-64 36h64m-32-55v74m-21-67q-14 30 0 61m42-61q14 30 0 61" fill="none" stroke="#ded7e7" strokeWidth="2"/>
      <path d="M180 0v28" stroke="#838ca5" strokeWidth="3"/>
      <path d="M84 106V81l18-4v22" fill="none" stroke="#c48982" strokeWidth="4"/><ellipse cx="78" cy="108" rx="8" ry="5" fill="#c48982"/><ellipse cx="96" cy="101" rx="8" ry="5" fill="#c48982"/>
      <path d="M0 135q90-12 180 0t180 0v9H0Z" fill="#a89dbb"/>
    </> : kind === 'bar' ? <>
      <rect y="119" width="360" height="25" fill="#c0a481"/>
      <path d="M136 43h75l-37 47z" fill="#f9e7bd"/><path d="M143 52h61l-30 34z" fill="#c88c69"/>
      <path d="M174 88v30m-19 2h38" stroke="#f5eed6" strokeWidth="4" strokeLinecap="round"/>
      <path d="M181 58l20-37" stroke="#7c9f8c" strokeWidth="3"/><circle cx="208" cy="43" r="12" fill="#dec57e"/>
      <rect x="229" y="73" width="35" height="46" rx="7" fill="#768f88"/><path d="M233 82h27" stroke="#e9dac0" strokeWidth="4"/>
    </> : kind === 'coffee' ? <>
      <rect y="122" width="360" height="22" fill="#d5bb97"/><ellipse cx="177" cy="119" rx="60" ry="9" fill="#bfa688"/>
      <path d="M134 66h82v24q0 28-29 28h-24q-29 0-29-28z" fill="#fff7e5"/><path d="M216 74h8q29 0 20 19-3 9-29 9" fill="none" stroke="#fff7e5" strokeWidth="8"/>
      <path d="M155 51q-9-10 0-21m22 21q-9-10 0-21m22 21q-9-10 0-21" fill="none" stroke="#ae8e6b" strokeWidth="3" strokeLinecap="round"/>
      <path d="M155 86q22 19 43 0" fill="none" stroke="#9cb69b" strokeWidth="4" strokeLinecap="round"/>
    </> : kind === 'food' ? <>
      <rect y="119" width="360" height="25" fill="#cdb296"/><ellipse cx="180" cy="95" rx="52" ry="33" fill="#faf2df"/><ellipse cx="180" cy="95" rx="39" ry="24" fill="#dfb082"/>
      <path d="M156 96q16-24 30 0t20-4" fill="none" stroke="#7c9f79" strokeWidth="8" strokeLinecap="round"/>
      <g stroke="#8f9f92" strokeWidth="3" strokeLinecap="round"><path d="M110 60v61m-7-61v19q7 10 14 0V60m133 1v60m0-61q-12 17 0 30"/></g>
    </> : kind === 'sport' ? <>
      <path d="M0 118q120-20 360 2v24H0Z" fill="#a5bc85"/><path d="M102 17v113m154-113v113M102 74h154" stroke="#f0f2d5" strokeWidth="3" opacity=".7"/>
      <circle cx="180" cy="91" r="36" fill="#e5af6a"/><path d="M145 85q35 22 70 0m-62 30q27-35 54 0M180 55v72" fill="none" stroke="#b57e4c" strokeWidth="2.5"/>
    </> : kind === 'culture' ? <>
      <path d="M108 51l72-32 73 32z" fill="#899c92"/><rect x="111" y="55" width="138" height="8" rx="3" fill="#fbf0d9"/>
      {[123,158,193,228].map(x=><rect key={x} x={x} y="65" width="12" height="50" rx="2" fill="#fbf0d9"/>)}
      <path d="M111 120h139m-151 12h163" stroke="#b8acbf" strokeWidth="7" strokeLinecap="round"/>
    </> : kind === 'park' ? <>
      <path d="M0 112q90-28 180 0t180 0v32H0Z" fill="#a6c292"/><path d="M159 144q55-30 14-53" fill="none" stroke="#f6e4b8" strokeWidth="17"/>
      {[108,249].map((x,i)=><g key={x}><path d={'M'+x+' 117V64'} stroke="#97896b" strokeWidth="6"/><ellipse cx={x} cy={60-i*11} rx="29" ry="34" fill={i?'#7eaa89':'#92b58e'}/></g>)}
    </> : <>
      <path d="M88 103l51-35 48 31 70-48m-142 63l30-20 46 29 48-35" fill="none" stroke="#aac5b6" strokeWidth="9" strokeLinecap="round"/>
      <path d="M180 118s-31-29-31-50a31 31 0 0162 0c0 21-31 50-31 50z" fill="#6e9e91"/><circle cx="180" cy="68" r="11" fill="#f5e7c1"/>
    </>}
  </svg>;
}
