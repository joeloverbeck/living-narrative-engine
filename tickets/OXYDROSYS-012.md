# OXYDROSYS-012: Implement DepleteOxygenHandler

## Description

Implement the JavaScript handler for the DEPLETE_OXYGEN operation.

## Files to Create

- `src/logic/operationHandlers/depleteOxygenHandler.js`
- `tests/unit/logic/operationHandlers/depleteOxygenHandler.test.js`

## Files to Modify

- `src/dependencyInjection/tokens/tokens-core.js` - Add `DepleteOxygenHandler` token
- `src/dependencyInjection/registrations/operationHandlerRegistrations.js` - Register handler
- `src/dependencyInjection/registrations/interpreterRegistrations.js` - Map operation
- `src/utils/preValidationUtils.js` - Add `'DEPLETE_OXYGEN'` to KNOWN_OPERATION_TYPES

## Out of Scope

- HypoxiaTickSystem (separate ticket)
- Rules that call this operation
- RESTORE_OXYGEN operation

## Acceptance Criteria

1. **Handler extends BaseOperationHandler**
2. **Dependencies**: entityManager, logger, eventDispatcher (for dispatching oxygen_depleted event)
3. **Logic**: Finds respiratory organs via anatomy system, decrements oxygen, dispatches event when depleted
4. **Error handling**: Graceful handling of entities without respiratory organs
5. **Tests**: Unit tests with >80% coverage

## Tests That Must Pass

- `npm run test:unit -- tests/unit/logic/operationHandlers/depleteOxygenHandler.test.js`
- `npm run typecheck`

## Invariants

- Token naming: `DepleteOxygenHandler` (no "I" prefix)
- Alphabetical ordering in all registration files
- Follows existing handler patterns exactly
