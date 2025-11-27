# Robust Operation Handler Validation Specification

## Context

The Living Narrative Engine uses a rule-based system where game logic is defined in JSON rule files containing sequences of operations. Each operation type (e.g., `UNWIELD_ITEM`, `DROP_ITEM_AT_LOCATION`) requires a corresponding handler class registered in the dependency injection container.

### Current Architecture

```
Rule JSON → SystemLogicInterpreter → OperationInterpreter → OperationRegistry → Handler
```

**Key Files:**
- `src/logic/operationInterpreter.js` - Orchestrates operation execution
- `src/logic/operationRegistry.js` - Stores handler mappings
- `src/utils/preValidationUtils.js` - Contains `KNOWN_OPERATION_TYPES` whitelist
- `src/dependencyInjection/registrations/operationHandlerRegistrations.js` - Handler factory registration
- `src/dependencyInjection/registrations/interpreterRegistrations.js` - Operation type → handler token mapping

### Registration Points (Two Independent Systems)

1. **Load-Time Validation**: `KNOWN_OPERATION_TYPES` whitelist in `preValidationUtils.js` (68+ operation types)
2. **Runtime Handler Lookup**: `operationRegistry.getHandler(opType)` returns handler or undefined

**Critical Gap**: No validation ensures that every whitelisted operation type has an actual handler registered.

## Problem Statement

When operation handlers are missing from the system, execution fails silently. The current behavior at `src/logic/operationInterpreter.js:418-425`:

```javascript
const handler = this.#registry.getHandler(opType);
if (!handler) {
  this.#logger.error(
    `---> HANDLER NOT FOUND for operation type: "${opType}".`
  );
  return;  // ← SILENT FAILURE: returns undefined, execution continues
}
```

### Consequences

1. **Silent Test Failures**: Tests pass (no thrown errors) but expected behaviors don't occur
2. **Difficult Debugging**: Hours spent discovering that a handler was never registered
3. **Production Risk**: Missing handlers could cause game state corruption or unexpected behavior
4. **Maintenance Burden**: Every new operation requires updates to multiple independent files with no cross-validation

### Recent Example

The `UNWIELD_ITEM` handler was implemented but not added to `ModTestHandlerFactory.createHandlersWithItemsSupport()`. Integration tests appeared to pass but the unwield behavior never executed. Root cause discovery required manual code tracing.

## Truth Sources

### Existing Code References

| File | Line | Purpose |
|------|------|---------|
| `src/logic/operationInterpreter.js` | 418-425 | Silent failure point |
| `src/logic/operationRegistry.js` | 83-101 | Handler lookup returns undefined |
| `src/utils/preValidationUtils.js` | 32-99 | `KNOWN_OPERATION_TYPES` whitelist |
| `src/dependencyInjection/registrations/interpreterRegistrations.js` | all | Operation type → handler mappings |
| `tests/common/mods/ModTestHandlerFactory.js` | all | Test infrastructure handler setup |

### Current Validation Flow

```
Load Time:
  rule.json → validateOperationType(type) → checks KNOWN_OPERATION_TYPES → OK/Error

Runtime:
  operation → registry.getHandler(type) → handler OR undefined → silent log if missing
```

## Desired Behavior

### Normal Mode

1. **Rule Loading Phase**:
   - Parse rule JSON
   - For each operation in the rule's actions array:
     - Verify operation type is in `KNOWN_OPERATION_TYPES` (existing behavior)
     - **NEW**: Verify operation type has a registered handler in `OperationRegistry`
   - If any operation lacks a handler, throw `ConfigurationError` with clear message

2. **Startup Phase**:
   - After all handlers are registered:
     - Compare `KNOWN_OPERATION_TYPES` against registered handlers
     - Report any mismatches as warnings (operation types without handlers)
     - Optionally report registered handlers not in whitelist (orphaned handlers)

3. **Runtime Execution**:
   - If a handler is not found (defense-in-depth), throw `MissingHandlerError`
   - Never silently continue execution

### Edge Cases

| Scenario | Desired Behavior |
|----------|------------------|
| Operation type in whitelist but no handler | `ConfigurationError` at rule load time |
| Handler registered but not in whitelist | Warning at startup (valid but unusual) |
| Rule references unknown operation type | `ConfigurationError` at rule load time (existing) |
| Handler throws during execution | Propagate error (existing behavior, unchanged) |
| Test infrastructure missing handler | Same `ConfigurationError` behavior |

### Failure Modes

| Failure Type | Response |
|--------------|----------|
| Missing handler at rule load | `ConfigurationError`: "Rule 'X' uses operation 'Y' but no handler is registered" |
| Missing handler at runtime | `MissingHandlerError`: "Cannot execute operation 'Y': handler not found" |
| Whitelist/registry mismatch | Startup warning with list of mismatched types |

## Invariants

1. **Handler Completeness**: Every operation type in `KNOWN_OPERATION_TYPES` MUST have a handler registered before any rule using that type can load
2. **Fail-Fast**: Missing handlers are critical errors, never warnings
3. **No Silent Failures**: `operationInterpreter.js` must throw, not return undefined
4. **Test Parity**: Test infrastructure handler registration must use the same validation as production

## API Contracts

### New: OperationRegistry Methods

```javascript
/**
 * Check if a handler exists for the given operation type
 * @param {string} operationType - The operation type to check
 * @returns {boolean} True if handler is registered
 */
hasHandler(operationType: string): boolean

/**
 * Get all registered operation types
 * @returns {string[]} Array of registered operation type names
 */
getRegisteredTypes(): string[]
```

### New: Validation Service

```javascript
/**
 * Validates that all operations in a rule have registered handlers
 * @param {Rule} rule - The rule object to validate
 * @param {OperationRegistry} registry - The handler registry
 * @throws {ConfigurationError} If any operation lacks a handler
 */
validateRuleHandlerCompleteness(rule, registry): void

/**
 * Compares whitelist against registry and reports mismatches
 * @param {string[]} knownTypes - The KNOWN_OPERATION_TYPES array
 * @param {OperationRegistry} registry - The handler registry
 * @returns {ValidationReport} Report of mismatches
 */
validateHandlerRegistryCompleteness(knownTypes, registry): ValidationReport
```

### New: Error Types

```javascript
class MissingHandlerError extends Error {
  constructor(operationType: string, ruleId?: string) {
    super(`Cannot execute operation '${operationType}'${ruleId ? ` in rule '${ruleId}'` : ''}: handler not found`);
    this.operationType = operationType;
    this.ruleId = ruleId;
  }
}
```

### Modified: OperationInterpreter

```javascript
// Before (silent failure):
if (!handler) {
  this.#logger.error(`---> HANDLER NOT FOUND for operation type: "${opType}".`);
  return;
}

// After (fail-fast):
if (!handler) {
  throw new MissingHandlerError(opType, this.#currentRuleId);
}
```

## What Can Change

### Implementation Flexibility

| Aspect | Flexibility |
|--------|-------------|
| Validation timing | Can be at rule load, handler registration, or both |
| Error class names | Names can vary, behavior must be fail-fast |
| Whitelist location | Can remain in preValidationUtils or move to dedicated file |
| Startup validation | Can be opt-in via configuration flag |
| Reporting format | Log format and structure flexible |

### Must NOT Change

| Aspect | Requirement |
|--------|-------------|
| Fail-fast behavior | Missing handler = thrown error, not logged warning |
| Rule loading contract | Invalid rules do not load |
| Existing rule JSON format | No changes to rule schema |
| Handler interface | Handlers continue to implement `execute()` |

## Testing Plan

### Unit Tests

**File**: `tests/unit/logic/operationInterpreter.missingHandler.test.js`

| Test Case | Description |
|-----------|-------------|
| Missing handler throws | Verify `MissingHandlerError` is thrown, not silent return |
| Error contains operation type | Error message includes the missing type |
| Error contains rule ID | Error message includes the rule being executed |

**File**: `tests/unit/logic/operationRegistry.completeness.test.js`

| Test Case | Description |
|-----------|-------------|
| hasHandler returns true | For registered handler |
| hasHandler returns false | For unregistered handler |
| getRegisteredTypes | Returns all registered types |

**File**: `tests/unit/validation/handlerValidation.test.js`

| Test Case | Description |
|-----------|-------------|
| Rule with valid operations | Validation passes |
| Rule with missing handler | Throws ConfigurationError |
| Rule with unknown operation | Throws ConfigurationError (existing) |
| Multiple missing handlers | Error lists all missing |

### Integration Tests

**File**: `tests/integration/validation/operationHandlerCompleteness.test.js`

| Test Case | Description |
|-----------|-------------|
| All core operations have handlers | Verify KNOWN_OPERATION_TYPES matches registry |
| Rule loading validates handlers | Rule with fake operation type fails to load |
| Runtime handler check | Defense-in-depth throw behavior |

### Regression Tests

**File**: `tests/integration/loaders/ruleLoaderRegression.test.js`

| Test Case | Description |
|-----------|-------------|
| Existing rules still load | All current mod rules load successfully |
| Handler execution unchanged | Rules execute with same behavior |

### Test Infrastructure Tests

**File**: `tests/unit/common/mods/ModTestHandlerFactory.completeness.test.js`

| Test Case | Description |
|-----------|-------------|
| Items handlers cover required ops | createHandlersWithItemsSupport has all item operations |
| Positioning handlers cover required ops | createHandlersWithPositioningSupport has all positioning operations |
| Handler creation consistency | Test handlers match production handler interfaces |

## Files Summary

### Files to Create

| File | Purpose |
|------|---------|
| `src/errors/missingHandlerError.js` | Custom error class |
| `src/validation/handlerCompletenessValidator.js` | Validation service |
| `tests/unit/logic/operationInterpreter.missingHandler.test.js` | Unit tests |
| `tests/unit/logic/operationRegistry.completeness.test.js` | Unit tests |
| `tests/unit/validation/handlerValidation.test.js` | Unit tests |
| `tests/integration/validation/operationHandlerCompleteness.test.js` | Integration tests |

### Files to Modify

| File | Change |
|------|--------|
| `src/logic/operationInterpreter.js` | Throw instead of silent return |
| `src/logic/operationRegistry.js` | Add `hasHandler()` and `getRegisteredTypes()` |
| `src/loaders/ruleLoader.js` | Add handler validation after parse |
| `tests/common/mods/ModTestHandlerFactory.js` | Use centralized validation |

## Implementation Priority

1. **Phase 1 - Stop Silent Failures**: Modify `operationInterpreter.js` to throw `MissingHandlerError`
2. **Phase 2 - Add Registry Methods**: Add `hasHandler()` and `getRegisteredTypes()` to `OperationRegistry`
3. **Phase 3 - Load-Time Validation**: Add handler validation to rule loading pipeline
4. **Phase 4 - Startup Validation**: Add whitelist/registry comparison at app startup
5. **Phase 5 - Test Infrastructure**: Update `ModTestHandlerFactory` to use same validation

## Success Criteria

1. Missing handler causes immediate, clear error at rule load time
2. Error message identifies: operation type, rule ID, and which handler is missing
3. All existing tests continue to pass
4. No rule can execute an operation without a registered handler
5. Developers adding new operations get immediate feedback if registration is incomplete
