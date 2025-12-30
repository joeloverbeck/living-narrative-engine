# DAMAGESIMULATOR-018: Create E2E Tests and Final Polish

## Summary
Create end-to-end tests for the Damage Simulator tool using browser automation, and complete final polish including index page link, documentation, and accessibility compliance.

## Dependencies
- All previous DAMAGESIMULATOR tickets (001-017) must be completed
- Integration tests must be passing

## Files to Touch

### Create
- `tests/e2e/damage-simulator/fullDamageWorkflow.e2e.test.js` - Full workflow E2E tests
- `tests/e2e/damage-simulator/uiInteraction.e2e.test.js` - UI interaction tests

### Modify
- `index.html` - Add link to Damage Simulator tool
- `css/damage-simulator.css` - Final style adjustments, accessibility fixes
- `damage-simulator.html` - ARIA labels, accessibility attributes

### Reference (Read Only)
- `tests/e2e/anatomy-visualizer/` - E2E test patterns to follow
- `docs/accessibility-guidelines.md` - Accessibility requirements

## Out of Scope
- DO NOT create user documentation (future enhancement)
- DO NOT implement keyboard navigation beyond basic tab order
- DO NOT implement screen reader optimizations beyond ARIA labels
- DO NOT implement mobile-specific layouts
- DO NOT add features not specified in previous tickets

## Acceptance Criteria

### E2E Test Requirements
1. Full browser-based workflow testing
2. Entity selection → damage configuration → execution flow
3. Multi-hit simulation start/stop
4. History panel verification
5. Analytics display verification
6. Visual regression baseline (optional)

### Polish Requirements
1. Add Damage Simulator link to main index.html
2. Ensure consistent styling with other tool pages
3. Add ARIA labels to all interactive elements
4. Ensure proper focus management
5. Verify all buttons have visible focus states
6. Check color contrast meets WCAG AA

### Tests That Must Pass
1. **E2E: fullDamageWorkflow.e2e.test.js**
   - `should load page without errors`
   - `should select entity from dropdown`
   - `should display anatomy after entity load`
   - `should configure damage entry`
   - `should apply damage and see results`
   - `should show damage in history`
   - `should update analytics display`
   - `should run multi-hit simulation`
   - `should stop simulation early`

2. **E2E: uiInteraction.e2e.test.js**
   - `should expand and collapse sections`
   - `should switch between target modes`
   - `should load weapon presets`
   - `should clear history`
   - `should handle invalid inputs gracefully`
   - `should maintain state during interactions`

3. **Accessibility Tests**
   - All interactive elements have accessible names
   - Focus order is logical
   - Color contrast meets WCAG AA
   - No keyboard traps

4. **Existing Tests Must Continue to Pass**
   - `npm run test:ci` passes
   - `npm run test:e2e` passes

### Invariants
1. Page loads without JavaScript errors
2. All features work in supported browsers
3. No console errors during normal operation
4. Page is navigable via keyboard

## Implementation Notes

### E2E Test Structure
```javascript
// tests/e2e/damage-simulator/fullDamageWorkflow.e2e.test.js

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import puppeteer from 'puppeteer';

describe('Damage Simulator E2E', () => {
  let browser;
  let page;

  beforeAll(async () => {
    browser = await puppeteer.launch({ headless: true });
    page = await browser.newPage();
    await page.goto('http://localhost:8080/damage-simulator.html');
  });

  afterAll(async () => {
    await browser.close();
  });

  describe('Page Load', () => {
    it('should load page without errors', async () => {
      const errors = [];
      page.on('pageerror', err => errors.push(err));

      await page.reload();
      await page.waitForSelector('.ds-container');

      expect(errors.length).toBe(0);
    });
  });

  describe('Entity Selection', () => {
    it('should select entity from dropdown', async () => {
      // Select entity from recipe dropdown
      await page.select('#entity-selector', 'test_humanoid');

      // Wait for anatomy to load
      await page.waitForSelector('.ds-anatomy-tree');

      // Verify parts are displayed
      const partCards = await page.$$('.ds-part-card');
      expect(partCards.length).toBeGreaterThan(0);
    });
  });

  describe('Damage Application', () => {
    it('should configure damage and apply', async () => {
      // Configure damage
      await page.select('#damage-type', 'slashing');
      await page.type('#damage-amount', '20');
      await page.click('#apply-damage-btn');

      // Wait for history update
      await page.waitForSelector('.ds-history-entry');

      // Verify history contains entry
      const historyEntries = await page.$$('.ds-history-entry');
      expect(historyEntries.length).toBeGreaterThan(0);
    });
  });

  describe('Multi-Hit Simulation', () => {
    it('should run and stop simulation', async () => {
      // Configure simulation
      await page.type('#hit-count', '50');
      await page.click('#sim-run-btn');

      // Wait for progress
      await page.waitForSelector('.ds-sim-progress:not([hidden])');

      // Stop simulation
      await page.click('#sim-stop-btn');

      // Verify stopped
      const results = await page.waitForSelector('.ds-sim-results:not([hidden])');
      const hitsText = await page.$eval('#result-hits', el => el.textContent);
      const hits = parseInt(hitsText);

      expect(hits).toBeLessThan(50);
      expect(hits).toBeGreaterThan(0);
    });
  });
});
```

### UI Interaction Tests
```javascript
// tests/e2e/damage-simulator/uiInteraction.e2e.test.js

describe('UI Interactions', () => {
  it('should expand and collapse analytics section', async () => {
    // Click collapse button
    await page.click('.ds-analytics-header .ds-collapse-btn');

    // Verify collapsed
    const section = await page.$('.ds-analytics-section');
    const isHidden = await section.evaluate(el => el.hidden);
    expect(isHidden).toBe(true);

    // Click again to expand
    await page.click('.ds-analytics-header .ds-collapse-btn');

    const isVisible = await section.evaluate(el => !el.hidden);
    expect(isVisible).toBe(true);
  });

  it('should load weapon preset', async () => {
    // Select preset
    await page.select('#weapon-preset', 'vespera_rapier');

    // Verify damage type updated
    const damageType = await page.$eval('#damage-type', el => el.value);
    expect(damageType).toBe('piercing');

    // Verify amount updated
    const amount = await page.$eval('#damage-amount', el => el.value);
    expect(parseInt(amount)).toBeGreaterThan(0);
  });

  it('should handle invalid inputs gracefully', async () => {
    // Enter invalid hit count
    await page.click('#hit-count', { clickCount: 3 });
    await page.type('#hit-count', '-5');

    // Try to run simulation
    await page.click('#sim-run-btn');

    // Should show validation error
    const errorMsg = await page.waitForSelector('.ds-validation-error');
    expect(errorMsg).toBeTruthy();
  });
});
```

### Index Page Link Addition
```html
<!-- In index.html, add to tools section -->
<li>
  <a href="damage-simulator.html">Damage Simulator</a>
  <span class="tool-description">Test damage application and analyze combat effects</span>
</li>
```

### Accessibility Improvements
```html
<!-- damage-simulator.html additions -->

<!-- Entity selector -->
<label for="entity-selector">Select Entity</label>
<select id="entity-selector" aria-describedby="entity-selector-help">
  <option value="">Choose an entity...</option>
</select>
<span id="entity-selector-help" class="sr-only">
  Select an entity to load its anatomy for damage testing
</span>

<!-- Damage controls -->
<fieldset aria-label="Damage Configuration">
  <legend>Configure Damage</legend>
  <!-- controls -->
</fieldset>

<!-- Apply button -->
<button id="apply-damage-btn" aria-label="Apply configured damage to entity">
  Apply Damage
</button>

<!-- Progress -->
<div class="ds-sim-progress"
     role="progressbar"
     aria-valuenow="0"
     aria-valuemin="0"
     aria-valuemax="100"
     aria-label="Simulation progress">
</div>

<!-- Status announcements -->
<div id="status-announcer" aria-live="polite" class="sr-only"></div>
```

### CSS Focus States
```css
/* Focus visibility for all interactive elements */
button:focus-visible,
input:focus-visible,
select:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}

/* Ensure proper contrast */
.ds-part-card {
  color: var(--text-primary); /* Ensure 4.5:1 contrast */
}

.ds-health-text {
  color: var(--text-primary);
}

/* Screen reader only class */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

### Color Contrast Verification
```javascript
// Automated contrast check in tests
async function verifyColorContrast(page) {
  const results = await page.evaluate(() => {
    // Use browser's built-in contrast calculation
    const elements = document.querySelectorAll('.ds-container *');
    const issues = [];

    elements.forEach(el => {
      const style = getComputedStyle(el);
      const bgColor = style.backgroundColor;
      const textColor = style.color;
      // Calculate contrast ratio
      // Report if below 4.5:1 for normal text
    });

    return issues;
  });

  return results;
}
```

### Keyboard Navigation Test
```javascript
it('should allow keyboard-only navigation', async () => {
  // Tab through all interactive elements
  const focusableElements = await page.$$('button, input, select, [tabindex="0"]');

  for (const element of focusableElements) {
    await page.keyboard.press('Tab');
    const activeElement = await page.evaluate(() => document.activeElement.tagName);
    expect(['BUTTON', 'INPUT', 'SELECT']).toContain(activeElement);
  }
});
```

## Definition of Done
- [ ] All E2E test files created
- [ ] E2E tests pass in headless browser
- [ ] Index.html updated with Damage Simulator link
- [ ] All interactive elements have ARIA labels
- [ ] Focus states visible on all interactive elements
- [ ] Color contrast meets WCAG AA (4.5:1 for text)
- [ ] No keyboard traps detected
- [ ] Page loads without console errors
- [ ] `npm run test:e2e` passes
- [ ] Manual verification in Chrome, Firefox, Safari
- [ ] ESLint passes on all files
- [ ] Documentation of any known limitations
