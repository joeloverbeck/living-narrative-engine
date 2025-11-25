# APPGRAOCCSYS-004: Create LOCK_GRABBING Operation Schema and Handler

**Originating Document**: `brainstorming/appendage-grabbing-occupation-system.md`

## Summary

Create the `LOCK_GRABBING` operation that locks a specified number of grabbing appendages on an actor, optionally associating them with a held item. This operation is used when an actor wields a weapon or picks up an item that requires hands.

## Dependencies

- APPGRAOCCSYS-001 (anatomy:can_grab component schema)
- APPGRAOCCSYS-003 (grabbingUtils utility functions)

## Files to Create

| File | Purpose |
|------|---------|
| `data/schemas/operations/lockGrabbing.schema.json` | Operation schema |
| `src/logic/operationHandlers/lockGrabbingHandler.js` | Operation handler |
| `tests/unit/logic/operationHandlers/lockGrabbingHandler.test.js` | Unit tests |

## Files to Modify

| File | Change |
|------|--------|
| `data/schemas/operation.schema.json` | Add `$ref` to lockGrabbing.schema.json in anyOf array |
| `src/dependencyInjection/tokens/tokens-core.js` | Add `LockGrabbingHandler` token |
| `src/dependencyInjection/registrations/operationHandlerRegistrations.js` | Register handler factory |
| `src/dependencyInjection/registrations/interpreterRegistrations.js` | Map operation type to handler |
| `src/utils/preValidationUtils.js` | Add `'LOCK_GRABBING'` to KNOWN_OPERATION_TYPES |

## Out of Scope

- DO NOT create UNLOCK_GRABBING (handled in APPGRAOCCSYS-005)
- DO NOT modify any entity files
- DO NOT modify any action files
- DO NOT create conditions (handled in APPGRAOCCSYS-009)
- DO NOT create the operator (handled in APPGRAOCCSYS-006)

## Implementation Details

### Operation Schema (`data/schemas/operations/lockGrabbing.schema.json`)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "schema://living-narrative-engine/operations/lockGrabbing.schema.json",
  "title": "LOCK_GRABBING Operation",
  "description": "Locks a specified number of grabbing appendages on an actor, optionally associating them with a held item.",
  "allOf": [
    { "$ref": "../base-operation.schema.json" },
    {
      "properties": {
        "type": { "const": "LOCK_GRABBING" },
        "parameters": { "$ref": "#/$defs/Parameters" }
      }
    }
  ],
  "$defs": {
    "Parameters": {
      "type": "object",
      "description": "Parameters for the LOCK_GRABBING operation.",
      "properties": {
        "actor_id": {
          "type": "string",
          "description": "The ID of the actor whose appendages to lock"
        },
        "count": {
          "type": "integer",
          "minimum": 1,
          "description": "Number of grabbing appendages to lock"
        },
        "item_id": {
          "type": "string",
          "description": "Optional: The ID of the item being held. Will be stored in heldItemId on locked appendages."
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
// src/logic/operationHandlers/lockGrabbingHandler.js
/**
 * @file Handler for LOCK_GRABBING operation
 *
 * Locks a specified number of grabbing appendages on an actor.
 *
 * Operation flow:
 * 1. Validate parameters (actor_id, count)
 * 2. Call lockGrabbingAppendages utility
 * 3. Log result and dispatch events
 *
 * @see data/schemas/operations/lockGrabbing.schema.json
 * @see src/utils/grabbingUtils.js
 * @augments BaseOperationHandler
 */

import BaseOperationHandler from './baseOperationHandler.js';
import { lockGrabbingAppendages } from '../../utils/grabbingUtils.js';
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';

class LockGrabbingHandler extends BaseOperationHandler {
  // ... implementation following lockMovementHandler.js pattern
}
```

### DI Registration Changes

**tokens-core.js** - Add after existing handler tokens (alphabetically sorted):
```javascript
LockGrabbingHandler: 'LockGrabbingHandler',
```

**operationHandlerRegistrations.js** - Add import and factory:
```javascript
import LockGrabbingHandler from '../../logic/operationHandlers/lockGrabbingHandler.js';

// In handlerFactories array:
{
  token: tokens.LockGrabbingHandler,
  factory: (c) => new LockGrabbingHandler({
    logger: c.resolve(tokens.ILogger),
    entityManager: c.resolve(tokens.EntityManager),
    safeEventDispatcher: c.resolve(tokens.SafeEventDispatcher)
  })
}
```

**interpreterRegistrations.js** - Add mapping:
```javascript
registry.register('LOCK_GRABBING', bind(tokens.LockGrabbingHandler));
```

**preValidationUtils.js** - Add to KNOWN_OPERATION_TYPES (alphabetically):
```javascript
'LOCK_GRABBING',
```

**operation.schema.json** - Add $ref in anyOf array (alphabetically):
```json
{ "$ref": "./operations/lockGrabbing.schema.json" }
```

## Acceptance Criteria

### Tests That Must Pass

1. **Unit Tests**: `tests/unit/logic/operationHandlers/lockGrabbingHandler.test.js`
   - [ ] Successfully locks specified count of appendages
   - [ ] Associates item_id with locked appendages when provided
   - [ ] Returns early with error dispatch when actor_id missing
   - [ ] Returns early with error dispatch when actor_id invalid (non-string)
   - [ ] Returns early with error dispatch when count missing
   - [ ] Returns early with error dispatch when count < 1
   - [ ] Dispatches error when not enough free appendages
   - [ ] Logs successful lock operation with affected part IDs
   - [ ] Works correctly when item_id is omitted

2. **Integration Tests** (verify registration):
   - [ ] `npm run test:ci` passes (validates schema registration)
   - [ ] Operation type recognized by preValidation

3. **Existing Tests**: `npm run test:unit` should pass

### Invariants That Must Remain True

1. Follows same handler pattern as `LockMovementHandler`
2. Uses `safeDispatchError` for error handling
3. Does not throw exceptions - dispatches errors instead
4. Token naming matches handler class name (no "I" prefix)
5. Schema is referenced in operation.schema.json anyOf
6. Operation type is in preValidationUtils whitelist

## Test File Template

```javascript
// tests/unit/logic/operationHandlers/lockGrabbingHandler.test.js
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import LockGrabbingHandler from '../../../../src/logic/operationHandlers/lockGrabbingHandler.js';

describe('LockGrabbingHandler', () => {
  let handler;
  let mockLogger;
  let mockEntityManager;
  let mockDispatcher;
  let executionContext;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };
    mockEntityManager = {
      getComponentData: jest.fn(),
      addComponent: jest.fn(),
      hasComponent: jest.fn()
    };
    mockDispatcher = {
      dispatch: jest.fn()
    };
    executionContext = { logger: mockLogger };

    handler = new LockGrabbingHandler({
      logger: mockLogger,
      entityManager: mockEntityManager,
      safeEventDispatcher: mockDispatcher
    });
  });

  describe('parameter validation', () => {
    it('should dispatch error when actor_id is missing', async () => {
      await handler.execute({ count: 1 }, executionContext);
      expect(mockDispatcher.dispatch).toHaveBeenCalled();
    });

    it('should dispatch error when count is missing', async () => {
      await handler.execute({ actor_id: 'actor_1' }, executionContext);
      expect(mockDispatcher.dispatch).toHaveBeenCalled();
    });

    it('should dispatch error when count is less than 1', async () => {
      await handler.execute({ actor_id: 'actor_1', count: 0 }, executionContext);
      expect(mockDispatcher.dispatch).toHaveBeenCalled();
    });
  });

  describe('successful execution', () => {
    beforeEach(() => {
      // Setup mock with 2 free hands
      mockEntityManager.getComponentData.mockImplementation((entityId, componentId) => {
        if (componentId === 'anatomy:body') {
          return { body: { parts: { left_hand: 'part_1', right_hand: 'part_2' } } };
        }
        if (componentId === 'anatomy:can_grab') {
          return { locked: false, heldItemId: null, gripStrength: 1.0 };
        }
        return null;
      });
    });

    it('should lock specified number of appendages', async () => {
      await handler.execute({ actor_id: 'actor_1', count: 1 }, executionContext);
      expect(mockEntityManager.addComponent).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Successfully locked')
      );
    });

    it('should associate item_id when provided', async () => {
      await handler.execute(
        { actor_id: 'actor_1', count: 1, item_id: 'sword_1' },
        executionContext
      );
      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        expect.any(String),
        'anatomy:can_grab',
        expect.objectContaining({ heldItemId: 'sword_1' })
      );
    });
  });

  describe('insufficient appendages', () => {
    it('should dispatch error when not enough free appendages', async () => {
      // Setup mock with 0 free hands
      mockEntityManager.getComponentData.mockImplementation((entityId, componentId) => {
        if (componentId === 'anatomy:body') {
          return { body: { parts: { left_hand: 'part_1' } } };
        }
        if (componentId === 'anatomy:can_grab') {
          return { locked: true, heldItemId: 'existing_item', gripStrength: 1.0 };
        }
        return null;
      });

      await handler.execute({ actor_id: 'actor_1', count: 1 }, executionContext);
      expect(mockDispatcher.dispatch).toHaveBeenCalled();
    });
  });
});
```

## Verification Commands

```bash
# Validate schemas
npm run validate

# Run handler tests
npm run test:unit -- tests/unit/logic/operationHandlers/lockGrabbingHandler.test.js

# Check DI registration
npm run test:ci

# Type check
npm run typecheck

# Lint modified files
npx eslint src/logic/operationHandlers/lockGrabbingHandler.js src/dependencyInjection/tokens/tokens-core.js src/dependencyInjection/registrations/operationHandlerRegistrations.js src/dependencyInjection/registrations/interpreterRegistrations.js src/utils/preValidationUtils.js
```
