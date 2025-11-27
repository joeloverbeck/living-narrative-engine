# ROBOPEHANVAL-005: Integrate Handler Validation into Rule Loader

## Status: ✅ COMPLETED

## Summary

Integrate the `HandlerCompletenessValidator` into the rule loading pipeline so that rules are validated for handler completeness at load time, before they can be executed.

## Background

Per the spec, the desired behavior is:
1. Parse rule JSON
2. For each operation in the rule's actions array:
   - Verify operation type is in `KNOWN_OPERATION_TYPES` (existing behavior)
   - **NEW**: Verify operation type has a registered handler
3. If any operation lacks a handler, throw `ConfigurationError` with clear message

This requires the `OperationRegistry` to be available during rule loading, which may require DI changes.

## Files to Touch

### Modify

| File | Change |
|------|--------|
| `src/loaders/ruleLoader.js` | Add handler validation after rule parsing |
| `src/dependencyInjection/registrations/` (appropriate file) | Register validator, inject registry into loader |

### Create

| File | Purpose |
|------|---------|
| `tests/integration/validation/ruleLoaderHandlerValidation.integration.test.js` | Integration tests |

### Possibly Modify

| File | Change |
|------|--------|
| `src/loaders/ruleLoader.js` constructor | May need to accept `OperationRegistry` or validator as dependency |

## Out of Scope

- **DO NOT** modify `operationInterpreter.js` (that's ROBOPEHANVAL-003)
- **DO NOT** modify `operationRegistry.js` (that's ROBOPEHANVAL-002)
- **DO NOT** modify `handlerCompletenessValidator.js` (that's ROBOPEHANVAL-004)
- **DO NOT** modify startup/bootstrap validation (that's ROBOPEHANVAL-006)
- **DO NOT** change the rule JSON schema or format
- **DO NOT** change how existing rule parsing works

## Implementation Details

### Architecture Decision

There are two approaches:

**Option A: Inject registry into RuleLoader**
```javascript
class RuleLoader {
  constructor({ schemaValidator, operationRegistry, logger }) {
    this.#operationRegistry = operationRegistry;
  }

  _processFetchedItem(item) {
    // ... existing parsing ...
    this.#validateOperationHandlers(rule);
    return rule;
  }
}
```

**Option B: Inject validator service into RuleLoader**
```javascript
class RuleLoader {
  constructor({ schemaValidator, handlerValidator, logger }) {
    this.#handlerValidator = handlerValidator;
  }

  _processFetchedItem(item) {
    // ... existing parsing ...
    this.#handlerValidator.validateRuleHandlerCompleteness(rule, this.#registry);
    return rule;
  }
}
```

**Recommendation**: Option B - use the validator service for separation of concerns. The validator encapsulates the validation logic.

### Validation Timing

Validation should happen in `_processFetchedItem()` AFTER:
1. JSON parsing is complete
2. Schema validation passes
3. Operation type whitelist validation passes (if done here)

But BEFORE:
1. The rule is returned/stored for execution

### Error Handling

The `ConfigurationError` from validation should propagate up and prevent the rule from loading. Do NOT catch and swallow this error.

### DI Registration Order Concern

The `OperationRegistry` must be populated with handlers BEFORE rules are loaded. Verify the DI registration order ensures this. If rules are loaded before handlers are registered, validation will incorrectly fail.

## Acceptance Criteria

### Tests That Must Pass

1. **Integration Tests** (`tests/integration/validation/ruleLoaderHandlerValidation.integration.test.js`):
   - Rule with all valid operations loads successfully
   - Rule with missing handler throws `ConfigurationError`
   - Error message identifies the rule and missing operation type
   - Multiple rules can be loaded, all validated
   - Rule that previously loaded still loads (regression test)

2. **Regression Tests**:
   - All existing rules in `data/mods/` continue to load
   - `npm run test:integration` passes

3. **Loader Tests**:
   - Existing RuleLoader tests continue to pass
   - New tests verify validation is called during load

### Invariants That Must Remain True

1. Invalid rules do NOT load - they fail with `ConfigurationError`
2. Valid rules continue to load exactly as before
3. Rule JSON format unchanged
4. Loading order: handlers registered → rules loaded → validation passes
5. No silent failures - validation errors propagate

## Estimated Scope

- ~30 lines of implementation changes
- ~80 lines of test code
- Medium complexity due to DI wiring

## Risk Assessment

**MEDIUM RISK**: This changes the rule loading pipeline. Potential issues:
1. DI registration order may need adjustment
2. Some tests may set up rules before handlers
3. Circular dependency potential if not careful

## Dependencies

- ROBOPEHANVAL-002 (hasHandler method) - for validator implementation
- ROBOPEHANVAL-004 (HandlerCompletenessValidator) - must be completed first

## Dependents

- ROBOPEHANVAL-007 (ModTestHandlerFactory) may need updates to ensure handlers are registered before rules in tests

---

## Outcome

### What Was Actually Changed

**1. `src/loaders/ruleLoader.js`** (~20 lines modified):
- Added 2 private fields: `#handlerValidator` and `#operationRegistry`
- Extended constructor to accept 2 optional parameters (with default `null` for backward compatibility)
- Added handler validation call in `_processFetchedItem()` after macro expansion, before storage

**2. `src/dependencyInjection/registrations/loadersRegistrations.js`** (~25 lines added):
- Added import for `HandlerCompletenessValidator`
- Registered `HandlerCompletenessValidator` as singleton factory with logger dependency
- Replaced `registerLoader` helper for RuleLoader with custom factory registration to inject 8 dependencies (original 6 + validator + registry)

**3. `tests/integration/validation/ruleLoaderHandlerValidation.integration.test.js`** (~395 lines created):
- 9 integration tests covering:
  - Valid operations loading successfully
  - Nested IF block validation
  - Missing handler error throwing with ConfigurationError
  - Error message containing rule ID
  - Error message containing operation type
  - Nested IF then_actions missing handlers
  - Backward compatibility without validator
  - Backward compatibility with validator but no registry
  - Multiple missing handlers collection

### Comparison to Original Plan

| Aspect | Planned | Actual |
|--------|---------|--------|
| Implementation lines | ~30 | ~45 |
| Test lines | ~80 | ~395 |
| Architecture | Option B (validator service) | Option B ✓ |
| Validation timing | After macro expansion | After macro expansion ✓ |
| Optional dependencies | Yes | Yes ✓ |
| DI changes required | Yes | Yes ✓ |

### Test Results

All tests pass:
- `tests/unit/loaders/ruleLoader.test.js`: 4/4 passed
- `tests/unit/dependencyInjection/registrations/loadersRegistrations.test.js`: 4/4 passed
- `tests/unit/validation/handlerCompletenessValidator.test.js`: 25/25 passed
- `tests/integration/validation/ruleLoaderHandlerValidation.integration.test.js`: 9/9 passed

### Key Implementation Decisions

1. **Optional parameters with null defaults**: Maintains backward compatibility - existing code creating RuleLoader without validator continues to work
2. **Conditional validation**: Only validates if both `handlerValidator` AND `operationRegistry` are provided
3. **Custom DI registration**: Replaced `registerLoader` helper with direct factory registration since RuleLoader now needs 8 params vs helper's 6 params
