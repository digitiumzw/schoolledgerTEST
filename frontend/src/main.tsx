/**
 * ============================================
 * MAIN ENTRY POINT - Application Startup File
 * ============================================
 * 
 * This is the FIRST file that runs when your web app loads.
 * Think of it as the "ignition key" that starts everything.
 * 
 * What it does:
 * 1. Finds the HTML element with id="root" in index.html
 * 2. Creates a React root attached to that element
 * 3. Renders the main <App /> component into it
 * 
 * Why you need this:
 * - React needs to know WHERE in your HTML to mount the app
 * - This file tells React: "Put everything inside #root"
 * 
 * When to modify:
 * - Rarely! Only if you need to add global setup like:
 *   • Error boundaries
 *   • Performance monitoring
 *   • Service workers
 * 
 * Related files:
 * - index.html (contains the <div id="root"></div>)
 * - App.tsx (the component that gets rendered here)
 */

// Import React's rendering function (React 18's concurrent mode)
import { createRoot } from "react-dom/client";

// Import the main App component (the root of your component tree)
import App from "./App.tsx";

// Import global CSS styles (Tailwind, fonts, etc.)
import "./index.css";

/**
 * STEP 1: Find the HTML element to attach React to
 * - document.getElementById("root") finds <div id="root"></div> in index.html
 * - The ! tells TypeScript: "I promise this element exists"
 * - If the element doesn't exist, the app will crash (intentional safety check)
 */
const rootElement = document.getElementById("root")!;

/**
 * STEP 2: Create a React root
 * - createRoot() is React 18's new API for concurrent rendering
 * - This enables features like automatic batching and Suspense
 * - Older React versions used ReactDOM.render() instead
 */
const root = createRoot(rootElement);

/**
 * STEP 3: Render the App component
 * - This mounts the entire React component tree
 * - <App /> is the top-level component defined in App.tsx
 * - Everything your users see comes from components inside <App />
 */
root.render(<App />);
