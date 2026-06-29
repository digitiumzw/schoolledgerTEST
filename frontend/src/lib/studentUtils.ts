/**
 * ================================================================================
 * studentUtils.ts - Student Data Utilities
 * ================================================================================
 * 
 * PURPOSE:
 * Helper functions for processing and formatting student-related data throughout
 * the application. These utilities handle calculations, formatting, and UI helpers.
 * 
 * WHY THIS EXISTS:
 * Instead of repeating the same calculation/formatting logic in multiple components,
 * we centralize it here. This makes the code easier to maintain and update.
 * 
 * MAIN EXPORTS:
 * - calculateAge(dob) - Calculate student's age from date of birth
 * - formatPhoneNumber(phone) - Format Zimbabwe phone numbers nicely
 * - getStatusColor(status) - Get CSS classes for status badges
 * - getBalanceColor(balance) - Get CSS classes for balance amounts
 * - sortStudents(students, field, order) - Sort student list
 * - formatCurrency(amount) - Format money amounts
 * 
 * RELATED FILES:
 * - Used in: Students page, Student profile, Student modals
 * - Works with: Student type from types/dashboard.ts
 * 
 * FOR BEGINNERS:
 * These are like building blocks that other parts of the app use. Think of them
 * as pre-made tools in a toolbox - instead of building the same tool over and
 * over, we build it once here and reuse it everywhere.
 * ================================================================================
 */

// Import the Student type so TypeScript knows the structure of student data
import { Student } from '@/types/dashboard';

// -----------------------------------------------------------------------------
// SECTION: Age Calculation
// Purpose: Calculate how old a student is from their date of birth
// -----------------------------------------------------------------------------

/**
 * Calculate a student's age from their date of birth
 * 
 * WHAT IT DOES:
 * Takes a date of birth string and calculates the student's current age in years
 * 
 * HOW IT WORKS:
 * 1. Get today's date
 * 2. Convert the date of birth string to a Date object
 * 3. Calculate the difference in years
 * 4. Adjust if birthday hasn't occurred this year yet
 * 
 * EXAMPLE USAGE:
 * calculateAge("2010-05-15")  // Returns: 14 (if today is 2024-11-24)
 * calculateAge("2008-12-01")  // Returns: 15 (birthday hasn't passed this year)
 * 
 * @param dob - Date of birth in format "YYYY-MM-DD"
 * @returns The student's age in years as a number
 */
export const calculateAge = (dob: string): number => {
  // Get today's date (right now)
  const today = new Date();
  
  // Convert the date of birth string into a Date object
  const birthDate = new Date(dob);
  
  // Calculate initial age by subtracting birth year from current year
  let age = today.getFullYear() - birthDate.getFullYear();
  
  // Check if birthday hasn't occurred yet this year
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  // If birth month hasn't arrived yet this year, OR
  // birth month is current month but birth day hasn't arrived yet...
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    // ...then subtract 1 from age (birthday hasn't happened yet)
    age--;
  }
  
  return age;
};

// -----------------------------------------------------------------------------
// SECTION: Phone Number Formatting
// Purpose: Make phone numbers look nice and readable
// -----------------------------------------------------------------------------

/**
 * Format a phone number for Zimbabwe (or international format)
 * 
 * WHAT IT DOES:
 * Takes a phone number string and formats it with spaces for readability
 * 
 * HOW IT WORKS:
 * 1. Remove all non-digit characters (keep only numbers)
 * 2. Try to match the pattern: country code (3), area (2), first part (3), last part (4)
 * 3. If it matches, format with spaces: "+263 77 123 4567"
 * 4. If it doesn't match, return original
 * 
 * EXAMPLE USAGE:
 * formatPhoneNumber("+263771234567")  // Returns: "+263 77 123 4567"
 * formatPhoneNumber("0771234567")     // Returns: "0771234567" (doesn't match pattern)
 * 
 * @param phone - Phone number string (can have various formats)
 * @returns Formatted phone number with spaces, or original if format doesn't match
 */
export const formatPhoneNumber = (phone: string): string => {
  // If no phone number provided, return empty string
  if (!phone) return '';
  
  // Remove all non-digit characters (letters, spaces, dashes, etc.)
  // Example: "+263-77-123-4567" becomes "263771234567"
  const cleaned = phone.replace(/\D/g, '');
  
  // Try to match the pattern: 3 digits (country) + 2 digits (area) + 3 digits + 4 digits
  // Example: "263771234567" matches as ["263771234567", "263", "77", "123", "4567"]
  const match = cleaned.match(/^(\d{3})(\d{2})(\d{3})(\d{4})$/);
  
  // If the phone number matches the expected pattern...
  if (match) {
    // Format it as: +263 77 123 4567
    return `+${match[1]} ${match[2]} ${match[3]} ${match[4]}`;
  }
  
  // If it doesn't match, return the original phone number unchanged
  return phone;
};

// -----------------------------------------------------------------------------
// SECTION: Status Badge Colors
// Purpose: Get CSS classes for student status badges (active, inactive, graduated)
// -----------------------------------------------------------------------------

/**
 * Get Tailwind CSS classes for a student status badge
 * 
 * WHAT IT DOES:
 * Returns appropriate background and text color classes based on student status
 * 
 * HOW IT WORKS:
 * Uses a switch statement to map status strings to Tailwind CSS class combinations
 * 
 * EXAMPLE USAGE:
 * getStatusColor("active")     // Returns: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
 * getStatusColor("inactive")   // Returns: "bg-gray-100 text-gray-800 ..."
 * getStatusColor("graduated")  // Returns: "bg-blue-100 text-blue-800 ..."
 * 
 * IN COMPONENTS:
 * <Badge className={getStatusColor(student.status)}>{student.status}</Badge>
 * 
 * @param status - The student's status ("active", "inactive", or "graduated")
 * @returns String of Tailwind CSS classes for both light and dark mode
 */
export const getStatusColor = (status: string) => {
  // Use a switch statement to determine colors based on status
  switch (status) {
    case 'active':
      // Green for active students (light: bg-green-100, dark: bg-green-900)
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 'inactive':
      // Gray for inactive students
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    case 'graduated':
      // Blue for graduated students
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    case 'transferred':
      // Purple for transferred students
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
    case 'dropped_out':
      // Red for dropped out students
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    default:
      // Default to gray if status is unknown
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
  }
};

// -----------------------------------------------------------------------------
// SECTION: Balance Color Coding
// Purpose: Color-code balances based on amount owed (green = paid, red = high debt)
// -----------------------------------------------------------------------------

/**
 * Get text color classes based on outstanding balance amount
 * 
 * WHAT IT DOES:
 * Returns color classes to indicate financial status:
 * - Green: Fully paid (balance = 0)
 * - Red: High debt (balance > $100)
 * - Orange: Some amount owed (0 < balance ≤ $100)
 * 
 * HOW IT WORKS:
 * Uses if/else conditions to check balance ranges and return appropriate colors
 * 
 * EXAMPLE USAGE:
 * getBalanceColor(0)    // Returns: "text-green-600 dark:text-green-400" (paid in full)
 * getBalanceColor(150)  // Returns: "text-destructive" (high debt, uses theme color)
 * getBalanceColor(50)   // Returns: "text-orange-600 dark:text-orange-400" (low debt)
 * 
 * @param balance - The student's outstanding balance amount
 * @returns Tailwind CSS text color classes
 */
export const getBalanceColor = (balance: number) => {
  if (balance === 0) {
    // No debt - use green (good status)
    return 'text-green-600 dark:text-green-400';
  } else if (balance > 100) {
    // High debt - use destructive/red color (urgent attention needed)
    return 'text-destructive';
  } else {
    // Low debt - use orange (warning)
    return 'text-orange-600 dark:text-orange-400';
  }
};

// -----------------------------------------------------------------------------
// SECTION: Student Sorting
// Purpose: Sort student arrays by name, class, or balance
// -----------------------------------------------------------------------------

/**
 * Sort an array of students by a specific field
 * 
 * WHAT IT DOES:
 * Creates a new sorted array of students based on the specified field and order
 * 
 * HOW IT WORKS:
 * 1. Create a copy of the students array (don't modify original)
 * 2. Use JavaScript's sort() function with custom comparison logic
 * 3. Compare students based on the specified field
 * 4. Apply ascending or descending order
 * 
 * EXAMPLE USAGE:
 * sortStudents(students, 'name', 'asc')     // Sort A-Z by full name
 * sortStudents(students, 'balance', 'desc') // Highest balance first
 * sortStudents(students, 'class', 'asc')    // Sort by class name alphabetically
 * 
 * @param students - Array of Student objects to sort
 * @param field - Which field to sort by ('name', 'class', or 'balance')
 * @param order - Sort direction ('asc' for ascending, 'desc' for descending)
 * @returns A new sorted array of students (original array is not modified)
 */
export const sortStudents = (
  students: Student[],
  field: 'name' | 'class' | 'balance',
  order: 'asc' | 'desc'
) => {
  // Create a copy of the array using spread operator [...]
  // This prevents modifying the original students array
  return [...students].sort((a, b) => {
    // Initialize comparison result
    let comparison = 0;
    
    // Determine how to compare based on the field
    if (field === 'name') {
      // Compare by full name (firstName + lastName)
      // localeCompare() does alphabetical comparison considering locale
      comparison = `${a.firstName} ${a.lastName}`.localeCompare(
        `${b.firstName} ${b.lastName}`
      );
    } else if (field === 'class') {
      // Compare by class ID alphabetically
      comparison = a.classId.localeCompare(b.classId);
    } else if (field === 'balance') {
      // Compare by balance numerically
      // Subtracting gives us: negative (a < b), 0 (equal), positive (a > b)
      comparison = a.balance - b.balance;
    }
    
    // Return the comparison, reversing it if descending order is requested
    // If order is 'asc', return comparison as-is
    // If order is 'desc', multiply by -1 to reverse the order
    return order === 'asc' ? comparison : -comparison;
  });
};

// -----------------------------------------------------------------------------
// SECTION: Currency Formatting
// Purpose: Display money amounts consistently with $ symbol and 2 decimal places
// -----------------------------------------------------------------------------

/**
 * Format a number as US Dollar currency
 * 
 * WHAT IT DOES:
 * Converts a number to a currency string with $ symbol and 2 decimal places
 * 
 * HOW IT WORKS:
 * Uses toFixed(2) to ensure exactly 2 decimal places, then adds $ prefix
 * 
 * EXAMPLE USAGE:
 * formatCurrency(100)    // Returns: "$100.00"
 * formatCurrency(50.5)   // Returns: "$50.50"
 * formatCurrency(0)      // Returns: "$0.00"
 * 
 * @param amount - The numeric amount to format
 * @returns Formatted currency string with $ and 2 decimals
 */
export const formatCurrency = (amount: number | string): string => {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(numAmount)) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numAmount);
};

export const formatCurrencyCompact = (amount: number | string): string => {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(numAmount)) return '$0';
  if (Math.abs(numAmount) >= 1_000_000) {
    return `$${(numAmount / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(numAmount) >= 1_000) {
    return `$${(numAmount / 1_000).toFixed(1)}K`;
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(numAmount);
};

export const formatAdmissionNumber = (raw: string): string => raw;

export const getGenderLabel = (gender: string | undefined): string => {
  switch (gender) {
    case "male":   return "Male";
    case "female": return "Female";
    case "other":  return "Other";
    default:       return "—";
  }
};
