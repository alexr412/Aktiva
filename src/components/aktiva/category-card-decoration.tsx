'use client';

import { useId } from 'react';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface CategoryCardDecorationProps {
  gradientClass: string;
  icon: LucideIcon;
  label: string;
  variant?: 'standard' | 'featured';
  className?: string;
  children?: React.ReactNode;
}

export function CategoryCardDecoration({
  gradientClass,
  icon: Icon,
  label,
  variant = 'standard',
  className,
  children
}: CategoryCardDecorationProps) {
  const patternId = useId();
  return (
    <div 
      className={cn(
        "w-full flex items-center justify-center relative overflow-hidden select-none pointer-events-none transition-transform duration-700",
        variant === 'featured' ? "h-full min-h-[140px] md:w-56 shrink-0" : "h-20",
        gradientClass,
        className
      )}
      aria-hidden="true"
    >
      {/* Subtle overlay gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/5 to-black/25 pointer-events-none" />

      {/* Lightweight Grid Pattern (SVG) */}
      <svg 
        className="absolute inset-0 w-full h-full opacity-[0.06] text-white pointer-events-none" 
        aria-hidden="true" 
        focusable="false"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id={patternId} width="12" height="12" patternUnits="userSpaceOnUse">
            <path d="M 12 0 L 0 0 0 12" fill="none" stroke="currentColor" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${patternId})`} />
      </svg>

      {/* Large faint rotated category icon watermark */}
      <Icon 
        className="absolute -right-4 -bottom-6 h-20 w-20 text-white/10 transform rotate-12 pointer-events-none select-none" 
        aria-hidden="true"
        focusable="false"
      />

      {/* Content wrapper */}
      <div className="flex flex-col items-center gap-1 z-10 pointer-events-auto">
        {children || (
          <>
            <Icon className="text-white h-7 w-7 drop-shadow-lg" />
            <span className="text-[7.5px] font-black uppercase tracking-[0.2em] text-white/90 drop-shadow-sm">{label}</span>
          </>
        )}
      </div>
    </div>
  );
}
