import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';
export const alt = 'Du wurdest zu Activa eingeladen';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          backgroundColor: '#020617',
          padding: '80px',
          position: 'relative',
          fontFamily: 'sans-serif',
          color: '#f8fafc',
        }}
      >
        {/* Subtle Emerald / Teal Glow Orbs */}
        <div
          style={{
            position: 'absolute',
            top: '-150px',
            left: '-150px',
            width: '600px',
            height: '600px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(16,185,129,0.25) 0%, rgba(2,6,23,0) 70%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-150px',
            right: '-150px',
            width: '600px',
            height: '600px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(20,184,166,0.2) 0%, rgba(2,6,23,0) 70%)',
          }}
        />

        {/* Top Header Branding */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            zIndex: 10,
          }}
        >
          {/* Logo Container */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1.5px solid rgba(16, 185, 129, 0.3)',
            }}
          >
            {/* Sparkles / Brand Icon SVG */}
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#34d399"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
            </svg>
          </div>

          <span
            style={{
              fontSize: '32px',
              fontWeight: 900,
              letterSpacing: '-0.5px',
              color: '#ffffff',
            }}
          >
            Activa
          </span>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 18px',
              borderRadius: '9999px',
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              color: '#34d399',
              fontSize: '16px',
              fontWeight: 600,
              marginLeft: '12px',
            }}
          >
            <span>Persönliche Einladung</span>
          </div>
        </div>

        {/* Main Content Box */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            zIndex: 10,
            maxWidth: '960px',
            margin: 'auto 0',
          }}
        >
          <div
            style={{
              fontSize: '54px',
              fontWeight: 900,
              lineHeight: 1.1,
              letterSpacing: '-1.5px',
              color: '#ffffff',
            }}
          >
            Du wurdest zu Activa eingeladen
          </div>

          <div
            style={{
              fontSize: '26px',
              fontWeight: 500,
              lineHeight: 1.4,
              color: '#94a3b8',
            }}
          >
            Entdecke Aktivitäten, Orte und neue Leute in deiner Nähe.
          </div>
        </div>

        {/* Bottom Feature Badges Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '32px',
            zIndex: 10,
            fontSize: '18px',
            fontWeight: 600,
            color: '#cbd5e1',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
            <span>Spannende Orte</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
            <span>Spontane Aktivitäten</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
            <span>Neue Leute treffen</span>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
