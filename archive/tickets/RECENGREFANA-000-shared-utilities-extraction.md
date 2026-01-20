# RECENGREFANA-000: Extract Shared Utilities (recommendationUtils.js)

## Description

Extract shared utility functions and constants from `RecommendationEngine.js` into a dedicated utilities module. This is the foundation ticket that enables all subsequent extractions by providing reusable helpers.

## Files to Create

- `src/expressionDiagnostics/services/utils/recommendationUtils.js`
- `tests/unit/expressionDiagnostics/services/utils/recommendationUtils.test.js`

## Files to Modify

- `src/expressionDiagnostics/services/RecommendationEngine.js` - Import from new utils, remove duplicated code

## Out of Scope

- PrototypeCreateSuggestionBuilder extraction (RECENGREFANA-001)
- GateClampRecommendationBuilder extraction (RECENGREFANA-002)
- AxisConflictAnalyzer extraction (RECENGREFANA-003)
- OverconstrainedConjunctionBuilder extraction (RECENGREFANA-004)
- SoleBlockerRecommendationBuilder extraction (RECENGREFANA-005)
- Any changes to recommendation generation logic
- Any changes to public API
- DI registration (pure functions, no DI needed)

## Implementation Details

### recommendationUtils.js

Extract these constants and functions from RecommendationEngine.js:

```javascript
/**
 * @file Shared utilities for recommendation builders
 * @see RecommendationEngine.js
 */

// === CONSTANTS ===

/** Severity ordering for recommendation sorting */
export const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 };

/** Choke classification thresholds */
export const CHOKE_GATE_FAIL_RATE = 0.4;
export const CHOKE_PASS_GIVEN_GATE_MAX = 0.15;

// === FUNCTIONS ===

/**
 * Determines confidence level based on mood sample count.
 * @param {number} moodSampleCount - Number of mood samples
 * @returns {'high'|'medium'|'low'} Confidence level
 */
export function getConfidence(moodSampleCount) {
  if (moodSampleCount >= 500) return 'high';
  if (moodSampleCount >= 50) return 'medium';
  return 'low';
}

/**
 * Determines severity level based on impact score.
 * @param {number} impact - Impact score (0-1)
 * @returns {'high'|'medium'|'low'} Severity level
 */
export function getSeverity(impact) {
  if (impact >= 0.6) return 'high';
  if (impact >= 0.3) return 'medium';
  return 'low';
}

/**
 * Builds a population metadata object.
 * @param {string} name - Population name
 * @param {number} count - Population count
 * @returns {{name: string, count: number}} Population object
 */
export function buildPopulation(name, count) {
  return { name, count };
}

/**
 * Classifies the choke type for a prototype-clause combination.
 * @param {object} params
 * @param {object} params.prototype - Prototype data
 * @param {object} params.clause - Clause data
 * @param {boolean} params.gateMismatch - Whether gate mismatch exists
 * @param {boolean} params.thresholdMismatch - Whether threshold mismatch exists
 * @returns {'gate'|'threshold'|'mixed'} Choke type
 */
export function classifyChokeType({ prototype, clause, gateMismatch, thresholdMismatch }) {
  const gateFailRate = 1 - (prototype?.gatePassRate ?? 1);
  const passGivenGate = clause?.passGivenGateRate ?? 1;

  const isGateChoke = gateFailRate >= CHOKE_GATE_FAIL_RATE;
  const isThresholdChoke = passGivenGate <= CHOKE_PASS_GIVEN_GATE_MAX;

  if (isGateChoke && isThresholdChoke) return 'mixed';
  if (isGateChoke) return 'gate';
  return 'threshold';
}

/**
 * Determines if a clause has a threshold choke.
 * @param {object} params
 * @param {number} params.passGivenGate - Pass rate given gate passes
 * @param {number} params.meanValueGivenGate - Mean value when gate passes
 * @param {number} params.thresholdValue - Threshold value
 * @returns {boolean} True if threshold choke
 */
export function isThresholdChoke({ passGivenGate, meanValueGivenGate, thresholdValue }) {
  return passGivenGate <= CHOKE_PASS_GIVEN_GATE_MAX &&
         meanValueGivenGate < thresholdValue;
}

/**
 * Gets impact score for a clause by ID.
 * @param {string} id - Clause ID
 * @param {Array} clauses - Array of clauses
 * @returns {number} Impact score (0 if not found)
 */
export function getImpactFromId(id, clauses) {
  const clause = clauses.find(c => c.id === id);
  return clause?.impact ?? 0;
}
```

### Update RecommendationEngine.js

Replace private method implementations with imports:

```javascript
import {
  SEVERITY_ORDER,
  CHOKE_GATE_FAIL_RATE,
  CHOKE_PASS_GIVEN_GATE_MAX,
  getConfidence,
  getSeverity,
  buildPopulation,
  classifyChokeType,
  isThresholdChoke,
  getImpactFromId,
} from './utils/recommendationUtils.js';

// Remove the following private methods:
// - #getConfidence(moodSampleCount)
// - #getSeverity(impact)
// - #buildPopulation(name, count)
// - #classifyChokeType({...})
// - #isThresholdChoke({...})
// - #getImpactFromId(id, clauses)
// - SEVERITY_ORDER constant
// - CHOKE_* constants

// Replace all internal calls:
// this.#getConfidence(...) → getConfidence(...)
// this.#getSeverity(...) → getSeverity(...)
// etc.
```

## Acceptance Criteria

### Tests That Must Pass

#### New Unit Tests (recommendationUtils.test.js)

1. **getConfidence**:
   ```javascript
   it('returns "high" for >= 500 samples', () => {
     expect(getConfidence(500)).toBe('high');
     expect(getConfidence(1000)).toBe('high');
   });

   it('returns "medium" for 50-499 samples', () => {
     expect(getConfidence(50)).toBe('medium');
     expect(getConfidence(499)).toBe('medium');
   });

   it('returns "low" for < 50 samples', () => {
     expect(getConfidence(0)).toBe('low');
     expect(getConfidence(49)).toBe('low');
   });
   ```

2. **getSeverity**:
   ```javascript
   it('returns "high" for impact >= 0.6', () => {
     expect(getSeverity(0.6)).toBe('high');
     expect(getSeverity(1.0)).toBe('high');
   });

   it('returns "medium" for impact 0.3-0.59', () => {
     expect(getSeverity(0.3)).toBe('medium');
     expect(getSeverity(0.59)).toBe('medium');
   });

   it('returns "low" for impact < 0.3', () => {
     expect(getSeverity(0)).toBe('low');
     expect(getSeverity(0.29)).toBe('low');
   });
   ```

3. **buildPopulation**:
   ```javascript
   it('builds population object with name and count', () => {
     expect(buildPopulation('test', 100)).toEqual({ name: 'test', count: 100 });
   });
   ```

4. **classifyChokeType**:
   ```javascript
   it('returns "gate" for high gate fail rate only', () => {
     expect(classifyChokeType({
       prototype: { gatePassRate: 0.5 }, // 50% fail = above threshold
       clause: { passGivenGateRate: 0.5 }, // above threshold
       gateMismatch: true,
       thresholdMismatch: false,
     })).toBe('gate');
   });

   it('returns "threshold" for low passGivenGate only', () => {
     expect(classifyChokeType({
       prototype: { gatePassRate: 0.9 }, // 10% fail = below threshold
       clause: { passGivenGateRate: 0.1 }, // below threshold
       gateMismatch: false,
       thresholdMismatch: true,
     })).toBe('threshold');
   });

   it('returns "mixed" for both chokes', () => {
     expect(classifyChokeType({
       prototype: { gatePassRate: 0.5 },
       clause: { passGivenGateRate: 0.1 },
       gateMismatch: true,
       thresholdMismatch: true,
     })).toBe('mixed');
   });
   ```

5. **isThresholdChoke**:
   ```javascript
   it('returns true when passGivenGate is low and mean below threshold', () => {
     expect(isThresholdChoke({
       passGivenGate: 0.1,
       meanValueGivenGate: 0.3,
       thresholdValue: 0.5,
     })).toBe(true);
   });

   it('returns false when passGivenGate is high', () => {
     expect(isThresholdChoke({
       passGivenGate: 0.5,
       meanValueGivenGate: 0.3,
       thresholdValue: 0.5,
     })).toBe(false);
   });
   ```

6. **getImpactFromId**:
   ```javascript
   it('returns impact for matching clause', () => {
     const clauses = [{ id: 'test', impact: 0.7 }];
     expect(getImpactFromId('test', clauses)).toBe(0.7);
   });

   it('returns 0 for missing clause', () => {
     expect(getImpactFromId('missing', [])).toBe(0);
   });
   ```

#### Existing Tests That Must Still Pass

All tests in these files must pass unchanged:
- `tests/unit/expressionDiagnostics/services/recommendationEngine.test.js`
- `tests/unit/expressionDiagnostics/services/recommendationEngine.chokeType.test.js`
- `tests/unit/expressionDiagnostics/services/recommendationEngine.overconstrained.test.js`
- `tests/integration/expressionDiagnostics/overconstrainedConjunction.integration.test.js`

### Invariants That Must Remain True

1. RecommendationEngine.generate() produces identical output for identical inputs
2. All 7 recommendation types still emitted correctly
3. Severity sorting unchanged (high → medium → low)
4. Confidence levels unchanged (high: ≥500, medium: ≥50, low: <50)
5. Choke classification logic unchanged
6. No new dependencies added to RecommendationEngine constructor
7. `npm run test:unit -- --testPathPattern="recommendationEngine"` passes
8. `npm run typecheck` passes
9. `npx eslint src/expressionDiagnostics/services/RecommendationEngine.js src/expressionDiagnostics/services/utils/recommendationUtils.js` passes

## Verification Commands

```bash
# Run new utility tests
npm run test:unit -- --testPathPattern="recommendationUtils"

# Run existing RecommendationEngine tests (must all pass)
npm run test:unit -- --testPathPattern="recommendationEngine"

# Run integration tests
npm run test:integration -- --testPathPattern="overconstrained"

# Type check
npm run typecheck

# Lint modified files
npx eslint src/expressionDiagnostics/services/RecommendationEngine.js \
           src/expressionDiagnostics/services/utils/recommendationUtils.js
```

## Dependencies

None - this is the foundation ticket.

## Estimated Diff Size

- New source file: ~80 lines
- New test file: ~150 lines
- RecommendationEngine.js changes: ~60 lines removed, ~10 lines imports added
- **Total: ~300 lines changed**
