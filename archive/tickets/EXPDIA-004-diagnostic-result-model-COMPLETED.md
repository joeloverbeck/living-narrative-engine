# EXPDIA-004: Create DiagnosticResult Model

## Summary

Create the unified result model that aggregates output from all diagnostic layers (static analysis, Monte Carlo simulation, witness finding, SMT solving). This model provides consistent structure for UI display and data export.

## Priority: High | Effort: Small

## Rationale

Each diagnostic layer produces different types of results. Having a unified model ensures consistent handling in the UI, enables easy serialization for export, and provides clear rarity categorization for user feedback.

## Dependencies

- **EXPDIA-001** (AxisInterval, GateConstraint models) should be completed first
- No service dependencies - this is a pure data model

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/expressionDiagnostics/models/DiagnosticResult.js` | **Create** |
| `src/expressionDiagnostics/models/index.js` | **Modify** (add export) |
| `tests/unit/expressionDiagnostics/models/DiagnosticResult.test.js` | **Create** |

## Out of Scope

- **DO NOT** implement WitnessState model - that's EXPDIA-010
- **DO NOT** implement any service classes
- **DO NOT** create UI components - that's EXPDIA-006
- **DO NOT** create DI registration

## Implementation Details

### Rarity Categories

From specs/expression-diagnostics.md:

| Category | Trigger Rate | Status Indicator |
|----------|--------------|------------------|
| Impossible | 0% (proven) | Red |
| Extremely Rare | < 0.001% | Orange |
| Rare | 0.001% - 0.05% | Yellow |
| Normal | 0.05% - 2% | Green |
| Frequent | > 2% | Blue |

### DiagnosticResult Model

```javascript
/**
 * @file DiagnosticResult - Unified result model for expression diagnostics
 * @see specs/expression-diagnostics.md
 */

/**
 * @typedef {'impossible' | 'extremely_rare' | 'rare' | 'normal' | 'frequent'} RarityCategory
 */

/**
 * @typedef {Object} GateConflictInfo
 * @property {string} axis
 * @property {{ min: number, max: number }} required
 * @property {string[]} prototypes
 * @property {string[]} gates
 */

/**
 * @typedef {Object} UnreachableThresholdInfo
 * @property {string} prototypeId
 * @property {string} type
 * @property {number} threshold
 * @property {number} maxPossible
 * @property {number} gap
 */

/**
 * @typedef {Object} ClauseFailureInfo
 * @property {string} clauseDescription
 * @property {number} failureRate - 0 to 1
 * @property {number} averageViolation
 * @property {number} clauseIndex
 */

/**
 * @typedef {Object} ThresholdSuggestion
 * @property {string} clause
 * @property {number} original
 * @property {number} suggested
 * @property {number} expectedTriggerRate
 */

const RARITY_THRESHOLDS = Object.freeze({
  IMPOSSIBLE: 0,
  EXTREMELY_RARE: 0.00001,  // 0.001%
  RARE: 0.0005,             // 0.05%
  NORMAL: 0.02              // 2%
});

const RARITY_CATEGORIES = Object.freeze({
  IMPOSSIBLE: 'impossible',
  EXTREMELY_RARE: 'extremely_rare',
  RARE: 'rare',
  NORMAL: 'normal',
  FREQUENT: 'frequent'
});

const STATUS_INDICATORS = Object.freeze({
  impossible: { color: 'red', emoji: '🔴', label: 'Impossible' },
  extremely_rare: { color: 'orange', emoji: '🟠', label: 'Extremely Rare' },
  rare: { color: 'yellow', emoji: '🟡', label: 'Rare' },
  normal: { color: 'green', emoji: '🟢', label: 'Normal' },
  frequent: { color: 'blue', emoji: '🔵', label: 'Frequent' }
});

class DiagnosticResult {
  /** @type {string} */
  #expressionId;

  /** @type {boolean} */
  #isImpossible = false;

  /** @type {string|null} */
  #impossibilityReason = null;

  /** @type {GateConflictInfo[]} */
  #gateConflicts = [];

  /** @type {UnreachableThresholdInfo[]} */
  #unreachableThresholds = [];

  /** @type {number|null} */
  #triggerRate = null;

  /** @type {number|null} */
  #confidenceIntervalLow = null;

  /** @type {number|null} */
  #confidenceIntervalHigh = null;

  /** @type {number} */
  #sampleCount = 0;

  /** @type {string|null} */
  #distribution = null;

  /** @type {ClauseFailureInfo[]} */
  #clauseFailures = [];

  /** @type {object|null} */
  #witnessState = null;

  /** @type {object|null} */
  #nearestMiss = null;

  /** @type {boolean|null} */
  #smtResult = null;

  /** @type {string[]|null} */
  #unsatCore = null;

  /** @type {ThresholdSuggestion[]} */
  #suggestions = [];

  /** @type {Date} */
  #timestamp;

  /**
   * @param {string} expressionId
   */
  constructor(expressionId) {
    if (!expressionId || typeof expressionId !== 'string') {
      throw new Error('DiagnosticResult requires expressionId');
    }
    this.#expressionId = expressionId;
    this.#timestamp = new Date();
  }

  // Getters
  get expressionId() { return this.#expressionId; }
  get isImpossible() { return this.#isImpossible; }
  get impossibilityReason() { return this.#impossibilityReason; }
  get gateConflicts() { return [...this.#gateConflicts]; }
  get unreachableThresholds() { return [...this.#unreachableThresholds]; }
  get triggerRate() { return this.#triggerRate; }
  get confidenceInterval() {
    if (this.#confidenceIntervalLow === null) return null;
    return { low: this.#confidenceIntervalLow, high: this.#confidenceIntervalHigh };
  }
  get sampleCount() { return this.#sampleCount; }
  get distribution() { return this.#distribution; }
  get clauseFailures() { return [...this.#clauseFailures]; }
  get witnessState() { return this.#witnessState; }
  get nearestMiss() { return this.#nearestMiss; }
  get smtResult() { return this.#smtResult; }
  get unsatCore() { return this.#unsatCore ? [...this.#unsatCore] : null; }
  get suggestions() { return [...this.#suggestions]; }
  get timestamp() { return this.#timestamp; }

  /**
   * Derive rarity category from trigger rate and impossibility status
   * @returns {RarityCategory}
   */
  get rarityCategory() {
    if (this.#isImpossible) {
      return RARITY_CATEGORIES.IMPOSSIBLE;
    }

    if (this.#triggerRate === null) {
      return RARITY_CATEGORIES.IMPOSSIBLE; // No data, assume worst
    }

    if (this.#triggerRate === 0) {
      return RARITY_CATEGORIES.IMPOSSIBLE;
    }

    if (this.#triggerRate < RARITY_THRESHOLDS.EXTREMELY_RARE) {
      return RARITY_CATEGORIES.EXTREMELY_RARE;
    }

    if (this.#triggerRate < RARITY_THRESHOLDS.RARE) {
      return RARITY_CATEGORIES.RARE;
    }

    if (this.#triggerRate < RARITY_THRESHOLDS.NORMAL) {
      return RARITY_CATEGORIES.NORMAL;
    }

    return RARITY_CATEGORIES.FREQUENT;
  }

  /**
   * Get status indicator for UI display
   * @returns {{ color: string, emoji: string, label: string }}
   */
  get statusIndicator() {
    return STATUS_INDICATORS[this.rarityCategory];
  }

  // Setters (builder pattern)

  /**
   * Set static analysis results
   * @param {Object} staticResults
   * @returns {DiagnosticResult} this for chaining
   */
  setStaticAnalysis(staticResults) {
    if (staticResults.gateConflicts) {
      this.#gateConflicts = [...staticResults.gateConflicts];
      if (this.#gateConflicts.length > 0) {
        this.#isImpossible = true;
        this.#impossibilityReason = `Gate conflict on axis: ${this.#gateConflicts[0].axis}`;
      }
    }

    if (staticResults.unreachableThresholds) {
      this.#unreachableThresholds = [...staticResults.unreachableThresholds];
      if (this.#unreachableThresholds.length > 0 && !this.#isImpossible) {
        this.#isImpossible = true;
        const first = this.#unreachableThresholds[0];
        this.#impossibilityReason = `Unreachable threshold: ${first.prototypeId} requires ${first.threshold}, max possible is ${first.maxPossible}`;
      }
    }

    return this;
  }

  /**
   * Set Monte Carlo simulation results
   * @param {Object} mcResults
   * @returns {DiagnosticResult} this for chaining
   */
  setMonteCarloResults(mcResults) {
    this.#triggerRate = mcResults.triggerRate ?? null;
    this.#sampleCount = mcResults.sampleCount ?? 0;
    this.#distribution = mcResults.distribution ?? null;

    if (mcResults.confidenceInterval) {
      this.#confidenceIntervalLow = mcResults.confidenceInterval.low;
      this.#confidenceIntervalHigh = mcResults.confidenceInterval.high;
    }

    if (mcResults.clauseFailures) {
      this.#clauseFailures = [...mcResults.clauseFailures];
    }

    return this;
  }

  /**
   * Set witness finding results
   * @param {Object} witnessResults
   * @returns {DiagnosticResult} this for chaining
   */
  setWitnessResults(witnessResults) {
    this.#witnessState = witnessResults.witnessState ?? null;
    this.#nearestMiss = witnessResults.nearestMiss ?? null;
    return this;
  }

  /**
   * Set SMT solver results
   * @param {Object} smtResults
   * @returns {DiagnosticResult} this for chaining
   */
  setSmtResults(smtResults) {
    this.#smtResult = smtResults.satisfiable ?? null;

    if (smtResults.unsatCore) {
      this.#unsatCore = [...smtResults.unsatCore];
      if (!smtResults.satisfiable) {
        this.#isImpossible = true;
        this.#impossibilityReason = 'SMT solver proved impossibility';
      }
    }

    return this;
  }

  /**
   * Set threshold suggestions
   * @param {ThresholdSuggestion[]} suggestions
   * @returns {DiagnosticResult} this for chaining
   */
  setSuggestions(suggestions) {
    this.#suggestions = [...suggestions];
    return this;
  }

  /**
   * Serialize to JSON for export
   * @returns {Object}
   */
  toJSON() {
    return {
      expressionId: this.#expressionId,
      timestamp: this.#timestamp.toISOString(),
      rarityCategory: this.rarityCategory,
      statusIndicator: this.statusIndicator,
      isImpossible: this.#isImpossible,
      impossibilityReason: this.#impossibilityReason,
      staticAnalysis: {
        gateConflicts: this.#gateConflicts,
        unreachableThresholds: this.#unreachableThresholds
      },
      monteCarlo: {
        triggerRate: this.#triggerRate,
        confidenceInterval: this.confidenceInterval,
        sampleCount: this.#sampleCount,
        distribution: this.#distribution,
        clauseFailures: this.#clauseFailures
      },
      witness: {
        found: this.#witnessState !== null,
        state: this.#witnessState,
        nearestMiss: this.#nearestMiss
      },
      smt: {
        satisfiable: this.#smtResult,
        unsatCore: this.#unsatCore
      },
      suggestions: this.#suggestions
    };
  }
}

// Export constants for use in tests and UI
DiagnosticResult.RARITY_THRESHOLDS = RARITY_THRESHOLDS;
DiagnosticResult.RARITY_CATEGORIES = RARITY_CATEGORIES;
DiagnosticResult.STATUS_INDICATORS = STATUS_INDICATORS;

export default DiagnosticResult;
```

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:unit -- tests/unit/expressionDiagnostics/models/DiagnosticResult.test.js --verbose
```

### Unit Test Coverage Requirements

**DiagnosticResult.test.js:**
- Constructor throws if expressionId is missing
- Constructor throws if expressionId is not a string
- Constructor sets timestamp automatically
- `rarityCategory` returns 'impossible' when isImpossible=true
- `rarityCategory` returns 'extremely_rare' for rate < 0.00001
- `rarityCategory` returns 'rare' for rate 0.00001-0.0005
- `rarityCategory` returns 'normal' for rate 0.0005-0.02
- `rarityCategory` returns 'frequent' for rate > 0.02
- `statusIndicator` returns correct color/emoji for each category
- `setStaticAnalysis()` sets isImpossible for gate conflicts
- `setStaticAnalysis()` sets isImpossible for unreachable thresholds
- `setMonteCarloResults()` stores all fields correctly
- `setWitnessResults()` stores witness state and nearest miss
- `setSmtResults()` sets isImpossible when unsatisfiable
- `toJSON()` serializes all fields correctly
- `toJSON()` output is valid JSON (no circular refs)
- Builder pattern allows chaining all setters

### Invariants That Must Remain True

1. **Rarity category derived correctly** from trigger rate and impossibility status
2. **All fields have sensible defaults** - empty arrays, null values
3. **Serializes to JSON cleanly** - no circular references, all values JSON-compatible
4. **Immutable getters** - arrays are copied, not exposed directly
5. **Timestamp automatically set** on construction

## Verification Commands

```bash
# Run unit tests
npm run test:unit -- tests/unit/expressionDiagnostics/models/DiagnosticResult.test.js --verbose

# Type checking
npm run typecheck
```

## Definition of Done

- [ ] `DiagnosticResult.js` created with all methods implemented
- [ ] `models/index.js` updated with export
- [ ] Unit tests cover all public methods
- [ ] Tests cover all rarity category thresholds
- [ ] Tests verify JSON serialization
- [ ] JSDoc documentation complete
- [ ] All tests pass
- [ ] Static constants exported for UI use
