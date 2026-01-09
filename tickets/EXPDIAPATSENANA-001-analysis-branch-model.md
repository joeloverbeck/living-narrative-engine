# EXPDIAPATSENANA-001: Create AnalysisBranch Model

## Summary

Create the `AnalysisBranch` data model representing a single execution path through OR branches with its constraint state. This is the foundational model for path-sensitive analysis.

## Priority: High | Effort: Small

## Rationale

Path-sensitive analysis requires tracking independent constraint states for each OR branch. The `AnalysisBranch` model encapsulates the branch identifier, required prototypes, computed axis intervals, detected conflicts, and knife-edge constraints for a single path through the expression's JSON Logic tree.

## Dependencies

- **None** - This is a foundational model with no dependencies on other EXPDIAPATSENANA tickets
- Requires existing `AxisInterval` model from `src/expressionDiagnostics/models/AxisInterval.js`

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/expressionDiagnostics/models/AnalysisBranch.js` | **Create** |
| `src/expressionDiagnostics/models/index.js` | **Modify** (add export) |
| `tests/unit/expressionDiagnostics/models/AnalysisBranch.test.js` | **Create** |

## Out of Scope

- **DO NOT** implement PathSensitiveAnalyzer service - that's EXPDIAPATSENANA-005
- **DO NOT** create KnifeEdge model - that's EXPDIAPATSENANA-002
- **DO NOT** create BranchReachability model - that's EXPDIAPATSENANA-003
- **DO NOT** create PathSensitiveResult model - that's EXPDIAPATSENANA-004
- **DO NOT** add DI registration - models don't need DI tokens
- **DO NOT** modify existing GateConstraintAnalyzer or IntensityBoundsCalculator

## Implementation Details

### AnalysisBranch Model

```javascript
/**
 * @file AnalysisBranch - Represents a single path through OR branches with its constraint state
 * @see specs/expression-diagnostics-path-sensitive-analysis.md
 */

/**
 * @typedef {import('./AxisInterval.js').default} AxisInterval
 */

/**
 * @typedef {Object} GateConflict
 * @property {string} axis - The axis with conflicting constraints
 * @property {string} message - Human-readable conflict description
 */

class AnalysisBranch {
  /** @type {string} Unique branch identifier (e.g., "0.1.0" for nested paths) */
  #branchId;

  /** @type {string} Human-readable description (e.g., "entrancement branch") */
  #description;

  /** @type {Map<string, AxisInterval>} Axis intervals for this branch */
  #axisIntervals;

  /** @type {string[]} Prototype IDs included in this branch */
  #requiredPrototypes;

  /** @type {boolean} True if any axis interval is empty */
  #isInfeasible;

  /** @type {GateConflict[]} Conflicts detected in this branch */
  #conflicts;

  /** @type {Object[]} Knife-edge constraints in this branch (populated externally) */
  #knifeEdges;

  /**
   * @param {Object} params
   * @param {string} params.branchId - Unique branch identifier
   * @param {string} params.description - Human-readable description
   * @param {string[]} [params.requiredPrototypes=[]] - Prototype IDs in this branch
   * @param {Map<string, AxisInterval>} [params.axisIntervals] - Computed intervals
   * @param {GateConflict[]} [params.conflicts=[]] - Detected conflicts
   * @param {Object[]} [params.knifeEdges=[]] - Knife-edge constraints
   */
  constructor({
    branchId,
    description,
    requiredPrototypes = [],
    axisIntervals = new Map(),
    conflicts = [],
    knifeEdges = []
  }) {
    if (typeof branchId !== 'string' || branchId.trim() === '') {
      throw new Error('AnalysisBranch requires non-empty branchId string');
    }
    if (typeof description !== 'string') {
      throw new Error('AnalysisBranch requires description string');
    }
    if (!Array.isArray(requiredPrototypes)) {
      throw new Error('AnalysisBranch requiredPrototypes must be an array');
    }

    this.#branchId = branchId;
    this.#description = description;
    this.#requiredPrototypes = [...requiredPrototypes];
    this.#axisIntervals = new Map(axisIntervals);
    this.#conflicts = [...conflicts];
    this.#knifeEdges = [...knifeEdges];
    this.#isInfeasible = conflicts.length > 0;
  }

  // Getters
  get branchId() { return this.#branchId; }
  get description() { return this.#description; }
  get requiredPrototypes() { return [...this.#requiredPrototypes]; }
  get axisIntervals() { return new Map(this.#axisIntervals); }
  get conflicts() { return [...this.#conflicts]; }
  get knifeEdges() { return [...this.#knifeEdges]; }
  get isInfeasible() { return this.#isInfeasible; }

  /**
   * Check if branch includes a specific prototype
   * @param {string} prototypeId
   * @returns {boolean}
   */
  hasPrototype(prototypeId) {
    return this.#requiredPrototypes.includes(prototypeId);
  }

  /**
   * Get axis interval for a specific axis
   * @param {string} axis
   * @returns {AxisInterval|undefined}
   */
  getAxisInterval(axis) {
    return this.#axisIntervals.get(axis);
  }

  /**
   * Create a copy with updated axis intervals
   * @param {Map<string, AxisInterval>} axisIntervals
   * @returns {AnalysisBranch}
   */
  withAxisIntervals(axisIntervals) {
    return new AnalysisBranch({
      branchId: this.#branchId,
      description: this.#description,
      requiredPrototypes: this.#requiredPrototypes,
      axisIntervals,
      conflicts: this.#conflicts,
      knifeEdges: this.#knifeEdges
    });
  }

  /**
   * Create a copy with updated conflicts
   * @param {GateConflict[]} conflicts
   * @returns {AnalysisBranch}
   */
  withConflicts(conflicts) {
    return new AnalysisBranch({
      branchId: this.#branchId,
      description: this.#description,
      requiredPrototypes: this.#requiredPrototypes,
      axisIntervals: this.#axisIntervals,
      conflicts,
      knifeEdges: this.#knifeEdges
    });
  }

  /**
   * Create a copy with updated knife-edges
   * @param {Object[]} knifeEdges
   * @returns {AnalysisBranch}
   */
  withKnifeEdges(knifeEdges) {
    return new AnalysisBranch({
      branchId: this.#branchId,
      description: this.#description,
      requiredPrototypes: this.#requiredPrototypes,
      axisIntervals: this.#axisIntervals,
      conflicts: this.#conflicts,
      knifeEdges
    });
  }

  /**
   * Convert to JSON for serialization
   * @returns {Object}
   */
  toJSON() {
    const axisIntervalsObj = {};
    for (const [key, interval] of this.#axisIntervals) {
      axisIntervalsObj[key] = {
        min: interval.min,
        max: interval.max
      };
    }

    return {
      branchId: this.#branchId,
      description: this.#description,
      requiredPrototypes: [...this.#requiredPrototypes],
      axisIntervals: axisIntervalsObj,
      conflicts: [...this.#conflicts],
      knifeEdges: [...this.#knifeEdges],
      isInfeasible: this.#isInfeasible
    };
  }

  /**
   * Create human-readable summary
   * @returns {string}
   */
  toSummary() {
    const status = this.#isInfeasible ? '❌ Infeasible' : '✅ Feasible';
    const protoList = this.#requiredPrototypes.join(', ') || 'none';
    return `Branch ${this.#branchId}: ${this.#description}\n` +
           `  Status: ${status}\n` +
           `  Prototypes: ${protoList}\n` +
           `  Conflicts: ${this.#conflicts.length}\n` +
           `  Knife-edges: ${this.#knifeEdges.length}`;
  }
}

export default AnalysisBranch;
```

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:unit -- tests/unit/expressionDiagnostics/models/AnalysisBranch.test.js --verbose
```

### Unit Test Coverage Requirements

**AnalysisBranch.test.js:**
- Constructor throws if branchId is missing
- Constructor throws if branchId is empty string
- Constructor throws if branchId is not a string
- Constructor throws if description is missing
- Constructor throws if description is not a string
- Constructor throws if requiredPrototypes is not an array
- Constructor accepts valid parameters with defaults
- Constructor accepts all optional parameters
- `branchId` getter returns correct value
- `description` getter returns correct value
- `requiredPrototypes` getter returns copy, not reference
- `axisIntervals` getter returns copy of Map
- `conflicts` getter returns copy, not reference
- `knifeEdges` getter returns copy, not reference
- `isInfeasible` returns true when conflicts exist
- `isInfeasible` returns false when no conflicts
- `hasPrototype()` returns true for included prototype
- `hasPrototype()` returns false for missing prototype
- `getAxisInterval()` returns interval for existing axis
- `getAxisInterval()` returns undefined for missing axis
- `withAxisIntervals()` creates new instance with updated intervals
- `withAxisIntervals()` preserves other properties
- `withConflicts()` creates new instance with updated conflicts
- `withConflicts()` updates isInfeasible accordingly
- `withKnifeEdges()` creates new instance with updated knife-edges
- `toJSON()` includes all properties
- `toJSON()` serializes axisIntervals correctly
- `toSummary()` returns formatted string
- `toSummary()` shows correct status indicator

### Invariants That Must Remain True

1. **Immutable getters** - All getters return copies, not references
2. **branchId is non-empty string** - Always validated on construction
3. **isInfeasible reflects conflicts** - True iff conflicts.length > 0
4. **Arrays are copied** - Constructor and getters copy arrays
5. **Map is copied** - axisIntervals getter returns new Map

## Verification Commands

```bash
# Run unit tests
npm run test:unit -- tests/unit/expressionDiagnostics/models/AnalysisBranch.test.js --verbose

# Type checking
npm run typecheck

# Verify export
node -e "import('./src/expressionDiagnostics/models/index.js').then(m => console.log('AnalysisBranch exported:', !!m.AnalysisBranch))"
```

## Definition of Done

- [ ] `AnalysisBranch.js` created with all methods implemented
- [ ] `models/index.js` updated with export
- [ ] Unit tests cover all public methods
- [ ] Tests cover validation edge cases
- [ ] Tests verify immutability of getters
- [ ] Tests verify `with*` methods create new instances
- [ ] JSDoc documentation complete
- [ ] All tests pass
