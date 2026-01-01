# DAMAGESIMULATOR-014: Create HitProbabilityCalculator

## Summary
Create the `HitProbabilityCalculator` service that calculates hit probability distributions based on the existing `hitProbabilityWeightUtils.js`. This service provides weighted targeting analysis showing which parts are most likely to be hit.

## Dependencies
- DAMAGESIMULATOR-007 must be completed (HierarchicalAnatomyRenderer provides anatomy data)

## Files to Touch

### Create
- `src/domUI/damage-simulator/HitProbabilityCalculator.js` - Calculator service
- `tests/unit/domUI/damage-simulator/HitProbabilityCalculator.test.js` - Unit tests

### Modify
- `src/dependencyInjection/tokens/tokens-ui.js` - Add HitProbabilityCalculator token
- `src/dependencyInjection/registrations/damageSimulatorRegistrations.js` - Register service

### DEFERRED (Future Ticket)
- `src/domUI/damage-simulator/DamageAnalyticsPanel.js` - Use calculator for display
- `css/damage-simulator.css` - Add probability visualization styles

### Reference (Read Only)
- `src/anatomy/utils/hitProbabilityWeightUtils.js` - Existing weight utilities

## Out of Scope
- DO NOT modify hitProbabilityWeightUtils.js
- DO NOT modify damage resolution logic
- DO NOT implement random number generation
- DO NOT implement damage application
- DO NOT modify entity components

## Acceptance Criteria

### Calculation Requirements
1. Calculate hit probability percentage for each targetable part
2. Use existing weight utilities from hitProbabilityWeightUtils.js
3. Account for part visibility/accessibility
4. Handle parts with zero weight (non-targetable)
5. Normalize probabilities to sum to 100%

### Visualization Requirements
1. Display probability as percentage bars
2. Sort by probability (highest first)
3. Color coding by probability tier (high/medium/low)
4. Show exact percentage value
5. Visual bar chart representation

### Tests That Must Pass
1. **Unit: HitProbabilityCalculator.test.js**
   - `should calculate probabilities from part weights`
   - `should normalize probabilities to 100%`
   - `should handle parts with zero weight`
   - `should sort parts by probability`
   - `should use existing hitProbabilityWeightUtils`
   - `should handle empty parts array`
   - `should handle single part case`
   - `should calculate cumulative probability`
   - `should identify highest probability parts`
   - `should handle parts with equal weights`

2. **Existing Tests Must Continue to Pass**
   - `npm run test:ci` passes
   - All hitProbabilityWeightUtils tests unchanged

### Invariants
1. Probabilities always sum to 100% (±0.1% for rounding)
2. No modification of source weight utilities
3. Pure calculation service (no side effects)
4. Consistent results for same input

## Implementation Notes

### HitProbabilityCalculator Interface
```javascript
class HitProbabilityCalculator {
  constructor({ hitProbabilityWeightUtils, logger })

  /**
   * Calculate hit probabilities for all parts
   * @param {Array<PartData>} parts - Parts with weight data
   * @returns {Array<PartProbability>}
   */
  calculateProbabilities(parts)

  /**
   * Get probability distribution visualization data
   * @param {Array<PartProbability>} probabilities
   * @returns {VisualizationData}
   */
  getVisualizationData(probabilities)

  /**
   * Calculate cumulative probability for a part
   * @param {Array<PartProbability>} probabilities
   * @param {string} partId
   * @returns {number}
   */
  getCumulativeProbability(probabilities, partId)

  /**
   * Get parts above probability threshold
   * @param {Array<PartProbability>} probabilities
   * @param {number} threshold - Minimum percentage
   * @returns {Array<PartProbability>}
   */
  getHighProbabilityParts(probabilities, threshold)
}
```

### PartProbability Structure
```javascript
/**
 * @typedef {Object} PartProbability
 * @property {string} partId
 * @property {string} partName
 * @property {number} weight - Raw weight value
 * @property {number} probability - Percentage (0-100)
 * @property {string} tier - 'high' | 'medium' | 'low'
 */
```

### VisualizationData Structure
```javascript
/**
 * @typedef {Object} VisualizationData
 * @property {Array<BarData>} bars
 * @property {number} maxProbability
 * @property {number} totalParts
 */

/**
 * @typedef {Object} BarData
 * @property {string} partId
 * @property {string} label
 * @property {number} percentage
 * @property {number} barWidth - Normalized 0-100
 * @property {string} colorClass
 */
```

### Probability Calculation
```javascript
function calculateProbabilities(parts) {
  // Get weights using existing utility - parts are {id, name, component} objects
  const weights = parts.map(part => ({
    partId: part.id,
    partName: part.name,
    weight: hitProbabilityWeightUtils.getEffectiveHitWeight(part.component)
  }));

  // Calculate total weight
  const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);

  if (totalWeight === 0) {
    return weights.map(w => ({ ...w, probability: 0, tier: 'none' }));
  }

  // Calculate percentages
  return weights.map(w => {
    const probability = (w.weight / totalWeight) * 100;
    return {
      ...w,
      probability: Math.round(probability * 10) / 10, // 1 decimal place
      tier: getProbabilityTier(probability)
    };
  }).sort((a, b) => b.probability - a.probability);
}

function getProbabilityTier(percentage) {
  if (percentage >= 15) return 'high';
  if (percentage >= 5) return 'medium';
  return 'low';
}
```

### Visualization HTML
```html
<div class="ds-probability-chart">
  <h4>Hit Probability Distribution</h4>
  <div class="ds-prob-bars">
    <div class="ds-prob-bar-row">
      <span class="ds-prob-label">Torso</span>
      <div class="ds-prob-bar-container">
        <div class="ds-prob-bar ds-prob-high" style="width: 35%"></div>
      </div>
      <span class="ds-prob-value">35%</span>
    </div>
    <!-- More rows -->
  </div>
</div>
```

### CSS for Visualization
```css
.ds-probability-chart {
  margin-top: 12px;
}

.ds-prob-bars {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ds-prob-bar-row {
  display: grid;
  grid-template-columns: 80px 1fr 40px;
  align-items: center;
  gap: 8px;
}

.ds-prob-bar-container {
  height: 16px;
  background: var(--bg-dark);
  border-radius: 2px;
  overflow: hidden;
}

.ds-prob-bar {
  height: 100%;
  transition: width 0.3s ease;
}

.ds-prob-high { background: var(--color-danger); }
.ds-prob-medium { background: var(--color-warning); }
.ds-prob-low { background: var(--color-info); }

.ds-prob-value {
  text-align: right;
  font-size: 12px;
  font-weight: bold;
}
```

### Integration with hitProbabilityWeightUtils
```javascript
// Import existing utilities (actual exports from the module)
import {
  getEffectiveHitWeight,
  filterEligibleHitTargets,
  DEFAULT_HIT_PROBABILITY_WEIGHT
} from '../../../anatomy/utils/hitProbabilityWeightUtils.js';

// Use in calculator
const weight = getEffectiveHitWeight(partComponent);
// Or filter to only parts with positive weight:
const eligibleParts = filterEligibleHitTargets(parts);
```

## Definition of Done

### Core Service (This Ticket) ✅ COMPLETED
- [x] HitProbabilityCalculator created with full JSDoc
- [x] Unit tests with ≥90% coverage (33 tests, all passing)
- [x] DI token added to tokens-ui.js
- [x] Service registered in DI container
- [x] Uses existing hitProbabilityWeightUtils correctly (getEffectiveHitWeight)
- [x] Probabilities sum to 100%
- [x] Visualization data generated correctly
- [x] Parts sorted by probability
- [x] Tier classification working (high ≥15%, medium ≥5%, low <5%)
- [x] ESLint passes: `npx eslint src/domUI/damage-simulator/HitProbabilityCalculator.js` (warnings only, no errors)

### DEFERRED (Future Ticket)
- [ ] Integration with DamageAnalyticsPanel
- [ ] CSS styles for probability bars

---

## Outcome

### What Was Actually Changed vs Originally Planned

**Ticket Corrections Made FIRST:**
1. Fixed incorrect function references in lines 233-243: Replaced non-existent `calculateTargetingWeight()` and `getPartHitChance()` with actual exports `getEffectiveHitWeight()`, `filterEligibleHitTargets()`, `DEFAULT_HIT_PROBABILITY_WEIGHT`
2. Fixed probability calculation pseudocode in line 146: Changed `getPartWeight(part)` to `getEffectiveHitWeight(part.component)`
3. Added missing token registration requirement in Files to Touch section
4. Separated DEFERRED items from Core Service scope per user direction

**Files Created:**
- `src/domUI/damage-simulator/HitProbabilityCalculator.js` (205 lines) - Pure calculation service with 4 public methods
- `tests/unit/domUI/damage-simulator/HitProbabilityCalculator.test.js` (33 tests) - All 10 specified test cases plus 23 additional edge case tests

**Files Modified:**
- `src/dependencyInjection/tokens/tokens-ui.js` - Added `HitProbabilityCalculator` token
- `src/dependencyInjection/registrations/damageSimulatorRegistrations.js` - Added service registration with hitProbabilityWeightUtils dependency injection

**Files NOT Modified (as directed):**
- `src/anatomy/utils/hitProbabilityWeightUtils.js` - Read only
- `src/domUI/damage-simulator/DamageAnalyticsPanel.js` - UI integration deferred
- `css/damage-simulator.css` - CSS styles deferred

**Test Results:**
- All 33 new unit tests pass
- All 313 damage-simulator domain tests pass
- All 22 hitProbabilityWeightUtils tests unchanged and passing
- ESLint: 0 errors, 22 warnings (JSDoc style preferences only)
