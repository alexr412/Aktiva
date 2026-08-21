import Image from 'next/image';

export default function GlobalLoading() {
  return (
    <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-neutral-950 text-white select-none">
      <style>{`
        @keyframes logoPulse {
          0%, 100% { transform: scale(1); filter: drop-shadow(0 0 20px rgba(239, 68, 68, 0.35)); }
          50% { transform: scale(1.05); filter: drop-shadow(0 0 38px rgba(239, 68, 68, 0.65)); }
        }
        @keyframes splashBar {
          0% { left: -40%; width: 35%; }
          50% { left: 30%; width: 50%; }
          100% { left: 105%; width: 35%; }
        }
      `}</style>

      {/* Background Glow */}
      <div className="absolute w-80 h-80 rounded-full bg-rose-500/15 blur-3xl pointer-events-none" />

      {/* Main Content Box */}
      <div className="relative z-10 flex flex-col items-center text-center p-6 space-y-6">
        {/* Animated Heart Logo */}
        <div
          className="relative w-32 h-32 md:w-40 md:h-40"
          style={{ animation: 'logoPulse 2.4s ease-in-out infinite' }}
        >
          <Image
            src="/assets/logo-heart.png"
            alt="Activa Logo"
            fill
            sizes="(max-width: 768px) 128px, 160px"
            className="object-contain"
            priority
          />
        </div>

        {/* Brand Typography */}
        <div className="space-y-1">
          <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">
            activa<span className="text-rose-500">.</span>
          </h1>
          <p className="text-[10px] md:text-xs font-black uppercase tracking-[0.25em] text-neutral-400">
            CONNECT • EXPLORE • LIVE
          </p>
        </div>

        {/* Loading Bar */}
        <div className="w-48 sm:w-56 h-2 bg-neutral-900 rounded-full overflow-hidden relative mt-4 border border-white/10 shadow-inner">
          <div
            className="absolute inset-y-0 bg-gradient-to-r from-rose-600 via-red-500 to-pink-500 rounded-full"
            style={{ animation: 'splashBar 1.3s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}
          />
        </div>
      </div>
    </div>
  );
}
