# DAMAGESIMULATOR-012: Create DamageHistoryTracker

## Summary
Create the `DamageHistoryTracker` component that maintains a session log of all damage applications. This provides a scrollable history showing timestamp, target part, damage dealt, effects triggered, and health changes.

## Dependencies
- DAMAGESIMULATOR-011 must be completed (DamageExecutionService for results)

## Files to Touch

### Create
- `src/domUI/damage-simulator/DamageHistoryTracker.js` - History tracker
- `tests/unit/domUI/damage-simulator/DamageHistoryTracker.test.js` - Unit tests

### Modify
- `src/domUI/damage-simulator/DamageSimulatorUI.js` - Integrate history panel
- `css/damage-simulator.css` - Add history panel styles

## Out of Scope
- DO NOT implement history export (future enhancement)
- DO NOT implement history persistence across page reloads
- DO NOT implement history filtering/search
- DO NOT modify DamageExecutionService

## Acceptance Criteria

### History Requirements
1. Record all damage applications from DamageExecutionService
2. Display in chronological order (newest first or last)
3. Show: timestamp, target part, damage amount, effects, health before/after
4. Limit display to last N entries (default: 50)
5. Clear history on entity change
6. Provide "Clear History" button

### Display Requirements
1. Table or card-based display
2. Color coding for effects (bleed=red, burn=orange, etc.)
3. Health change indicator (red arrow down)
4. Scrollable container for long history
5. Summary statistics at bottom (total damage, hit count)

### Tests That Must Pass
1. **Unit: DamageHistoryTracker.test.js**
   - `should record damage result`
   - `should display entries in order`
   - `should format timestamp correctly`
   - `should show target part name`
   - `should show damage amount`
   - `should show effects triggered`
   - `should show health before and after`
   - `should limit entries to maxEntries`
   - `should clear history on clearHistory()`
   - `should clear history on entity change`
   - `should calculate total damage`
   - `should calculate hit count`

2. **Existing Tests Must Continue to Pass**
   - `npm run test:ci` passes

### Invariants
1. History data stored in memory only
2. No external state persistence
3. History clears on entity change
4. No modifications to damage results

## Implementation Notes

### DamageHistoryTracker Interface
```javascript
class DamageHistoryTracker {
  constructor({
    containerElement,
    eventBus,
    logger,
    maxEntries = 50
  })

  /**
   * Record a damage result
   * @param {DamageResult} result
   */
  record(result)

  /**
   * Render the history display
   */
  render()

  /**
   * Clear all history
   */
  clearHistory()

  /**
   * Get summary statistics
   * @returns {{totalDamage: number, hitCount: number, effectCounts: Object}}
   */
  getStatistics()

  /**
   * Get all entries
   * @returns {Array<HistoryEntry>}
   */
  getEntries()
}
```

### HistoryEntry Structure
```javascript
/**
 * @typedef {Object} HistoryEntry
 * @property {number} id - Unique entry ID
 * @property {Date} timestamp
 * @property {string} targetPartId
 * @property {string} targetPartName
 * @property {number} damageDealt
 * @property {string} damageType
 * @property {Object} healthBefore - {current, max}
 * @property {Object} healthAfter - {current, max}
 * @property {Array<string>} effectsTriggered
 */
```

### History Table HTML
```html
<div class="ds-history-panel">
  <div class="ds-history-header">
    <h3>Damage History</h3>
    <button id="clear-history-btn">Clear</button>
  </div>
  <div class="ds-history-table-container">
    <table class="ds-history-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Time</th>
          <th>Part</th>
          <th>Damage</th>
          <th>Effects</th>
          <th>Health</th>
        </tr>
      </thead>
      <tbody id="history-entries">
        <!-- Entries rendered here -->
      </tbody>
    </table>
  </div>
  <div class="ds-history-summary">
    <span>Total: <strong id="total-damage">0</strong> damage</span>
    <span>Hits: <strong id="hit-count">0</strong></span>
    <span>Effects: <strong id="effect-count">0</strong></span>
  </div>
</div>
```

### Entry Row Rendering
```javascript
function renderEntry(entry) {
  const healthChange = entry.healthAfter.current - entry.healthBefore.current;
  const healthClass = healthChange < 0 ? 'ds-health-decrease' : '';

  return `
    <tr>
      <td>${entry.id}</td>
      <td>${formatTime(entry.timestamp)}</td>
      <td>${entry.targetPartName}</td>
      <td>${entry.damageDealt} ${entry.damageType}</td>
      <td>${formatEffects(entry.effectsTriggered)}</td>
      <td class="${healthClass}">
        ${entry.healthBefore.current}→${entry.healthAfter.current}
      </td>
    </tr>
  `;
}

function formatEffects(effects) {
  if (!effects || effects.length === 0) return '—';
  return effects.map(e => `<span class="ds-effect-badge ds-effect-${e}">${e}</span>`).join('');
}

function formatTime(date) {
  return date.toLocaleTimeString('en-US', { hour12: false });
}
```

### CSS Additions
```css
.ds-history-panel {
  max-height: 300px;
  overflow-y: auto;
}

.ds-history-table {
  width: 100%;
  border-collapse: collapse;
}

.ds-history-table th,
.ds-history-table td {
  padding: 4px 8px;
  border-bottom: 1px solid var(--border-color);
}

.ds-health-decrease {
  color: var(--color-danger);
}

.ds-effect-badge {
  display: inline-block;
  padding: 2px 4px;
  border-radius: 3px;
  font-size: 10px;
  margin-right: 2px;
}

.ds-effect-bleed { background: #ffcccc; color: #900; }
.ds-effect-burn { background: #ffe0cc; color: #940; }
.ds-effect-poison { background: #ccffcc; color: #090; }
.ds-effect-fracture { background: #e0e0e0; color: #444; }

.ds-history-summary {
  display: flex;
  gap: 16px;
  padding: 8px;
  background: var(--bg-dark);
}
```

### Event Subscription
```javascript
// In DamageSimulatorUI or DamageHistoryTracker
eventBus.subscribe('damage-simulator:execution-complete', (event) => {
  const { results } = event.payload;
  for (const result of results) {
    historyTracker.record(result);
  }
  historyTracker.render();
});
```

## Definition of Done
- [ ] DamageHistoryTracker created with full JSDoc
- [ ] Unit tests with ≥90% coverage
- [ ] History panel integrated in UI
- [ ] Entries display correctly with all fields
- [ ] Summary statistics calculated and displayed
- [ ] Clear button functions
- [ ] History clears on entity change
- [ ] Scrollable for long history
- [ ] Effect badges styled correctly
- [ ] ESLint passes: `npx eslint src/domUI/damage-simulator/DamageHistoryTracker.js`
