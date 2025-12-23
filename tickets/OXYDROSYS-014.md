# OXYDROSYS-014: Implement RestoreOxygenHandler

## Description

Implement the JavaScript handler for the RESTORE_OXYGEN operation.

## Files to Create

- `src/logic/operationHandlers/restoreOxygenHandler.js`
- `tests/unit/logic/operationHandlers/restoreOxygenHandler.test.js`

## Files to Modify

- `src/dependencyInjection/tokens/tokens-core.js` - Add `RestoreOxygenHandler` token
- `src/dependencyInjection/registrations/operationHandlerRegistrations.js` - Register handler
- `src/dependencyInjection/registrations/interpreterRegistrations.js` - Map operation
- `src/utils/preValidationUtils.js` - Add `'RESTORE_OXYGEN'` to KNOWN_OPERATION_TYPES

## Out of Scope

- Rules that call this operation
- Hypoxia status removal (handled by rule)

## Acceptance Criteria

1. **Handler extends BaseOperationHandler**
2. **Logic**: Restores oxygen to respiratory organs (full or amount)
3. **restoreFull=true**: Sets all organs to oxygenCapacity
4. **Tests**: Unit tests with >80% coverage

## Tests That Must Pass

- `npm run test:unit -- tests/unit/logic/operationHandlers/restoreOxygenHandler.test.js`
- `npm run typecheck`

## Invariants

- Follows DepleteOxygenHandler patterns
- Alphabetical ordering in registration files
