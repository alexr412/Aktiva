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
  let borderColor = '';
  let shadowColor = '';
  let label = '';

  if (isPremium) {
    borderColor = 'border-[#FFD700]';
    shadowColor = 'shadow-[inset_0_0_15px_rgba(255,215,0,0.4),0_0_15px_rgba(255,215,0,0.2)]';
    label = 'Premium';
  } else if (isCreator) {
    borderColor = 'border-[#A855F7]';
    shadowColor = 'shadow-[inset_0_0_15px_rgba(168,85,247,0.4),0_0_15px_rgba(168,85,247,0.2)]';
    label = 'Creator';
  } else if (role === 'admin' || role === 'supporter') {
    borderColor = 'border-[#3B82F6]';
    shadowColor = 'shadow-[inset_0_0_15px_rgba(59,130,246,0.4),0_0_15px_rgba(59,130,246,0.2)]';
    label = role === 'admin' ? 'Admin' : 'Support';
  }

  return (
    <>
      {borderColor && (
        <div className={cn(
          "fixed inset-0 pointer-events-none z-[100000] border-[4px] transition-all duration-1000 ease-in-out",
          borderColor,
          shadowColor,
          "animate-pulse-subtle"
        )} />
      )}

      {(borderColor || isEligible) && (
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
                  : (isPremium ? "bg-[#FFD700] text-black" : 
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
              isPremium ? "bg-[#FFD700] text-black" : 
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

