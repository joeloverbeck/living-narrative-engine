# DAMAGESIMULATOR-013: Create DamageAnalyticsPanel

## Summary
Create the `DamageAnalyticsPanel` component that displays analytical insights about damage capabilities against the current entity. This includes hits-to-destroy calculations, effect trigger analysis, and visual representations of damage potential.

## Dependencies
- DAMAGESIMULATOR-007 must be completed (HierarchicalAnatomyRenderer for part data)
- DAMAGESIMULATOR-009 must be completed (DamageCapabilityComposer for current config)
- DAMAGESIMULATOR-014 should be completed (HitProbabilityCalculator for calculations)

## Files to Touch

### Create
- `src/domUI/damage-simulator/DamageAnalyticsPanel.js` - Analytics panel
- `tests/unit/domUI/damage-simulator/DamageAnalyticsPanel.test.js` - Unit tests

### Modify
- `src/domUI/damage-simulator/DamageSimulatorUI.js` - Integrate analytics panel
- `src/dependencyInjection/registrations/damageSimulatorRegistrations.js` - Register panel
- `css/damage-simulator.css` - Add analytics panel styles

## Out of Scope
- DO NOT implement hit probability calculations (separate ticket DAMAGESIMULATOR-014)
- DO NOT implement death condition monitoring (separate ticket DAMAGESIMULATOR-015)
- DO NOT modify any damage resolution services
- DO NOT implement real-time damage application
- DO NOT implement export functionality

## Acceptance Criteria

### Display Requirements
1. Show "Hits to Destroy" for each body part based on current config
2. Display effect trigger thresholds (when effects will activate)
3. Update automatically when damage config changes
4. Update automatically when entity changes
5. Collapsible/expandable panel sections
6. Clear visual hierarchy of information

### Analytics Requirements
1. Per-part hits calculation: `ceil(partHealth / damageEntry.amount)`
2. Effect trigger analysis (bleed at X%, fracture at Y%, etc.)
3. Aggregate statistics (average hits across all parts)
4. Critical parts highlighting (head, torso, heart)

### Tests That Must Pass
1. **Unit: DamageAnalyticsPanel.test.js**
   - `should render panel with all sections`
   - `should display hits-to-destroy for each part`
   - `should update when damage config changes`
   - `should update when entity changes`
   - `should calculate hits correctly with penetration`
   - `should identify effect trigger thresholds`
   - `should highlight critical parts`
   - `should handle zero damage gracefully`
   - `should handle parts with armor/resistance`
   - `should collapse and expand sections`
   - `should show aggregate statistics`

2. **Existing Tests Must Continue to Pass**
   - `npm run test:ci` passes

### Invariants
1. Read-only analysis (no damage application)
2. Calculations based on current damage config only
3. Updates reactively to config/entity changes
4. No persistence of analytics data

## Implementation Notes

### DamageAnalyticsPanel Interface
```javascript
class DamageAnalyticsPanel {
  constructor({
    containerElement,
    hitProbabilityCalculator,
    eventBus,
    logger
  })

  /**
   * Set the current entity for analysis
   * @param {string} entityId
   * @param {Object} anatomyData - From AnatomyDataExtractor
   */
  setEntity(entityId, anatomyData)

  /**
   * Update with new damage configuration
   * @param {Object} damageEntry - From DamageCapabilityComposer
   * @param {number} multiplier
   */
  updateDamageConfig(damageEntry, multiplier)

  /**
   * Render the analytics display
   */
  render()

  /**
   * Get current analytics data
   * @returns {AnalyticsData}
   */
  getAnalytics()
}
```

### AnalyticsData Structure
```javascript
/**
 * @typedef {Object} AnalyticsData
 * @property {Array<PartAnalytics>} parts
 * @property {AggregateStats} aggregate
 * @property {Array<EffectThreshold>} effectThresholds
 */

/**
 * @typedef {Object} PartAnalytics
 * @property {string} partId
 * @property {string} partName
 * @property {number} currentHealth
 * @property {number} maxHealth
 * @property {number} hitsToDestroy
 * @property {number} effectiveDamage - After penetration/resistance
 * @property {boolean} isCritical
 */

/**
 * @typedef {Object} AggregateStats
 * @property {number} averageHits
 * @property {number} minHits
 * @property {number} maxHits
 * @property {number} totalParts
 */

/**
 * @typedef {Object} EffectThreshold
 * @property {string} effectType
 * @property {number} threshold - Health percentage
 * @property {string} description
 */
```

### Panel HTML Structure
```html
<div class="ds-analytics-panel">
  <div class="ds-analytics-header">
    <h3>Damage Analytics</h3>
    <button class="ds-collapse-btn">▼</button>
  </div>

  <!-- Hits to Destroy Section -->
  <section class="ds-analytics-section">
    <h4>Hits to Destroy</h4>
    <table class="ds-hits-table">
      <thead>
        <tr>
          <th>Part</th>
          <th>Health</th>
          <th>Eff. Damage</th>
          <th>Hits</th>
        </tr>
      </thead>
      <tbody id="hits-table-body">
        <!-- Rows rendered here -->
      </tbody>
    </table>
  </section>

  <!-- Effect Triggers Section -->
  <section class="ds-analytics-section">
    <h4>Effect Triggers</h4>
    <ul class="ds-effect-list">
      <li class="ds-effect-item">
        <span class="ds-effect-name">Bleed</span>
        <span class="ds-effect-threshold">≤50% HP</span>
      </li>
    </ul>
  </section>

  <!-- Aggregate Stats Section -->
  <section class="ds-analytics-section ds-aggregate-stats">
    <div class="ds-stat">
      <span class="ds-stat-label">Avg Hits</span>
      <span class="ds-stat-value" id="avg-hits">--</span>
    </div>
    <div class="ds-stat">
      <span class="ds-stat-label">Min/Max</span>
      <span class="ds-stat-value" id="min-max-hits">--</span>
    </div>
  </section>
</div>
```

### Hits Calculation
```javascript
function calculateHitsToDestroy(partHealth, damageEntry, penetration = 0) {
  // Account for penetration reducing effective damage
  const effectiveDamage = damageEntry.amount * (1 - penetration);
  if (effectiveDamage <= 0) return Infinity;
  return Math.ceil(partHealth / effectiveDamage);
}
```

### Event Subscriptions
```javascript
// Listen for config changes
eventBus.subscribe('damage-composer:config-changed', (event) => {
  this.updateDamageConfig(event.payload.damageEntry, event.payload.multiplier);
  this.render();
});

// Listen for entity changes
eventBus.subscribe('damage-simulator:entity-loaded', (event) => {
  this.setEntity(event.payload.entityId, event.payload.anatomyData);
  this.render();
});
```

### CSS Additions
```css
.ds-analytics-panel {
  border: 1px solid var(--border-color);
  border-radius: 4px;
  margin-top: 16px;
}

.ds-analytics-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: var(--bg-dark);
  cursor: pointer;
}

.ds-analytics-section {
  padding: 12px;
  border-top: 1px solid var(--border-color);
}

.ds-hits-table {
  width: 100%;
  font-size: 12px;
}

.ds-critical-part {
  font-weight: bold;
  color: var(--color-danger);
}

.ds-aggregate-stats {
  display: flex;
  gap: 24px;
}

.ds-stat-value {
  font-size: 18px;
  font-weight: bold;
}
```

## Definition of Done
- [ ] DamageAnalyticsPanel created with full JSDoc
- [ ] Unit tests with ≥90% coverage
- [ ] Panel registered in DI container
- [ ] Integrated with DamageSimulatorUI
- [ ] Hits-to-destroy displays for all parts
- [ ] Effect thresholds identified and displayed
- [ ] Aggregate statistics calculated
- [ ] Critical parts highlighted
- [ ] Updates reactively to config/entity changes
- [ ] Collapsible sections functional
- [ ] CSS styles complete
- [ ] ESLint passes: `npx eslint src/domUI/damage-simulator/DamageAnalyticsPanel.js`
