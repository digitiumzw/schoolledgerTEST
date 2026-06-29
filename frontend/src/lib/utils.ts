/**
 * ================================================================================
 * utils.ts - Tailwind CSS Utility Functions
 * ================================================================================
 * 
 * PURPOSE:
 * This file provides a single utility function for combining Tailwind CSS classes.
 * It's essential for conditional styling and merging class names properly.
 * 
 * WHY THIS EXISTS:
 * When you need to combine multiple CSS classes (especially conditional ones),
 * Tailwind classes can conflict. This utility merges them correctly, removing
 * duplicates and handling conflicts.
 * 
 * MAIN EXPORT:
 * - cn(...inputs) - Combines and merges Tailwind CSS class names
 * 
 * EXAMPLE USAGE:
 * cn("text-red-500", "bg-blue-500")  // Returns: "text-red-500 bg-blue-500"
 * cn("p-4", someCondition && "p-6")  // Conditionally applies p-6 if true
 * cn("text-sm", { "text-lg": isLarge })  // Object syntax for conditions
 * 
 * FOR BEGINNERS:
 * Think of this as a smart class combiner. It takes multiple class strings
 * and combines them intelligently, removing conflicts and duplicates.
 * ================================================================================
 */

// clsx: Combines class names together (handles arrays, objects, conditionals)
// Purpose: "clsx('a', 'b')" → "a b"  or  "clsx('a', condition && 'b')" → "a b" (if true)
import { clsx, type ClassValue } from "clsx";

// twMerge: Merges Tailwind classes intelligently (removes conflicts)
// Purpose: "twMerge('p-4 p-6')" → "p-6" (keeps last padding, removes duplicate)
import { twMerge } from "tailwind-merge";

/**
 * Combine and merge CSS class names intelligently
 * 
 * WHAT IT DOES:
 * 1. Takes multiple class name inputs (strings, arrays, objects, conditionals)
 * 2. Combines them using clsx
 * 3. Merges Tailwind classes to remove conflicts using twMerge
 * 4. Returns a single optimized class string
 * 
 * HOW IT WORKS:
 * Step 1: clsx() combines all inputs into one string
 * Step 2: twMerge() removes Tailwind conflicts (e.g., if you have "p-4" and "p-6", keeps "p-6")
 * 
 * EXAMPLE USAGE:
 * ```tsx
 * // Basic combination
 * cn("text-white", "bg-blue-500")  // "text-white bg-blue-500"
 * 
 * // Conditional classes
 * cn("btn", isPrimary && "btn-primary")  // "btn btn-primary" (if isPrimary is true)
 * 
 * // Object syntax
 * cn("btn", { "btn-large": isLarge, "btn-small": isSmall })
 * 
 * // Component usage (most common)
 * <div className={cn("base-class", variant === "primary" && "primary-class")} />
 * 
 * // Handling conflicts (twMerge magic)
 * cn("p-4", "p-6")  // Returns "p-6" (removes p-4, keeps p-6)
 * ```
 * 
 * @param inputs - Variable number of class values (strings, arrays, objects, booleans)
 * @returns A single merged class string with no conflicts
 */
export function cn(...inputs: ClassValue[]) {
  // Step 1: clsx combines all inputs (handles conditionals, objects, arrays)
  // Step 2: twMerge removes Tailwind class conflicts (e.g., p-4 + p-6 = p-6)
  return twMerge(clsx(inputs));
}
