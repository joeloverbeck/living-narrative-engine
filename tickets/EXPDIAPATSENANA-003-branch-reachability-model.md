# EXPDIAPATSENANA-003: Create BranchReachability Model

## Summary

Create the `BranchReachability` data model representing threshold reachability results for a specific branch. This model captures whether a particular prototype threshold is achievable within a given branch's constraints.

## Priority: High | Effort: Small

## Rationale

Path-sensitive analysis produces per-branch reachability results. The `BranchReachability` model provides a structured representation of whether a threshold is reachable in a specific branch, including the maximum possible value and any gap from the required threshold.

## Dependencies

- **None** - This is a foundational model with no dependencies on other EXPDIAPATSENANA tickets

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/expressionDiagnostics/models/BranchReachability.js` | **Create** |
| `src/expressionDiagnostics/models/index.js` | **Modify** (add export) |
| `tests/unit/expressionDiagnostics/models/BranchReachability.test.js` | **Create** |

## Out of Scope

- **DO NOT** implement PathSensitiveAnalyzer service - that's EXPDIAPATSENANA-005
- **DO NOT** implement reachability calculation logic - that's EXPDIAPATSENANA-006
- **DO NOT** create AnalysisBranch model - that's EXPDIAPATSENANA-001
- **DO NOT** create KnifeEdge model - that's EXPDIAPATSENANA-002
- **DO NOT** add DI registration - models don't need DI tokens

## Implementation Details

### BranchReachability Model

```javascript
/**
 * @file BranchReachability - Threshold reachability result for a specific branch
 * @see specs/expression-diagnostics-path-sensitive-analysis.md
 */

/**
 * @typedef {import('./KnifeEdge.js').default} KnifeEdge
 */

class BranchReachability {
  /** @type {string} Branch identifier */
  #branchId;

  /** @type {string} Branch description */
  #branchDescription;

  /** @type {string} Prototype ID being tested */
  #prototypeId;

  /** @type {'emotion'|'sexual'} Prototype type */
  #type;

  /** @type {number} Required threshold */
  #threshold;

  /** @type {number} Maximum achievable in this branch */
  #maxPossible;

  /** @type {boolean} True if threshold is reachable in this branch */
  #isReachable;

  /** @type {number} Gap if unreachable (threshold - maxPossible), 0 if reachable */
  #gap;

  /** @type {Object[]} Knife-edge constraints affecting this threshold */
  #knifeEdges;

  /**
   * @param {Object} params
   * @param {string} params.branchId - Branch identifier
   * @param {string} params.branchDescription - Human-readable branch description
   * @param {string} params.prototypeId - Prototype being tested (e.g., "flow")
   * @param {'emotion'|'sexual'} params.type - Prototype type
   * @param {number} params.threshold - Required threshold value
   * @param {number} params.maxPossible - Maximum achievable value in this branch
   * @param {Object[]} [params.knifeEdges=[]] - Knife-edge constraints
   */
  constructor({
    branchId,
    branchDescription,
    prototypeId,
    type,
    threshold,
    maxPossible,
    knifeEdges = []
  }) {
    if (typeof branchId !== 'string' || branchId.trim() === '') {
      throw new Error('BranchReachability requires non-empty branchId string');
    }
    if (typeof branchDescription !== 'string') {
      throw new Error('BranchReachability requires branchDescription string');
    }
    if (typeof prototypeId !== 'string' || prototypeId.trim() === '') {
      throw new Error('BranchReachability requires non-empty prototypeId string');
    }
    if (type !== 'emotion' && type !== 'sexual') {
      throw new Error('BranchReachability type must be "emotion" or "sexual"');
    }
    if (typeof threshold !== 'number' || Number.isNaN(threshold)) {
      throw new Error('BranchReachability requires numeric threshold');
    }
    if (typeof maxPossible !== 'number' || Number.isNaN(maxPossible)) {
      throw new Error('BranchReachability requires numeric maxPossible');
    }
    if (!Array.isArray(knifeEdges)) {
      throw new Error('BranchReachability knifeEdges must be an array');
    }

    this.#branchId = branchId;
    this.#branchDescription = branchDescription;
    this.#prototypeId = prototypeId;
    this.#type = type;
    this.#threshold = threshold;
    this.#maxPossible = maxPossible;
    this.#isReachable = maxPossible >= threshold;
    this.#gap = this.#isReachable ? 0 : threshold - maxPossible;
    this.#knifeEdges = [...knifeEdges];
  }

  // Getters
  get branchId() { return this.#branchId; }
  get branchDescription() { return this.#branchDescription; }
  get prototypeId() { return this.#prototypeId; }
  get type() { return this.#type; }
  get threshold() { return this.#threshold; }
  get maxPossible() { return this.#maxPossible; }
  get isReachable() { return this.#isReachable; }
  get gap() { return this.#gap; }
  get knifeEdges() { return [...this.#knifeEdges]; }

  /**
   * Check if this has any knife-edge constraints
   * @returns {boolean}
   */
  get hasKnifeEdges() {
    return this.#knifeEdges.length > 0;
  }

  /**
   * Get status indicator for UI display
   * @returns {'reachable'|'unreachable'|'knife-edge'}
   */
  get status() {
    if (!this.#isReachable) return 'unreachable';
    if (this.#knifeEdges.length > 0) return 'knife-edge';
    return 'reachable';
  }

  /**
   * Get status emoji for display
   * @returns {string}
   */
  get statusEmoji() {
    const emojiMap = {
      'reachable': '✅',
      'unreachable': '❌',
      'knife-edge': '⚠️'
    };
    return emojiMap[this.status];
  }

  /**
   * Get gap as percentage of threshold
   * @returns {number}
   */
  get gapPercentage() {
    if (this.#threshold === 0) return 0;
    return (this.#gap / this.#threshold) * 100;
  }

  /**
   * Create human-readable summary
   * @returns {string}
   */
  toSummary() {
    const status = this.#isReachable ? 'Reachable' : `Unreachable (gap: ${this.#gap.toFixed(2)})`;
    const keWarning = this.#knifeEdges.length > 0
      ? ` [${this.#knifeEdges.length} knife-edge(s)]`
      : '';

    return `${this.#prototypeId} >= ${this.#threshold}: ${status}${keWarning}` +
           `\n  Max possible: ${this.#maxPossible.toFixed(2)}` +
           `\n  Branch: ${this.#branchDescription}`;
  }

  /**
   * Convert to JSON for serialization
   * @returns {Object}
   */
  toJSON() {
    return {
      branchId: this.#branchId,
      branchDescription: this.#branchDescription,
      prototypeId: this.#prototypeId,
      type: this.#type,
      threshold: this.#threshold,
      maxPossible: this.#maxPossible,
      isReachable: this.#isReachable,
      gap: this.#gap,
      knifeEdges: this.#knifeEdges.map(ke =>
        typeof ke.toJSON === 'function' ? ke.toJSON() : ke
      ),
      status: this.status
    };
  }

  /**
   * Create from JSON
   * @param {Object} json
   * @returns {BranchReachability}
   */
  static fromJSON(json) {
    return new BranchReachability({
      branchId: json.branchId,
      branchDescription: json.branchDescription,
      prototypeId: json.prototypeId,
      type: json.type,
      threshold: json.threshold,
      maxPossible: json.maxPossible,
      knifeEdges: json.knifeEdges || []
    });
  }

  /**
   * Create display object for UI table row
   * @returns {Object}
   */
  toTableRow() {
    return {
      prototype: this.#prototypeId,
      type: this.#type,
      required: this.#threshold.toFixed(2),
      maxPossible: this.#maxPossible.toFixed(2),
      gap: this.#gap.toFixed(2),
      status: this.statusEmoji,
      branch: this.#branchDescription
    };
  }
}

export default BranchReachability;
```

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:unit -- tests/unit/expressionDiagnostics/models/BranchReachability.test.js --verbose
```

### Unit Test Coverage Requirements

**BranchReachability.test.js:**
- Constructor throws if branchId is missing
- Constructor throws if branchId is empty string
- Constructor throws if branchDescription is missing
- Constructor throws if prototypeId is missing
- Constructor throws if prototypeId is empty string
- Constructor throws if type is not 'emotion' or 'sexual'
- Constructor throws if threshold is missing
- Constructor throws if threshold is NaN
- Constructor throws if maxPossible is missing
- Constructor throws if maxPossible is NaN
- Constructor throws if knifeEdges is not an array
- Constructor accepts valid parameters
- Constructor calculates isReachable correctly (maxPossible >= threshold)
- Constructor calculates gap correctly when unreachable
- Constructor sets gap to 0 when reachable
- All getters return correct values
- `knifeEdges` getter returns copy, not reference
- `hasKnifeEdges` returns true when knifeEdges present
- `hasKnifeEdges` returns false when knifeEdges empty
- `status` returns 'unreachable' when not reachable
- `status` returns 'knife-edge' when reachable with knife-edges
- `status` returns 'reachable' when reachable without knife-edges
- `statusEmoji` returns correct emoji for each status
- `gapPercentage` calculates correctly
- `gapPercentage` returns 0 when threshold is 0
- `toSummary()` includes all relevant information
- `toJSON()` includes all properties
- `toJSON()` includes calculated status
- `fromJSON()` reconstructs correctly
- `fromJSON()` handles missing knifeEdges
- `toTableRow()` returns UI-ready format

### Invariants That Must Remain True

1. **isReachable = (maxPossible >= threshold)** - Always calculated from values
2. **gap = 0 when reachable** - No gap if achievable
3. **gap = threshold - maxPossible when unreachable** - Positive gap
4. **type is 'emotion' or 'sexual'** - Validated on construction
5. **Immutable getters** - knifeEdges array is copied

## Verification Commands

```bash
# Run unit tests
npm run test:unit -- tests/unit/expressionDiagnostics/models/BranchReachability.test.js --verbose

# Type checking
npm run typecheck

# Verify export
node -e "import('./src/expressionDiagnostics/models/index.js').then(m => console.log('BranchReachability exported:', !!m.BranchReachability))"
```

## Definition of Done

- [ ] `BranchReachability.js` created with all methods implemented
- [ ] `models/index.js` updated with export
- [ ] Unit tests cover all public methods
- [ ] Tests cover validation edge cases
- [ ] Tests verify calculated properties (isReachable, gap, status)
- [ ] Tests verify JSON roundtrip
- [ ] JSDoc documentation complete
- [ ] All tests pass
