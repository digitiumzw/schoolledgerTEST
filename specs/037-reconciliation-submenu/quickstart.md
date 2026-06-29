# Quickstart: Move Reconciliation Under Payments Submenu

**Feature**: 037-reconciliation-submenu  
**Branch**: `037-reconciliation-submenu`

## Development Setup

### Prerequisites
- Node.js 18+ (for frontend)
- PHP 8.1+ (for backend)
- MySQL (existing database)

### Starting Development

```bash
# 1. Ensure you're on the feature branch
git checkout 037-reconciliation-submenu

# 2. Start the backend (if testing full integration)
cd /home/jerald-whande/WORKSPACE/DEV_ENVIROMENT/SchoolLedger
php spark serve

# 3. Start the frontend dev server (new terminal)
npm run dev
```

## Testing the Feature

### Manual Testing Checklist

#### Navigation Submenu
- [ ] Click on Payments menu → submenu appears with "Reconciliation" option
- [ ] Click on Reconciliation submenu → navigates to `/payments/reconciliation`
- [ ] Submenu closes after selection
- [ ] Clicking outside submenu closes it
- [ ] Keyboard navigation: Tab to Payments, Enter to open, Arrow keys to navigate, Enter to select
- [ ] Mobile: Submenu accessible via touch, adequate touch targets (44x44px)

#### URL Routing
- [ ] Direct access to `/payments/reconciliation` loads the page
- [ ] Old URL `/reconciliation` redirects to new URL
- [ ] Browser back/forward buttons work correctly

#### Responsive Design
- [ ] Desktop (>1024px): Full layout, all columns visible
- [ ] Tablet (768px-1024px): Adapted layout, readable text
- [ ] Mobile (<768px): No horizontal scrolling, tables scroll horizontally within containers
- [ ] Mobile: Touch targets minimum 44x44px
- [ ] Font sizes readable (minimum 14px) at all breakpoints

### Device Testing

Test on these screen widths:
- 320px (small mobile)
- 375px (iPhone SE)
- 768px (iPad/tablet)
- 1024px (small laptop)
- 1440px (desktop)
- 2560px (large desktop)

## Common Issues

### Issue: Submenu doesn't appear
**Check**: Ensure the Navigation component has the `children` property added to the Payments menu item.

### Issue: Old URL doesn't redirect
**Check**: Add a React Router redirect from `/reconciliation` to `/payments/reconciliation` in the route configuration.

### Issue: Tables overflow on mobile
**Check**: Wrap tables in a container with `overflow-x-auto` class.

## Verification Commands

```bash
# Check branch status
git status

# Run frontend linting (if available)
npm run lint

# Build for production (catches build errors)
npm run build
```

## Success Criteria Verification

| Criterion | How to Verify |
|-----------|---------------|
| SC-001: 2-click navigation | Click Payments → Click Reconciliation → Page loads |
| SC-002: No horizontal scrolling | Resize browser to 320px, verify no horizontal scrollbar |
| SC-003: Touch targets 44x44px | Use browser DevTools device mode, inspect button sizes |
| SC-004: Keyboard navigation | Use only Tab/Enter/Escape/Arrows to navigate to reconciliation |
| SC-005: Deep linking | Open `/payments/reconciliation` directly in new tab |
| SC-006: Legacy redirect | Open `/reconciliation`, should redirect to new URL |
