"use client";

import React from "react";
import { User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "./avatar";
import { cn } from "@/lib/utils";

interface ProfileAvatarProps {
  photoURL?: string | null;
  displayName?: string | null;
  isPremium?: boolean;
  isCreator?: boolean;
  isSupporter?: boolean;
  className?: string;
  fallbackClassName?: string;
}

export function ProfileAvatar({
  photoURL,
  displayName,
  isPremium,
  isCreator,
  isSupporter,
  className,
  fallbackClassName,
}: ProfileAvatarProps) {
  // If no photoURL is present, adjust the class names to avoid white borders and double backgrounds.
  let adjustedClassName = className;
  if (!photoURL && className) {
    adjustedClassName = className
      .replace(/\bborder-white\b/g, "border-slate-200/70")
      .replace(/\b(border-\w+)?-white\b/g, "$1-slate-200/70");
  }

  return (
    <Avatar
      isPremium={isPremium}
      isCreator={isCreator}
      isSupporter={isSupporter}
      className={adjustedClassName}
    >
      {photoURL ? (
        <AvatarImage src={photoURL} alt={displayName || "User"} className="object-cover" />
      ) : null}
      <AvatarFallback
        className={cn(
          "bg-slate-100 text-slate-300 dark:bg-slate-800 dark:text-slate-500 flex items-center justify-center",
          fallbackClassName
        )}
      >
        <User className="h-1/2 w-1/2" />
      </AvatarFallback>
    </Avatar>
  );
}
