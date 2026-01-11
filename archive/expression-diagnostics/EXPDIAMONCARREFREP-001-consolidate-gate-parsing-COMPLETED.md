# EXPDIAMONCARREFREP-001: Consolidate Gate Parsing to GateConstraint Model

## Summary
Make `GateConstraint.parse()` the single source of truth for gate string parsing. Have `PrototypeConstraintAnalyzer` and `PrototypeFitRankingService` delegate to this centralized parser instead of maintaining their own `#parseGate` implementations.

## Assumptions & Scope Updates (2025-02-14)
- `GateConstraint.parse()` returns a `GateConstraint` instance and throws on invalid input (it does not return `null`). Callers must catch errors and treat unparsable gates as no-ops.
- Existing unit tests already cover `GateConstraint.parse()` for all operators, whitespace/underscore handling, and invalid inputs; this ticket should not add duplicate parse tests.
- The consolidation must preserve current behavior for invalid gates in downstream services (skip/continue without throwing).
- `GateConstraint` is the default export from `src/expressionDiagnostics/models/GateConstraint.js`.

## Files to Modify

| File | Action | Changes |
|------|--------|---------|
| `src/expressionDiagnostics/models/GateConstraint.js` | Modify (if needed) | Confirm `parse()` handles all operators and edge cases; avoid changes unless a bug is found |
| `src/expressionDiagnostics/services/PrototypeConstraintAnalyzer.js` | Modify | Remove `#parseGate`, import and use `GateConstraint.parse()` with error handling |
| `src/expressionDiagnostics/services/PrototypeFitRankingService.js` | Modify | Remove `#parseGate`, import and use `GateConstraint.parse()` with error handling |

## Out of Scope

- **DO NOT** modify `src/emotions/emotionCalculatorService.js` - This is the core emotion system and changes could affect runtime behavior
- **DO NOT** modify `src/expressionDiagnostics/services/MonteCarloSimulator.js` - Addressed in EXPDIAMONCARREFREP-005
- **DO NOT** modify any UI/controller code
- **DO NOT** change the gate regex pattern itself
- **DO NOT** add new operators beyond: `>=`, `<=`, `>`, `<`, `==`

## Acceptance Criteria

### Tests That Must Pass
1. All existing tests in `tests/unit/expressionDiagnostics/services/prototypeConstraintAnalyzer.test.js`
2. All existing tests in `tests/unit/expressionDiagnostics/services/prototypeFitRankingService.test.js`
3. All existing tests in `tests/unit/expressionDiagnostics/models/GateConstraint.test.js`
4. New/updated unit test: invalid gate strings are safely ignored (no exceptions) in `PrototypeConstraintAnalyzer`

### Invariants That Must Remain True
1. Gate parsing regex pattern: `/^(\w+)\s*(>=|<=|>|<|==)\s*(-?\d*\.?\d+)$/`
2. Return type: `GateConstraint`
3. Invalid gate strings throw in `GateConstraint.parse()`, but callers catch and treat them as unparsable
4. Axis names can contain underscores (e.g., `sex_excitation`)
5. Values can be negative (e.g., `-0.5`)
6. Values can be decimals (e.g., `0.25`)

## Implementation Notes

### Current Duplication
```javascript
// PrototypeConstraintAnalyzer.js (lines 321-330)
#parseGate(gate) {
  const match = gate.match(/^(\w+)\s*(>=|<=|>|<)\s*([-\d.]+)$/);
  if (!match) return null;
  return { axis: match[1], operator: match[2], value: parseFloat(match[3]) };
}

// PrototypeFitRankingService.js (lines 692-701)
#parseGate(gate) {
  const match = gate.match(/^(\w+)\s*(>=|<=|>|<)\s*([-\d.]+)$/);
  if (!match) return null;
  return { axis: match[1], operator: match[2], value: parseFloat(match[3]) };
}
```

### Target Pattern
```javascript
// In both services, replace #parseGate calls with:
import GateConstraint from '../models/GateConstraint.js';

// Usage:
let parsed;
try {
  parsed = GateConstraint.parse(gateString);
} catch (err) {
  continue;
}
const { axis, operator, value } = parsed;
```

## Verification Commands
```bash
npm run test:unit -- --testPathPatterns="prototypeConstraintAnalyzer"
npm run test:unit -- --testPathPatterns="prototypeFitRankingService"
npm run test:unit -- --testPathPatterns="GateConstraint"
npm run typecheck
npx eslint src/expressionDiagnostics/models/GateConstraint.js src/expressionDiagnostics/services/PrototypeConstraintAnalyzer.js src/expressionDiagnostics/services/PrototypeFitRankingService.js
```

## Dependencies
- **Depends on**: None (GateConstraint parse tests already exist in repo)
- **Blocks**: EXPDIAMONCARREFREP-005 (MonteCarloSimulator gate delegation)

## Status
Completed

## Outcome
Consolidated gate parsing in `PrototypeConstraintAnalyzer` and `PrototypeFitRankingService` by delegating to `GateConstraint.parse()` with error handling, added an invalid-gate unit test in `PrototypeConstraintAnalyzer`, and preserved the existing `GateConstraint` implementation rather than modifying it.
