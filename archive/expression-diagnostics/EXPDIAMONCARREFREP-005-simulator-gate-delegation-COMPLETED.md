# EXPDIAMONCARREFREP-005: MonteCarloSimulator Delegates Gate Parsing to GateConstraint

## Summary
Replace `MonteCarloSimulator`'s `#parseGate()` method with delegation to `GateConstraint.parse()`. Update `#checkGates()` to use `GateConstraint` model for gate evaluation.

## Assumptions & Scope Adjustments (2025-02-14)
- `GateConstraint.parse()` **throws** on invalid input (it does not return `null`). `#checkGates()` must catch parse errors to preserve the "skip invalid gates" invariant.
- `GateConstraint` already implements `isSatisfiedBy(axisValue)`; no new method is required.
- `GateConstraint.parse()` uses the emotionCalculatorService regex (`-?\d*\.?\d+`), which differs from MonteCarloSimulator’s current regex (`-?\d+\.?\d*`). This change intentionally aligns MonteCarloSimulator with the shared gate parsing behavior (per report) and may reject edge-case numeric strings like `1.` that were previously accepted.

## Files to Modify

| File | Action | Changes |
|------|--------|---------|
| `src/expressionDiagnostics/services/MonteCarloSimulator.js` | Modify | Remove `#parseGate`, update `#checkGates` to use `GateConstraint` |
| `src/expressionDiagnostics/models/GateConstraint.js` | No change | `isSatisfiedBy(axisValue)` already exists |

## Out of Scope

- **DO NOT** modify emotion calculation delegation - That's EXPDIAMONCARREFREP-004
- **DO NOT** modify `#generateRandomState` - Addressed in EXPDIAMONCARREFREP-006
- **DO NOT** modify any UI/controller code
- **DO NOT** change gate syntax or add new operators
- **DO NOT** modify other services' gate parsing (already done in EXPDIAMONCARREFREP-001)

## Acceptance Criteria

### Tests That Must Pass
1. All existing tests in `tests/unit/expressionDiagnostics/services/monteCarloSimulator.gateEnforcement.test.js`
2. All existing tests in `tests/unit/expressionDiagnostics/services/monteCarloSimulator.test.js`
3. All existing tests in `tests/unit/expressionDiagnostics/models/GateConstraint.test.js`
4. Integration tests continue to pass

### Invariants That Must Remain True
1. Gate checking behavior unchanged: all gates must pass for gate check to succeed
2. Invalid gates are silently skipped (not errors) — handled by catching `GateConstraint.parse()` errors
3. Gate evaluation uses same epsilon (0.0001) for `==` operator
4. Return type of `#checkGates` remains `boolean`

## Implementation Notes

### Method to Remove
```javascript
// REMOVE from MonteCarloSimulator.js (lines 672-676 approximately):
#parseGate(gate) {
  const match = gate.match(/^(\w+)\s*(>=|<=|>|<|==)\s*(-?\d+\.?\d*)$/);
  if (!match) return null;
  return { axis: match[1], operator: match[2], value: parseFloat(match[3]) };
}
```

### Add to GateConstraint (if not present)
```javascript
/**
 * Check if this gate constraint is satisfied by the given axis value.
 * @param {number} axisValue - The value to check against
 * @returns {boolean} True if constraint is satisfied
 */
isSatisfiedBy(axisValue) {
  switch (this.#operator) {
    case '>=': return axisValue >= this.#value;
    case '>': return axisValue > this.#value;
    case '<=': return axisValue <= this.#value;
    case '<': return axisValue < this.#value;
    case '==': return Math.abs(axisValue - this.#value) < 0.0001;
    default: return false;
  }
}
```

### Updated #checkGates in MonteCarloSimulator
```javascript
import GateConstraint from '../models/GateConstraint.js';

#checkGates(gates, normalizedAxes) {
  if (!gates || !Array.isArray(gates) || gates.length === 0) {
    return true;
  }

  for (const gate of gates) {
    let constraint;
    try {
      constraint = GateConstraint.parse(gate);
    } catch {
      continue; // Skip invalid gates
    }

    const axisValue = normalizedAxes[constraint.axis];
    if (axisValue === undefined) continue; // Skip unknown axes

    if (!constraint.isSatisfiedBy(axisValue)) {
      return false;
    }
  }
  return true;
}
```

### Alternative: Use parsed object directly
If adding `isSatisfiedBy()` feels heavyweight, can use parsed object:
```javascript
#checkGates(gates, normalizedAxes) {
  if (!gates || !Array.isArray(gates) || gates.length === 0) {
    return true;
  }

  for (const gate of gates) {
    const parsed = GateConstraint.parse(gate);
    if (!parsed) continue;

    const { axis, operator, value } = parsed;
    const axisValue = normalizedAxes[axis];
    if (axisValue === undefined) continue;

    let passes;
    switch (operator) {
      case '>=': passes = axisValue >= value; break;
      case '<=': passes = axisValue <= value; break;
      case '>': passes = axisValue > value; break;
      case '<': passes = axisValue < value; break;
      case '==': passes = Math.abs(axisValue - value) < 0.0001; break;
      default: passes = false;
    }

    if (!passes) return false;
  }
  return true;
}
```

## Verification Commands
```bash
npm run test:unit -- --testPathPattern="monteCarloSimulator"
npm run test:unit -- --testPathPattern="GateConstraint"
npm run typecheck
npx eslint src/expressionDiagnostics/services/MonteCarloSimulator.js src/expressionDiagnostics/models/GateConstraint.js
```

## Dependencies
- **Depends on**: EXPDIAMONCARREFREP-001 (gate parsing consolidation must be done first)
- **Blocks**: None

## Status
Completed (2025-02-14)

## Outcome
- Delegated `MonteCarloSimulator` gate parsing/evaluation to `GateConstraint` with parse-error skipping preserved.
- Removed local `#parseGate`; no changes needed in `GateConstraint` since `isSatisfiedBy` already existed.
- Parsing now aligns with `emotionCalculatorService` regex (edge-case numeric parsing standardized).
