# ROBOPEHANVAL-000: Robust Operation Handler Validation - Overview

## Summary

This epic implements fail-fast validation for operation handler registration, eliminating silent failures when handlers are missing. The goal is to ensure that missing handlers are detected and reported immediately, either at rule load time or at runtime, rather than silently failing.

## Problem Statement

When operation handlers are missing from the system, execution fails silently. The current behavior logs an error but continues execution, leading to:

- Silent test failures (tests pass but expected behaviors don't occur)
- Difficult debugging (hours spent discovering that a handler was never registered)
- Production risk (missing handlers could cause game state corruption)
- Maintenance burden (no cross-validation between whitelist and registry)

## Success Criteria

1. Missing handler causes immediate, clear error at rule load time
2. Error message identifies: operation type, rule ID, and which handler is missing
3. All existing tests continue to pass
4. No rule can execute an operation without a registered handler
5. Developers adding new operations get immediate feedback if registration is incomplete

## Tickets

| Ticket           | Title                                | Priority | Dependencies |
| ---------------- | ------------------------------------ | -------- | ------------ |
| ROBOPEHANVAL-001 | MissingHandlerError Class            | P0       | None         |
| ROBOPEHANVAL-002 | OperationRegistry hasHandler Method  | P0       | None         |
| ROBOPEHANVAL-003 | OperationInterpreter Fail-Fast       | P0       | 001          |
| ROBOPEHANVAL-004 | HandlerCompletenessValidator Service | P1       | 002          |
| ROBOPEHANVAL-005 | Rule Loader Validation Integration   | P1       | 004          |
| ROBOPEHANVAL-006 | Startup Validation                   | P2       | 004          |
| ROBOPEHANVAL-007 | ModTestHandlerFactory Integration    | P1       | 003          |

## Dependency Graph

```
ROBOPEHANVAL-001 (MissingHandlerError)
         │
         └──► ROBOPEHANVAL-003 (OperationInterpreter fail-fast)
                      │
                      └──► ROBOPEHANVAL-007 (ModTestHandlerFactory)

ROBOPEHANVAL-002 (hasHandler method)
         │
         └──► ROBOPEHANVAL-004 (HandlerCompletenessValidator)
                      │
                      ├──► ROBOPEHANVAL-005 (Rule Loader integration)
                      │
                      └──► ROBOPEHANVAL-006 (Startup validation)
```

## Recommended Implementation Order

### Phase 1: Foundational Classes (Parallel)

- **ROBOPEHANVAL-001**: Create `MissingHandlerError` class
- **ROBOPEHANVAL-002**: Add `hasHandler()` to `OperationRegistry`

### Phase 2: Core Behavior Change

- **ROBOPEHANVAL-003**: Make `OperationInterpreter` throw on missing handler
  - HIGH IMPACT: Will cause many tests to fail, revealing broken tests

### Phase 3: Validation Infrastructure

- **ROBOPEHANVAL-004**: Create `HandlerCompletenessValidator` service

### Phase 4: Integration (Parallel after Phase 3)

- **ROBOPEHANVAL-005**: Integrate validation into rule loader
- **ROBOPEHANVAL-006**: Add startup validation
- **ROBOPEHANVAL-007**: Fix test infrastructure

## Risk Assessment

| Risk                                    | Likelihood | Impact | Mitigation                             |
| --------------------------------------- | ---------- | ------ | -------------------------------------- |
| Many tests break after ROBOPEHANVAL-003 | High       | Medium | Expected; reveals broken tests         |
| DI registration order issues            | Medium     | High   | Careful testing of boot sequence       |
| Performance impact of validation        | Low        | Low    | Validation is O(n) on actions, minimal |

## Key Files

| File                                         | Role                                    |
| -------------------------------------------- | --------------------------------------- |
| `src/logic/operationInterpreter.js`          | Runtime execution, silent failure point |
| `src/logic/operationRegistry.js`             | Handler storage and lookup              |
| `src/utils/preValidationUtils.js`            | `KNOWN_OPERATION_TYPES` whitelist       |
| `src/loaders/ruleLoader.js`                  | Rule loading pipeline                   |
| `tests/common/mods/ModTestHandlerFactory.js` | Test infrastructure                     |

## Spec Reference

See `specs/robust-operation-handler-validation.md` for full specification including:

- Detailed current architecture analysis
- API contracts
- Testing plan
- Edge cases and failure modes
