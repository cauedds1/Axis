import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatTxDescription(description: string): string {
  return description.replace(/^\[bill:[^\]]+\]\s*/, "");
}
