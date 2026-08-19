'use client';

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
  return (
    <div 
      className={cn(
        "w-full flex items-center justify-center relative overflow-hidden select-none pointer-events-none transition-transform duration-300",
        variant === 'featured' ? "h-full min-h-[140px] md:w-56 shrink-0" : "h-20",
        gradientClass,
        className
      )}
      aria-hidden="true"
    >
      {/* Subtle overlay gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/5 to-black/25 pointer-events-none" />

      {/* Organic Wavy Curves Overlay */}
      <svg 
        className="absolute inset-0 w-full h-full opacity-[0.18] text-white pointer-events-none" 
        viewBox="0 0 100 100" 
        preserveAspectRatio="none"
        aria-hidden="true" 
        focusable="false"
      >
        <path d="M 0 35 Q 25 10, 50 45 T 100 25 L 100 100 L 0 100 Z" fill="currentColor" opacity="0.4" />
        <path d="M 0 60 Q 35 85, 65 50 T 100 75 L 100 100 L 0 100 Z" fill="currentColor" opacity="0.6" />
      </svg>

      {/* Large faint rotated category icon watermark */}
      {variant === 'standard' && (
        <div className="absolute right-3 bottom-3 h-[60px] w-[60px] opacity-[0.48] text-white transform rotate-12 pointer-events-none select-none flex items-center justify-center">
          <Icon 
            className="w-full h-full object-contain text-white" 
            aria-hidden="true"
            focusable="false"
          />
        </div>
      )}

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
