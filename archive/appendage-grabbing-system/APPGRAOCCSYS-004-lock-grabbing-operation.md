# APPGRAOCCSYS-004: Create LOCK_GRABBING Operation Schema and Handler

**Originating Document**: `brainstorming/appendage-grabbing-occupation-system.md`

## Summary

Create the `LOCK_GRABBING` operation that locks a specified number of grabbing appendages on an actor, optionally associating them with a held item. This operation is used when an actor wields a weapon or picks up an item that requires hands.

## Dependencies

- APPGRAOCCSYS-001 (anatomy:can_grab component schema)
- APPGRAOCCSYS-003 (grabbingUtils utility functions)

## Files to Create

| File                                                             | Purpose           |
| ---------------------------------------------------------------- | ----------------- |
| `data/schemas/operations/lockGrabbing.schema.json`               | Operation schema  |
| `src/logic/operationHandlers/lockGrabbingHandler.js`             | Operation handler |
| `tests/unit/logic/operationHandlers/lockGrabbingHandler.test.js` | Unit tests        |

## Files to Modify

| File                                                                     | Change                                                     |
| ------------------------------------------------------------------------ | ---------------------------------------------------------- |
| `data/schemas/operation.schema.json`                                     | Add `$ref` to lockGrabbing.schema.json in anyOf array      |
| `src/dependencyInjection/tokens/tokens-core.js`                          | Add `LockGrabbingHandler` token                            |
| `src/dependencyInjection/registrations/operationHandlerRegistrations.js` | Register handler factory                                   |
| `src/dependencyInjection/registrations/interpreterRegistrations.js`      | Map operation type to handler                              |
| `src/utils/preValidationUtils.js`                                        | Add `'LOCK_GRABBING'` to KNOWN_OPERATION_TYPES             |
| `src/configuration/staticConfiguration.js`                               | Add `'lockGrabbing.schema.json'` to OPERATION_SCHEMA_FILES |

## Out of Scope

- DO NOT create UNLOCK_GRABBING (handled in APPGRAOCCSYS-005)
- DO NOT modify any entity files
- DO NOT modify any action files
- DO NOT create conditions (handled in APPGRAOCCSYS-009)
- DO NOT create the operator (handled in APPGRAOCCSYS-006)

## Outcome

**Status**: COMPLETED

**Date**: 2025-11-25

### Implementation Summary

All files were created/modified as specified in the ticket. One additional file modification was discovered during implementation:

- **Additional file modified**: `src/configuration/staticConfiguration.js` - The schema file needed to be added to the `OPERATION_SCHEMA_FILES` array for the schema loader to discover and load it.

### Acceptance Criteria Results

#### Unit Tests (25/25 passing)

| Criterion                                                            | Status  |
| -------------------------------------------------------------------- | ------- |
| Successfully locks specified count of appendages                     | ✅ PASS |
| Associates item_id with locked appendages when provided              | ✅ PASS |
| Returns early with error dispatch when actor_id missing              | ✅ PASS |
| Returns early with error dispatch when actor_id invalid (non-string) | ✅ PASS |
| Returns early with error dispatch when count missing                 | ✅ PASS |
| Returns early with error dispatch when count < 1                     | ✅ PASS |
| Dispatches error when not enough free appendages                     | ✅ PASS |
| Logs successful lock operation with affected part IDs                | ✅ PASS |
| Works correctly when item_id is omitted                              | ✅ PASS |

#### Additional Tests Implemented

- Trim whitespace from actor_id
- Handle count as non-integer (e.g., 1.5)
- Handle count as non-number (e.g., "two")
- Handle null/undefined params
- Handle lockGrabbingAppendages throwing exceptions
- Handle lockGrabbingAppendages throwing non-Error objects
- Logger integration tests (context logger, missing logger)

#### Validation Results

| Validation                          | Status                               |
| ----------------------------------- | ------------------------------------ |
| `npm run validate`                  | ✅ PASS (schema loads and validates) |
| `npm run test:unit` (handler tests) | ✅ PASS (25/25 tests)                |
| `npx eslint` (modified files)       | ✅ PASS (0 errors, warnings only)    |

### Invariants Verification

| Invariant                                                          | Verified |
| ------------------------------------------------------------------ | -------- |
| Follows same handler pattern as `LockMovementHandler`              | ✅       |
| Uses SYSTEM_ERROR_OCCURRED_ID for error handling                   | ✅       |
| Does not throw exceptions - dispatches errors instead              | ✅       |
| Token naming matches handler class name (no "I" prefix)            | ✅       |
| Schema is referenced in operation.schema.json anyOf                | ✅       |
| Operation type is in preValidationUtils whitelist                  | ✅       |
| Schema registered in staticConfiguration.js OPERATION_SCHEMA_FILES | ✅       |

### Files Created

1. `data/schemas/operations/lockGrabbing.schema.json` - Operation schema with actor_id, count, and optional item_id parameters
2. `src/logic/operationHandlers/lockGrabbingHandler.js` - Handler implementation using lockGrabbingAppendages utility
3. `tests/unit/logic/operationHandlers/lockGrabbingHandler.test.js` - 25 comprehensive unit tests

### Files Modified

1. `data/schemas/operation.schema.json` - Added $ref to lockGrabbing.schema.json
2. `src/dependencyInjection/tokens/tokens-core.js` - Added LockGrabbingHandler token
3. `src/dependencyInjection/registrations/operationHandlerRegistrations.js` - Added import and factory
4. `src/dependencyInjection/registrations/interpreterRegistrations.js` - Added operation mapping
5. `src/utils/preValidationUtils.js` - Added LOCK_GRABBING to whitelist
6. `src/configuration/staticConfiguration.js` - Added lockGrabbing.schema.json to OPERATION_SCHEMA_FILES

### Notes

- The ticket was missing the `staticConfiguration.js` modification requirement. This file contains the `OPERATION_SCHEMA_FILES` array that tells the schema loader which operation schemas to load. Without this registration, schema validation fails with `can't resolve reference` errors.
- The handler follows the established pattern from `LockMovementHandler` but delegates to `lockGrabbingAppendages` utility for the actual locking logic.
- Error handling uses event dispatching via `safeEventDispatcher.dispatch(SYSTEM_ERROR_OCCURRED_ID, {...})` rather than throwing exceptions, consistent with project patterns.
