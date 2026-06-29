/**
 * ================================================================================
 * transportUtils.ts - Transport Management Utilities
 * ================================================================================
 * 
 * PURPOSE:
 * Helper functions for the Transport Management module. These utilities handle
 * formatting transport fees, calculating route utilization, payment status badges,
 * CSV export for reports, and utilization color coding.
 * 
 * WHY THIS EXISTS:
 * The Transport module deals with routes, student assignments, fees, and capacity.
 * Instead of repeating formatting and calculation logic in multiple components,
 * we centralize it here for consistency and maintainability.
 * 
 * MAIN EXPORTS:
 * - formatTransportFee(fee) - Format fee as currency ($50.00)
 * - calculateRouteUtilization(assigned, capacity) - Calculate % full
 * - getPaymentStatusBadge(paid) - Badge text and styling for payment status
 * - exportTransportReportToCSV(data, filename) - Export data to downloadable CSV
 * - getUtilizationColor(utilization) - Color code for route capacity
 * 
 * RELATED FILES:
 * - Used in: Transport page, route modals, transport reports
 * - Works with: TransportRoute, TransportAllocation types
 * 
 * FOR BEGINNERS:
 * Think of this as a toolbox specifically for transport features. It has tools
 * for showing money, calculating how full a bus is, showing payment status,
 * and even creating Excel-like files (CSV) for reports.
 * ================================================================================
 */

// Import types so TypeScript knows the structure of transport data
// -----------------------------------------------------------------------------
// SECTION: Currency Formatting
// Purpose: Display transport fees consistently as currency
// -----------------------------------------------------------------------------

/**
 * Format a transport fee amount as US Dollar currency
 * 
 * WHAT IT DOES:
 * Converts a number to a currency string with $ symbol and exactly 2 decimal places
 * 
 * HOW IT WORKS:
 * Uses toFixed(2) to ensure 2 decimal places, then adds $ symbol
 * 
 * EXAMPLE USAGE:
 * formatTransportFee(50)    // Returns: "$50.00"
 * formatTransportFee(75.5)  // Returns: "$75.50"
 * formatTransportFee(100)   // Returns: "$100.00"
 * 
 * @param fee - The transport fee amount as a number
 * @returns Formatted currency string with $ and 2 decimals
 */
export const formatTransportFee = (fee: number | null | undefined): string => {
  if (fee == null) return '—';
  return `$${fee.toFixed(2)}`;
};

// -----------------------------------------------------------------------------
// SECTION: Route Utilization Calculation
// Purpose: Calculate what percentage of a route's capacity is being used
// -----------------------------------------------------------------------------

/**
 * Calculate route utilization percentage
 * 
 * WHAT IT DOES:
 * Calculates what percentage of a transport route's capacity is filled with
 * assigned students
 * 
 * HOW IT WORKS:
 * 1. Divide assigned students by total capacity
 * 2. Multiply by 100 to get percentage
 * 3. Round to nearest whole number
 * 4. Handle division by zero (if capacity is 0)
 * 
 * EXAMPLE USAGE:
 * calculateRouteUtilization(25, 30)  // Returns: 83 (83% full)
 * calculateRouteUtilization(30, 30)  // Returns: 100 (full)
 * calculateRouteUtilization(10, 40)  // Returns: 25 (25% full)
 * calculateRouteUtilization(5, 0)    // Returns: 0 (handles zero capacity)
 * 
 * USE CASE:
 * Shows administrators how full each bus route is so they can plan better.
 * A 95% full route might need a bigger vehicle or a second route.
 * 
 * @param assigned - Number of students currently assigned to the route
 * @param capacity - Total capacity of the route (maximum students)
 * @returns Utilization percentage (0-100) as a whole number
 */
export const calculateRouteUtilization = (assigned: number, capacity: number): number => {
  // If capacity is 0, return 0 to avoid division by zero
  // Otherwise, calculate percentage and round to nearest integer
  return capacity > 0 ? Math.round((assigned / capacity) * 100) : 0;
};

// -----------------------------------------------------------------------------
// SECTION: Payment Status Badge
// Purpose: Get display properties for paid/unpaid status badges
// -----------------------------------------------------------------------------

/**
 * Get badge properties for transport payment status
 * 
 * WHAT IT DOES:
 * Returns an object with text and CSS classes for displaying payment status
 * 
 * HOW IT WORKS:
 * Uses a ternary operator to return different properties based on paid status
 * 
 * EXAMPLE USAGE:
 * getPaymentStatusBadge(true)   // Returns: { text: "✅ Paid", className: "bg-green-100..." }
 * getPaymentStatusBadge(false)  // Returns: { text: "❌ Unpaid", className: "bg-red-100..." }
 * 
 * IN COMPONENTS:
 * const status = getPaymentStatusBadge(assignment.paid);
 * <span className={status.className}>{status.text}</span>
 * 
 * @param paid - Boolean indicating if the transport fee has been paid
 * @returns Object with 'text' (display string) and 'className' (CSS classes)
 */
export const getPaymentStatusBadge = (paid: boolean) => {
  // If paid is true, return green badge with checkmark
  // If paid is false, return red badge with X mark
  return paid 
    ? { text: "✅ Paid", className: "bg-green-100 text-green-800" }
    : { text: "❌ Unpaid", className: "bg-red-100 text-red-800" };
};

// -----------------------------------------------------------------------------
// SECTION: CSV Export
// Purpose: Generate and download CSV files for transport reports
// -----------------------------------------------------------------------------

/**
 * Export transport report data to a downloadable CSV file
 * 
 * WHAT IT DOES:
 * Takes an array of transport data and creates a CSV file that the user can
 * download, similar to exporting from Excel
 * 
 * HOW IT WORKS:
 * 1. Define CSV headers (column names)
 * 2. Convert each data row to CSV format
 * 3. Combine headers and rows with newlines
 * 4. Create a Blob (file in memory)
 * 5. Create a temporary download link
 * 6. Trigger the download automatically
 * 7. Clean up the temporary link
 * 
 * EXAMPLE USAGE:
 * exportTransportReportToCSV([
 *   { studentName: "John Doe", studentClass: "Form 1A", routeName: "Route 1", ... },
 *   { studentName: "Jane Smith", studentClass: "Form 2B", routeName: "Route 2", ... }
 * ], "transport-report-november");
 * 
 * This will download a file named "transport-report-november.csv"
 * 
 * CSV FORMAT:
 * The resulting file looks like:
 * Student Name,Class,Route,Fee,Payment Status,Payment Date
 * "John Doe",Form 1A,"Route 1",50,Paid,2024-11-15
 * "Jane Smith",Form 2B,"Route 2",50,Unpaid,N/A
 * 
 * @param data - Array of transport assignment data with student details
 * @param filename - Name for the downloaded CSV file (without .csv extension)
 */
export const exportTransportReportToCSV = (data: any[], filename: string) => {
  // Define the column headers for the CSV file
  const headers = ["Student Name", "Class", "Route", "Fee", "Payment Status", "Payment Date"];
  
  // Build the CSV content
  const csvContent = [
    // First row: headers joined by commas
    headers.join(","),
    
    // Remaining rows: map each data object to a CSV row
    ...data.map(row => [
      // Wrap names in quotes to handle commas in names
      `"${row.studentName}"`,
      row.studentClass,
      `"${row.routeName}"`,
      row.fee,
      // Convert boolean to "Paid" or "Unpaid"
      row.paid ? "Paid" : "Unpaid",
      // Show payment date or "N/A" if not paid
      row.paymentDate || "N/A"
    ].join(","))  // Join each row's values with commas
  ].join("\n");  // Join all rows with newlines

  // Create a Blob (binary large object) - essentially a file in memory
  // The type "text/csv" tells the browser this is a CSV file
  const blob = new Blob([csvContent], { type: "text/csv" });
  
  // Create a temporary URL that points to this Blob
  const url = window.URL.createObjectURL(blob);
  
  // Create a temporary <a> element for downloading
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}.csv`;  // Set the download filename
  
  // Programmatically click the link to trigger download
  link.click();
  
  // Clean up: remove the temporary URL from memory
  window.URL.revokeObjectURL(url);
};

// -----------------------------------------------------------------------------
// SECTION: Utilization Color Coding
// Purpose: Color-code route utilization based on capacity thresholds
// -----------------------------------------------------------------------------

/**
 * Get text color class based on route utilization percentage
 * 
 * WHAT IT DOES:
 * Returns appropriate color classes to visually indicate route capacity status:
 * - Red: 90%+ (almost full or full - needs attention)
 * - Yellow: 70-89% (getting full - monitor)
 * - Green: 0-69% (plenty of space - good)
 * 
 * HOW IT WORKS:
 * Uses if statements to check utilization ranges and return color classes
 * 
 * EXAMPLE USAGE:
 * getUtilizationColor(95)   // Returns: "text-destructive" (red - urgent)
 * getUtilizationColor(75)   // Returns: "text-yellow-600" (yellow - warning)
 * getUtilizationColor(50)   // Returns: "text-green-600" (green - good)
 * 
 * IN COMPONENTS:
 * <span className={getUtilizationColor(utilization)}>
 *   {utilization}%
 * </span>
 * 
 * WHY THESE THRESHOLDS:
 * - 90%+: Route is nearly full, need to consider capacity expansion
 * - 70-89%: Route is filling up, should monitor for future planning
 * - Below 70%: Route has comfortable capacity
 * 
 * @param utilization - Route utilization percentage (0-100)
 * @returns Tailwind CSS text color class name
 */
export const getUtilizationColor = (utilization: number): string => {
  // Check thresholds from high to low
  if (utilization >= 90) return "text-destructive";      // 90-100%: Red (urgent)
  if (utilization >= 70) return "text-yellow-600";       // 70-89%: Yellow (warning)
  return "text-green-600";                                // 0-69%: Green (good)
};
