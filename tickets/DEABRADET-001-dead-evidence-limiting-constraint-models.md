# DEABRADET-001: DeadEvidence and LimitingConstraint Data Models

## Description

Create the foundational data models for dead branch evidence and limiting constraint explanations following the existing model pattern (pure data classes with factory functions and frozen objects).

## Files to Create

- `src/expressionDiagnostics/models/DeadEvidence.js`
- `src/expressionDiagnostics/models/LimitingConstraint.js`
- `tests/unit/expressionDiagnostics/models/DeadEvidence.test.js`
- `tests/unit/expressionDiagnostics/models/LimitingConstraint.test.js`

## Files to Modify

- `src/expressionDiagnostics/models/index.js` - Add exports for new models

## Out of Scope

- Alternative model (DEABRADET-002)
- OrBlock model (DEABRADET-003)
- Any service logic
- Integration with existing services
- DI token registration (models don't need tokens)

## Implementation Details

### DeadEvidence.js

Must export:
- `DEAD_EVIDENCE_TYPES` - frozen array `['CEILING', 'FLOOR', 'CLAMP_IMPOSSIBLE']`
- `isValidDeadEvidenceType(type)` - validator function
- `createDeadEvidence(props)` - factory function

**DeadEvidence shape**:
```javascript
{
  type: 'CEILING' | 'FLOOR' | 'CLAMP_IMPOSSIBLE',
  clauseRef: string,        // Reference to the leaf clause
  threshold: number,        // The threshold value from the clause
  observedBound: number,    // maxObserved (CEILING) or minObserved (FLOOR)
  gap: number,              // Numeric gap between threshold and bound
  gatePassRate?: number,    // Optional, for CLAMP_IMPOSSIBLE
}
```

### LimitingConstraint.js

Must export:
- `BINDING_TYPES` - frozen array `['positive_weight_low_max', 'negative_weight_high_min']`
- `isValidBindingType(type)` - validator function
- `createLimitingConstraint(props)` - factory function

**LimitingConstraint shape**:
```javascript
{
  constraintClauseRef: string,  // e.g., "moodAxes.arousal <= 45"
  axis: string,                 // The mood axis name
  prototypeWeight: number,      // Weight from prototype definition
  regimeBound: number,          // Bound value from regime constraint
  bindingType: 'positive_weight_low_max' | 'negative_weight_high_min',
  explanation: string,          // Human-readable one-liner
}
```

### Pattern to Follow

Use `src/expressionDiagnostics/models/FitFeasibilityConflict.js` as the template:
- JSDoc file header with @file description
- JSDoc typedefs for all types
- Constants exported as frozen arrays
- Validator functions for each enum type
- Factory function with validation and Object.freeze()

## Acceptance Criteria

### Tests That Must Pass

1. **DeadEvidence.test.js**:
   - `createDeadEvidence()` creates valid object with all required fields
   - `createDeadEvidence()` throws when `type` is missing or invalid
   - `createDeadEvidence()` throws when `clauseRef` is missing
   - `createDeadEvidence()` throws when `threshold` is not a number
   - `createDeadEvidence()` throws when `observedBound` is not a number
   - `createDeadEvidence()` throws when `gap` is not a number
   - `createDeadEvidence()` accepts optional `gatePassRate` for CLAMP_IMPOSSIBLE
   - `isValidDeadEvidenceType()` returns true for valid types
   - `isValidDeadEvidenceType()` returns false for invalid types
   - Created objects are frozen (immutable)
   - `DEAD_EVIDENCE_TYPES` is frozen

2. **LimitingConstraint.test.js**:
   - `createLimitingConstraint()` creates valid object with all required fields
   - `createLimitingConstraint()` throws when `constraintClauseRef` is missing
   - `createLimitingConstraint()` throws when `axis` is missing
   - `createLimitingConstraint()` throws when `prototypeWeight` is not a number
   - `createLimitingConstraint()` throws when `regimeBound` is not a number
   - `createLimitingConstraint()` throws when `bindingType` is invalid
   - `createLimitingConstraint()` throws when `explanation` is missing
   - `isValidBindingType()` returns true for valid types
   - `isValidBindingType()` returns false for invalid types
   - Created objects are frozen (immutable)
   - `BINDING_TYPES` is frozen

### Invariants That Must Remain True

1. All created objects are frozen (Object.isFrozen() === true)
2. Validation errors have descriptive messages naming the invalid field
3. Factory functions are pure (no side effects)
4. JSDoc typedefs match the actual object shapes
5. Existing tests in `tests/unit/expressionDiagnostics/models/` continue to pass
6. `npm run typecheck` passes
7. `npx eslint src/expressionDiagnostics/models/DeadEvidence.js src/expressionDiagnostics/models/LimitingConstraint.js` passes

## Dependencies

None - this is the first ticket in the series.

## Estimated Diff Size

~200 lines of source code + ~300 lines of tests = ~500 lines total
