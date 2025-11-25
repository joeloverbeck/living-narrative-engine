# APPGRAOCCSYS-005: Create UNLOCK_GRABBING Operation Schema and Handler

**Status**: ✅ COMPLETED

**Originating Document**: `brainstorming/appendage-grabbing-occupation-system.md`

## Outcome

### What Was Actually Changed vs Originally Planned

**Key Discovery**: The ticket originally assumed `unlockGrabbingAppendages` utility would return an error when not enough locked appendages exist. Investigation of `src/utils/grabbingUtils.js:178-219` revealed the utility uses **graceful degradation** - it unlocks as many appendages as are available without returning an error. This differs from `lockGrabbingAppendages` which does error on insufficient free appendages.

**Ticket Correction**: Updated acceptance criteria and test template notes to reflect this behavioral difference.

**Implementation Changes**:
1. Handler was implemented to log partial unlocks (when fewer unlocked than requested) as debug info, not errors
2. Tests verify graceful degradation behavior with no error dispatch

**Files Created** (as planned):
- `data/schemas/operations/unlockGrabbing.schema.json`
- `src/logic/operationHandlers/unlockGrabbingHandler.js`
- `tests/unit/logic/operationHandlers/unlockGrabbingHandler.test.js` (25 tests, all passing)

**Files Modified** (as planned, plus one additional):
- `data/schemas/operation.schema.json` - Added `$ref` entry
- `src/dependencyInjection/tokens/tokens-core.js` - Added `UnlockGrabbingHandler` token
- `src/dependencyInjection/registrations/operationHandlerRegistrations.js` - Added factory
- `src/dependencyInjection/registrations/interpreterRegistrations.js` - Added mapping
- `src/utils/preValidationUtils.js` - Added to KNOWN_OPERATION_TYPES
- **`src/configuration/staticConfiguration.js`** - Added schema to schemaFiles array (this was not in the original ticket but was required for schema loading)

**Test Results**:
- 25 unit tests pass
- Schema validation passes
- ESLint passes (warnings only, no errors)

---

## Summary

Create the `UNLOCK_GRABBING` operation that unlocks a specified number of grabbing appendages on an actor, optionally filtering by the held item. This operation is used when an actor drops an item, sheathes a weapon, or releases a held object.

## Dependencies

- APPGRAOCCSYS-001 (anatomy:can_grab component schema) ✅ Verified
- APPGRAOCCSYS-003 (grabbingUtils utility functions) ✅ Verified

## Files to Create

| File | Purpose |
|------|---------|
| `data/schemas/operations/unlockGrabbing.schema.json` | Operation schema |
| `src/logic/operationHandlers/unlockGrabbingHandler.js` | Operation handler |
| `tests/unit/logic/operationHandlers/unlockGrabbingHandler.test.js` | Unit tests |

## Files to Modify

| File | Change |
|------|--------|
| `data/schemas/operation.schema.json` | Add `$ref` to unlockGrabbing.schema.json in anyOf array |
| `src/dependencyInjection/tokens/tokens-core.js` | Add `UnlockGrabbingHandler` token |
| `src/dependencyInjection/registrations/operationHandlerRegistrations.js` | Register handler factory |
| `src/dependencyInjection/registrations/interpreterRegistrations.js` | Map operation type to handler |
| `src/utils/preValidationUtils.js` | Add `'UNLOCK_GRABBING'` to KNOWN_OPERATION_TYPES |

## Out of Scope

- DO NOT create LOCK_GRABBING (handled in APPGRAOCCSYS-004)
- DO NOT modify any entity files
- DO NOT modify any action files
- DO NOT create conditions (handled in APPGRAOCCSYS-009)
- DO NOT create the operator (handled in APPGRAOCCSYS-006)

## Implementation Details

### Operation Schema (`data/schemas/operations/unlockGrabbing.schema.json`)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "schema://living-narrative-engine/operations/unlockGrabbing.schema.json",
  "title": "UNLOCK_GRABBING Operation",
  "description": "Unlocks a specified number of grabbing appendages on an actor, optionally filtering by held item.",
  "allOf": [
    { "$ref": "../base-operation.schema.json" },
    {
      "properties": {
        "type": { "const": "UNLOCK_GRABBING" },
        "parameters": { "$ref": "#/$defs/Parameters" }
      }
    }
  ],
  "$defs": {
    "Parameters": {
      "type": "object",
      "description": "Parameters for the UNLOCK_GRABBING operation.",
      "properties": {
        "actor_id": {
          "type": "string",
          "description": "The ID of the actor whose appendages to unlock"
        },
        "count": {
          "type": "integer",
          "minimum": 1,
          "description": "Number of grabbing appendages to unlock"
        },
        "item_id": {
          "type": "string",
          "description": "Optional: Only unlock appendages holding this specific item"
        }
      },
      "required": ["actor_id", "count"],
      "additionalProperties": false
    }
  }
}
```

### Handler Implementation Pattern

```javascript
// src/logic/operationHandlers/unlockGrabbingHandler.js
/**
 * @file Handler for UNLOCK_GRABBING operation
 *
 * Unlocks a specified number of grabbing appendages on an actor.
 *
 * Operation flow:
 * 1. Validate parameters (actor_id, count)
 * 2. Call unlockGrabbingAppendages utility
 * 3. Log result and dispatch events
 *
 * @see data/schemas/operations/unlockGrabbing.schema.json
 * @see src/utils/grabbingUtils.js
 * @augments BaseOperationHandler
 */

import BaseOperationHandler from './baseOperationHandler.js';
import { unlockGrabbingAppendages } from '../../utils/grabbingUtils.js';
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';

class UnlockGrabbingHandler extends BaseOperationHandler {
  // ... implementation following lockGrabbingHandler.js pattern
}
```

### DI Registration Changes

**tokens-core.js** - Add after existing handler tokens (alphabetically sorted):
```javascript
UnlockGrabbingHandler: 'UnlockGrabbingHandler',
```

**operationHandlerRegistrations.js** - Add import and factory:
```javascript
import UnlockGrabbingHandler from '../../logic/operationHandlers/unlockGrabbingHandler.js';

// In handlerFactories array:
{
  token: tokens.UnlockGrabbingHandler,
  factory: (c) => new UnlockGrabbingHandler({
    logger: c.resolve(tokens.ILogger),
    entityManager: c.resolve(tokens.EntityManager),
    safeEventDispatcher: c.resolve(tokens.SafeEventDispatcher)
  })
}
```

**interpreterRegistrations.js** - Add mapping:
```javascript
registry.register('UNLOCK_GRABBING', bind(tokens.UnlockGrabbingHandler));
```

**preValidationUtils.js** - Add to KNOWN_OPERATION_TYPES (alphabetically):
```javascript
'UNLOCK_GRABBING',
```

**operation.schema.json** - Add $ref in anyOf array (alphabetically):
```json
{ "$ref": "./operations/unlockGrabbing.schema.json" }
```

## Acceptance Criteria

### Tests That Must Pass

1. **Unit Tests**: `tests/unit/logic/operationHandlers/unlockGrabbingHandler.test.js`
   - [x] Successfully unlocks specified count of appendages
   - [x] Filters by item_id when provided
   - [x] Returns early with error dispatch when actor_id missing
   - [x] Returns early with error dispatch when actor_id invalid (non-string)
   - [x] Returns early with error dispatch when count missing
   - [x] Returns early with error dispatch when count < 1
   - [x] **CORRECTED**: Gracefully handles when fewer locked appendages exist than requested (no error, unlocks what's available)
   - [x] Logs successful unlock operation with affected part IDs
   - [x] Clears heldItemId on unlocked appendages (handled by utility)
   - [x] Works correctly when item_id is omitted (unlocks any locked appendages)

**Important Note**: The `unlockGrabbingAppendages` utility function (in `grabbingUtils.js`) does NOT return an error when there aren't enough locked appendages. It gracefully unlocks as many as available. This differs from the lock operation which does return an error for insufficient free appendages.

2. **Integration Tests** (verify registration):
   - [x] `npm run test:ci` passes (validates schema registration)
   - [x] Operation type recognized by preValidation

3. **Existing Tests**: `npm run test:unit` should pass

### Invariants That Must Remain True

1. Follows same handler pattern as `LockGrabbingHandler`
2. Uses `safeDispatchError` for error handling
3. Does not throw exceptions - dispatches errors instead
4. Token naming matches handler class name (no "I" prefix)
5. Schema is referenced in operation.schema.json anyOf
6. Operation type is in preValidationUtils whitelist

## Test File Template

**Note**: The test template below was corrected from the original. The handler uses `unlockGrabbingAppendages` utility which is mocked, not direct entityManager manipulation.

```javascript
// tests/unit/logic/operationHandlers/unlockGrabbingHandler.test.js
// See actual implementation in tests/unit/logic/operationHandlers/unlockGrabbingHandler.test.js
// Pattern follows lockGrabbingHandler.test.js with key difference:
// - unlockGrabbingAppendages returns { success: true, unlockedParts: [] } even when
//   no appendages are available (graceful degradation, no error)
// - Unlike lock operation, unlock always "succeeds" but may unlock fewer than requested
```

## Verification Commands

```bash
# Validate schemas
npm run validate

# Run handler tests
npm run test:unit -- tests/unit/logic/operationHandlers/unlockGrabbingHandler.test.js

# Check DI registration
npm run test:ci

# Type check
npm run typecheck

# Lint modified files
npx eslint src/logic/operationHandlers/unlockGrabbingHandler.js src/dependencyInjection/tokens/tokens-core.js src/dependencyInjection/registrations/operationHandlerRegistrations.js src/dependencyInjection/registrations/interpreterRegistrations.js src/utils/preValidationUtils.js
```
