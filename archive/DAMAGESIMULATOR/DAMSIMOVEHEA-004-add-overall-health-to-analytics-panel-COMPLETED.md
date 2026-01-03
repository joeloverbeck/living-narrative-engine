# DAMSIMOVEHEA-004: Add Overall Health Bar to Analytics Panel

## Summary
Display the overall entity health bar in the Analytics panel, right-aligned on the same line as the "Hits to Destroy" section header.

## Motivation
The Analytics panel provides damage statistics. Having the overall health visible alongside "Hits to Destroy" gives immediate context for damage impact assessment.

## Status
Completed

## Reassessed Assumptions
- DamageAnalyticsPanel renders into `#ds-analytics .ds-analytics-grid` using template strings, not the legacy `#hits-to-destroy` column header markup.
- The "Hits to Destroy" header is an `h4` inside the content section, so the inline bar belongs in that section header row.
- Overall health CSS classes from ticket 005 are not yet present in `css/damage-simulator.css`, so inline layout styles are required for alignment.

## Prerequisites
- **DAMSIMOVEHEA-001** must be completed (exposes calculation)
- **DAMSIMOVEHEA-002** must be completed (wires service)
- **DAMSIMOVEHEA-005** is not yet reflected in `css/damage-simulator.css`; use inline layout styles for alignment while keeping existing `ds-health-bar*` classes

## Files to Touch

| File | Changes |
|------|---------|
| `src/domUI/damage-simulator/DamageAnalyticsPanel.js` | Add `setOverallHealth()` method, render health bar in Hits-to-Destroy section header |
| `src/domUI/damage-simulator/DamageSimulatorUI.js` | Call `setOverallHealth()` on analytics panel after entity load |
| `tests/unit/domUI/damage-simulator/DamageAnalyticsPanel.test.js` | Add tests for new health bar functionality |

## Out of Scope

- **NO changes to Anatomy panel** - That's ticket 003
- **NO changes to InjuryAggregationService** - Done in ticket 001
- **NO DI registration changes** - Done in ticket 002
- **NO CSS file changes** - Leave styling to ticket 005 (not yet applied in `css/damage-simulator.css`)
- **NO changes to "Hits to Destroy" table** - Only adding header health bar

## Implementation Details

### 1. Add Health Bar to DamageAnalyticsPanel

**File**: `src/domUI/damage-simulator/DamageAnalyticsPanel.js`

Add private field:
```javascript
#overallHealthPercent = null;
```

Add public method:
```javascript
/**
 * Set the overall health percentage to display.
 * @param {number} percent - Health percentage (0-100)
 */
setOverallHealth(percent) {
  if (!Number.isFinite(percent)) {
    this.#overallHealthPercent = null;
    this.#updateHealthBarDisplay();
    return;
  }

  this.#overallHealthPercent = Math.max(0, Math.min(100, Math.round(percent)));
  this.#updateHealthBarDisplay();
}
```

Add render helper (string-based to match existing templating):
```javascript
/**
 * Create the inline health bar HTML for the section header.
 * @returns {string}
 */
#generateInlineHealthBarHTML() {
  if (this.#overallHealthPercent === null) {
    return '';
  }

  return `
    <div class="ds-overall-health-inline" id="analytics-overall-health">
      <span class="ds-overall-health-label">Overall:</span>
      <div class="ds-overall-health-bar">
        <div class="ds-health-bar">
          <div class="ds-health-bar-fill ${this.#getHealthClass(this.#overallHealthPercent)}"
               style="width: ${this.#overallHealthPercent}%"></div>
        </div>
        <span class="ds-overall-health-text">${this.#overallHealthPercent}%</span>
      </div>
    </div>
  `;
}

/**
 * Update the health bar display if it exists.
 */
#updateHealthBarDisplay() {
  const healthBar = this.#containerElement.querySelector('#analytics-overall-health');
  if (!healthBar) {
    if (this.#overallHealthPercent !== null && this.#containerElement.innerHTML) {
      this.render();
    }
    return;
  }

  const fill = healthBar.querySelector('.ds-health-bar-fill');
  const text = healthBar.querySelector('.ds-overall-health-text');

  if (fill) {
    fill.className = `ds-health-bar-fill ${this.#getHealthClass(this.#overallHealthPercent)}`;
    fill.style.width = `${this.#overallHealthPercent}%`;
  }
  if (text) {
    text.textContent = `${this.#overallHealthPercent}%`;
  }
}

/**
 * Get CSS class for health percentage.
 * @param {number} percent
 * @returns {string}
 */
#getHealthClass(percent) {
  if (percent > 66) return 'ds-health-bar-fill--healthy';
  if (percent > 33) return 'ds-health-bar-fill--damaged';
  return 'ds-health-bar-fill--critical';
}
```

### 2. Modify Section Header Generation

In `#generateContentHTML()`, wrap the "Hits to Destroy" `<h4>` in a header row and insert the inline health bar HTML. Use a lightweight inline layout style for alignment (CSS ticket 005 is not yet applied).

```html
<section class="ds-analytics-section">
  <div class="ds-analytics-section-header" style="display:flex; align-items:center; justify-content:space-between; gap: 12px;">
    <h4>Hits to Destroy</h4>
    <!-- Health bar inserted here via #generateInlineHealthBarHTML() -->
  </div>
  ...
</section>
```

### 3. Wire Up in DamageSimulatorUI

**File**: `src/domUI/damage-simulator/DamageSimulatorUI.js`

In the entity loaded handler (same place as ticket 003):
```javascript
// Calculate and set overall health (DamageSimulatorUI already has part-info conversion helpers)
const partInfos = this.#buildPartInfosFromHierarchy(anatomyData);
const overallHealth = this.#injuryAggregationService.calculateOverallHealth(partInfos);
this.#anatomyRenderer.setOverallHealth(overallHealth);
this.#analyticsPanel.setOverallHealth(overallHealth);  // NEW
```

## Acceptance Criteria

### Tests That Must Pass

1. **Health bar rendered in "Hits to Destroy" section header**
   ```javascript
   it('should render overall health bar in the Hits to Destroy header row', () => {
     panel.setOverallHealth(80);
     panel.render();
     const header = container.querySelector('.ds-analytics-section-header');
     const healthBar = header.querySelector('#analytics-overall-health');
     expect(healthBar).not.toBeNull();
   });
   ```

2. **Correct CSS class for thresholds**
   ```javascript
   it('should use healthy/damaged/critical classes based on percent', () => {
     panel.setOverallHealth(80);
     panel.render();
     expect(container.querySelector('.ds-health-bar-fill')).toHaveClass('ds-health-bar-fill--healthy');
   });
   ```

3. **Health bar updates when setOverallHealth called after render**
   ```javascript
   it('should update health bar after render', () => {
     panel.setOverallHealth(100);
     panel.render();
     panel.setOverallHealth(30);
     const fill = container.querySelector('.ds-health-bar-fill');
     expect(fill.style.width).toBe('30%');
     expect(fill.classList.contains('ds-health-bar-fill--critical')).toBe(true);
   });
   ```

4. **All existing tests pass unchanged**
   - Run: `npm run test:unit -- tests/unit/domUI/damage-simulator/DamageAnalyticsPanel.test.js`

### Invariants

1. **"Hits to Destroy" table unchanged** - All table data displays correctly
2. **Collapse/expand functionality unchanged** - Panel still collapses and expands
3. **No regression in existing tests** - All current functionality works

## Definition of Done

- [x] `setOverallHealth(percent)` method added to DamageAnalyticsPanel
- [x] Health bar renders in the "Hits to Destroy" section header row
- [x] Health bar is right-aligned in that header (inline layout until ticket 005 lands)
- [x] Correct CSS classes applied at 66%/33% thresholds
- [x] DamageSimulatorUI calls `setOverallHealth()` after entity load
- [x] Health bar persists through collapse/expand
- [x] Health bar updates when damage is applied and after setOverallHealth calls post-render
- [x] All unit tests pass
- [x] Manual verification: Health bar visible in damage-simulator.html Analytics section
- [x] Code reviewed and merged

## Outcome
- Implemented inline overall health bar markup in the "Hits to Destroy" section header using template strings (not DOM construction), with inline flex layout because CSS classes are still pending.
- DamageSimulatorUI now forwards calculated overall health to the analytics panel during anatomy rendering.
- Added unit coverage for rendering, threshold class assignment, and post-render updates.
