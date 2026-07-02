# School Ledger Landing Page — Design Rules & Guidelines

This document defines the design system, color palette, typography, and component patterns for the School Ledger landing page. All changes should follow these rules to maintain consistency.

---

## Color Palette

### Primary Colors
- **Primary (Dark Navy)**: `#0a1c2e` — Used for headings, footer background, and primary text
- **Primary Light**: `#102841` — Used for hover states and secondary text
- **Secondary**: `#3c6e9a` — Used for badges, labels, and accent UI elements

### Accent Color
- **Accent (Teal)**: `#1dc9b8` — Used for CTAs, icons, key highlights, and emphasis
- **Accent Light**: `#36e2d1` — Used for hover states and gradients
- **Accent Dark**: `#169c8f` — Used for gradients and darker accents

### Neutral / Navy Scale
- **Navy 50**: `#f3f5f7` — Light backgrounds
- **Navy 100**: `#e0e5ea` — Borders and dividers
- **Navy 200**: `#bfccd9` — Secondary borders
- **Navy 300**: `#8ba6c0` — Muted text
- **Navy 400**: `#537fac` — Secondary links
- **Navy 500**: `#3d668f` — Body text
- **Navy 600**: `#264d72` — Primary links
- **Navy 700**: `#193857` — Subheadings
- **Navy 800**: `#102841` — Dark backgrounds
- **Navy 900**: `#0a1c2e` — Deepest backgrounds (same as Primary)

### Functional Colors
- **Destructive**: `#ef4343` — Error states and destructive actions
- **Success Default**: `#24935f` — Success states
- **Success Soft**: `#d4f0e3` — Success backgrounds
- **Warning Default**: `#fa8c1f` — Warning states
- **Warning Soft**: `#fef0e2` — Warning backgrounds

---

## Typography

### Font Family
- **Primary**: `Inter` (via Google Fonts)
- **Fallback**: `system-ui`, `sans-serif`

### Font Weights
- **Normal**: 400
- **Medium**: 500
- **Semi-Bold**: 600
- **Bold**: 700
- **Extra-Bold**: 800
- **Black**: 900

### Heading Hierarchy
- **H1**: `text-4xl sm:text-5xl lg:text-6xl font-extrabold text-primary` — Main hero headline
- **H2**: `text-3xl lg:text-4xl font-extrabold text-primary` — Section titles
- **H3**: `text-2xl lg:text-3xl font-bold text-primary` — Subsection titles
- **H4**: `text-xl font-bold text-primary` — Card titles

### Body Text
- **Large**: `text-lg text-navy-500` — Section descriptions
- **Base**: `text-sm text-navy-600` — Body content
- **Small**: `text-xs` — Labels and captions

---

## Components

### Buttons

#### Primary Button (`.btn-primary`)
- **Background**: Accent gradient (from-accent to-accent-dark)
- **Text**: White (`text-white`)
- **Padding**: `px-6 py-2.5` (nav) / `px-8 py-4` (hero)
- **Rounded**: `rounded-lg` / `rounded-xl`
- **Font**: `font-semibold`
- **Hover**: Subtle glow effect (`animate-pulse-glow`)

#### Secondary Button (`.btn-secondary`)
- **Background**: White with border (`border border-navy-200`)
- **Text**: Navy (`text-primary`)
- **Padding**: `px-8 py-4`
- **Rounded**: `rounded-xl`
- **Font**: `font-semibold`
- **Hover**: Border changes to accent (`hover:border-accent`)

### Cards

#### Feature Card (`.feature-card`)
- **Background**: White (`bg-white`)
- **Border**: `border border-navy-100`
- **Rounded**: `rounded-2xl`
- **Padding**: `p-6 lg:p-8`
- **Icon Container**: `w-12 h-12` with colored background (accent/10, blue/50, etc.)
- **Icon Color**: Matched to container (accent, secondary, green-600, etc.)

#### Stat Card (`.stat-card`)
- **Background**: White (`bg-white`)
- **Border**: `border border-navy-100`
- **Rounded**: `rounded-2xl`
- **Padding**: `p-6 lg:p-8`
- **Number**: `text-4xl lg:text-5xl font-extrabold gradient-text`
- **Label**: `text-navy-500 font-medium text-sm`

#### Testimonial Card
- **Background**: White (`bg-white`)
- **Border**: `border border-navy-100`
- **Rounded**: `rounded-2xl`
- **Padding**: `p-6 lg:p-8`
- **Shadow**: `shadow-sm hover:shadow-md transition-shadow`
- **Stars**: Amber-400 (`text-amber-400`)

---

## Sections

### Hero Section
- **Background**: Gradient (`bg-gradient-to-br from-navy-50 via-white to-accent/5`)
- **Decorative Elements**: Blurred circles for visual interest
- **CTAs**: Primary button + secondary button
- **Trust Badges**: Checkmark icons with navy-500 text

### Features Section
- **Background**: White
- **Grid**: 3 columns on large screens (`lg:grid-cols-3`)
- **Gap**: `gap-6 lg:gap-8`

### Benefits Section
- **Background**: Light gradient (`bg-gradient-to-b from-navy-50/50 to-white`)
- **Layout**: 2-column grid with alternating text/image

### How It Works Section
- **Background**: White
- **Steps**: 4 steps with numbered badges
- **Connector Lines**: Horizontal gradient lines between steps (desktop only)

### Why Schools Choose Us Section
- **Background**: Primary dark (`bg-primary`)
- **Text**: White (`text-white`)
- **Cards**: Semi-transparent white (`bg-white/5 border-white/10`)

### Testimonials Section
- **Background**: Light gradient (`bg-gradient-to-b from-navy-50/50 to-white`)
- **Grid**: 3 columns on large screens

### Statistics Section
- **Background**: Light gradient (`bg-gradient-to-b from-navy-50/50 to-white`)
- **Grid**: 4 columns on large screens

### FAQ Section
- **Background**: White
- **Items**: Border with rounded corners (`border border-navy-100 rounded-xl`)
- **Toggle**: Hover state (`hover:bg-navy-50`)

### CTA / Demo Form Section
- **Background**: Primary dark gradient (`bg-gradient-to-br from-primary via-navy-800 to-primary`)
- **Decorative**: Blurred accent circles
- **Form**: White card with shadow (`shadow-2xl`)

### Footer
- **Background**: Primary dark (`bg-primary`)
- **Text**: White (`text-white`)
- **Links**: Navy-300 (`text-navy-300`) with accent hover

---

## Spacing

### Section Padding
- **Vertical**: `py-20 lg:py-28` — Standard section spacing
- **Hero**: `pt-24 lg:pt-32 pb-16 lg:pb-24` — Slightly tighter top for nav clearance

### Container
- **Max Width**: `max-w-7xl`
- **Padding**: `px-4 sm:px-6 lg:px-8`

### Grid Gaps
- **Small**: `gap-6` — Cards and components
- **Large**: `gap-8 lg:gap-20` — Section layouts

---

## Interactive Elements

### Animations
- **Fade Up**: `animate-fade-up` — Elements fade in and move up
- **Float**: `animate-float` — Subtle floating motion
- **Pulse Glow**: `animate-pulse-glow` — CTA button glow effect
- **Delay Classes**: `delay-100`, `delay-200`, `delay-300`, `delay-400` — Staggered animations

### Scroll Effects
- **Reveal**: `.reveal` class triggers animations on scroll
- **Smooth Scroll**: `scroll-smooth` on html tag

### Hover States
- **Links**: `hover:text-accent` — Color change on hover
- **Buttons**: Border color change (`hover:border-accent`)
- **Cards**: Background change (`hover:bg-white/10` for dark sections)

---

## Forms

### Input Fields
- **Background**: White (`bg-white`)
- **Border**: `border border-navy-200`
- **Rounded**: `rounded-lg`
- **Padding**: `px-4 py-3`
- **Focus**: `focus:ring-2 focus:ring-accent focus:border-transparent`
- **Error State**: `border-destructive`

### Labels
- **Color**: `text-primary font-medium text-sm`
- **Spacing**: `mb-2` below label

### Validation
- **Error Message**: `text-destructive text-sm mt-2`

---

## Icons

### Icon Sizes
- **Small**: `w-4 h-4` — Inline icons
- **Medium**: `w-5 h-5` — Checkmarks and list icons
- **Large**: `w-6 h-6` — Menu and navigation icons
- **Extra Large**: `w-10 h-10` — Feature card icons

### Icon Colors
- **Accent**: `text-accent` — Primary icons and checkmarks
- **Secondary**: `text-secondary` — Secondary icons
- **Navy**: `text-navy-700` / `text-navy-400` — Neutral icons
- **Amber**: `text-amber-400` — Star ratings
- **White**: `text-white` — Dark section icons

---

## Accessibility

### Color Contrast
- All text meets WCAG AA contrast requirements
- Primary text on white: Navy-500 or darker
- White text on dark backgrounds: Only on Primary/Navy-800+

### Focus States
- All interactive elements have visible focus rings
- Focus ring color: Accent (`focus:ring-accent`)

### Semantic HTML
- Use proper heading hierarchy (h1 → h2 → h3)
- Buttons use `<button>` element
- Links use `<a>` element with meaningful href
- Forms use proper labels and input types

---

## Responsive Design

### Breakpoints
- **Mobile**: Default (up to 639px)
- **Tablet**: `sm:` (640px+), `md:` (768px+)
- **Desktop**: `lg:` (1024px+)

### Mobile Considerations
- Hide decorative elements on small screens (`lg:hidden`)
- Stack grids to single column on mobile
- Adjust font sizes (`text-4xl sm:text-5xl lg:text-6xl`)
- Touch-friendly button sizes (minimum 44px height)

---

## Content Guidelines

### Voice and Tone
- **Professional**: Clear, confident, authoritative
- **Benefit-Driven**: Focus on outcomes, not features
- **Direct**: Avoid jargon; speak plainly
- **Local Context**: Reference Zimbabwean schools and locations when relevant

### Accuracy Rules
- All claims must be verified against actual product capabilities
- Cross-reference with backend code before adding features
- No fabricated compliance claims (e.g., ZIMSEC/Cambridge)
- Pricing must match seeded subscription plans
- Multi-tenancy claims must reflect data isolation

### CTAs
- **Primary CTA**: Always "Book a Free Demo" (links to #demo)
- **Secondary CTA**: "See How It Works" (links to #how-it-works)
- **Portal Link**: "Access Portal" (links to http://localhost:8081)
- No "Start Free Trial" — trials are enrolled manually after onboarding

---

## File Structure

```
landingpage/
├── index.html          # Main landing page
├── privacy-policy.html # Legal document (do not modify)
├── terms-of-service.html # Legal document (do not modify)
├── assets/             # Images and logos
│   └── logo.png
├── favicon/            # Favicon files
├── RULES.MD           # This file
└── *.html             # Additional pages (follow same design system)
```

---

## Notes

- Tailwind CSS is loaded via CDN for the landing page
- Custom animations are defined in inline `<style>` tags
- JavaScript handles navigation, scroll effects, counters, FAQ toggles, and form submission
- Demo form submits to: `http://localhost:8080/api/demo-requests`
- All sections use `id` attributes for anchor navigation
- Maintain consistency with the frontend React app design (same color palette)
