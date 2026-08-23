'use client';

import { useAuth } from '@/hooks/use-auth';
import { useActivePremium } from '@/hooks/use-active-premium';
import { cn } from '@/lib/utils';

export function StatusBorder() {
  const { userProfile, actualRole, simulatedRole, setSimulatedRole } = useAuth();
  const { isPremium, formattedExpiry } = useActivePremium();

  if (!userProfile) return null;

  const isEligible = actualRole === 'admin' || actualRole === 'supporter';

  const { isCreator, role } = userProfile;

  // Priority: Premium > Creator > Support/Admin (based on simulated/active role)
  let statusColor = '';
  let glowColor = '';
  let label = '';

  if (isPremium) {
    statusColor = 'bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-600';
    glowColor = 'shadow-[0_1px_14px_rgba(245,158,11,0.6)]';
    label = 'Premium';
  } else if (isCreator) {
    statusColor = 'bg-[#A855F7]';
    glowColor = 'shadow-[0_1px_12px_rgba(168,85,247,0.85)]';
    label = 'Creator';
  } else if (role === 'admin' || role === 'supporter') {
    statusColor = 'bg-[#3B82F6]';
    glowColor = 'shadow-[0_1px_12px_rgba(59,130,246,0.85)]';
    label = role === 'admin' ? 'Admin' : 'Support';
  }

  return (
    <>
      {statusColor && (
        <div className={cn(
          "fixed top-0 left-0 right-0 h-[2.5px] pointer-events-none z-[100000] transition-all duration-700 ease-in-out",
          statusColor,
          glowColor
        )} />
      )}

      {(statusColor || isEligible) && (
        <div className="fixed top-0 right-12 z-[100001] pointer-events-auto">
          {isEligible ? (
            <button
              onClick={() => {
                const targetRole = simulatedRole === 'user' ? (actualRole || 'user') : 'user';
                setSimulatedRole(targetRole);
              }}
              title={simulatedRole === 'user' ? "Zurück zur Admin-/Supporter-Ansicht wechseln" : "Zur User-Ansicht wechseln"}
              className={cn(
                "px-3 py-1 rounded-b-lg text-[10px] font-black uppercase tracking-widest text-white shadow-2xl transition-all duration-300",
                "cursor-pointer hover:brightness-110 active:scale-95 select-none",
                simulatedRole === 'user' 
                  ? "bg-slate-600/80 border border-t-0 border-slate-500 text-slate-200" 
                  : (isPremium ? "bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-600 text-slate-950 font-black" : 
                     isCreator ? "bg-[#A855F7]" : 
                     "bg-[#3B82F6]")
              )}
            >
              {simulatedRole === 'user' 
                ? (actualRole === 'admin' ? 'ADMIN (USER VIEW)' : 'SUPPORT (USER VIEW)') 
                : (role === 'admin' ? 'ADMIN' : 'SUPPORT')
              }
            </button>
          ) : (
            <div className={cn(
              "px-3 py-1 rounded-b-lg text-[10px] font-black uppercase tracking-widest text-white shadow-2xl",
              isPremium ? "bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-600 text-slate-950 font-black" : 
              isCreator ? "bg-[#A855F7]" : 
              "bg-[#3B82F6]"
            )}>
              {label}
            </div>
          )}
        </div>
      )}
    </>
  );
}

