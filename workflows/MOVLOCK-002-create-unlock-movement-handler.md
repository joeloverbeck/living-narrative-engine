# MOVLOCK-002: Create Unlock Movement Handler

**Status**: NOT_STARTED  
**Priority**: HIGH  
**Dependencies**: MOVLOCK-001 (for reference structure)  
**Estimated Effort**: 0.5 hours

## Context

The unlock movement handler is the counterpart to the lock movement handler. It removes movement restrictions when actors stand up from kneeling position. This handler follows the same structure as lockMovementHandler but calls `updateMovementLock` with `false` to unlock movement.

## Implementation Steps

### 1. Create Handler File

Create `src/logic/operationHandlers/unlockMovementHandler.js` with the following structure:

```javascript
import BaseOperationHandler from './baseOperationHandler.js';
import { updateMovementLock } from '../../utils/movementUtils.js';
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';
import { validateDependency } from '../../utils/validationUtils.js';
import { ensureValidLogger } from '../../utils/loggerUtils.js';

class UnlockMovementHandler extends BaseOperationHandler {
  #entityManager;
  #dispatcher;

  constructor({ logger, entityManager, safeEventDispatcher }) {
    logger = ensureValidLogger(logger, 'UnlockMovementHandler');

    validateDependency(entityManager, 'IEntityManager', null, {
      requiredMethods: ['getComponentData', 'addComponent', 'updateComponent'],
    });

    validateDependency(safeEventDispatcher, 'ISafeEventDispatcher', null, {
      requiredMethods: ['dispatch'],
    });

    super('UnlockMovementHandler', {
      logger: { value: logger },
      entityManager: { value: entityManager },
      safeEventDispatcher: { value: safeEventDispatcher },
    });

    this.#entityManager = entityManager;
    this.#dispatcher = safeEventDispatcher;
  }

  async execute(params, executionContext) {
    const logger = this.getLogger(executionContext);
    const { actor_id } = params || {};

    if (!actor_id) {
      safeDispatchError(
        this.#dispatcher,
        'UNLOCK_MOVEMENT: missing actor_id parameter',
        { params },
        logger
      );
      return;
    }

    try {
      // This utility handles both legacy and anatomy-based entities
      await updateMovementLock(this.#entityManager, actor_id, false);
      logger.debug(
        `[UnlockMovementHandler] Successfully unlocked movement for entity: ${actor_id}`
      );
    } catch (err) {
      safeDispatchError(
        this.#dispatcher,
        `UNLOCK_MOVEMENT: failed to unlock movement for entity ${actor_id}`,
        { actor_id, error: err.message },
        logger
      );
    }
  }
}

export default UnlockMovementHandler;
```

### 2. Key Differences from Lock Handler

- Class name: `UnlockMovementHandler` instead of `LockMovementHandler`
- Logger name: `'UnlockMovementHandler'` in ensureValidLogger
- Operation name: `'UNLOCK_MOVEMENT'` in error messages
- updateMovementLock call: Pass `false` instead of `true`
- Debug message: "Successfully unlocked" instead of "Successfully locked"

### 3. Implementation Checklist

- [ ] Create the handler file in the correct location
- [ ] Copy structure from lockMovementHandler
- [ ] Update class name to UnlockMovementHandler
- [ ] Update logger name in ensureValidLogger call
- [ ] Update error message prefixes to 'UNLOCK_MOVEMENT'
- [ ] Call updateMovementLock with false parameter
- [ ] Update debug log message to reflect unlocking
- [ ] Ensure all imports are correct
- [ ] Maintain identical error handling structure

## Validation Criteria

1. **File exists**: `src/logic/operationHandlers/unlockMovementHandler.js`
2. **Proper structure**: Extends BaseOperationHandler
3. **Correct operation**: Calls updateMovementLock with lock=false
4. **Error messages**: Use 'UNLOCK_MOVEMENT' prefix
5. **Debug logging**: Mentions "unlocked" not "locked"
6. **Consistent structure**: Mirrors lockMovementHandler pattern

## Testing Requirements

After implementation:

1. Run linter: `npm run lint`
2. Check for syntax errors: `npm run build`
3. Compare structure with lockMovementHandler for consistency

## Error Scenarios to Handle

1. **Missing actor_id**: Dispatch error with 'UNLOCK_MOVEMENT' prefix
2. **Entity not found**: Let updateMovementLock handle, catch and dispatch
3. **Already unlocked entity**: Should not error (idempotent operation)
4. **No movement component**: Should handle gracefully via utility

## Notes

- This handler should be nearly identical to lockMovementHandler except for the unlock logic
- The operation should be idempotent - unlocking an already unlocked entity should not cause errors
- Maintain the same validation and error handling patterns
- The utility function handles the complexity of finding and updating movement components

## References

- Paired handler: `src/logic/operationHandlers/lockMovementHandler.js` (MOVLOCK-001)
- Similar unlock pattern: `src/logic/operationHandlers/removeFromClosenessCircleHandler.js`
- Utility function: `src/utils/movementUtils.js::updateMovementLock()`
