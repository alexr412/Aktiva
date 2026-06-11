import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Global strict formatting rule for all system labels and tags.
 * Ensures uppercase, no underscores, and consistent spacing.
 */
export function formatLabel(label: string | undefined | null): string {
  if (!label) return "";
  
  return label
    .toString()
    .replace(/_/g, " ") // Block underscores
    .replace(/([a-z])([A-Z])/g, "$1 $2") // Handle camelCase
    .replace(/\./g, " ") // Block dots (for category paths)
    .toUpperCase()
    .trim();
}

export function formatFirstName(
  name?: string | null,
  fallback = "User"
): string {
  const trimmed = name?.trim();

  if (!trimmed) {
    return fallback;
  }

  return trimmed.split(/\s+/)[0] || fallback;
}

