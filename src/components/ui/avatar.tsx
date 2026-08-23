
"use client"

import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"

import { cn } from "@/lib/utils"
import { getLevelTierInfo } from "@/lib/levels"

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root> & {
    isPremium?: boolean;
    isCreator?: boolean;
    isSupporter?: boolean;
    level?: number;
    showLevelBadge?: boolean;
  }
>(({ className, isPremium, isCreator, isSupporter, level, showLevelBadge, ...props }, ref) => {
  const tierInfo = level ? getLevelTierInfo(level) : null;
  const hasStatus = isPremium || isCreator || isSupporter || (level !== undefined && level > 0);
  
  const statusBorderClass = isCreator 
    ? "bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 shadow-[0_0_20px_rgba(168,85,247,0.6)]" 
    : isPremium 
      ? "bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-700 shadow-[0_0_15px_rgba(217,119,6,0.5)]" 
      : isSupporter 
        ? "bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.6)]" 
        : tierInfo 
          ? tierInfo.borderGradient 
          : "";

  const statusWrapperClasses = cn(
    "p-[3px] rounded-full",
    statusBorderClass,
    className
  );

  const wrapperClasses = cn(
    "relative inline-flex shrink-0 transition-all duration-300 rounded-full",
    hasStatus ? statusWrapperClasses : className,
    !className?.includes('h-') && !className?.includes('w-') && "h-10 w-10"
  );

  return (
    <div className={wrapperClasses}>
      <AvatarPrimitive.Root
        ref={ref}
        className={cn(
          "flex h-full w-full shrink-0 overflow-hidden rounded-full transition-all duration-300",
          hasStatus ? "border-transparent" : ""
        )}
        {...props}
      >
        {props.children}
      </AvatarPrimitive.Root>

      {showLevelBadge && level !== undefined && level > 0 && (
        <span 
          className={cn(
            "absolute -bottom-1 -right-1 z-10 px-1 py-0.25 rounded-full text-[9px] font-black uppercase tracking-tight shadow-md border border-white dark:border-slate-900 leading-none select-none flex items-center justify-center",
            tierInfo?.badgeBg || "bg-slate-700",
            tierInfo?.badgeText || "text-white"
          )}
          title={`Level ${level}`}
        >
          Lv. {level}
        </span>
      )}
    </div>
  );
})
Avatar.displayName = AvatarPrimitive.Root.displayName

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image
    ref={ref}
    className={cn("aspect-square h-full w-full object-cover", className)}
    {...props}
  />
))
AvatarImage.displayName = AvatarPrimitive.Image.displayName

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn(
      "flex h-full w-full items-center justify-center rounded-full bg-muted",
      className
    )}
    {...props}
  />
))
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName

export { Avatar, AvatarImage, AvatarFallback }
