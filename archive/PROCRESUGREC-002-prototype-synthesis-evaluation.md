# PROCRESUGREC-002: Implement Prototype Synthesis + Predicted Fit Evaluation

## Summary

Add deterministic prototype synthesis and predicted fit evaluation utilities to generate proposed prototype weights/gates and compute fit metrics against stored mood-regime contexts.

## Priority: High | Effort: Medium

## Rationale

The recommendation must propose a concrete prototype and compute predicted fit metrics that align with existing prototype evaluation logic while preserving determinism.

## Dependencies

- PROCRESUGREC-001 (facts builder provides target signature, regime bounds, stored contexts)

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/expressionDiagnostics/services/PrototypeSynthesisService.js` | **Create** |
| `src/expressionDiagnostics/utils/prototypeNameGenerator.js` | **Create** (if no existing helper) |
| `src/expressionDiagnostics/services/PrototypeEvaluationService.js` | **Update** (or reference existing evaluator) |
| `src/expressionDiagnostics/services/PrototypeFitRankingService.js` | **Read-only** (reference for evaluation semantics) |
| `tests/unit/expressionDiagnostics/services/prototypeSynthesisService.test.js` | **Create** |

## Out of Scope

- **DO NOT** modify stored prototype data or mod files
- **DO NOT** change gate parsing or evaluation semantics
- **DO NOT** alter existing fit ranking logic or metrics
- **DO NOT** introduce new UI components

## Implementation Details

- Implement deterministic synthesis algorithm:
  1) Build target vector from `targetSignature` and normalize.
  2) Use anchor prototype weights/gates as baseline or zeros.
  3) Blend `w = w0 + 0.70 * v_norm`.
  4) Regime conflict resolution clamp rules per spec.
  5) Clamp weights to [-1, 1].
  6) Sparsify: keep top 6 by abs(weight), ensure at least 3 non-zero weights.
  7) Gates: start with anchor gates; add up to 3 regime-derived gates; drop unsatisfiable gates; order added gates by importance then axis.
  8) Name: `<modifier>_<base>` with deterministic collision suffixing.
- Implement predicted fit evaluation against `storedMoodRegimeContexts` using existing prototype evaluation logic:
  - gatePassRate
  - mean intensity
  - p95 intensity
  - pAtLeastT for `t*`, `t* - 0.1`, `t* + 0.1` clamped to [0, 1]
  - optional conflict indicators if conflicts are exposed
- Ensure outputs are deterministic with stable ordering and numeric formatting.

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:unit -- tests/unit/expressionDiagnostics/services/prototypeSynthesisService.test.js --coverage=false
```

### Invariants That Must Remain True

- Weights always in [-1, 1].
- At least 3 non-zero weights; max 6 non-zero weights after sparsification.
- Gates are parseable by existing gate parser and satisfiable under regime bounds.
- Predicted fit intensities are finite and in [0, 1].
- Synthesis is deterministic for identical inputs.

## Definition of Done

- [x] `PrototypeSynthesisService` created with deterministic synthesis algorithm.
- [x] Predicted fit evaluation matches existing prototype evaluation semantics.
- [x] Unit tests cover name stability, gate ordering, clamp behavior, and fit metrics.
- [x] No mutation of existing prototypes or contexts.

## Outcome

### Implementation Summary

Successfully implemented the prototype synthesis and evaluation system with the following components:

**Files Created:**
- `src/expressionDiagnostics/utils/prototypeNameGenerator.js` - Deterministic name generation utility
- `src/expressionDiagnostics/services/PrototypeSynthesisService.js` - Main synthesis service with full algorithm
- `tests/unit/expressionDiagnostics/prototypeNameGenerator.test.js` - Name generator unit tests
- `tests/unit/expressionDiagnostics/services/prototypeSynthesisService.test.js` - Synthesis service unit tests

**Files Modified:**
- `src/dependencyInjection/tokens/tokens-diagnostics.js` - Added `IPrototypeSynthesisService` token
- `src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js` - Registered service factory
- `src/expressionDiagnostics/services/index.js` - Added barrel export

### Technical Details

**Synthesis Algorithm (per spec):**
1. Build target vector from `targetSignature` (Map or Object)
2. Normalize to unit vector
3. Blend with anchor weights using 0.70 blend factor
4. Apply regime conflict clamps (threshold 0.10, weight threshold 0.25)
5. Clamp all weights to [-1, 1]
6. Sparsify: keep top 6 by abs(weight), ensure at least 3 non-zero
7. Synthesize gates from anchor + regime-derived (max 3, sorted by importance then axis)
8. Generate deterministic name with collision avoidance

**Predicted Fit Evaluation:**
- `gatePassRate`: Proportion of contexts passing all gates
- `mean`: Average intensity across contexts
- `p95`: 95th percentile intensity
- `pAtLeastT`: Array of `{t, p}` for `[t*-0.1, t*, t*+0.1]` clamped to [0, 1]

### Invariants Verified

- [x] Weights always in [-1, 1]
- [x] 3-6 non-zero weights after sparsification
- [x] Gates parseable by `GateConstraint.parse()`
- [x] Predicted fit intensities finite and in [0, 1]
- [x] Deterministic for identical inputs

### Test Results

```
Test Suites: 2 passed, 2 total
Tests:       60 passed, 60 total
Coverage: PrototypeSynthesisService.js - 96.34% statements, 97.43% lines
Coverage: prototypeNameGenerator.js - 100% statements, 100% lines
```

### Discrepancy Noted

The ticket mentioned `PrototypeEvaluationService` which does not exist. The evaluation logic is implemented as private methods within `PrototypeFitRankingService`. The new `PrototypeSynthesisService` implements evaluation semantics directly (same formulas) without depending on those private methods.
