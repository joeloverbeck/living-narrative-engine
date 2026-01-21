# PROREDANAV2-007: Create GateConstraintExtractor Service (B1)

## Description

Create a service that parses gate strings into per-axis intervals for deterministic nesting analysis. This enables detecting when one prototype's gate constraints are strictly contained within another's.

## Files to Touch

### Create
- `src/expressionDiagnostics/services/prototypeOverlap/GateConstraintExtractor.js`
- `tests/unit/expressionDiagnostics/services/prototypeOverlap/gateConstraintExtractor.test.js`

## Out of Scope

- GateImplicationEvaluator (PROREDANAV2-008)
- DI registration (PROREDANAV2-013)
- Integration with orchestrator (PROREDANAV2-016)
- Using results in classification
- GateBandingSuggestionBuilder

## Changes Required

### 1. Create GateConstraintExtractor Class

```javascript
/**
 * Parses gate strings into per-axis intervals.
 * Input: Array of gate strings (e.g., ['arousal >= 0.30', 'threat <= 0.20'])
 * Output: Intervals map with parse status
 */
class GateConstraintExtractor {
  #config;
  #logger;

  constructor({ config, logger }) {
    this.#config = config;
    this.#logger = logger;
  }

  extract(gates) {
    // Returns extraction result
  }
}
```

### 2. Implement Gate Parsing

Parse gate patterns: `<axis> <op> <number>` where op ∈ {>=, >, <=, <}

```javascript
// Regular expression for gate pattern
const GATE_PATTERN = /^(\w+)\s*(>=|>|<=|<)\s*(-?\d+\.?\d*)$/;

// For each gate string:
const match = gate.match(GATE_PATTERN);
if (!match) {
  unparsedGates.push(gate);
  continue;
}
const [, axis, op, valueStr] = match;
const value = parseFloat(valueStr);
```

### 3. Normalize Strict Inequalities

```javascript
// Normalize strict inequalities with config.strictEpsilon
if (op === '>') {
  lower = value + config.strictEpsilon;
} else if (op === '>=') {
  lower = value;
}
if (op === '<') {
  upper = value - config.strictEpsilon;
} else if (op === '<=') {
  upper = value;
}
```

### 4. Aggregate Multiple Constraints

When multiple constraints exist for the same axis:
```javascript
// Take intersection of bounds
existingInterval.lower = Math.max(existingInterval.lower, newLower);
existingInterval.upper = Math.min(existingInterval.upper, newUpper);
```

### 5. Return Structure

```javascript
{
  intervals: Map<string, {
    lower: number,      // default: -Infinity
    upper: number,      // default: +Infinity
    lowerInclusive: boolean,
    upperInclusive: boolean
  }>,
  unparsedGates: string[],
  parseStatus: 'complete' | 'partial' | 'failed'
}
```

### 6. Handle Unsatisfiable Intervals

If lower > upper after aggregation, mark as unsatisfiable:
```javascript
if (interval.lower > interval.upper) {
  interval.unsatisfiable = true;
}
```

## Acceptance Criteria

### Tests That Must Pass

1. **Simple upper bound**: `"threat <= 0.20"` → intervals.get('threat') = { lower: -Infinity, upper: 0.20 }
2. **Simple lower bound**: `"arousal >= 0.30"` → intervals.get('arousal') = { lower: 0.30, upper: +Infinity }
3. **Combined bounds**: `["arousal >= -0.30", "arousal <= 0.35"]` → interval [-0.30, 0.35]
4. **Strict inequality (>)**: `"valence > 0.10"` → lower = 0.10 + strictEpsilon
5. **Strict inequality (<)**: `"threat < 0.20"` → upper = 0.20 - strictEpsilon
6. **Unparsed gates**: `"weird gate string"` → unparsedGates = ["weird gate string"], parseStatus = 'partial'
7. **All unparsed**: `["invalid", "also invalid"]` → parseStatus = 'failed'
8. **All parsed**: `["threat <= 0.20", "arousal >= 0.30"]` → parseStatus = 'complete'
9. **Unsatisfiable interval**: `["arousal >= 0.50", "arousal <= 0.30"]` → interval.unsatisfiable = true
10. **Empty gates array**: `[]` → empty intervals Map, parseStatus = 'complete'
11. **Negative values**: `"valence >= -0.50"` → lower = -0.50
12. **Multiple axes**: Parse gates for different axes into separate intervals

### Invariants That Must Remain True

- For each axis interval: lower <= upper, UNLESS marked unsatisfiable
- strictEpsilon used consistently for strict inequalities
- Unparsed gates don't affect other gate parsing
- Input gate array not mutated
- Service is stateless (no side effects between extract() calls)

## Estimated Size

~180 lines of code + ~250 lines of tests

## Dependencies

- PROREDANAV2-001 (config with strictEpsilon)
- PROREDANAV2-002 (DI token for IGateConstraintExtractor)

## Verification Commands

```bash
# Run unit tests
npm run test:unit -- --testPathPattern=gateConstraintExtractor

# Lint
npx eslint src/expressionDiagnostics/services/prototypeOverlap/GateConstraintExtractor.js

# Typecheck
npm run typecheck
```
