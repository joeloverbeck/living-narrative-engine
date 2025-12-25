# OXYDROSYS-012: Implement DepleteOxygenHandler

## Status: COMPLETED

## Description

Implement the JavaScript handler for the DEPLETE_OXYGEN operation.

## Files Created

- `src/logic/operationHandlers/depleteOxygenHandler.js`
- `tests/unit/logic/operationHandlers/depleteOxygenHandler.test.js`

## Files Modified

- `src/dependencyInjection/tokens/tokens-core.js` - Added `DepleteOxygenHandler` token
- `src/dependencyInjection/registrations/operationHandlerRegistrations.js` - Registered handler factory
- `src/dependencyInjection/registrations/interpreterRegistrations.js` - Mapped DEPLETE_OXYGEN operation

> **Note**: `src/utils/preValidationUtils.js` already contained `'DEPLETE_OXYGEN'` in KNOWN_OPERATION_TYPES (line 43) - no modification needed.

## Implementation Notes

- **Component ID**: Used `breathing-states:respiratory_organ` (not `breathing:respiratory_organ` as referenced in brainstorming docs)
- Handler resolves entity references using `resolveEntityId` utility with JSON Logic fallback
- Finds respiratory organs by querying entities with `breathing-states:respiratory_organ` component that have `anatomy:part.ownerEntityId` matching target
- Dispatches `breathing-states:oxygen_depleted` event when total oxygen across all organs reaches zero

## Out of Scope

- HypoxiaTickSystem (separate ticket)
- Rules that call this operation
- RESTORE_OXYGEN operation

## Acceptance Criteria

1. **Handler extends BaseOperationHandler** - DONE
2. **Dependencies**: entityManager, logger, safeEventDispatcher, jsonLogicService - DONE
3. **Logic**: Finds respiratory organs via anatomy system, decrements oxygen, dispatches event when depleted - DONE
4. **Error handling**: Graceful handling of entities without respiratory organs - DONE
5. **Tests**: Unit tests with >80% coverage - DONE (28 tests passing)

## Tests That Must Pass

- `npm run test:unit -- tests/unit/logic/operationHandlers/depleteOxygenHandler.test.js` - PASSING (28/28)
- `npm run typecheck` - Pre-existing errors in CLI validation files only

## Invariants

- Token naming: `DepleteOxygenHandler` (no "I" prefix) - DONE
- Alphabetical ordering in all registration files - DONE
- Follows existing handler patterns exactly - DONE

## Outcome

Successfully implemented the DEPLETE_OXYGEN operation handler with:
- Full handler implementation following BaseOperationHandler pattern
- DI token and factory registration
- Operation mapping in interpreter registrations
- Comprehensive unit test suite (28 tests)
- All tests passing
- ESLint clean (only pre-existing warnings about mod-architecture that are consistent with other anatomy-related handlers)
