
"use client"

import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"

import { cn } from "@/lib/utils"

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root> & {
    isPremium?: boolean;
    isCreator?: boolean;
    isSupporter?: boolean;
  }
>(({ className, isPremium, isCreator, isSupporter, ...props }, ref) => {
  const hasStatus = isPremium || isCreator || isSupporter;
  
  const statusWrapperClasses = cn(
    "p-[4px] rounded-full",
    isCreator 
      ? "bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 shadow-[0_0_20px_rgba(168,85,247,0.6)]" 
      : isPremium 
        ? "bg-gradient-to-tr from-amber-400 via-yellow-200 to-amber-600 shadow-[0_0_20px_rgba(251,191,36,0.6)]" 
        : isSupporter 
          ? "bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.6)]" 
          : "",
    className
  );

  const wrapperClasses = cn(
    "relative inline-flex shrink-0 transition-all duration-500",
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
