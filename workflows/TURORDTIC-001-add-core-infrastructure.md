# TURORDTIC-001: Add Core Infrastructure for Turn Order Ticker

## Status
Ready for Implementation

## Priority
High - Foundation for all subsequent tickets

## Dependencies
None

## Description
Add the foundational infrastructure for the turn order ticker: event constant, HTML structure, and CSS styling. This creates the base upon which the renderer will be built.

## Affected Files
- `src/constants/eventIds.js` (modify)
- `game.html` (modify line 19)
- `css/turn-order-ticker.css` (create)
- `css/style.css` (modify)

## Implementation Steps

### 1. Add Event Constant
**File:** `src/constants/eventIds.js`

Add the following export:
```javascript
export const ROUND_STARTED_ID = 'core:round_started';
```

Place it alphabetically with other event IDs in the file.

### 2. Update HTML Structure
**File:** `game.html` (line 19)

**Before:**
```html
<h1 id="title-element">Adventure Game</h1>
```

**After:**
```html
<div id="turn-order-ticker" role="region" aria-label="Turn order" aria-live="polite">
  <div class="ticker-round-label">
    <span id="ticker-round-number">ROUND 1</span>
  </div>
  <div id="ticker-actor-queue" class="ticker-actor-queue">
    <!-- Actor elements dynamically inserted here -->
  </div>
</div>
```

**Note:** Keep the `<h1 id="title-element">` element below the ticker for backward compatibility. It will be conditionally hidden later.

### 3. Create CSS File
**File:** `css/turn-order-ticker.css` (create new file)

Copy the complete CSS from spec lines 271-482. Key sections include:
- Ticker container with sticky positioning
- Round label styling
- Actor queue flex layout
- Actor portrait and name badge styles
- Participation state (grayscale filter)
- Entry/exit animations
- Current actor highlight with pulse animation
- Responsive design for mobile
- Accessibility focus styles
- Scrollbar styling

### 4. Import CSS
**File:** `css/style.css`

Add at the appropriate location (with other component imports):
```css
@import 'turn-order-ticker.css';
```

## Validation

### Manual Verification
1. Check that `ROUND_STARTED_ID` is exported from `eventIds.js`
2. Verify HTML structure exists in `game.html`
3. Confirm CSS file created with all styles
4. Ensure CSS is imported in `style.css`

### Build Verification
```bash
npm run build
```
Should complete without errors.

### Visual Verification
Start the application and inspect the DOM:
```bash
npm run dev
```
- The ticker container should be visible at the top
- "ROUND 1" label should display
- Actor queue container should be empty (will be populated later)
- Ticker should be sticky at top of viewport

## Acceptance Criteria
- [ ] `ROUND_STARTED_ID` constant added to `eventIds.js`
- [ ] HTML structure added to `game.html` with proper ARIA attributes
- [ ] `css/turn-order-ticker.css` created with complete styling
- [ ] CSS imported in `style.css`
- [ ] Application builds without errors
- [ ] Ticker container visible in browser
- [ ] Ticker has proper sticky positioning
- [ ] Responsive styles apply on mobile viewport

## Testing Notes
No automated tests required for this ticket (static assets only). Visual verification is sufficient.

## Notes
- Keep the existing `<h1 id="title-element">` for now; we'll handle its display logic in a later ticket
- The CSS includes animations that won't be used until TURORDTIC-011 and TURORDTIC-012
- ARIA attributes ensure accessibility from the start

## Next Ticket
TURORDTIC-002: Modify RoundManager to dispatch round_started event
