import { HelpContentBundle, HelpSection, UserRole } from '@/types/help';

/**
 * ============================================================
 * HELP CENTER CONTENT
 * ============================================================
 * Single source of truth for every Help Center article.
 *
 * Content is role-aware: each section and topic declares the
 * roles that may view it, and the Help page filters accordingly.
 *
 * Navigation paths, button labels, tab names, and feature names
 * in this file are kept in sync with the live product. When a
 * screen changes, update the matching topic here too.
 */

// ---- Role groups (keep in sync with src/types/auth.ts UserRole) ----
const ALL_ROLES: UserRole[] = ['super_admin', 'admin', 'bursar', 'teacher', 'hr'];
const ADMIN_ROLES: UserRole[] = ['super_admin', 'admin'];
const BURSAR_ROLES: UserRole[] = ['super_admin', 'admin', 'bursar'];
const HR_ROLES: UserRole[] = ['super_admin', 'admin', 'hr'];
const TEACHER_ROLES: UserRole[] = ['super_admin', 'admin', 'teacher'];

const sections: HelpSection[] = [
  // ==========================================================
  // 1. GETTING STARTED
  // ==========================================================
  {
    id: 'getting-started',
    heading: 'Getting Started',
    description: 'Sign in, learn the layout, and understand what your role can do.',
    roleVisibility: ALL_ROLES,
    order: 1,
    icon: 'Compass',
    topics: [
      {
        id: 'understanding-roles',
        title: 'Understanding user roles and permissions',
        roleVisibility: ALL_ROLES,
        order: 1,
        summary:
          'SchoolLedger gives every user a role. Your role controls which pages appear in your sidebar and what actions you can take.',
        steps: [
          { order: 1, instruction: 'Super Admin — full access to everything, including the User Accounts tab and Account Settings. The super admin account cannot be deactivated.' },
          { order: 2, instruction: 'Admin — full access to every module except Account Settings. Admins manage students, classes, staff, billing, attendance, and most settings.' },
          { order: 3, instruction: 'Bursar — focused on finances: Students, Transport, Payments (including Reconciliation, Tuition Structure, Billing and Payment Categories tabs), and Fee Campaigns.' },
          { order: 4, instruction: 'HR — focused on people: Staff records and Staff Attendance only.' },
          { order: 5, instruction: 'Teacher — focused on the classroom: Student Attendance only.' },
        ],
        notes: [
          'The Help Center you are reading is filtered to your role — you only see articles for features you can access.',
          'If you need access to a page you cannot see, ask your school administrator to review your role in Settings > User Accounts.',
        ],
        faqs: [
          { question: 'Can one person have more than one role?', answer: 'No. Each user account has exactly one role. If someone performs two jobs, an administrator can change their role, or create a second account with a different email.' },
        ],
        related: [
          { topicId: 'sidebar-navigation', label: 'Navigating the sidebar' },
          { topicId: 'inviting-users', label: 'Inviting users' },
        ],
        tags: ['roles', 'permissions', 'access', 'admin', 'bursar', 'teacher', 'hr'],
      },
      {
        id: 'logging-in',
        title: 'Signing in and resetting your password',
        roleVisibility: ALL_ROLES,
        order: 2,
        summary: 'How to log in for the first time, sign in day-to-day, and recover a forgotten password.',
        steps: [
          { order: 1, instruction: 'Open the app and enter the email address and password provided to you, then click "Sign in".' },
          { order: 2, instruction: 'If you were given a temporary password, you will be prompted to set a new one the first time you log in. Choose a strong, private password.', tip: 'Temporary passwords stop working once you set your own.' },
          { order: 3, instruction: 'Forgot your password? On the login screen click "Forgot password?", enter your email, and follow the reset link sent to your inbox.' },
          { order: 4, instruction: 'Invited by email? Open the invitation link, set your password on the "Accept invitation" screen, and you will be signed in automatically.' },
        ],
        warnings: [
          'Reset and invitation links expire for security. If a link no longer works, request a new one or ask an administrator to resend the invite.',
        ],
        notes: [
          'After signing in, you land on the page that best fits your role: admins see the Dashboard, bursars go to Payments, HR to Staff, and teachers to Student Attendance.',
          'Sessions expire after a period of inactivity. If you are logged out unexpectedly, simply sign in again.',
        ],
        faqs: [
          { question: 'I never received my reset email. What now?', answer: 'Check your spam or junk folder first. If it still has not arrived, ask your administrator to confirm the email on your account is correct and to resend the invitation.' },
        ],
        related: [{ topicId: 'login-issues', label: 'Troubleshooting login problems' }],
        tags: ['login', 'sign in', 'password', 'reset', 'forgot', 'invite'],
      },
      {
        id: 'sidebar-navigation',
        title: 'Navigating the sidebar and header',
        roleVisibility: ALL_ROLES,
        order: 3,
        summary: 'The left sidebar is your main menu. It only shows the pages your role can open.',
        steps: [
          { order: 1, instruction: 'Use the left sidebar to move between modules. The current page is highlighted.' },
          { order: 2, instruction: 'Collapse the sidebar to icon-only mode using the toggle to free up screen space; hover any icon to see its label.' },
          { order: 3, instruction: 'The header shows your school name and profile menu, and a theme toggle for switching between light and dark mode.' },
          { order: 4, instruction: 'Click "Restart tutorial" at the bottom of the sidebar to replay the guided walkthrough at any time.' },
        ],
        notes: [
          'Look for the circular help icon on many pages — it opens the relevant Help Center article for that screen.',
          'Banners may appear at the top of the app to warn about subscription status, unbilled charges, or dates that fall outside your configured terms.',
        ],
        tags: ['navigation', 'sidebar', 'menu', 'header', 'dark mode', 'theme'],
      },
      {
        id: 'understanding-dashboard',
        title: 'Understanding the Dashboard',
        roleVisibility: ADMIN_ROLES,
        order: 4,
        summary: 'The Dashboard is the admin home page. It summarises collections, enrolment, and outstanding balances at a glance.',
        prerequisites: ['You are signed in as an Admin or Super Admin.'],
        steps: [
          { order: 1, instruction: 'Open the Dashboard from the top of the sidebar (or by clicking your school logo).' },
          { order: 2, instruction: 'Review the summary cards for key figures such as total students, collections, and outstanding balances.' },
          { order: 3, instruction: 'Use the charts and lists to spot trends, then click through to the relevant module for detail.' },
        ],
        notes: [
          'Figures refresh automatically every 30 seconds and whenever you return to the tab, so you always see current data.',
          'Bursars, HR, and teachers do not have a Dashboard; they land on their primary working page instead.',
        ],
        tags: ['dashboard', 'overview', 'home', 'summary', 'analytics'],
      },
      {
        id: 'using-help-center',
        title: 'Getting the most out of the Help Center',
        roleVisibility: ALL_ROLES,
        order: 5,
        summary: 'How to find answers quickly using search, the table of contents, and contextual help links.',
        steps: [
          { order: 1, instruction: 'Open Help from the sidebar at any time.' },
          { order: 2, instruction: 'Use the search box to filter topics by keyword — it matches titles, summaries, steps, notes, and FAQs.' },
          { order: 3, instruction: 'Use the table of contents on the left (or "Browse topics" on mobile) to jump straight to a section.' },
          { order: 4, instruction: 'Follow the "Related topics" links at the bottom of an article to explore connected features.' },
        ],
        notes: ['This Help Center is role-aware, so the articles you see always match what you can do in the app.'],
        tags: ['help', 'search', 'support', 'documentation'],
      },
    ],
  },
  {
    id: 'school-setup',
    heading: 'School Setup & Settings',
    description: 'Configure your school profile and core preferences under Settings.',
    roleVisibility: ADMIN_ROLES,
    order: 2,
    icon: 'Settings',
    topics: [
      {
        id: 'completing-onboarding',
        title: 'Completing first-time onboarding',
        roleVisibility: ADMIN_ROLES,
        order: 1,
        summary: 'When a school is first created, the admin is guided through a short onboarding wizard before reaching the Dashboard.',
        steps: [
          { order: 1, instruction: 'On first login with a temporary password, set your own password when prompted.' },
          { order: 2, instruction: 'Follow the onboarding wizard to confirm your school details and initial preferences.' },
          { order: 3, instruction: 'Finish the wizard to unlock the Dashboard. You can refine everything later under Settings.' },
        ],
        notes: [
          'Onboarding only appears until it is completed once. Schools created before this feature are treated as already onboarded.',
          'You can revisit and change any onboarding choice later in Settings.',
        ],
        related: [
          { topicId: 'general-settings', label: 'General settings' },
          { topicId: 'creating-academic-year', label: 'Set up your academic calendar' },
        ],
        tags: ['onboarding', 'setup', 'first time', 'wizard'],
      },
      {
        id: 'general-settings',
        title: 'Editing general school settings',
        roleVisibility: ADMIN_ROLES,
        order: 2,
        summary: 'General settings hold your school name, contact details, and display preferences shown across the app and on receipts.',
        prerequisites: ['You are signed in as an Admin or Super Admin.'],
        steps: [
          { order: 1, instruction: 'Open Settings from the sidebar. You land on the General tab by default.' },
          { order: 2, instruction: 'Update your school name, contact information, and other profile details.' },
          { order: 3, instruction: 'Save your changes. Updated details appear across the app and on newly generated receipts.' },
        ],
        notes: [
          'Settings pages are available to Admins and Super Admins only. Account Settings is limited to the Super Admin.',
          'Your school name also appears in the sidebar header once saved.',
        ],
        related: [
          { topicId: 'inviting-users', label: 'Manage user accounts' },
          { topicId: 'creating-academic-year', label: 'Academic calendar' },
          { topicId: 'enabling-multi-currency', label: 'Multi-currency settings' },
        ],
        tags: ['settings', 'school name', 'profile', 'general', 'contact'],
      },
    ],
  },
  {
    id: 'academic-calendar',
    heading: 'Academic Calendar & Terms',
    description: 'Define the terms that drive billing periods, reports, and attendance.',
    roleVisibility: ADMIN_ROLES,
    order: 3,
    icon: 'Calendar',
    topics: [
      {
        id: 'creating-academic-year',
        title: 'Setting up terms for the academic year',
        roleVisibility: ADMIN_ROLES,
        order: 1,
        summary: 'The academic calendar defines your terms. Terms are used across billing, reports, and the "current term" shown throughout the app.',
        prerequisites: ['You are signed in as an Admin or Super Admin.'],
        steps: [
          { order: 1, instruction: 'Open Settings > Academic Calendar.' },
          { order: 2, instruction: 'Click "Add term", then enter the term name and its start and end dates.' },
          { order: 3, instruction: 'Repeat for each term. You can configure up to three terms per academic year.' },
          { order: 4, instruction: 'Use the edit icon beside a term to change its dates, or the delete icon to remove it.' },
          { order: 5, instruction: 'Save the calendar. The term that contains today\u2019s date is tagged "Current".' },
        ],
        warnings: [
          'Term dates cannot overlap. If you see a "Term Dates Overlap" message, adjust the dates so each term occupies a distinct range.',
          'You must keep at least one term \u2014 the last remaining term cannot be deleted.',
        ],
        notes: [
          'A maximum of three terms is allowed per academic year.',
          'If today falls outside every configured term, an "Outside term" banner appears app-wide. Update your term dates at the start of each new year to clear it.',
          'The Active Session shown on this tab is read-only and reflects the recommended academic session.',
        ],
        faqs: [
          { question: 'Why does the app say the current date is outside all terms?', answer: 'Your term dates are likely from a previous year or you are in a holiday break. Edit each term to set the correct dates for the current year.' },
        ],
        related: [
          { topicId: 'billing-cycle', label: 'Choosing a billing cycle' },
          { topicId: 'generating-fee-charges', label: 'Generating termly charges' },
        ],
        tags: ['calendar', 'term', 'academic year', 'dates', 'session'],
      },
    ],
  },
  {
    id: 'class-management',
    heading: 'Classes & Enrollment',
    description: 'Create classes, assign teachers, place students, and promote at year end.',
    roleVisibility: ADMIN_ROLES,
    order: 4,
    icon: 'GraduationCap',
    topics: [
      {
        id: 'creating-a-class',
        title: 'Creating and editing classes',
        roleVisibility: ADMIN_ROLES,
        order: 1,
        summary: 'Classes group students for enrolment, attendance, and class-scoped fee rules. Each class can have a teacher, a capacity, and a progression order.',
        prerequisites: ['You are signed in as an Admin or Super Admin.'],
        steps: [
          { order: 1, instruction: 'Open Classes from the sidebar.' },
          { order: 2, instruction: 'Click "Add Class", then enter the class name, capacity, an optional teacher, and its progression order.', tip: 'Progression order controls the sequence classes follow during promotion (for example Grade 1 → Grade 2).' },
          { order: 3, instruction: 'Save. The class appears in the list showing its teacher, current students vs capacity, and progression.' },
          { order: 4, instruction: 'Use the row menu to edit a class, or archive it when it is no longer in use.' },
        ],
        notes: [
          'The Students / Capacity column shows how full each class is; a full class is flagged so you avoid over-enrolling.',
          'Archived classes are hidden from the active list but kept for historical records. Switch to the Archived tab to view or restore them.',
          'Teachers see this page as read-only; bursars do not have access to the Classes list.',
        ],
        related: [
          { topicId: 'enrolling-students', label: 'Enrolling students into a class' },
          { topicId: 'promoting-students', label: 'Promoting students at year end' },
          { topicId: 'creating-fee-rules', label: 'Class-scoped fee rules' },
        ],
        tags: ['classes', 'create class', 'capacity', 'teacher', 'progression', 'archive'],
      },
      {
        id: 'enrolling-students',
        title: 'Assigning students to a class',
        roleVisibility: ADMIN_ROLES,
        order: 2,
        summary: 'Open a class to manage its roster, and clear the Unassigned list so every active student has a class.',
        steps: [
          { order: 1, instruction: 'On the Classes page, click a class to open its student roster (/classes/:id/students).' },
          { order: 2, instruction: 'Add students to the class or move them between classes from the roster view.' },
          { order: 3, instruction: 'If a banner shows unassigned students, click "View & Assign" to open the Unassigned Students page and place them.' },
        ],
        notes: [
          'Students imported in bulk often arrive without a class. The amber "students not assigned to a class" alert links straight to the Unassigned page.',
          'A student can belong to one class at a time.',
        ],
        related: [
          { topicId: 'bulk-student-import', label: 'Bulk importing students' },
          { topicId: 'creating-a-class', label: 'Creating classes' },
        ],
        tags: ['enrol', 'enroll', 'assign', 'roster', 'unassigned', 'class'],
      },
      {
        id: 'promoting-students',
        title: 'Promoting and graduating students',
        roleVisibility: ADMIN_ROLES,
        order: 3,
        summary: 'The Promote action moves students to their next class based on progression order and graduates those in the final class.',
        prerequisites: [
          'Every class has a progression order set.',
          'You are starting a new academic year or session.',
        ],
        steps: [
          { order: 1, instruction: 'On the Classes page, click "Promote".' },
          { order: 2, instruction: 'Review the summary of how many students will be promoted, graduated, or skipped.' },
          { order: 3, instruction: 'Confirm to run promotion. Students advance to the next class in the progression sequence.' },
        ],
        warnings: [
          'Promotion changes the class of many students at once. Run it only when you are ready to roll over to the new year, and double-check progression order first.',
        ],
        notes: [
          'Students in the highest progression class are marked as graduated rather than promoted.',
          'Students without a valid next class are skipped and reported so you can place them manually.',
        ],
        related: [{ topicId: 'creating-a-class', label: 'Set progression order' }],
        tags: ['promote', 'graduate', 'year end', 'progression', 'rollover'],
      },
    ],
  },
  {
    id: 'student-management',
    heading: 'Student Records',
    description: 'Add, find, edit, and manage the status of every student.',
    roleVisibility: BURSAR_ROLES,
    order: 5,
    icon: 'Users',
    topics: [
      {
        id: 'finding-students',
        title: 'Finding and filtering students',
        roleVisibility: BURSAR_ROLES,
        order: 1,
        summary: 'The Students page lists everyone enrolled. Use search and filters to narrow the list to exactly who you need.',
        steps: [
          { order: 1, instruction: 'Open Students from the sidebar.' },
          { order: 2, instruction: 'Type a name into the search box, or filter by class using the Class dropdown.' },
          { order: 3, instruction: 'Filter by status (Active, Inactive, Graduated, Transferred, Dropped out, or All). The list defaults to Active students.' },
          { order: 4, instruction: 'Toggle "with balance" to show only students who currently owe money.' },
          { order: 5, instruction: 'Sort by name, class, or balance by clicking the column headers.' },
        ],
        notes: [
          'Bursary status is shown beside a student\u2019s name — "Full Bursary" or a percentage for partial bursaries.',
          'The colour of the balance indicates whether a student is in credit, settled, or owing.',
        ],
        related: [
          { topicId: 'student-profile', label: 'Opening a student profile' },
          { topicId: 'viewing-balances', label: 'Understanding balances' },
        ],
        tags: ['students', 'search', 'filter', 'status', 'balance', 'list'],
      },
      {
        id: 'adding-editing-students',
        title: 'Adding and editing a student',
        roleVisibility: BURSAR_ROLES,
        order: 2,
        summary: 'Create individual student records, keep their details up to date, and set bursary discounts.',
        steps: [
          { order: 1, instruction: 'On the Students page, click "Add Student".' },
          { order: 2, instruction: 'Fill in the student\u2019s personal details, class, and guardian/contact information.' },
          { order: 3, instruction: 'Set a bursary (full or partial percentage) if the student receives fee assistance.', tip: 'A bursary automatically reduces the charges generated for that student.' },
          { order: 4, instruction: 'Save. To edit later, click the pencil (edit) icon on the student\u2019s row.' },
        ],
        notes: [
          'Assigning a class here places the student on that class roster immediately.',
          'Editing a bursary affects future generated charges, not charges already posted to the ledger.',
        ],
        related: [
          { topicId: 'changing-student-status', label: 'Changing a student\u2019s status' },
          { topicId: 'bulk-student-import', label: 'Bulk importing students' },
        ],
        tags: ['add student', 'edit', 'bursary', 'guardian', 'create'],
      },
      {
        id: 'changing-student-status',
        title: 'Changing a student\u2019s status',
        roleVisibility: BURSAR_ROLES,
        order: 3,
        summary: 'Status marks whether a student is currently enrolled. Use it instead of deleting when a student leaves.',
        steps: [
          { order: 1, instruction: 'On the Students page, click the status (up/down arrows) button on a student\u2019s row.' },
          { order: 2, instruction: 'Choose the new status: Active, Inactive, Graduated, Transferred, or Dropped out.' },
          { order: 3, instruction: 'Confirm. The student is filtered accordingly and stops appearing in the default Active list.' },
        ],
        warnings: [
          'Deleting a student is permanent and removes their records. Prefer changing status to Inactive, Transferred, or Dropped out to keep historical and financial data.',
        ],
        notes: [
          'Only Active students are billed when you generate charges.',
          'Graduated status is normally applied automatically by the Promote action for the final class.',
        ],
        related: [
          { topicId: 'promoting-students', label: 'Promoting and graduating' },
          { topicId: 'finding-students', label: 'Filtering by status' },
        ],
        tags: ['status', 'inactive', 'graduated', 'transferred', 'dropped out', 'delete'],
      },
      {
        id: 'student-profile',
        title: 'Using the student profile',
        roleVisibility: BURSAR_ROLES,
        order: 4,
        summary: 'The student profile is the full record for one student — personal details, class, financial ledger, and receipts.',
        steps: [
          { order: 1, instruction: 'On the Students page, click the view (eye) icon on a student\u2019s row to open their profile (/students/:id).' },
          { order: 2, instruction: 'Review personal and guardian details at the top.' },
          { order: 3, instruction: 'Scroll to the financial section to see the ledger of charges and payments, the current balance, and receipts.' },
          { order: 4, instruction: 'Record a payment, print a statement, or view receipts directly from the profile.' },
        ],
        notes: [
          'The profile is the best place to answer a guardian\u2019s question about "what do I owe and why".',
          'Every charge and payment line is dated so you can trace how the balance was reached.',
        ],
        related: [
          { topicId: 'recording-a-payment', label: 'Recording a payment' },
          { topicId: 'fee-statement', label: 'Printing a fee statement' },
        ],
        tags: ['profile', 'student detail', 'ledger', 'balance', 'receipts'],
      },
      {
        id: 'bulk-student-import',
        title: 'Bulk importing students',
        roleVisibility: BURSAR_ROLES,
        order: 5,
        summary: 'Import many students at once from a spreadsheet instead of adding them one by one.',
        prerequisites: ['You have your student data ready in a spreadsheet.'],
        steps: [
          { order: 1, instruction: 'On the Students page, click "Import" to open the bulk import page (/students/import).' },
          { order: 2, instruction: 'Download the template, fill it with your student data, and upload the completed file.' },
          { order: 3, instruction: 'Review the validation preview, fix any flagged rows, then confirm the import.' },
          { order: 4, instruction: 'After importing, assign the new students to classes from the Unassigned Students page.' },
        ],
        warnings: [
          'Imported students often arrive without a class. Clear the "unassigned students" alert on the Classes page so they appear on rosters and are billed correctly.',
        ],
        notes: [
          'Use "Export" on the Students page to download the current list, which also shows the expected column format.',
          'Importing counts toward your subscription\u2019s student capacity limit.',
        ],
        related: [
          { topicId: 'enrolling-students', label: 'Assigning students to classes' },
          { topicId: 'student-capacity', label: 'Student capacity limits' },
        ],
        tags: ['import', 'bulk', 'spreadsheet', 'upload', 'export', 'csv'],
      },
    ],
  },
  {
    id: 'fees-billing',
    heading: 'Fees, Tuition & Billing',
    description: 'Set up how fees are calculated, then generate charges onto student ledgers.',
    roleVisibility: BURSAR_ROLES,
    order: 6,
    icon: 'Receipt',
    topics: [
      {
        id: 'billing-cycle',
        title: 'Choosing your billing cycle',
        roleVisibility: BURSAR_ROLES,
        order: 1,
        summary: 'The billing cycle decides whether recurring fees are grouped by term or by calendar month.',
        steps: [
          { order: 1, instruction: 'Open Payments from the sidebar, then select the "Tuition Structure" tab.' },
          { order: 2, instruction: 'Under Billing Configuration, choose Termly or Monthly.', tip: 'Termly suits schools with clear term boundaries; Monthly suits rolling/continuous enrolment.' },
          { order: 3, instruction: 'Click "Save Cycle" to apply the change.' },
        ],
        notes: [
          'Only Admins and Super Admins can change the billing cycle; bursars see these settings as read-only.',
          'The cycle controls how charges are grouped when you generate them on the Billing tab.',
        ],
        related: [
          { topicId: 'creating-fee-rules', label: 'Creating tuition rules' },
          { topicId: 'generating-fee-charges', label: 'Generating charges' },
          { topicId: 'creating-academic-year', label: 'Academic calendar & terms' },
        ],
        tags: ['billing', 'cycle', 'termly', 'monthly', 'tuition structure'],
      },
      {
        id: 'creating-fee-rules',
        title: 'Creating tuition (fee) rules',
        roleVisibility: BURSAR_ROLES,
        order: 2,
        summary: 'Tuition rules define what students are charged. Each rule has an amount and a scope (school-wide or specific classes).',
        prerequisites: ['You have chosen a billing cycle on the Tuition Structure tab.'],
        steps: [
          { order: 1, instruction: 'Go to Payments > Tuition Structure and find the Tuition Rules panel.' },
          { order: 2, instruction: 'Add a rule with a name and amount, then scope it school-wide or to specific classes.' },
          { order: 3, instruction: 'Activate the rules you want to bill. Inactive rules are ignored when charges are generated.' },
        ],
        warnings: [
          'Only active rules generate charges. Double-check which rules are active before running generation.',
          'Editing a rule affects future charge generation, not charges already posted to student ledgers.',
        ],
        notes: [
          'School-wide rules apply to every active student; class rules only apply to students in the selected classes.',
          'Transport charges are configured separately on the Transport page, not as tuition rules.',
        ],
        related: [
          { topicId: 'charge-proration', label: 'Proration for mid-period joins' },
          { topicId: 'generating-fee-charges', label: 'Generating charges' },
        ],
        tags: ['fee rules', 'tuition', 'charges', 'scope', 'class', 'school-wide'],
      },
      {
        id: 'charge-proration',
        title: 'Prorating charges for mid-period enrolments',
        roleVisibility: BURSAR_ROLES,
        order: 3,
        summary: 'Proration charges a partial amount to students who join partway through a term or month.',
        steps: [
          { order: 1, instruction: 'Go to Payments > Tuition Structure.' },
          { order: 2, instruction: 'Turn on "Charge Proration" to bill partial amounts based on enrolment/allocation dates.' },
          { order: 3, instruction: 'Click "Save Proration".' },
        ],
        notes: [
          'Proration applies to both fee-rule charges and transport charges, using the student\u2019s enrolment or route-allocation date.',
          'With proration off, students are charged the full amount regardless of when they joined.',
          'Only Admins and Super Admins can change this setting.',
        ],
        tags: ['proration', 'partial', 'mid-term', 'pro-rata'],
      },
      {
        id: 'payment-categories',
        title: 'Managing payment categories',
        roleVisibility: BURSAR_ROLES,
        order: 4,
        summary: 'Payment categories let you label payments (for example Tuition, Uniform, Trip) for clearer reporting.',
        steps: [
          { order: 1, instruction: 'Open Payments > Payment Categories.' },
          { order: 2, instruction: 'Add, rename, or remove categories to match how your school groups income.' },
          { order: 3, instruction: 'When recording a payment, pick a category so it appears correctly in filters and reports.' },
        ],
        notes: [
          'Categories are optional on a payment, but using them consistently makes reconciliation and reporting far easier.',
          'A single payment can be split across multiple categories when recording it.',
        ],
        related: [
          { topicId: 'recording-a-payment', label: 'Recording a payment' },
          { topicId: 'split-payment', label: 'Splitting a payment across categories' },
        ],
        tags: ['categories', 'payment category', 'labels', 'reporting'],
      },
      {
        id: 'generating-fee-charges',
        title: 'Generating tuition charges',
        roleVisibility: BURSAR_ROLES,
        order: 5,
        summary: 'Generation posts charges from your active tuition rules onto each eligible student\u2019s ledger for a chosen period.',
        prerequisites: [
          'Your billing cycle is set and your tuition rules are active.',
          'Students are marked Active and assigned to the correct classes.',
        ],
        steps: [
          { order: 1, instruction: 'Open Payments > Billing.' },
          { order: 2, instruction: 'Select the billing period (term or month, depending on your cycle).' },
          { order: 3, instruction: 'Click "Generate charges". Each eligible student receives a ledger entry automatically.' },
          { order: 4, instruction: 'Review the result summary showing how many charges were created and how many were skipped.' },
        ],
        warnings: [
          'Generate charges only once per period. Students already charged for the selected period are skipped, so it is safe to re-run, but always review the summary.',
          'An "Unbilled charges" banner may appear if new fee rules exist that have not yet been generated.',
        ],
        notes: [
          'Bursaries automatically reduce the amount charged to those students.',
          'Only Active students are billed. Inactive, graduated, transferred, and dropped-out students are excluded.',
        ],
        related: [
          { topicId: 'generating-transport-charges', label: 'Generating transport charges' },
          { topicId: 'rolling-back-charges', label: 'Rolling back a charge batch' },
        ],
        tags: ['generate', 'charges', 'billing', 'term', 'month', 'ledger'],
      },
      {
        id: 'generating-transport-charges',
        title: 'Generating transport charges',
        roleVisibility: BURSAR_ROLES,
        order: 6,
        summary: 'Transport charges are billed monthly to students who have an active route allocation.',
        prerequisites: ['Route allocations and stop assignments are up to date on the Transport page.'],
        steps: [
          { order: 1, instruction: 'Open Payments > Billing and find the Transport Charges card.' },
          { order: 2, instruction: 'Choose the charge month.' },
          { order: 3, instruction: 'Click "Generate charges" to add a transport charge to every student with an active allocation for that month.' },
        ],
        warnings: [
          'Students already charged for the selected month are skipped, so re-running is safe. Always confirm allocations before generating.',
        ],
        notes: [
          'Run transport billing once per month, after confirming route allocations.',
          'If proration is enabled, students allocated mid-month are charged a partial amount.',
        ],
        related: [
          { topicId: 'assigning-transport', label: 'Assigning students to routes' },
          { topicId: 'rolling-back-charges', label: 'Rolling back a charge batch' },
        ],
        tags: ['transport', 'charges', 'monthly', 'generate', 'route'],
      },
      {
        id: 'rolling-back-charges',
        title: 'Rolling back a charge batch',
        roleVisibility: BURSAR_ROLES,
        order: 7,
        summary: 'If you generate charges by mistake, you can void the most recent batch to remove them from student ledgers.',
        steps: [
          { order: 1, instruction: 'On Payments > Billing, find the charge type you generated (tuition or transport).' },
          { order: 2, instruction: 'Click "Rollback latest" to load the most recent batch.' },
          { order: 3, instruction: 'Optionally enter a reason, then confirm to void the batch.' },
        ],
        warnings: [
          'Rollback voids the most recently generated batch only. It does not undo payments that guardians have already made.',
          'Voided charges are recorded in the audit trail; the action is tracked but cannot be silently reversed.',
        ],
        related: [
          { topicId: 'generating-fee-charges', label: 'Generating tuition charges' },
          { topicId: 'adjustments-refunds', label: 'Reconciliation & adjustments' },
        ],
        tags: ['rollback', 'void', 'undo', 'batch', 'charges'],
      },
    ],
  },
  {
    id: 'recording-payments',
    heading: 'Recording Payments & Receipts',
    description: 'Take payments, split them across categories, and share receipts.',
    roleVisibility: BURSAR_ROLES,
    order: 7,
    icon: 'CreditCard',
    topics: [
      {
        id: 'recording-a-payment',
        title: 'Recording a payment',
        roleVisibility: BURSAR_ROLES,
        order: 1,
        summary: 'Record money received from a guardian against a student\u2019s account. This reduces their outstanding balance immediately.',
        steps: [
          { order: 1, instruction: 'Open Payments from the sidebar and stay on the Payments tab.' },
          { order: 2, instruction: 'Click "Record Payment".' },
          { order: 3, instruction: 'Search for and select the student.' },
          { order: 4, instruction: 'Enter the amount and payment date, then choose a payment method.', tip: 'Methods include Cash, EcoCash, OneMoney, Telecash, Bank Transfer, ZIPIT, Swipe (Card), Cheque, and Other.' },
          { order: 5, instruction: 'Optionally choose a category and add a description, then review the summary and confirm.' },
        ],
        notes: [
          'A receipt is created automatically for every payment and can be viewed, printed, or shared.',
          'Amount, method, and student are required; category and description are optional but recommended.',
        ],
        related: [
          { topicId: 'split-payment', label: 'Splitting a payment across categories' },
          { topicId: 'managing-receipts', label: 'Viewing and sharing receipts' },
          { topicId: 'payment-categories', label: 'Managing payment categories' },
          { topicId: 'recording-foreign-currency-payments', label: 'Recording a foreign-currency payment' },
        ],
        tags: ['payment', 'record', 'receipt', 'method', 'cash', 'ecocash'],
      },
      {
        id: 'split-payment',
        title: 'Splitting a payment across categories',
        roleVisibility: BURSAR_ROLES,
        order: 2,
        summary: 'Allocate one payment to several categories at once — for example part tuition, part uniform.',
        steps: [
          { order: 1, instruction: 'In the Record Payment dialog, click "Split across categories".' },
          { order: 2, instruction: 'Add a row for each category and enter the amount for that portion.' },
          { order: 3, instruction: 'Make sure the category amounts add up to the total, then confirm.' },
        ],
        notes: ['Splitting is optional and only affects how the payment is categorised for reporting; the total still applies to the student\u2019s balance.'],
        related: [{ topicId: 'payment-categories', label: 'Managing payment categories' }],
        tags: ['split', 'categories', 'allocate', 'payment'],
      },
      {
        id: 'viewing-payment-history',
        title: 'Searching and filtering payment history',
        roleVisibility: BURSAR_ROLES,
        order: 3,
        summary: 'The Payments tab lists every payment. Use search and filters to find specific transactions.',
        steps: [
          { order: 1, instruction: 'On the Payments tab, search by student name or receipt number.' },
          { order: 2, instruction: 'Filter by payment method, category, class, month, or year to narrow the list.' },
          { order: 3, instruction: 'Open a payment to view or reprint its receipt.' },
        ],
        notes: ['Consistent use of categories and descriptions makes this history far easier to search and reconcile.'],
        related: [
          { topicId: 'managing-receipts', label: 'Receipts' },
          { topicId: 'adjustments-refunds', label: 'Reconciliation & adjustments' },
        ],
        tags: ['history', 'search', 'filter', 'receipt number', 'payments'],
      },
      {
        id: 'managing-receipts',
        title: 'Viewing and sharing receipts',
        roleVisibility: BURSAR_ROLES,
        order: 4,
        summary: 'Every payment produces a receipt you can print or share with the guardian, including a public link and QR code.',
        steps: [
          { order: 1, instruction: 'Open a payment (from the Payments tab or a student\u2019s profile) to view its receipt.' },
          { order: 2, instruction: 'Print the receipt, or share the public receipt link/QR code with the guardian.' },
          { order: 3, instruction: 'Guardians can view a student\u2019s receipts from the public receipt list without logging in.' },
        ],
        notes: [
          'Public receipt links are designed to be shared with guardians; they show only that receipt or a student\u2019s receipt list.',
          'Your school name and contact details from General settings appear on receipts.',
        ],
        related: [
          { topicId: 'general-settings', label: 'School details on receipts' },
          { topicId: 'fee-statement', label: 'Printing a full fee statement' },
        ],
        tags: ['receipt', 'print', 'share', 'qr', 'public link'],
      },
      {
        id: 'adjustments-refunds',
        title: 'Reconciliation: adjustments and refunds',
        roleVisibility: BURSAR_ROLES,
        order: 5,
        summary: 'The Reconciliation tab lets you correct balances with credit/debit adjustments and process refunds, all tracked in an audit log.',
        steps: [
          { order: 1, instruction: 'Open Payments > Reconciliation.' },
          { order: 2, instruction: 'Use "Adjustments" to add a credit (reduce what a student owes) or debit (increase it), with a category and reason.' },
          { order: 3, instruction: 'Use "Refunds" to record money returned to a guardian and track its status.' },
          { order: 4, instruction: 'Review the summary cards and audit log to see all corrections for the period.' },
        ],
        warnings: [
          'Adjustments directly change a student\u2019s balance. Always enter a clear reason — every adjustment and void is recorded in the audit trail.',
          'To undo an adjustment, void it (a reason is required). Voiding is logged and cannot be hidden.',
        ],
        notes: [
          'Use adjustments for genuine corrections (waivers, discounts, error fixes), not to replace recording real payments.',
          'Prefer rolling back a charge batch to fix an incorrect generation; use adjustments for individual balance corrections.',
        ],
        related: [
          { topicId: 'rolling-back-charges', label: 'Rolling back a charge batch' },
          { topicId: 'viewing-balances', label: 'Understanding balances' },
        ],
        tags: ['reconciliation', 'adjustment', 'refund', 'credit', 'debit', 'audit'],
      },
    ],
  },
  {
    id: 'transport',
    heading: 'Transport Management',
    description: 'Set up routes, vehicles, and drivers, then allocate students and bill transport.',
    roleVisibility: BURSAR_ROLES,
    order: 8,
    icon: 'Bus',
    topics: [
      {
        id: 'creating-transport-routes',
        title: 'Creating routes, vehicles, and drivers',
        roleVisibility: BURSAR_ROLES,
        order: 1,
        summary: 'The Transport page has three tabs — Routes, Vehicles, and Drivers. A route carries a monthly fee and can be linked to a vehicle and driver.',
        steps: [
          { order: 1, instruction: 'Open Transport from the sidebar.' },
          { order: 2, instruction: 'On the Routes tab, click "New Route" and enter the route name and monthly fee. Optionally link a vehicle and driver.' },
          { order: 3, instruction: 'Use the Vehicles tab ("Add Vehicle") and Drivers tab ("Add Driver") to build your fleet and staff list.' },
          { order: 4, instruction: 'Each route row shows its status, number of students, stops, monthly fee, vehicle, and driver.' },
        ],
        notes: [
          'The monthly fee on a route is what students on that route are billed each month.',
          'Search across routes, vehicles, and drivers using the search box at the top.',
        ],
        related: [
          { topicId: 'assigning-transport', label: 'Assigning students to routes' },
          { topicId: 'generating-transport-charges', label: 'Generating transport charges' },
        ],
        tags: ['transport', 'route', 'vehicle', 'driver', 'monthly fee'],
      },
      {
        id: 'assigning-transport',
        title: 'Assigning students to routes and stops',
        roleVisibility: BURSAR_ROLES,
        order: 2,
        summary: 'Open a route to manage its stops and allocate students. Allocations drive the monthly transport charge.',
        steps: [
          { order: 1, instruction: 'On the Routes tab, click a route (or the view icon) to open its detail page.' },
          { order: 2, instruction: 'Add stops to the route and allocate students to the route/stop.' },
          { order: 3, instruction: 'Keep allocations current before generating monthly transport charges.' },
        ],
        warnings: [
          'Only students with an active route allocation are billed for transport. Confirm allocations each month before generating charges.',
        ],
        notes: [
          'If proration is enabled, a student allocated mid-month is charged a partial transport fee.',
          'A "missing charge" alert can appear when allocated students have not yet been billed for the current month.',
        ],
        related: [
          { topicId: 'generating-transport-charges', label: 'Generating transport charges' },
          { topicId: 'charge-proration', label: 'Charge proration' },
        ],
        tags: ['allocation', 'stop', 'assign', 'route', 'transport'],
      },
      {
        id: 'driver-kiosk',
        title: 'Using the driver kiosk',
        roleVisibility: BURSAR_ROLES,
        order: 3,
        summary: 'The driver kiosk is a public screen a driver can open to see the students allocated to their route.',
        steps: [
          { order: 1, instruction: 'From a route\u2019s detail page, open or share the driver kiosk link for that route.' },
          { order: 2, instruction: 'The driver opens the link on a phone or tablet — no login required.' },
          { order: 3, instruction: 'The kiosk shows the route\u2019s allocated students and stops for pick-up and drop-off.' },
        ],
        notes: ['Kiosk links are public by design so drivers do not need an account. Only share them with the assigned driver.'],
        tags: ['driver', 'kiosk', 'route', 'public'],
      },
    ],
  },
  {
    id: 'fee-campaigns',
    heading: 'Fee Campaigns',
    description: 'Collect one-off, event-based fees (trips, uniforms, fundraisers) and track progress.',
    roleVisibility: BURSAR_ROLES,
    order: 9,
    icon: 'Megaphone',
    topics: [
      {
        id: 'creating-campaign',
        title: 'Creating a fee campaign',
        roleVisibility: BURSAR_ROLES,
        order: 1,
        summary: 'A campaign is a one-off collection — like a trip or uniform drive — separate from recurring tuition. It tracks how much has been collected against a target.',
        steps: [
          { order: 1, instruction: 'Open Fee Campaigns from the sidebar.' },
          { order: 2, instruction: 'Click "New Campaign" and enter the campaign name, description, per-student amount, and due date.' },
          { order: 3, instruction: 'Choose which students the campaign applies to, then create it.' },
          { order: 4, instruction: 'The list shows each campaign\u2019s status, collection progress, expected students, and amount.' },
        ],
        notes: [
          'Campaigns are for event-based fees, not recurring tuition. Use tuition rules for regular fees.',
          'Filter campaigns by status (Active, Closed, or All) and search by name or description.',
        ],
        related: [
          { topicId: 'recording-campaign-payment', label: 'Recording a campaign contribution' },
          { topicId: 'creating-fee-rules', label: 'Recurring tuition rules' },
        ],
        tags: ['campaign', 'event fee', 'trip', 'fundraiser', 'collection'],
      },
      {
        id: 'recording-campaign-payment',
        title: 'Recording a campaign contribution and tracking progress',
        roleVisibility: BURSAR_ROLES,
        order: 2,
        summary: 'Open a campaign to record contributions and watch the collection progress bar move toward the target.',
        steps: [
          { order: 1, instruction: 'On the Fee Campaigns page, click a campaign to open its detail view.' },
          { order: 2, instruction: 'Record a student\u2019s contribution against the campaign.' },
          { order: 3, instruction: 'Track the collected-vs-expected progress and see which students have paid.' },
          { order: 4, instruction: 'Close the campaign when the collection is complete.' },
        ],
        notes: ['Campaign progress is shown as a percentage of the total expected amount collected so far.'],
        related: [{ topicId: 'creating-campaign', label: 'Creating a campaign' }],
        tags: ['campaign', 'contribution', 'progress', 'payment', 'close'],
      },
    ],
  },
  {
    id: 'staff-management',
    heading: 'Staff Management',
    description: 'Keep records for teaching and non-teaching staff up to date.',
    roleVisibility: HR_ROLES,
    order: 10,
    icon: 'UsersRound',
    topics: [
      {
        id: 'finding-staff',
        title: 'Finding and filtering staff',
        roleVisibility: HR_ROLES,
        order: 1,
        summary: 'The Staff page lists everyone employed. Search and filter to find the person you need.',
        steps: [
          { order: 1, instruction: 'Open Staff from the sidebar.' },
          { order: 2, instruction: 'Search by name, email, or employee ID.' },
          { order: 3, instruction: 'Filter by Department, Teaching/Non-teaching, or Employment Status.' },
          { order: 4, instruction: 'Click the view icon on a row to open a staff member\u2019s profile (/staff/:id).' },
        ],
        notes: ['Staff management is available to HR, Admins, and Super Admins.'],
        related: [
          { topicId: 'adding-staff', label: 'Adding and editing staff' },
          { topicId: 'daily-staff-attendance', label: 'Recording staff attendance' },
        ],
        tags: ['staff', 'search', 'filter', 'department', 'employee'],
      },
      {
        id: 'adding-staff',
        title: 'Adding, editing, and importing staff',
        roleVisibility: HR_ROLES,
        order: 2,
        summary: 'Create staff one at a time or import many from a spreadsheet, and keep their details current.',
        steps: [
          { order: 1, instruction: 'On the Staff page, click "Add Staff" and complete the personal, contact, and employment details.' },
          { order: 2, instruction: 'Mark whether the person is teaching or non-teaching and set their department and employment status.' },
          { order: 3, instruction: 'To add many at once, click "Import" to open the staff bulk import page (/staff/import), download the template, fill it, and upload.' },
          { order: 4, instruction: 'Use "Export" to download the current staff list as a CSV.' },
        ],
        notes: [
          'You can bulk-generate QR code cards for staff, used to check in and out at the attendance kiosk.',
          'Editing employment status affects how a staff member appears in attendance and reports.',
        ],
        related: [
          { topicId: 'staff-kiosk', label: 'Staff attendance kiosk' },
          { topicId: 'daily-staff-attendance', label: 'Recording staff attendance' },
        ],
        tags: ['add staff', 'edit', 'import', 'export', 'qr', 'employee'],
      },
    ],
  },
  {
    id: 'staff-attendance',
    heading: 'Staff Attendance',
    description: 'Record check-in/out, manage leave, and report on staff attendance.',
    roleVisibility: HR_ROLES,
    order: 11,
    icon: 'UserCheck',
    topics: [
      {
        id: 'daily-staff-attendance',
        title: 'Recording daily staff attendance',
        roleVisibility: HR_ROLES,
        order: 1,
        summary: 'The Daily Attendance tab records check-in and check-out events. Status is classified automatically from your working hours.',
        steps: [
          { order: 1, instruction: 'Open Staff Attendance from the sidebar (the /s-attendance page).' },
          { order: 2, instruction: 'On the Daily Attendance tab, record each staff member\u2019s check-in and check-out for the day.' },
          { order: 3, instruction: 'The system classifies each record as present, late, half-day, or early departure based on the configured working hours.' },
        ],
        notes: [
          'Staff can also check in and out themselves using the attendance kiosk with their QR code.',
          'Corrections you make override earlier entries for the day.',
        ],
        related: [
          { topicId: 'staff-kiosk', label: 'Using the attendance kiosk' },
          { topicId: 'staff-attendance-records', label: 'Reviewing records' },
        ],
        tags: ['attendance', 'check in', 'check out', 'daily', 'late', 'staff'],
      },
      {
        id: 'staff-attendance-records',
        title: 'Reviewing records and monthly summaries',
        roleVisibility: HR_ROLES,
        order: 2,
        summary: 'Use the Records and Monthly Summary tabs to verify entries and see per-staff totals.',
        steps: [
          { order: 1, instruction: 'Open the Records tab to view the full attendance log, filtered by staff, department, date range, or status.' },
          { order: 2, instruction: 'Open the Monthly Summary tab to see days present, late arrivals, on-leave days, half-days, and overtime for any month.' },
        ],
        notes: ['Use these tabs to investigate patterns before running formal reports.'],
        related: [
          { topicId: 'staff-attendance-reports', label: 'Attendance reports' },
          { topicId: 'leave-management', label: 'Leave management' },
        ],
        tags: ['records', 'monthly', 'summary', 'log', 'filter'],
      },
      {
        id: 'leave-management',
        title: 'Managing staff leave',
        roleVisibility: HR_ROLES,
        order: 3,
        summary: 'The Leave Management tab lets you submit, review, and approve leave requests.',
        steps: [
          { order: 1, instruction: 'Open the Leave Management tab.' },
          { order: 2, instruction: 'Submit a leave request, or review and approve/decline pending requests.' },
          { order: 3, instruction: 'Approved leave automatically creates attendance events for the affected working days.' },
        ],
        notes: ['Approved leave can be cancelled if plans change; the attendance events created for it are updated accordingly.'],
        related: [{ topicId: 'staff-attendance-reports', label: 'Attendance reports' }],
        tags: ['leave', 'request', 'approve', 'absence', 'holiday'],
      },
      {
        id: 'staff-attendance-reports',
        title: 'Generating attendance reports',
        roleVisibility: HR_ROLES,
        order: 4,
        summary: 'The Reports tab produces period and department reports with attendance rates and late counts.',
        steps: [
          { order: 1, instruction: 'Open the Reports tab.' },
          { order: 2, instruction: 'Choose a period and, if needed, a department.' },
          { order: 3, instruction: 'Review attendance rates, working-day totals, and late-arrival counts.' },
        ],
        notes: ['Holidays are excluded from the working-day totals used to calculate attendance rates.'],
        related: [{ topicId: 'staff-attendance-records', label: 'Records & summaries' }],
        tags: ['reports', 'attendance rate', 'department', 'period', 'analytics'],
      },
      {
        id: 'staff-kiosk',
        title: 'Using the staff attendance kiosk',
        roleVisibility: HR_ROLES,
        order: 5,
        summary: 'The kiosk is a public screen where staff scan their QR code to check in and out without logging in.',
        steps: [
          { order: 1, instruction: 'Generate QR code cards for staff from the Staff page.' },
          { order: 2, instruction: 'Open the kiosk link on a shared device at the entrance.' },
          { order: 3, instruction: 'Staff scan or enter their code to record a check-in or check-out; the event appears in Daily Attendance.' },
        ],
        warnings: ['The kiosk is a public page. Set it up on a trusted, dedicated device and keep the link private to your school.'],
        related: [
          { topicId: 'adding-staff', label: 'Generating staff QR codes' },
          { topicId: 'daily-staff-attendance', label: 'Daily attendance' },
        ],
        tags: ['kiosk', 'qr', 'check in', 'self service', 'staff'],
      },
    ],
  },
  {
    id: 'student-attendance',
    heading: 'Student Attendance',
    description: 'Mark the daily register and review class and student attendance.',
    roleVisibility: TEACHER_ROLES,
    order: 12,
    icon: 'ClipboardCheck',
    topics: [
      {
        id: 'class-attendance',
        title: 'Marking the class register',
        roleVisibility: TEACHER_ROLES,
        order: 1,
        summary: 'Record daily attendance for a class, marking each student present, late, absent, or excused.',
        steps: [
          { order: 1, instruction: 'Open Student Attendance from the sidebar (the /attendance page).' },
          { order: 2, instruction: 'On the Class Attendance tab, select the date and the class.' },
          { order: 3, instruction: 'Mark each student as present, late, absent, or excused.' },
          { order: 4, instruction: 'Your entries save against that date; later corrections override earlier marks.' },
        ],
        notes: [
          'The right class roster appears based on your active academic session, so make sure the session and terms are set correctly.',
          'Every change is logged with a timestamp so you can see who marked what and when.',
        ],
        related: [
          { topicId: 'attendance-summaries', label: 'Attendance summaries' },
          { topicId: 'creating-academic-year', label: 'Academic session & terms' },
        ],
        tags: ['attendance', 'register', 'present', 'absent', 'late', 'excused', 'class'],
      },
      {
        id: 'attendance-summaries',
        title: 'Reviewing student and class summaries',
        roleVisibility: TEACHER_ROLES,
        order: 2,
        summary: 'See per-student and per-class attendance statistics to spot students who need support.',
        steps: [
          { order: 1, instruction: 'On the Student Attendance page, open the student summary to see each student\u2019s total days, late arrivals, and attendance rate.' },
          { order: 2, instruction: 'Open the class summary to see total sessions, average presence, and late counts per class.' },
        ],
        notes: ['Use these summaries to identify attendance patterns early and follow up with guardians.'],
        related: [{ topicId: 'class-attendance', label: 'Marking the register' }],
        tags: ['summary', 'attendance rate', 'statistics', 'student', 'class'],
      },
    ],
  },
  {
    id: 'user-accounts',
    heading: 'User Accounts & Roles',
    description: 'Invite staff to the system and control what each person can access.',
    roleVisibility: ADMIN_ROLES,
    order: 13,
    icon: 'UserCog',
    topics: [
      {
        id: 'inviting-users',
        title: 'Inviting and managing users',
        roleVisibility: ADMIN_ROLES,
        order: 1,
        summary: 'The User Accounts tab is where you add people who need to log in, assign their role, and manage their access.',
        prerequisites: ['You are signed in as an Admin or Super Admin.'],
        steps: [
          { order: 1, instruction: 'Open Settings > User Accounts.' },
          { order: 2, instruction: 'Click "Add User", enter their name and email, and choose a role (Admin, Bursar, Teacher, or HR).' },
          { order: 3, instruction: 'Save. The user receives an invitation email and shows as "Invited" until they accept and set a password.' },
          { order: 4, instruction: 'For an invited user who has not received the email, click the resend icon to send a fresh invitation.' },
          { order: 5, instruction: 'Use the power (toggle) icon to activate or deactivate a user, or search and filter the list by role and status.' },
        ],
        warnings: [
          'The Super Admin account cannot be deactivated or deleted.',
          'Deactivating a user immediately blocks their access. Prefer deactivating over deleting so historical records stay intact.',
        ],
        notes: [
          'Only Admins and Super Admins can open Settings > User Accounts. School admins cannot see or manage the Super Admin account.',
          'A user\u2019s status can be Active, Invited, or Inactive. You cannot toggle status while an invitation is still pending.',
        ],
        faqs: [
          { question: 'Which role should I give a finance officer?', answer: 'Give them the Bursar role. Bursars can manage students, transport, payments, billing, and fee campaigns, but not school settings or user accounts.' },
          { question: 'How do I change what someone can access?', answer: 'Edit the user and change their role. Each role has a fixed set of permissions — see "Understanding user roles and permissions".' },
        ],
        related: [
          { topicId: 'understanding-roles', label: 'Understanding roles' },
          { topicId: 'logging-in', label: 'How users sign in' },
        ],
        tags: ['users', 'invite', 'role', 'account', 'deactivate', 'resend'],
      },
    ],
  },
  {
    id: 'subscription',
    heading: 'Subscription & Plan',
    description: 'Manage your SchoolLedger plan, student capacity, and invoices.',
    roleVisibility: ADMIN_ROLES,
    order: 14,
    icon: 'Crown',
    topics: [
      {
        id: 'managing-subscription',
        title: 'Subscribing, upgrading, and renewing',
        roleVisibility: ADMIN_ROLES,
        order: 1,
        summary: 'The Subscription page (Billing & Subscription) is where you choose a plan and pay for SchoolLedger.',
        prerequisites: ['You are signed in as an Admin or Super Admin.'],
        steps: [
          { order: 1, instruction: 'Open Subscription from the sidebar.' },
          { order: 2, instruction: 'Review the available plans and switch between monthly and annual billing.' },
          { order: 3, instruction: 'Click Subscribe, Upgrade, or renew, then complete payment via Paynow.' },
          { order: 4, instruction: 'Your subscription activates automatically once the payment is confirmed. View past invoices on the same page.' },
        ],
        warnings: [
          'If your subscription expires, access is limited until you renew. Renew before the expiry date to avoid interruption.',
          'Upgrades are handled with proration; review the amount shown before confirming.',
        ],
        notes: [
          'Payments are processed through Paynow. If a payment is still processing, your plan activates as soon as Paynow confirms it.',
          'Banners across the app warn you when a subscription is expiring soon, expired, or over its student limit.',
        ],
        related: [
          { topicId: 'student-capacity', label: 'Student capacity limits' },
          { topicId: 'account-credits', label: 'Account credits' },
        ],
        tags: ['subscription', 'plan', 'billing', 'renew', 'upgrade', 'paynow', 'invoice'],
      },
      {
        id: 'student-capacity',
        title: 'Understanding student capacity limits',
        roleVisibility: ADMIN_ROLES,
        order: 2,
        summary: 'Each plan includes a maximum number of students. The Subscription page shows how close you are to your limit.',
        steps: [
          { order: 1, instruction: 'Open Subscription and review the student capacity card.' },
          { order: 2, instruction: 'See your current student count against the plan maximum and the remaining slots.' },
          { order: 3, instruction: 'If you are near or over the limit, upgrade to a larger plan.' },
        ],
        warnings: [
          'When you reach your student limit, you cannot add or import more students until you upgrade or reduce active students.',
        ],
        notes: [
          'Only counting rules set by your plan apply — importing students counts toward this limit.',
          'Changing a student to a non-active status can free capacity, but keep records accurate rather than deleting.',
        ],
        related: [
          { topicId: 'managing-subscription', label: 'Upgrading your plan' },
          { topicId: 'bulk-student-import', label: 'Bulk importing students' },
        ],
        tags: ['capacity', 'limit', 'students', 'plan', 'upgrade'],
      },
      {
        id: 'account-credits',
        title: 'Viewing account credits',
        roleVisibility: ADMIN_ROLES,
        order: 3,
        summary: 'Account credits are amounts held on your school\u2019s SchoolLedger account that can offset future subscription charges.',
        steps: [
          { order: 1, instruction: 'Open the Subscription area and go to the Credits page.' },
          { order: 2, instruction: 'Review your available credit balance and how it applies to upcoming charges.' },
        ],
        notes: ['Credits typically arise from proration when changing plans. They reduce what you pay on your next subscription charge.'],
        related: [{ topicId: 'managing-subscription', label: 'Managing your subscription' }],
        tags: ['credits', 'account', 'subscription', 'balance'],
      },
    ],
  },
  {
    id: 'student-finances',
    heading: 'Balances & Fee Statements',
    description: 'Read a student\u2019s balance, trace the ledger, and print statements.',
    roleVisibility: BURSAR_ROLES,
    order: 15,
    icon: 'Wallet',
    topics: [
      {
        id: 'viewing-balances',
        title: 'Understanding a student\u2019s balance',
        roleVisibility: BURSAR_ROLES,
        order: 1,
        summary: 'A balance is the running total of charges minus payments and credits. The colour tells you at a glance whether a student owes, is settled, or is in credit.',
        steps: [
          { order: 1, instruction: 'Open a student\u2019s profile from the Students page.' },
          { order: 2, instruction: 'Read the current balance at the top of the financial section.' },
          { order: 3, instruction: 'Scroll the ledger to see every charge, payment, adjustment, and credit that produced the balance.' },
        ],
        notes: [
          'A positive balance means the student owes money; a credit means they have paid ahead.',
          'Bursaries reduce charges automatically, so a bursary student\u2019s balance reflects the discounted amount.',
        ],
        faqs: [
          { question: 'A balance looks wrong. How do I fix it?', answer: 'First trace the ledger to find the incorrect line. If a whole charge batch was generated in error, roll it back. For a single correction, use a credit or debit adjustment on the Reconciliation tab with a clear reason.' },
        ],
        related: [
          { topicId: 'adjustments-refunds', label: 'Adjustments & refunds' },
          { topicId: 'rolling-back-charges', label: 'Rolling back charges' },
          { topicId: 'multi-currency-receipts-statements', label: 'Currency details on receipts & statements' },
        ],
        tags: ['balance', 'ledger', 'owing', 'credit', 'statement'],
      },
      {
        id: 'fee-statement',
        title: 'Printing a fee statement',
        roleVisibility: BURSAR_ROLES,
        order: 2,
        summary: 'A fee statement is a printable summary of a student\u2019s charges and payments over a period — ideal for guardians.',
        steps: [
          { order: 1, instruction: 'Open the student\u2019s profile.' },
          { order: 2, instruction: 'Choose to print a statement from the financial section.' },
          { order: 3, instruction: 'Print or save the statement, or share the relevant receipts with the guardian.' },
        ],
        notes: ['Your school name and contact details from General settings appear on the printed statement.'],
        related: [
          { topicId: 'managing-receipts', label: 'Sharing receipts' },
          { topicId: 'viewing-balances', label: 'Understanding balances' },
        ],
        tags: ['statement', 'print', 'guardian', 'ledger', 'balance'],
      },
    ],
  },
  {
    id: 'multi-currency-support',
    heading: 'Multi-Currency Support',
    description: 'Enable additional currencies, manage exchange rates, and record transactions in foreign currencies.',
    roleVisibility: BURSAR_ROLES,
    order: 16,
    icon: 'Coins',
    topics: [
      {
        id: 'enabling-multi-currency',
        title: 'Enabling multi-currency support',
        roleVisibility: BURSAR_ROLES,
        order: 1,
        summary: 'Multi-currency support lets your school record charges and payments in currencies other than the base currency (USD). An admin turns it on and selects which additional currencies staff can use.',
        prerequisites: ['You are signed in as an Admin or Super Admin to change currency configuration.'],
        steps: [
          { order: 1, instruction: 'Open Settings > Currency from the sidebar.' },
          { order: 2, instruction: 'Turn on the "Multi-Currency Support" toggle to enable foreign-currency transactions.', tip: 'When disabled, only the base currency (USD) is used. Your previously configured currencies are preserved and restored instantly when you re-enable.' },
          { order: 3, instruction: 'Under "Enabled Transaction Currencies", tick the checkboxes for each additional currency you want staff to be able to use (for example ZWL, ZAR, EUR, GBP).' },
          { order: 4, instruction: 'The base currency (USD) is always enabled and shown with a lock icon — it cannot be removed.' },
        ],
        warnings: [
          'You cannot disable a currency that has existing charges or payments recorded in it. The system will tell you how many transactions depend on it.',
          'The base currency (USD) is locked and cannot be changed once transactions have been recorded.',
        ],
        notes: [
          'Bursars can view the currency configuration but only admins and super admins can change it.',
          'The supported currency list includes USD, ZWL, ZAR, EUR, GBP, ZMW, BWP, KES, NGN, MZN, GHS, CNY, INR, AUD, and CAD.',
        ],
        faqs: [
          { question: 'Can I change the base currency later?', answer: 'No. The base currency (USD) is locked from the start and cannot be changed once transactions exist. Changing it would require a separate data-redesignation feature.' },
          { question: 'What happens if I turn off multi-currency after using it?', answer: 'Existing foreign-currency transactions remain unchanged. Staff simply cannot record new transactions in non-base currencies while it is off. Re-enabling restores your previously selected currencies instantly.' },
        ],
        related: [
          { topicId: 'managing-exchange-rates', label: 'Managing exchange rates' },
          { topicId: 'recording-foreign-currency-payments', label: 'Recording foreign-currency payments' },
          { topicId: 'general-settings', label: 'General settings' },
        ],
        tags: ['currency', 'multi-currency', 'enable', 'base currency', 'USD', 'configuration', 'settings'],
      },
      {
        id: 'managing-exchange-rates',
        title: 'Managing exchange rates',
        roleVisibility: BURSAR_ROLES,
        order: 2,
        summary: 'Exchange rates tell the system how to convert a foreign-currency amount into the base currency (USD). Each rate has an effective date so the correct rate is applied based on the transaction date.',
        prerequisites: ['Multi-currency support is enabled and at least one non-base currency is enabled.'],
        steps: [
          { order: 1, instruction: 'Open Settings > Currency and scroll to the Exchange Rates card.' },
          { order: 2, instruction: 'Click the button for the currency you want to manage (for example ZWL or EUR).' },
          { order: 3, instruction: 'Enter the rate as "1 USD = X [currency]". For example, if 1 USD = 1000 ZWL, enter 1000.', tip: 'The rate is always expressed as "1 base currency = rate transaction currency". The system computes the inverse automatically when converting.' },
          { order: 4, instruction: 'Choose the effective date for the rate — this is the date from which the rate applies.' },
          { order: 5, instruction: 'Click "Add Rate". The rate appears in the history table below, ordered by effective date.' },
        ],
        warnings: [
          'You cannot enter two rates for the same currency on the same effective date. If a rate already exists for that date, update the existing one instead.',
          'Updating a rate does not retroactively change transactions already recorded with the old rate. Each transaction keeps the exchange rate it was recorded with.',
        ],
        notes: [
          'Rates are date-effective: the system uses the most recent rate on or before a transaction\u2019s date. Make sure you have a rate in place before recording transactions for a new period.',
          'Only admins and bursars can create and update exchange rates.',
          'If no exchange rate exists for a currency on a given date, the system will block the transaction and prompt you to enter a rate first.',
        ],
        faqs: [
          { question: 'How often should I update exchange rates?', answer: 'Update rates whenever the market rate changes significantly or at the start of each billing period. Each transaction uses the rate that was effective on its own date, so historical accuracy is always preserved.' },
          { question: 'Can I delete an exchange rate?', answer: 'No. Rates are historical records and cannot be deleted. If a rate was entered incorrectly, update it with the correct value for that effective date.' },
        ],
        related: [
          { topicId: 'enabling-multi-currency', label: 'Enabling multi-currency support' },
          { topicId: 'recording-foreign-currency-payments', label: 'Recording foreign-currency payments' },
        ],
        tags: ['exchange rate', 'currency', 'conversion', 'effective date', 'rate history'],
      },
      {
        id: 'recording-foreign-currency-payments',
        title: 'Recording a payment in a foreign currency',
        roleVisibility: BURSAR_ROLES,
        order: 3,
        summary: 'When multi-currency is enabled, you can record payments in any enabled currency. The system automatically looks up the correct exchange rate and converts the amount to the base currency (USD).',
        prerequisites: [
          'Multi-currency support is enabled.',
          'The transaction currency is enabled in Settings > Currency.',
          'An exchange rate exists for the currency on or before the payment date.',
        ],
        steps: [
          { order: 1, instruction: 'Open Payments and click "Record Payment" as you normally would.' },
          { order: 2, instruction: 'Select the student, then choose the transaction currency from the currency dropdown (it appears when multi-currency is on).' },
          { order: 3, instruction: 'Enter the amount in the selected currency. The system automatically looks up the exchange rate for the payment date and shows the converted USD equivalent.', tip: 'The auto-applied rate comes from the most recent rate on or before the payment date.' },
          { order: 4, instruction: 'If a specific rate was agreed with the guardian, you can manually override the auto-applied rate. The system flags the transaction as a manual override.' },
          { order: 5, instruction: 'Confirm the payment. The original currency, original amount, exchange rate, and base-currency equivalent are all stored on the transaction record.' },
        ],
        warnings: [
          'If the selected currency is not enabled, the transaction will be rejected. Enable it first in Settings > Currency.',
          'If no exchange rate exists for the currency on the payment date, the system blocks the transaction and directs you to enter a rate first.',
        ],
        notes: [
          'The exchange rate stored on each transaction is immutable — later rate changes do not alter existing transactions.',
          'The base-currency amount (USD) is what appears on the student\u2019s ledger and is used for balance calculations. The original currency details are preserved for transparency.',
          'Multi-category (split) payments in a foreign currency convert each category proportionally to the base currency.',
        ],
        faqs: [
          { question: 'Can I record a charge in a foreign currency too?', answer: 'Yes. The same currency selection and exchange rate logic applies to charges as well as payments. When generating fee-rule or transport charges, the system uses the base currency. Individual manual charges can be recorded in a foreign currency.' },
          { question: 'What happens when I void a foreign-currency payment?', answer: 'Voiding uses the same exchange rate as the original transaction, so the base-currency impact is exactly reversed. The original currency details are preserved on the voided record.' },
        ],
        related: [
          { topicId: 'recording-a-payment', label: 'Recording a payment' },
          { topicId: 'managing-exchange-rates', label: 'Managing exchange rates' },
          { topicId: 'multi-currency-receipts-statements', label: 'Receipts & statements with currency details' },
        ],
        tags: ['payment', 'foreign currency', 'exchange rate', 'conversion', 'override', 'multi-currency'],
      },
      {
        id: 'multi-currency-receipts-statements',
        title: 'Receipts and fee statements with currency details',
        roleVisibility: BURSAR_ROLES,
        order: 4,
        summary: 'Receipts and fee statements show full currency transparency for foreign-currency transactions: the original currency, original amount, exchange rate, and base-currency equivalent.',
        steps: [
          { order: 1, instruction: 'Open a payment that was recorded in a foreign currency (from the Payments tab or a student\u2019s profile).' },
          { order: 2, instruction: 'View or print the receipt. It displays: the transaction currency, the original amount in that currency, the applied exchange rate, and the base-currency (USD) equivalent.' },
          { order: 3, instruction: 'Open a student\u2019s profile and print a fee statement. Each foreign-currency transaction row shows its original currency and amount, while the statement summary shows the outstanding balance in the base currency.' },
        ],
        notes: [
          'For transactions recorded in the base currency (USD), no conversion information is shown — the receipt simply displays the amount as-is.',
          'Guardians can see both how much they paid in their currency and how it converts to the school\u2019s accounting currency, which helps with transparency and dispute resolution.',
          'Public receipt links also display currency details for foreign-currency transactions without requiring login.',
        ],
        related: [
          { topicId: 'managing-receipts', label: 'Viewing and sharing receipts' },
          { topicId: 'fee-statement', label: 'Printing a fee statement' },
          { topicId: 'recording-foreign-currency-payments', label: 'Recording foreign-currency payments' },
        ],
        tags: ['receipt', 'statement', 'currency', 'transparency', 'conversion', 'print'],
      },
      {
        id: 'multi-currency-reporting',
        title: 'Generating reports in different currencies',
        roleVisibility: BURSAR_ROLES,
        order: 5,
        summary: 'Financial reports can be generated in any of your enabled currencies. Each transaction is converted using the exchange rate recorded at its own date, ensuring historical accuracy.',
        prerequisites: ['Multi-currency support is enabled and you have transactions in more than one currency.'],
        steps: [
          { order: 1, instruction: 'Open Payments and find the report generation option (e.g. the PDF report).' },
          { order: 2, instruction: 'Select the reporting currency from the available enabled currencies.' },
          { order: 3, instruction: 'Generate the report. All transaction amounts are converted into the selected currency using each transaction\u2019s own date exchange rate.' },
        ],
        warnings: [
          'You can only generate reports in currencies that are currently enabled. If a currency is disabled, it cannot be selected as the reporting currency.',
        ],
        notes: [
          'When you select the base currency (USD) as the reporting currency, no conversion is applied — amounts are shown as recorded.',
          'Each transaction in the report shows its original currency, original amount, applied exchange rate, and the reporting-currency equivalent.',
          'Period totals (total charges, total payments, outstanding balances) are aggregated in the selected reporting currency.',
        ],
        related: [
          { topicId: 'viewing-payment-history', label: 'Searching payment history' },
          { topicId: 'managing-exchange-rates', label: 'Managing exchange rates' },
        ],
        tags: ['report', 'reporting currency', 'conversion', 'pdf', 'multi-currency', 'finance'],
      },
    ],
  },
  {
    id: 'troubleshooting',
    heading: 'Troubleshooting & FAQs',
    description: 'Quick fixes for the most common issues and questions.',
    roleVisibility: ALL_ROLES,
    order: 17,
    icon: 'Wrench',
    topics: [
      {
        id: 'login-issues',
        title: 'I cannot sign in',
        roleVisibility: ALL_ROLES,
        order: 1,
        summary: 'Steps to take when your email and password are not working.',
        steps: [
          { order: 1, instruction: 'Double-check your email address and that Caps Lock is off.' },
          { order: 2, instruction: 'Use "Forgot password?" to reset your password, and check your spam folder for the email.' },
          { order: 3, instruction: 'If you were invited but never set a password, ask your administrator to resend the invitation.' },
          { order: 4, instruction: 'If you were logged out unexpectedly, your session likely expired — simply sign in again.' },
        ],
        warnings: ['Reset and invitation links expire. Always use the most recent link you received.'],
        faqs: [
          { question: 'It says my account is inactive.', answer: 'An administrator has deactivated your account. Ask them to reactivate it in Settings > User Accounts.' },
        ],
        related: [{ topicId: 'logging-in', label: 'Signing in and resetting your password' }],
        tags: ['login', 'password', 'locked out', 'inactive', 'session'],
      },
      {
        id: 'cannot-see-page',
        title: 'A page or menu item is missing',
        roleVisibility: ALL_ROLES,
        order: 2,
        summary: 'The sidebar and Help Center only show what your role can access.',
        steps: [
          { order: 1, instruction: 'Confirm the feature belongs to your role — see "Understanding user roles and permissions".' },
          { order: 2, instruction: 'If you need access, ask your administrator to review or change your role in Settings > User Accounts.' },
        ],
        notes: ['This is by design: pages you cannot use are hidden to keep your workspace focused.'],
        related: [{ topicId: 'understanding-roles', label: 'Understanding roles' }],
        tags: ['missing', 'access', 'permission', 'role', 'sidebar'],
      },
      {
        id: 'charges-not-generating',
        title: 'Charges did not generate for some students',
        roleVisibility: BURSAR_ROLES,
        order: 3,
        summary: 'When a generation run skips students, it is almost always due to eligibility or existing charges.',
        steps: [
          { order: 1, instruction: 'Check that the students are marked Active — only active students are billed.' },
          { order: 2, instruction: 'Confirm the relevant tuition rules are Active and correctly scoped to their class.' },
          { order: 3, instruction: 'Remember that students already charged for the selected period are skipped, which is expected on a re-run.' },
          { order: 4, instruction: 'For transport, confirm each student has an active route allocation for the month.' },
        ],
        related: [
          { topicId: 'generating-fee-charges', label: 'Generating tuition charges' },
          { topicId: 'creating-fee-rules', label: 'Checking tuition rules' },
        ],
        tags: ['charges', 'generate', 'skipped', 'billing', 'troubleshoot'],
      },
      {
        id: 'outside-term-banner',
        title: 'An "Outside term" or "Unbilled charges" banner appeared',
        roleVisibility: BURSAR_ROLES,
        order: 4,
        summary: 'These banners prompt an action so your data stays correct.',
        steps: [
          { order: 1, instruction: '"Outside term": today falls outside all configured terms. Update your term dates in Settings > Academic Calendar.' },
          { order: 2, instruction: '"Unbilled charges": new fee rules exist that have not been generated. Go to Payments > Billing and generate charges for the period.' },
        ],
        related: [
          { topicId: 'creating-academic-year', label: 'Fixing term dates' },
          { topicId: 'generating-fee-charges', label: 'Generating charges' },
        ],
        tags: ['banner', 'outside term', 'unbilled', 'alert', 'warning'],
      },
    ],
  },
];

// ==========================================================
// CONTEXTUAL HELP MAPPINGS
// Links a module route to the Help Center section that documents it.
// ==========================================================
const contextualMappings = [
  { moduleRoute: '/', targetSectionId: 'getting-started', label: 'Dashboard help', roleVisibility: ADMIN_ROLES },
  { moduleRoute: '/students', targetSectionId: 'student-management', label: 'Students help', roleVisibility: BURSAR_ROLES },
  { moduleRoute: '/classes', targetSectionId: 'class-management', label: 'Classes help', roleVisibility: ADMIN_ROLES },
  { moduleRoute: '/staff', targetSectionId: 'staff-management', label: 'Staff help', roleVisibility: HR_ROLES },
  { moduleRoute: '/s-attendance', targetSectionId: 'staff-attendance', label: 'Staff Attendance help', roleVisibility: HR_ROLES },
  { moduleRoute: '/transport', targetSectionId: 'transport', label: 'Transport help', roleVisibility: BURSAR_ROLES },
  { moduleRoute: '/payments', targetSectionId: 'recording-payments', label: 'Payments help', roleVisibility: BURSAR_ROLES },
  { moduleRoute: '/fee-campaigns', targetSectionId: 'fee-campaigns', label: 'Fee Campaigns help', roleVisibility: BURSAR_ROLES },
  { moduleRoute: '/attendance', targetSectionId: 'student-attendance', label: 'Student Attendance help', roleVisibility: TEACHER_ROLES },
  { moduleRoute: '/settings', targetSectionId: 'school-setup', label: 'Settings help', roleVisibility: ADMIN_ROLES },
  { moduleRoute: '/billing', targetSectionId: 'subscription', label: 'Subscription help', roleVisibility: ADMIN_ROLES },
  { moduleRoute: '/settings/currency', targetSectionId: 'multi-currency-support', label: 'Currency help', roleVisibility: BURSAR_ROLES },
];

export const helpContent: HelpContentBundle = {
  sections,
  contextualMappings,
};

/**
 * Filter sections and topics by the given user role.
 * Returns only sections/topics the role is authorized to see.
 */
export function getSectionsForRole(
  sectionList: HelpSection[],
  role: UserRole
): HelpSection[] {
  return sectionList
    .filter((section) => section.roleVisibility.includes(role))
    .map((section) => ({
      ...section,
      topics: section.topics.filter((topic) =>
        topic.roleVisibility.includes(role)
      ),
    }))
    .filter((section) => section.topics.length > 0);
}

/**
 * Check if a section is visible to a given role.
 */
export function isSectionVisibleToRole(
  section: HelpSection,
  role: UserRole
): boolean {
  return section.roleVisibility.includes(role);
}
