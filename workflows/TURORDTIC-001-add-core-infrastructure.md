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
- `game.html` (insert at line 19)
- `css/components/_turn-order-ticker.css` (create)
- `css/style.css` (modify)

## Implementation Steps

### 1. Add Event Constant
**File:** `src/constants/eventIds.js`

Add the following export:
```javascript
export const ROUND_STARTED_ID = 'core:round_started';
```

Place it with other turn/round-related events (after `GAME_SAVED_ID` at line 6, before `TURN_STARTED_ID` at line 7). The file is organized by functional groups, not alphabetically.

### 2. Update HTML Structure
**File:** `game.html`

**Location:** Insert the ticker HTML **before** line 19 (between `<body>` and the `<h1>` element).

**Current structure at line 18-19:**
```html
  <body>
    <h1 id="title-element">Adventure Game</h1>
```

**After insertion:**
```html
  <body>
    <div id="turn-order-ticker" role="region" aria-label="Turn order" aria-live="polite">
      <div class="ticker-round-label">
        <span id="ticker-round-number">ROUND 1</span>
      </div>
      <div id="ticker-actor-queue" class="ticker-actor-queue">
        <!-- Actor elements dynamically inserted here -->
      </div>
    </div>

    <h1 id="title-element">Adventure Game</h1>
```

**Note:** Keep the `<h1 id="title-element">` element for backward compatibility. It will be conditionally hidden later.

### 3. Create CSS File
**File:** `css/components/_turn-order-ticker.css` (create new file)

**Note:** Component CSS files are located in the `css/components/` directory and prefixed with an underscore.

Copy the complete CSS from spec lines 271-482 (`specs/turn-order-ticker-implementation.spec.md`). Key sections include:
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

Add in the "Components" section (section 4, after line 38 `_actor-participation-panel.css`):
```css
@import url('components/_turn-order-ticker.css');
```

**Note:** Follow existing import patterns - use `url()` wrapper and relative path from `css/` directory.

## Validation

### Manual Verification
1. Check that `ROUND_STARTED_ID` is exported from `src/constants/eventIds.js` (near line 7)
2. Verify HTML ticker structure is inserted in `game.html` before the `<h1>` element
3. Confirm CSS file created at `css/components/_turn-order-ticker.css` with all styles from spec
4. Ensure CSS is imported in `css/style.css` using correct syntax: `@import url('components/_turn-order-ticker.css');`

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
- [ ] `ROUND_STARTED_ID` constant added to `src/constants/eventIds.js` (placed with turn/round events)
- [ ] HTML structure inserted into `game.html` before the `<h1>` element with proper ARIA attributes
- [ ] `css/components/_turn-order-ticker.css` created with complete styling from spec
- [ ] CSS imported in `css/style.css` in the Components section using correct syntax
- [ ] Application builds without errors (`npm run build`)
- [ ] Ticker container visible at top of page in browser
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
