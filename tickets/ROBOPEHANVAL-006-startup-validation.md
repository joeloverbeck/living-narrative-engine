# ROBOPEHANVAL-006: Add Startup Validation for Whitelist/Registry Completeness

## Summary

Add a startup phase validation that compares `KNOWN_OPERATION_TYPES` against the `OperationRegistry` and reports any mismatches as warnings.

## Background

Per the spec's desired behavior:
- After all handlers are registered, compare `KNOWN_OPERATION_TYPES` against registered handlers
- Report any mismatches as warnings:
  - Operation types in whitelist but no handler (missing handlers)
  - Handlers registered but not in whitelist (orphaned handlers - valid but unusual)

This is a diagnostic/developer-experience feature, not a hard failure. It helps catch:
1. New operation types added to whitelist but handler not registered
2. Handler registered but whitelist not updated (unlikely but possible)

## Files to Touch

### Modify

| File | Change |
|------|--------|
| `src/main/` (appropriate bootstrap file) | Add validation call after DI setup |
| `src/dependencyInjection/registrations/` (appropriate file) | Ensure validator is available |

### Create

| File | Purpose |
|------|---------|
| `tests/integration/validation/startupHandlerValidation.integration.test.js` | Integration tests |

### Possibly Create

| File | Purpose |
|------|---------|
| `src/validation/startupValidator.js` | Orchestrates startup validations (if not already exists) |

## Out of Scope

- **DO NOT** modify `operationInterpreter.js`
- **DO NOT** modify `operationRegistry.js`
- **DO NOT** modify `ruleLoader.js`
- **DO NOT** modify `handlerCompletenessValidator.js`
- **DO NOT** make validation failures hard errors (they are warnings)
- **DO NOT** block application startup on validation warnings

## Implementation Details

### Validation Call Location

Find the appropriate place in application startup AFTER:
1. DI container is fully configured
2. All handler registrations are complete
3. BEFORE any rules are loaded/executed

Typical pattern:

```javascript
// In bootstrap/main
async function bootstrap() {
  // ... DI setup ...

  // Validate handler completeness (warnings only)
  validateHandlerCompleteness(container);

  // ... continue with rule loading, etc ...
}
```

### Validation Logic

```javascript
function validateHandlerCompleteness(container) {
  const validator = container.get(tokens.HandlerCompletenessValidator);
  const registry = container.get(tokens.OperationRegistry);
  const logger = container.get(tokens.ILogger);

  const report = validator.validateHandlerRegistryCompleteness(
    KNOWN_OPERATION_TYPES,
    registry
  );

  if (!report.isComplete) {
    if (report.missingHandlers.length > 0) {
      logger.warn(
        `Handler completeness check: ${report.missingHandlers.length} operation types have no handler registered:`,
        report.missingHandlers
      );
    }
    if (report.orphanedHandlers.length > 0) {
      logger.warn(
        `Handler completeness check: ${report.orphanedHandlers.length} handlers registered but not in KNOWN_OPERATION_TYPES:`,
        report.orphanedHandlers
      );
    }
  } else {
    logger.debug('Handler completeness check passed: all operation types have handlers registered.');
  }
}
```

### Configuration Option (Optional Enhancement)

Consider adding a config flag to control this validation:

```javascript
if (config.validateHandlerCompleteness !== false) {
  validateHandlerCompleteness(container);
}
```

This allows disabling in tests or production if needed.

## Acceptance Criteria

### Tests That Must Pass

1. **Integration Tests** (`tests/integration/validation/startupHandlerValidation.integration.test.js`):
   - Validation runs during startup without errors
   - Missing handlers are logged as warnings (not errors)
   - Orphaned handlers are logged as warnings (not errors)
   - Complete registry logs debug message
   - Application startup is NOT blocked by validation warnings

2. **Regression Tests**:
   - Application starts normally
   - `npm run start` works
   - `npm run test:integration` passes

### Invariants That Must Remain True

1. Startup validation is DIAGNOSTIC only - never blocks startup
2. Warnings are logged, not errors (unless explicitly configured otherwise)
3. Validation happens at correct time (after handlers registered, before rules executed)
4. Validation can be disabled via configuration if needed

## Estimated Scope

- ~40 lines of implementation code
- ~60 lines of test code
- Small, focused diff

## Risk Assessment

**LOW RISK**: This is purely additive diagnostic code. It logs warnings but doesn't change behavior. If validation code fails, it should be caught and logged, not crash the app.

## Dependencies

- ROBOPEHANVAL-004 (HandlerCompletenessValidator) must be completed first
- All handler registration tickets should be complete

## Dependents

- None - this is the final diagnostic layer
