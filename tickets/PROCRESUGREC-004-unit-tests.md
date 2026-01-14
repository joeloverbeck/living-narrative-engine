# PROCRESUGREC-004: Add Unit Tests for Prototype Creation Recommendation

## Summary

Expand unit test coverage for the prototype creation recommendation, including emission rules, synthesis determinism, gate generation, and clamp behaviors.

## Priority: Medium | Effort: Medium

## Rationale

The recommendation logic includes multiple condition branches and deterministic synthesis rules that need explicit regression coverage.

## Dependencies

- PROCRESUGREC-002 (synthesis utilities)
- PROCRESUGREC-003 (recommendation emission)

## Files to Touch

| File | Change Type |
|------|-------------|
| `tests/unit/expressionDiagnostics/services/recommendationEngine.test.js` | **Update** |
| `tests/unit/expressionDiagnostics/services/prototypeSynthesisService.test.js` | **Update** |
| `tests/unit/expressionDiagnostics/fixtures/prototypeCreateSuggestion.js` | **Create** (if fixture utilities needed) |

## Out of Scope

- **DO NOT** add integration tests or end-to-end flows
- **DO NOT** modify production service implementations beyond test hooks
- **DO NOT** update any data/mod fixtures

## Implementation Details

- Add unit test cases:
  - Emits when A && B true (no usable prototype, strong improvement).
  - Does not emit when usable prototype exists and C not triggered.
  - Does not emit when B fails.
  - Emits when C true and sanity thresholds pass.
  - Deterministic synthesis (name/weights/gates order stable).
  - Weight bounds and sparsity enforcement.
  - Conflict resolution clamps when regime bounds are tight.
  - Gate generation respects satisfiability and ordering rules.
- Use deterministic fixtures with fixed target signatures and regime bounds.
- Ensure tests isolate only new recommendation logic.

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:unit -- tests/unit/expressionDiagnostics/services/recommendationEngine.test.js --coverage=false
npm run test:unit -- tests/unit/expressionDiagnostics/services/prototypeSynthesisService.test.js --coverage=false
```

### Invariants That Must Remain True

- Tests remain deterministic and do not depend on random seeds.
- Existing unit tests for other recommendations continue to pass unchanged.
- No snapshot churn unless explicitly required for new fixtures.

## Definition of Done

- [ ] Unit tests cover A/B/C emission and non-emission paths.
- [ ] Deterministic synthesis tests validate name/weights/gates stability.
- [ ] Clamp/sparsify/gate-satisfiable behaviors are asserted.
- [ ] All unit tests pass for targeted files.
