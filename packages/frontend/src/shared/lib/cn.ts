import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// merges conditional class lists and resolves conflicting tailwind utilities
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
