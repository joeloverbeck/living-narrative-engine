# DAMSIMOVEHEA-003: Add Overall Health Bar to Anatomy Panel

## Summary
Display the overall entity health bar in the Anatomy panel, right-aligned above the first anatomy part card.

## Status
Completed

## Motivation
Users need to see at-a-glance overall health status when viewing the anatomy breakdown. The health bar should be prominently positioned above the detailed per-part cards.

## Reassessed Assumptions
- Anatomy data from `AnatomyDataExtractor` is a hierarchical `AnatomyTreeNode` root (not an array of parts).
- Overall health calculation only needs `healthPercentage`, `healthCalculationWeight`, and `vitalOrganCap`, all derivable from node `health` plus `anatomy:part` / `anatomy:vital_organ` component data.
- CSS classes are defined by ticket 005; this change uses the class names without adding new CSS.

## Prerequisites
- **DAMSIMOVEHEA-001** completed (exposes calculation)
- **DAMSIMOVEHEA-002** completed (wires service)
- **DAMSIMOVEHEA-005** pending (CSS classes); use the class names now without new CSS

## Files to Touch

| File | Changes |
|------|---------|
| `src/domUI/damage-simulator/HierarchicalAnatomyRenderer.js` | Add `setOverallHealth()` method, render health bar |
| `src/domUI/damage-simulator/DamageSimulatorUI.js` | Call `setOverallHealth()` on anatomy renderer after entity load |
| `tests/unit/domUI/damage-simulator/HierarchicalAnatomyRenderer.test.js` | Add tests for new health bar functionality |
| `tests/unit/domUI/damage-simulator/DamageSimulatorUI.test.js` | Add tests that overall health is computed and forwarded |

## Out of Scope

- **NO changes to Analytics panel** - That's ticket 004
- **NO changes to InjuryAggregationService** - Done in ticket 001
- **NO DI registration changes** - Done in ticket 002
- **NO CSS file changes** - Done in ticket 005 (use existing classes or inline for now)
- **NO changes to per-part health bars** - Only adding overall health

## Implementation Details

### 1. Add Health Bar Rendering to HierarchicalAnatomyRenderer

**File**: `src/domUI/damage-simulator/HierarchicalAnatomyRenderer.js`

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
  this.#overallHealthPercent = percent;
}
```

Add render method:
```javascript
/**
 * Create the overall health bar header element.
 * @returns {HTMLElement}
 */
#createOverallHealthHeader() {
  const header = document.createElement('div');
  header.className = 'ds-overall-health-header';

  const label = document.createElement('span');
  label.className = 'ds-overall-health-label';
  label.textContent = 'Overall:';

  const barContainer = document.createElement('div');
  barContainer.className = 'ds-overall-health-bar';

  const bar = document.createElement('div');
  bar.className = 'ds-health-bar';

  const fill = document.createElement('div');
  fill.className = 'ds-health-bar-fill';
  fill.style.width = `${this.#overallHealthPercent}%`;
  this.#updateHealthBarColor(fill, this.#overallHealthPercent);

  const text = document.createElement('span');
  text.className = 'ds-overall-health-text';
  text.textContent = `${this.#overallHealthPercent}%`;

  bar.appendChild(fill);
  barContainer.appendChild(bar);
  barContainer.appendChild(text);
  header.appendChild(label);
  header.appendChild(barContainer);

  return header;
}
```

Modify `render()` method to include health bar at top:
```javascript
render(anatomyData) {
  this.#containerElement.innerHTML = '';

  // Add overall health bar if set
  if (this.#overallHealthPercent !== null) {
    const healthHeader = this.#createOverallHealthHeader();
    this.#containerElement.appendChild(healthHeader);
  }

  // Rest of existing render logic...
}
```

### 2. Wire Up in DamageSimulatorUI

**File**: `src/domUI/damage-simulator/DamageSimulatorUI.js`

In the anatomy render path (so refreshes also update):
```javascript
// Calculate and set overall health from hierarchy data
const partInfos = this.#convertHierarchyToPartInfos(anatomyData);
const overallHealth = this.#injuryAggregationService.calculateOverallHealth(partInfos);
this.#anatomyRenderer.setOverallHealth(overallHealth);
```

Add conversion helper that traverses the hierarchy from `AnatomyDataExtractor` (root `AnatomyTreeNode`, not `anatomyData.parts`):
```javascript
/**
 * Convert hierarchy nodes to partInfos format expected by InjuryAggregationService.
 * @param {object|null} anatomyData
 * @returns {Array}
 */
#convertHierarchyToPartInfos(anatomyData) {
  // Traverse AnatomyTreeNode hierarchy, extracting anatomy:part and anatomy:vital_organ component data.
  return [];
}
```

## Acceptance Criteria

### Tests That Must Pass

1. **setOverallHealth stores value**
   ```javascript
   it('should store overall health percentage', () => {
     renderer.setOverallHealth(75);
     // Verify by checking render output
   });
   ```

2. **Health bar rendered when health is set**
   ```javascript
   it('should render overall health bar when setOverallHealth called', () => {
     renderer.setOverallHealth(80);
     renderer.render(mockAnatomyData);
     const header = container.querySelector('.ds-overall-health-header');
     expect(header).not.toBeNull();
   });
   ```

3. **Health bar positioned above anatomy cards**
   ```javascript
   it('should position health bar above first anatomy card', () => {
     renderer.setOverallHealth(80);
     renderer.render(mockAnatomyData);
     const firstChild = container.firstElementChild;
     expect(firstChild.classList.contains('ds-overall-health-header')).toBe(true);
   });
   ```

4. **Correct CSS class for healthy (>66%)**
   ```javascript
   it('should use healthy class for health > 66%', () => {
     renderer.setOverallHealth(80);
     renderer.render(mockAnatomyData);
     const fill = container.querySelector('.ds-health-bar-fill');
     expect(fill.classList.contains('ds-health-bar-fill--healthy')).toBe(true);
   });
   ```

5. **Correct CSS class for damaged (34-66%)**
   ```javascript
   it('should use damaged class for health 34-66%', () => {
     renderer.setOverallHealth(50);
     renderer.render(mockAnatomyData);
     const fill = container.querySelector('.ds-health-bar-fill');
     expect(fill.classList.contains('ds-health-bar-fill--damaged')).toBe(true);
   });
   ```

6. **Correct CSS class for critical (<=33%)**
   ```javascript
   it('should use critical class for health <= 33%', () => {
     renderer.setOverallHealth(25);
     renderer.render(mockAnatomyData);
     const fill = container.querySelector('.ds-health-bar-fill');
     expect(fill.classList.contains('ds-health-bar-fill--critical')).toBe(true);
   });
   ```

7. **Percentage text displays correctly**
   ```javascript
   it('should display percentage text', () => {
     renderer.setOverallHealth(75);
     renderer.render(mockAnatomyData);
     const text = container.querySelector('.ds-overall-health-text');
     expect(text.textContent).toBe('75%');
   });
   ```

8. **Health bar updates on re-render**
   ```javascript
   it('should update health bar when setOverallHealth called again', () => {
     renderer.setOverallHealth(100);
     renderer.render(mockAnatomyData);
     renderer.setOverallHealth(50);
     renderer.render(mockAnatomyData);
     const fill = container.querySelector('.ds-health-bar-fill');
     expect(fill.style.width).toBe('50%');
   });
   ```

9. **All existing tests pass unchanged**
   - Run: `npm run test:unit -- tests/unit/domUI/damage-simulator/HierarchicalAnatomyRenderer.test.js`
   - Run: `npm run test:unit -- tests/unit/domUI/damage-simulator/DamageSimulatorUI.test.js`

### Invariants

1. **Per-part health bars unchanged** - Individual part cards still show correctly
2. **Anatomy tree structure unchanged** - Parent/child relationships preserved
3. **No regression in existing tests** - All current functionality works

## Definition of Done

- [x] `setOverallHealth(percent)` method added to HierarchicalAnatomyRenderer
- [x] Overall health bar renders above first anatomy card
- [x] Correct CSS classes applied at 66%/33% thresholds
- [x] DamageSimulatorUI calls `setOverallHealth()` after entity load
- [x] Health bar updates when damage is applied (re-render)
- [x] All unit tests pass
- [ ] Manual verification: Health bar visible in damage-simulator.html after entity selection
- [ ] Code reviewed and merged

## Outcome
- Added overall health header rendering in `HierarchicalAnatomyRenderer` and wired it via `DamageSimulatorUI` using hierarchy traversal (not a flat parts array).
- Computed overall health from `anatomy:part` weight and `anatomy:vital_organ` caps without touching the aggregation service.
- Updated unit tests for both renderer and UI; CSS styling remains pending ticket 005.
