# ACTDISDIAFAIFAS-000 – Action Discovery Diagnostics and Fail-Fast Error Messaging (Overview)

## Problem

Action discovery returns empty arrays with **zero diagnostic output** explaining why actions were rejected. Tests in `get_close_facing_away_filter.test.js` silently failed because:

1. `ModTestFixture.createStandardActorTarget()` creates entities with `personal-space-states:closeness` component by default
2. The `get_close` action has `forbidden_components.actor` including `personal-space-states:closeness`
3. Action discovery correctly filtered out the action, but provided **no explanation**
4. Tests appeared to pass silently but with wrong behavior

Additionally, `condition_ref` errors lack context (suggestions, mod source, evaluation chain).

## Desired Outcome

1. **Diagnostics mode** for action discovery (opt-in, zero overhead when disabled)
2. **Enhanced condition_ref errors** with suggestions and context
3. **Test fixture validation** warnings for component conflicts
4. **Fail-fast behavior** for missing conditions (MUST throw, never return false)

## Child Tickets

| Ticket | Title | Dependencies | Layer |
|--------|-------|--------------|-------|
| [ACTDISDIAFAIFAS-001](ACTDISDIAFAIFAS-001-condition-suggestion-service.md) | Condition Suggestion Service | None | 1 |
| [ACTDISDIAFAIFAS-002](ACTDISDIAFAIFAS-002-scope-resolution-error-context.md) | Enhanced ScopeResolutionError Context | None | 1 |
| [ACTDISDIAFAIFAS-005](ACTDISDIAFAIFAS-005-action-index-diagnostic-mode.md) | ActionIndex Diagnostic Mode | None | 1 |
| [ACTDISDIAFAIFAS-002b](ACTDISDIAFAIFAS-002b-filter-resolver-integration.md) | FilterResolver Suggestion Integration | 001, 002 | 2 |
| [ACTDISDIAFAIFAS-003](ACTDISDIAFAIFAS-003-target-component-validator.md) | TargetComponentValidator Detailed Returns | 002 | 2 |
| [ACTDISDIAFAIFAS-004](ACTDISDIAFAIFAS-004-target-required-components-validator.md) | TargetRequiredComponentsValidator Detailed Returns | 002 | 2 |
| [ACTDISDIAFAIFAS-006](ACTDISDIAFAIFAS-006-component-filtering-stage.md) | ComponentFilteringStage Diagnostics | 005 | 3 |
| [ACTDISDIAFAIFAS-007](ACTDISDIAFAIFAS-007-target-validation-stage.md) | TargetComponentValidationStage Diagnostics | 003, 004 | 3 |
| [ACTDISDIAFAIFAS-008](ACTDISDIAFAIFAS-008-action-discovery-service.md) | ActionDiscoveryService Diagnostics Option | 006, 007, 002b | 4 |
| [ACTDISDIAFAIFAS-009](ACTDISDIAFAIFAS-009-mod-test-fixture-warnings.md) | ModTestFixture Component Conflict Warnings | 008 | 5 |
| [ACTDISDIAFAIFAS-010](ACTDISDIAFAIFAS-010-integration-tests.md) | Diagnostic Integration Tests | 008, 009 | 6 |

## Implementation Order

```
Layer 1 (Foundation - Parallel):
  ├── ACTDISDIAFAIFAS-001 (Suggestion Service)
  ├── ACTDISDIAFAIFAS-002 (Error Context)
  └── ACTDISDIAFAIFAS-005 (ActionIndex)

Layer 2 (Validators + Integration - After Layer 1):
  ├── ACTDISDIAFAIFAS-002b (FilterResolver Integration)
  ├── ACTDISDIAFAIFAS-003 (TargetComponentValidator)
  └── ACTDISDIAFAIFAS-004 (TargetRequiredComponentsValidator)

Layer 3 (Pipeline Stages - After Layer 2):
  ├── ACTDISDIAFAIFAS-006 (ComponentFilteringStage)
  └── ACTDISDIAFAIFAS-007 (TargetComponentValidationStage)

Layer 4 (Service Integration):
  └── ACTDISDIAFAIFAS-008 (ActionDiscoveryService)

Layer 5 (Test Infrastructure):
  └── ACTDISDIAFAIFAS-009 (ModTestFixture)

Layer 6 (Integration Tests):
  └── ACTDISDIAFAIFAS-010 (End-to-End Validation)
```

## Global Invariants (Apply to ALL Tickets)

1. **Fail-fast is non-negotiable**: Missing conditions MUST throw, never return false
2. **Diagnostics are opt-in**: Normal execution has zero overhead
3. **Error context is always complete**: Every error includes enough to debug without searching
4. **Test fixtures validate by default**: Warn on conflicts, can be disabled for edge case testing
5. **API Stability**: `getAvailableActions(actorId)` return type remains stable

## Source Specification

See `specs/action-discovery-diagnostics-fail-fast.md` for full requirements.

## Acceptance Criteria

- All child tickets completed
- `npm run test:unit` passes
- `npm run test:integration` passes
- `npm run validate` passes
- Diagnostics mode produces actionable output for the original `get_close` issue
