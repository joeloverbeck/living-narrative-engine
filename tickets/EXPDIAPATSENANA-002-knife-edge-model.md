# EXPDIAPATSENANA-002: Create KnifeEdge Model

## Summary

Create the `KnifeEdge` data model representing a brittle constraint where the feasible interval for an axis is very narrow (technically satisfiable but likely to cause issues in practice).

## Priority: High | Effort: Small

## Rationale

When OR branches create extremely narrow feasible intervals (e.g., `agency_control` forced to exactly 0.10), the expression is technically possible but extremely unlikely to trigger naturally. The `KnifeEdge` model captures these warnings so content authors can understand why their expression rarely fires.

## Dependencies

- **None** - This is a foundational model with no dependencies on other EXPDIAPATSENANA tickets

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/expressionDiagnostics/models/KnifeEdge.js` | **Create** |
| `src/expressionDiagnostics/models/index.js` | **Modify** (add export) |
| `tests/unit/expressionDiagnostics/models/KnifeEdge.test.js` | **Create** |

## Out of Scope

- **DO NOT** implement PathSensitiveAnalyzer service - that's EXPDIAPATSENANA-005
- **DO NOT** implement knife-edge detection logic - that's EXPDIAPATSENANA-006
- **DO NOT** create AnalysisBranch model - that's EXPDIAPATSENANA-001
- **DO NOT** create UI components for knife-edge display - that's EXPDIAPATSENANA-008
- **DO NOT** add DI registration - models don't need DI tokens

## Implementation Details

### KnifeEdge Model

```javascript
/**
 * @file KnifeEdge - Represents a brittle constraint where the feasible interval is very narrow
 * @see specs/expression-diagnostics-path-sensitive-analysis.md
 */

/**
 * Default threshold below which an interval is considered a "knife-edge"
 * @type {number}
 */
const DEFAULT_KNIFE_EDGE_THRESHOLD = 0.02;

class KnifeEdge {
  /** @type {string} Axis name */
  #axis;

  /** @type {number} Interval minimum */
  #min;

  /** @type {number} Interval maximum */
  #max;

  /** @type {number} Width of the interval (max - min) */
  #width;

  /** @type {string[]} Prototypes contributing to this knife-edge */
  #contributingPrototypes;

  /** @type {string[]} Gate strings that created this knife-edge */
  #contributingGates;

  /**
   * @param {Object} params
   * @param {string} params.axis - Axis name (e.g., "agency_control")
   * @param {number} params.min - Interval minimum
   * @param {number} params.max - Interval maximum
   * @param {string[]} [params.contributingPrototypes=[]] - Prototypes causing this constraint
   * @param {string[]} [params.contributingGates=[]] - Gate strings causing this constraint
   */
  constructor({
    axis,
    min,
    max,
    contributingPrototypes = [],
    contributingGates = []
  }) {
    if (typeof axis !== 'string' || axis.trim() === '') {
      throw new Error('KnifeEdge requires non-empty axis string');
    }
    if (typeof min !== 'number' || Number.isNaN(min)) {
      throw new Error('KnifeEdge requires numeric min value');
    }
    if (typeof max !== 'number' || Number.isNaN(max)) {
      throw new Error('KnifeEdge requires numeric max value');
    }
    if (max < min) {
      throw new Error(`KnifeEdge max (${max}) cannot be less than min (${min})`);
    }
    if (!Array.isArray(contributingPrototypes)) {
      throw new Error('KnifeEdge contributingPrototypes must be an array');
    }
    if (!Array.isArray(contributingGates)) {
      throw new Error('KnifeEdge contributingGates must be an array');
    }

    this.#axis = axis;
    this.#min = min;
    this.#max = max;
    this.#width = max - min;
    this.#contributingPrototypes = [...contributingPrototypes];
    this.#contributingGates = [...contributingGates];
  }

  // Getters
  get axis() { return this.#axis; }
  get min() { return this.#min; }
  get max() { return this.#max; }
  get width() { return this.#width; }
  get contributingPrototypes() { return [...this.#contributingPrototypes]; }
  get contributingGates() { return [...this.#contributingGates]; }

  /**
   * Check if this is a zero-width (point) constraint
   * @returns {boolean}
   */
  get isPoint() {
    return this.#width === 0;
  }

  /**
   * Check if this is below a given threshold
   * @param {number} [threshold=0.02] - Width threshold
   * @returns {boolean}
   */
  isBelowThreshold(threshold = DEFAULT_KNIFE_EDGE_THRESHOLD) {
    return this.#width <= threshold;
  }

  /**
   * Get severity level based on width
   * @returns {'critical'|'warning'|'info'}
   */
  get severity() {
    if (this.#width === 0) return 'critical';
    if (this.#width <= 0.01) return 'warning';
    return 'info';
  }

  /**
   * Format interval as string
   * @returns {string}
   */
  formatInterval() {
    if (this.#width === 0) {
      return `exactly ${this.#min.toFixed(2)}`;
    }
    return `[${this.#min.toFixed(2)}, ${this.#max.toFixed(2)}]`;
  }

  /**
   * Format contributing prototypes as readable string
   * @returns {string}
   */
  formatContributors() {
    if (this.#contributingPrototypes.length === 0) {
      return 'unknown';
    }
    return this.#contributingPrototypes.join(' ∧ ');
  }

  /**
   * Convert to JSON for serialization
   * @returns {Object}
   */
  toJSON() {
    return {
      axis: this.#axis,
      min: this.#min,
      max: this.#max,
      width: this.#width,
      contributingPrototypes: [...this.#contributingPrototypes],
      contributingGates: [...this.#contributingGates],
      severity: this.severity
    };
  }

  /**
   * Create from JSON
   * @param {Object} json
   * @returns {KnifeEdge}
   */
  static fromJSON(json) {
    return new KnifeEdge({
      axis: json.axis,
      min: json.min,
      max: json.max,
      contributingPrototypes: json.contributingPrototypes || [],
      contributingGates: json.contributingGates || []
    });
  }

  /**
   * Create human-readable warning message
   * @returns {string}
   */
  toWarningMessage() {
    const severityEmoji = {
      critical: '🔴',
      warning: '🟡',
      info: '🔵'
    };

    return `${severityEmoji[this.severity]} ${this.#axis}: ${this.formatInterval()} ` +
           `(width: ${this.#width.toFixed(3)}) caused by ${this.formatContributors()}`;
  }

  /**
   * Create display object for UI rendering
   * @returns {Object}
   */
  toDisplayObject() {
    return {
      axis: this.#axis,
      interval: this.formatInterval(),
      width: this.#width.toFixed(3),
      cause: this.formatContributors(),
      gates: this.#contributingGates,
      severity: this.severity
    };
  }
}

// Export constants
KnifeEdge.DEFAULT_THRESHOLD = DEFAULT_KNIFE_EDGE_THRESHOLD;

export default KnifeEdge;
```

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:unit -- tests/unit/expressionDiagnostics/models/KnifeEdge.test.js --verbose
```

### Unit Test Coverage Requirements

**KnifeEdge.test.js:**
- Constructor throws if axis is missing
- Constructor throws if axis is empty string
- Constructor throws if axis is not a string
- Constructor throws if min is missing
- Constructor throws if min is NaN
- Constructor throws if max is missing
- Constructor throws if max is NaN
- Constructor throws if max < min
- Constructor throws if contributingPrototypes is not an array
- Constructor throws if contributingGates is not an array
- Constructor accepts valid parameters with defaults
- Constructor calculates width correctly
- `axis` getter returns correct value
- `min` getter returns correct value
- `max` getter returns correct value
- `width` getter returns correct value (max - min)
- `contributingPrototypes` getter returns copy, not reference
- `contributingGates` getter returns copy, not reference
- `isPoint` returns true when width is 0
- `isPoint` returns false when width > 0
- `isBelowThreshold()` returns true when below default threshold
- `isBelowThreshold()` returns false when above default threshold
- `isBelowThreshold()` uses custom threshold when provided
- `severity` returns 'critical' for width 0
- `severity` returns 'warning' for width <= 0.01
- `severity` returns 'info' for width > 0.01
- `formatInterval()` returns "exactly X" for point constraints
- `formatInterval()` returns "[min, max]" for ranges
- `formatContributors()` returns "unknown" when no prototypes
- `formatContributors()` joins prototypes with " ∧ "
- `toJSON()` includes all properties
- `toJSON()` includes calculated severity
- `fromJSON()` reconstructs KnifeEdge correctly
- `fromJSON()` handles missing optional arrays
- `toWarningMessage()` includes severity emoji
- `toWarningMessage()` includes all information
- `toDisplayObject()` returns UI-ready format
- Static DEFAULT_THRESHOLD is 0.02

### Invariants That Must Remain True

1. **width = max - min** - Always calculated from bounds
2. **max >= min** - Validated on construction
3. **Immutable getters** - Arrays are copied
4. **severity is deterministic** - Based solely on width
5. **isPoint iff width === 0** - Consistent definition

## Verification Commands

```bash
# Run unit tests
npm run test:unit -- tests/unit/expressionDiagnostics/models/KnifeEdge.test.js --verbose

# Type checking
npm run typecheck

# Verify export
node -e "import('./src/expressionDiagnostics/models/index.js').then(m => console.log('KnifeEdge exported:', !!m.KnifeEdge))"
```

## Definition of Done

- [ ] `KnifeEdge.js` created with all methods implemented
- [ ] `models/index.js` updated with export
- [ ] Unit tests cover all public methods
- [ ] Tests cover validation edge cases
- [ ] Tests verify severity categorization
- [ ] Tests verify formatting methods
- [ ] Tests verify JSON roundtrip
- [ ] JSDoc documentation complete
- [ ] All tests pass
- [ ] DEFAULT_THRESHOLD constant exported
