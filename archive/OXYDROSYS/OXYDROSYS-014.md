# OXYDROSYS-014: Implement RestoreOxygenHandler

## Status: COMPLETED

## Description

Implement the JavaScript handler for the RESTORE_OXYGEN operation.

## Notes/Assumptions

- Operation schema for RESTORE_OXYGEN already exists (OXYDROSYS-013); no schema work needed here.
- Respiratory organ component uses the `breathing-states:respiratory_organ` namespace (match DepleteOxygenHandler).
- When `restoreFull` is false/omitted, use per-organ `restorationRate` if `amount` is not provided (mirrors DepleteOxygenHandler's depletionRate behavior).

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

## Outcome

- Implemented RestoreOxygenHandler with validation, entity resolution, and restoration logic (full restore or amount/restorationRate).
- Added unit tests for restore behavior and edge cases; DI registrations and pre-validation whitelist updated.
- No schema changes were needed because RESTORE_OXYGEN schema already existed from OXYDROSYS-013.
