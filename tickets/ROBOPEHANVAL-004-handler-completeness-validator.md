# ROBOPEHANVAL-004: Create HandlerCompletenessValidator Service

## Summary

Create a validation service that can check whether operations in a rule have registered handlers, and compare the `KNOWN_OPERATION_TYPES` whitelist against the registry.

## Background

The spec requires two validation capabilities:
1. **Rule Validation**: Given a rule, verify all its operations have handlers registered
2. **Registry Validation**: Compare whitelist against registry to find mismatches

This service provides the validation logic; integration into loaders/startup is separate.

## Files to Touch

### Create

| File | Purpose |
|------|---------|
| `src/validation/handlerCompletenessValidator.js` | Validation service implementation |
| `tests/unit/validation/handlerCompletenessValidator.test.js` | Unit tests |

### Modify

| File | Change |
|------|--------|
| `src/dependencyInjection/tokens/tokens-validation.js` (or appropriate token file) | Add DI token if using DI |

## Out of Scope

- **DO NOT** modify `operationInterpreter.js` (that's ROBOPEHANVAL-003)
- **DO NOT** modify `operationRegistry.js` (that's ROBOPEHANVAL-002)
- **DO NOT** modify `ruleLoader.js` (that's ROBOPEHANVAL-005)
- **DO NOT** modify any startup/bootstrap code (that's ROBOPEHANVAL-006)
- **DO NOT** integrate this service anywhere - just create and test it

## Implementation Details

### Service Interface

```javascript
// src/validation/handlerCompletenessValidator.js

import { ConfigurationError } from '../errors/configurationError.js';

/**
 * @typedef {Object} ValidationReport
 * @property {string[]} missingHandlers - Operation types in whitelist but not in registry
 * @property {string[]} orphanedHandlers - Handlers in registry but not in whitelist
 * @property {boolean} isComplete - True if no mismatches
 */

export class HandlerCompletenessValidator {
  #logger;

  constructor({ logger }) {
    this.#logger = logger;
  }

  /**
   * Validates that all operations in a rule have registered handlers.
   * @param {Object} rule - The rule object with actions array
   * @param {Object} registry - The OperationRegistry instance
   * @throws {ConfigurationError} If any operation lacks a handler
   */
  validateRuleHandlerCompleteness(rule, registry) {
    // Implementation
  }

  /**
   * Compares whitelist against registry and reports mismatches.
   * @param {string[]} knownTypes - The KNOWN_OPERATION_TYPES array
   * @param {Object} registry - The OperationRegistry instance
   * @returns {ValidationReport} Report of mismatches
   */
  validateHandlerRegistryCompleteness(knownTypes, registry) {
    // Implementation
  }
}
```

### Key Implementation Notes

1. **Rule Structure**: Rules have `actions` array containing operation objects with `type` property
2. **Use `registry.hasHandler()`**: From ROBOPEHANVAL-002
3. **Use `registry.getRegisteredTypes()`**: Already exists
4. **Error Message Quality**: Include ALL missing handlers in error, not just first one

### Example Error Message

```
Rule 'handle_drop_item' uses operations with no registered handlers:
- UNWIELD_ITEM (no handler registered)
- VALIDATE_INVENTORY_CAPACITY (no handler registered)
```

### Dependency Injection

Consider whether to use DI for this service. If the project pattern is to inject via constructor, follow that pattern. If validation services are typically standalone utilities, match that.

## Acceptance Criteria

### Tests That Must Pass

1. **Unit Tests** (`tests/unit/validation/handlerCompletenessValidator.test.js`):

   **validateRuleHandlerCompleteness tests:**
   - Passes for rule where all operations have handlers
   - Throws `ConfigurationError` for rule with one missing handler
   - Throws `ConfigurationError` listing ALL missing handlers (not just first)
   - Error message includes rule ID
   - Error message includes each missing operation type
   - Handles rules with no actions array gracefully
   - Handles rules with empty actions array (passes validation)
   - Handles nested/conditional operations if present in rule structure

   **validateHandlerRegistryCompleteness tests:**
   - Returns `isComplete: true` when whitelist matches registry exactly
   - Returns missing handlers when whitelist has types not in registry
   - Returns orphaned handlers when registry has types not in whitelist
   - Returns both missing and orphaned when both exist
   - Handles empty whitelist
   - Handles empty registry
   - Both arrays sorted for deterministic comparison

2. **Existing Tests**:
   - `npm run test:unit` passes with no regressions

### Invariants That Must Remain True

1. Validation logic is pure and side-effect free (except logging)
2. Service does not modify rule objects or registry
3. `ConfigurationError` is used for rule validation failures (consistent with spec)
4. Service can be instantiated independently for testing

## Estimated Scope

- ~80 lines of implementation code
- ~150 lines of test code
- Medium-sized, focused diff

## Dependencies

- ROBOPEHANVAL-002 (OperationRegistry hasHandler) should be done first for cleaner implementation
- ROBOPEHANVAL-001 (MissingHandlerError) - NOT a dependency; this uses ConfigurationError for load-time validation

## Dependents

- ROBOPEHANVAL-005 (Rule loader integration) uses `validateRuleHandlerCompleteness`
- ROBOPEHANVAL-006 (Startup validation) uses `validateHandlerRegistryCompleteness`
