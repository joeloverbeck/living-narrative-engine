# DAMAGESIMULATOR-004: Create Damage Simulator Page HTML and CSS Structure

## Status: COMPLETED

## Summary
Create the HTML page structure and CSS styles for the Damage Simulator tool. This establishes the visual foundation and DOM structure that all subsequent components will attach to.

## Dependencies
- None (can run in parallel with 001-003)

## Files to Touch

### Create
- `damage-simulator.html` - Main page structure
- `css/damage-simulator.css` - Page-specific styles

### Modify
- `index.html` - Add link to damage-simulator (in developer tools section)

### Reference (Read Only)
- `anatomy-visualizer.html` - Pattern to follow
- `css/anatomy-visualizer.css` - Style patterns to follow

## Out of Scope
- DO NOT create any JavaScript files yet (separate ticket)
- DO NOT create build configuration (separate ticket)
- DO NOT modify any existing CSS files (except index.html link)
- DO NOT implement any interactive behavior
- DO NOT add any MCP or bundled scripts yet

## Acceptance Criteria

### Visual Structure Requirements
1. Page header with title "Damage Simulator"
2. Recipe selector section (dropdown placeholder)
3. Two-column layout:
   - Left: Hierarchical anatomy display area
   - Right: Damage capability composer area
4. Bottom: Analytics panel section
5. Damage history log panel (collapsible)
6. Footer with navigation back to index

### CSS Requirements
1. Responsive layout (works on 1024px+ screens)
2. Card component styles for body part cards
3. Health bar styles (progress bar with color coding)
4. Form control styles for damage composer
5. Analytics panel grid layout
6. Consistent with existing tool pages (color scheme, fonts)

### Tests That Must Pass
1. **Manual Verification**
   - Page loads without 404 errors
   - All sections visible and properly laid out
   - Index.html links to damage-simulator correctly

2. **Existing Tests Must Continue to Pass**
   - `npm run test:ci` passes (no test changes expected)

### Invariants
1. No JavaScript execution required for basic layout
2. Page follows existing project CSS conventions
3. Accessibility: proper heading hierarchy, form labels, ARIA landmarks
4. No inline styles (all in CSS file)

## Implementation Notes

### HTML Structure Template
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Damage Simulator - Living Narrative Engine</title>
  <link rel="stylesheet" href="css/damage-simulator.css">
</head>
<body>
  <header class="ds-header">
    <h1>Damage Simulator</h1>
    <nav><a href="index.html">← Back to Index</a></nav>
  </header>

  <main class="ds-main">
    <!-- Recipe Selector -->
    <section id="ds-recipe-selector" class="ds-section">
      <label for="entity-select">Select Entity:</label>
      <select id="entity-select" disabled>
        <option>Loading...</option>
      </select>
    </section>

    <!-- Main Content Grid -->
    <div class="ds-content-grid">
      <!-- Anatomy Display -->
      <section id="ds-anatomy-panel" class="ds-panel">
        <h2>Anatomy</h2>
        <div id="anatomy-tree" class="ds-anatomy-tree">
          <!-- Cards rendered here -->
        </div>
      </section>

      <!-- Damage Composer -->
      <section id="ds-damage-composer" class="ds-panel">
        <h2>Damage Configuration</h2>
        <div id="damage-form">
          <!-- Form controls rendered here -->
        </div>
      </section>
    </div>

    <!-- Analytics Panel -->
    <section id="ds-analytics" class="ds-panel">
      <h2>Analytics</h2>
      <div class="ds-analytics-grid">
        <div id="hits-to-destroy"><!-- Rendered --></div>
        <div id="hit-probability"><!-- Rendered --></div>
      </div>
    </section>

    <!-- Damage History -->
    <section id="ds-history" class="ds-panel ds-collapsible">
      <h2>Damage History</h2>
      <div id="history-log"><!-- Rendered --></div>
    </section>
  </main>

  <footer class="ds-footer">
    <a href="index.html">Developer Tools Index</a>
  </footer>

  <!-- Scripts will be added in DAMAGESIMULATOR-005 -->
</body>
</html>
```

### CSS Class Naming Convention
Use `ds-` prefix for all damage-simulator specific classes to avoid conflicts.

### Key CSS Components Needed
- `.ds-panel` - Standard panel styling
- `.ds-anatomy-tree` - Container for hierarchical cards
- `.ds-part-card` - Body part card styling
- `.ds-health-bar` - Health bar progress indicator
- `.ds-form-group` - Form control grouping
- `.ds-analytics-grid` - Grid for analytics columns
- `.ds-collapsible` - Collapsible panel styling

## Definition of Done
- [x] HTML page created with all sections
- [x] CSS file created with all required styles
- [x] Index.html updated with link to damage-simulator
- [x] Page renders correctly at 1024px+ width
- [x] Heading hierarchy is accessible (h1 → h2 → h3)
- [x] No linting errors in HTML
- [x] ESLint passes (if any JS is accidentally included): `npx eslint damage-simulator.html`

---

## Outcome

### What Was Actually Changed vs Originally Planned

**Planned:**
1. Create `damage-simulator.html` with page structure
2. Create `css/damage-simulator.css` with styles
3. Modify `index.html` to add link to damage-simulator

**Actual Changes:**
1. **Created `damage-simulator.html`** - Full page structure following anatomy-visualizer.html patterns:
   - Header with "Damage Simulator" title and back button
   - Recipe selector section with entity dropdown placeholder
   - Two-column content grid (anatomy panel left, damage composer right)
   - Analytics panel with two-column grid layout
   - Damage history panel with collapsible structure
   - Footer with navigation link
   - All sections have proper ARIA landmarks and heading hierarchy
   - Form controls pre-populated with disabled state placeholders

2. **Created `css/damage-simulator.css`** (417 lines) - Complete stylesheet with:
   - `ds-` prefix for all class names
   - CSS custom properties from project design system
   - Flexbox-based responsive layout
   - Health bar styles with color-coded states (healthy, damaged, critical)
   - Card component styles for body parts with depth-based indentation
   - Form control and button styles
   - Analytics grid layout
   - Collapsible panel styling
   - Responsive breakpoints at 1024px and 768px

3. **Modified `index.html`**:
   - Added "Damage Simulator" button in Anatomy System section
   - Changed grid from 1-col to 2-col centered layout
   - Added click event listener for navigation to damage-simulator.html

4. **Updated `tests/unit/index.test.js`** (not originally planned but required):
   - Added "Damage Simulator" to expected buttons list
   - Added damage-simulator-button to button ID configuration
   - Added damage-simulator-button to event listener tests

### Deviations from Plan
- **Test updates required**: The ticket stated "no test changes expected" but the existing `tests/unit/index.test.js` has hardcoded button lists that needed updating to include the new Damage Simulator button. This was a minor deviation that exposed an invariant (the test validates all index page buttons are present).

### New/Modified Tests
| Test File | Changes | Rationale |
|-----------|---------|-----------|
| `tests/unit/index.test.js` | Added "Damage Simulator" to `expectedButtons` array | Test validates button order on index page |
| `tests/unit/index.test.js` | Added `{ id: 'damage-simulator-button', text: 'Damage Simulator' }` to button configs | Test validates button IDs match expected values |
| `tests/unit/index.test.js` | Added `{ id: 'damage-simulator-button', href: 'damage-simulator.html' }` to event listener configs | Test validates click handlers exist for all buttons |

### Test Results
- All 2340 test suites passed
- All 41665 tests passed
- No regressions introduced
