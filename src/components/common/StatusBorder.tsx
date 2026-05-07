'use client';

import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';

export function StatusBorder() {
  const { userProfile } = useAuth();

  if (!userProfile) return null;

  const { isPremium, isCreator, isSupporter, role } = userProfile;
  const isAdmin = role === 'admin';

  // Priority: Premium > Creator > Support/Admin
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
  } else if (isSupporter || isAdmin) {
    borderColor = 'border-[#3B82F6]';
    shadowColor = 'shadow-[inset_0_0_15px_rgba(59,130,246,0.4),0_0_15px_rgba(59,130,246,0.2)]';
    label = 'Support';
  }

  if (!borderColor) return null;

  return (
    <div className={cn(
      "fixed inset-0 pointer-events-none z-[100000] border-[4px] transition-all duration-1000 ease-in-out",
      borderColor,
      shadowColor,
      "animate-pulse-subtle"
    )}>
      {/* Subtiler Badge oben rechts */}
      <div className={cn(
        "absolute top-0 right-12 px-3 py-1 rounded-b-lg text-[10px] font-black uppercase tracking-widest text-white shadow-2xl",
        isPremium ? "bg-[#FFD700] text-black" : 
        isCreator ? "bg-[#A855F7]" : 
        "bg-[#3B82F6]"
      )}>
        {label}
      </div>
    </div>
  );
}
