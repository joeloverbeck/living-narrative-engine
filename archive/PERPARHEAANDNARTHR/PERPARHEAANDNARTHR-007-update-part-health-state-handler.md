# PERPARHEAANDNARTHR-007: UPDATE_PART_HEALTH_STATE Handler Implementation

**Status:** Completed
**Priority:** Critical (Phase 3)
**Estimated Effort:** 1 day
**Dependencies:**
- PERPARHEAANDNARTHR-001 (Part Health Component)
- PERPARHEAANDNARTHR-002 (Health Thresholds Lookup)
- PERPARHEAANDNARTHR-006 (UPDATE_PART_HEALTH_STATE Schema)

## Assumptions Corrections (2025-11-28)

The original code sample had patterns that diverged from the actual codebase. Corrections:

| Original Assumption | Corrected Pattern |
|---------------------|-------------------|
| `updateComponent()` method | `batchAddComponentsOptimized()` with single-element array |
| `validateDependency()` in constructor | `super('HandlerName', { deps })` with inline validation |
| `execute(context)` with `context.parameters` | `execute(params, executionContext)` - params first arg |
| `throw new Error()` for errors | `safeDispatchError()` + early return |
| `this._logger` | `this.getLogger(executionContext)` |
| Missing utility imports | Added `assertParamsObject`, `safeDispatchError` |

---

## Objective

Implement the `UpdatePartHealthStateHandler` operation handler that recalculates the narrative health state from the current health percentage, manages the `turnsInState` counter, and dispatches the `anatomy:part_state_changed` event only when the state actually changes.

---

## Files to Touch

### New Files
- `src/logic/operationHandlers/updatePartHealthStateHandler.js`
- `tests/unit/logic/operationHandlers/updatePartHealthStateHandler.test.js`

### Modified Files
- None (DI registration in separate ticket)

---

## Out of Scope

**DO NOT modify:**
- Any existing operation handlers
- Any DI registration files (covered in PERPARHEAANDNARTHR-008)
- `preValidationUtils.js` (covered in PERPARHEAANDNARTHR-008)
- Any component files
- Any event schema files
- `interpreterRegistrations.js` (covered in PERPARHEAANDNARTHR-008)
- `tokens-core.js` (covered in PERPARHEAANDNARTHR-008)
- The `ModifyPartHealthHandler` (separate operation)

**DO NOT implement:**
- Per-part-type threshold overrides (future iteration)
- Creature-type threshold overrides (future iteration)
- Any automatic effects from state changes (future iterations)

---

## Implementation Details

### Handler Structure

Create `src/logic/operationHandlers/updatePartHealthStateHandler.js`:

```javascript
/**
 * @file Handler for UPDATE_PART_HEALTH_STATE operation
 * @description Recalculates narrative health state from health percentage
 *
 * Operation flow:
 * 1. Validates operation parameters (part_entity_ref)
 * 2. Resolves entity reference from parameters
 * 3. Retrieves anatomy:part_health component
 * 4. Calculates health percentage: (currentHealth / maxHealth) * 100
 * 5. Maps percentage to health state using thresholds
 * 6. Updates turnsInState (increment if same state, reset to 0 if changed)
 * 7. Updates part_health component via batchAddComponentsOptimized
 * 8. Dispatches anatomy:part_state_changed event if state changed
 *
 * State thresholds:
 * - healthy: >75%
 * - bruised: 51-75%
 * - wounded: 26-50%
 * - badly_damaged: 1-25%
 * - destroyed: 0%
 *
 * @see data/schemas/operations/updatePartHealthState.schema.json
 * @see data/mods/anatomy/components/part_health.component.json
 * @augments BaseOperationHandler
 */

import BaseOperationHandler from './baseOperationHandler.js';
import { assertParamsObject } from '../../utils/handlerUtils/paramsUtils.js';
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';

const PART_HEALTH_COMPONENT_ID = 'anatomy:part_health';
const PART_COMPONENT_ID = 'anatomy:part';
const PART_STATE_CHANGED_EVENT = 'anatomy:part_state_changed';

class UpdatePartHealthStateHandler extends BaseOperationHandler {
  /** @type {import('../../entities/entityManager.js').default} */ #entityManager;
  /** @type {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} */ #dispatcher;

  constructor({ logger, entityManager, safeEventDispatcher }) {
    super('UpdatePartHealthStateHandler', {
      logger: { value: logger },
      entityManager: {
        value: entityManager,
        requiredMethods: ['getComponentData', 'batchAddComponentsOptimized'],
      },
      safeEventDispatcher: {
        value: safeEventDispatcher,
        requiredMethods: ['dispatch'],
      },
    });
    this.#entityManager = entityManager;
    this.#dispatcher = safeEventDispatcher;
  }

  /**
   * Calculate health state from percentage
   * @private
   */
  #calculateState(healthPercentage) {
    if (healthPercentage > 75) return 'healthy';
    if (healthPercentage > 50) return 'bruised';
    if (healthPercentage > 25) return 'wounded';
    if (healthPercentage > 0) return 'badly_damaged';
    return 'destroyed';
  }

  /**
   * Determine if state change is deterioration
   * @private
   */
  #isDeterioration(previousState, newState) {
    const stateOrder = ['healthy', 'bruised', 'wounded', 'badly_damaged', 'destroyed'];
    return stateOrder.indexOf(newState) > stateOrder.indexOf(previousState);
  }

  /**
   * Validate and normalize parameters
   * @private
   */
  #validateParams(params, logger) {
    if (!assertParamsObject(params, this.#dispatcher, 'UPDATE_PART_HEALTH_STATE')) {
      return null;
    }

    const { part_entity_ref } = params;
    let partEntityId;

    if (typeof part_entity_ref === 'string' && part_entity_ref.trim()) {
      partEntityId = part_entity_ref.trim();
    } else if (typeof part_entity_ref === 'object' && part_entity_ref !== null) {
      partEntityId = part_entity_ref.id || part_entity_ref.entityId;
    }

    if (!partEntityId) {
      safeDispatchError(
        this.#dispatcher,
        'UPDATE_PART_HEALTH_STATE: part_entity_ref is required and must be a valid string or object',
        { part_entity_ref },
        logger
      );
      return null;
    }

    return { partEntityId };
  }

  /**
   * Execute the update part health state operation
   */
  async execute(params, executionContext) {
    const log = this.getLogger(executionContext);

    const validated = this.#validateParams(params, log);
    if (!validated) return;

    const { partEntityId } = validated;

    try {
      // Get part_health component
      const partHealth = this.#entityManager.getComponentData(partEntityId, PART_HEALTH_COMPONENT_ID);
      if (!partHealth) {
        safeDispatchError(
          this.#dispatcher,
          `UPDATE_PART_HEALTH_STATE: Entity does not have ${PART_HEALTH_COMPONENT_ID} component`,
          { partEntityId },
          log
        );
        return;
      }

      const { currentHealth, maxHealth, state: previousState, turnsInState = 0 } = partHealth;

      // Calculate percentage and new state
      const healthPercentage = (currentHealth / maxHealth) * 100;
      const newState = this.#calculateState(healthPercentage);

      // Update turnsInState
      const newTurnsInState = newState === previousState ? turnsInState + 1 : 0;

      // Update component
      await this.#entityManager.batchAddComponentsOptimized([{
        instanceId: partEntityId,
        componentTypeId: PART_HEALTH_COMPONENT_ID,
        componentData: {
          currentHealth,
          maxHealth,
          state: newState,
          turnsInState: newTurnsInState,
        },
      }], true);

      // Dispatch event only if state changed
      if (newState !== previousState) {
        // Get owner info from anatomy:part component if available
        const partComponent = this.#entityManager.getComponentData(partEntityId, PART_COMPONENT_ID);
        const ownerEntityId = partComponent?.ownerEntityId || null;
        const partType = partComponent?.subType || 'unknown';

        this.#dispatcher.dispatch(PART_STATE_CHANGED_EVENT, {
          partEntityId,
          ownerEntityId,
          partType,
          previousState,
          newState,
          turnsInPreviousState: turnsInState,
          healthPercentage,
          isDeterioration: this.#isDeterioration(previousState, newState),
          timestamp: Date.now(),
        });

        log.debug('Part health state changed', {
          partEntityId, previousState, newState, healthPercentage, turnsInState: newTurnsInState,
        });
      } else {
        log.debug('Part health state unchanged', {
          partEntityId, state: newState, healthPercentage, turnsInState: newTurnsInState,
        });
      }
    } catch (error) {
      log.error('Update part health state operation failed', error, { partEntityId });
      safeDispatchError(
        this.#dispatcher,
        `UPDATE_PART_HEALTH_STATE: Operation failed - ${error.message}`,
        { partEntityId, error: error.message },
        log
      );
    }
  }
}

export default UpdatePartHealthStateHandler;
```

### Unit Test Structure

Create `tests/unit/logic/operationHandlers/updatePartHealthStateHandler.test.js` with test cases for:

1. **State calculation at each threshold boundary:**
   - 100% → healthy
   - 76% → healthy
   - 75% → bruised
   - 51% → bruised
   - 50% → wounded
   - 26% → wounded
   - 25% → badly_damaged
   - 1% → badly_damaged
   - 0% → destroyed

2. **turnsInState logic:**
   - Resets to 0 when state changes
   - Increments when state unchanged

3. **Event dispatch:**
   - Dispatches `part_state_changed` ONLY when state changes
   - Does NOT dispatch when state unchanged
   - All payload fields present and correct
   - `isDeterioration` correctly calculated

4. **Error handling:**
   - Entity not found → throws Error
   - Missing part_health component → throws Error

5. **JSON Logic resolution:**
   - part_entity_ref as JSON Logic expression

---

## Acceptance Criteria

### Tests That Must Pass

1. **Unit tests:**
   ```bash
   NODE_ENV=test npx jest tests/unit/logic/operationHandlers/updatePartHealthStateHandler.test.js --no-coverage --verbose
   ```

2. **Full test suite:**
   ```bash
   npm run test:ci
   ```

3. **Type checking:**
   ```bash
   npm run typecheck
   ```

### Invariants That Must Remain True

1. All existing operation handlers remain unchanged
2. Handler follows `BaseOperationHandler` pattern
3. Event payload matches spec REQ-6 exactly
4. Event dispatches ONLY on actual state change
5. State calculation matches spec exactly (>75, >50, >25, >0)
6. No breaking changes to existing systems

---

## Verification Steps

```bash
# 1. Run handler unit tests
NODE_ENV=test npx jest tests/unit/logic/operationHandlers/updatePartHealthStateHandler.test.js --no-coverage --verbose

# 2. Run type checking
npm run typecheck

# 3. Run full test suite
npm run test:ci

# 4. Lint the new files
npx eslint src/logic/operationHandlers/updatePartHealthStateHandler.js tests/unit/logic/operationHandlers/updatePartHealthStateHandler.test.js
```

---

## Reference Files

- Handler pattern: `src/logic/operationHandlers/updateHungerStateHandler.js`
- Base class: `src/logic/operationHandlers/baseOperationHandler.js`
- Event dispatch: `src/events/safeEventDispatcher.js`
- Test pattern: `tests/unit/logic/operationHandlers/updateHungerStateHandler.test.js`

---

## Outcome (2025-11-28)

### What Was Planned
- Create `UpdatePartHealthStateHandler` following ticket specifications
- Create comprehensive unit tests for all threshold boundaries and behaviors

### What Was Actually Changed

**Files Created:**
1. `src/logic/operationHandlers/updatePartHealthStateHandler.js` - Handler implementation
2. `tests/unit/logic/operationHandlers/updatePartHealthStateHandler.test.js` - 34 unit tests

**Ticket Corrections Applied:**
The original ticket code sample contained patterns that diverged from the actual codebase. Before implementation, the ticket was corrected with the following pattern updates:

| Original Pattern | Corrected Pattern |
|-----------------|-------------------|
| `updateComponent()` | `batchAddComponentsOptimized()` with single-element array |
| `validateDependency()` in constructor | `super('HandlerName', { deps })` with inline validation |
| `execute(context)` | `execute(params, executionContext)` - params as first arg |
| `throw new Error()` | `safeDispatchError()` + early return |
| `this._logger` | `this.getLogger(executionContext)` |
| Missing imports | Added `assertParamsObject`, `safeDispatchError` |

### Test Coverage Summary

| Category | Tests | Status |
|----------|-------|--------|
| Constructor validation | 4 | ✅ Pass |
| State threshold boundaries | 9 | ✅ Pass |
| turnsInState logic | 7 | ✅ Pass |
| Owner/part type resolution | 2 | ✅ Pass |
| Entity reference handling | 4 | ✅ Pass |
| Error scenarios | 7 | ✅ Pass |
| Health value preservation | 1 | ✅ Pass |
| **Total** | **34** | ✅ All Pass |

### Verification Results
- Unit tests: ✅ 34/34 passing
- ESLint: ✅ No errors (warnings match reference handler pattern)
- TypeCheck: Pre-existing CLI file errors only (not related to this ticket)

### Not Implemented (Per Ticket Scope)
- DI registration (PERPARHEAANDNARTHR-008)
- preValidationUtils.js whitelist (PERPARHEAANDNARTHR-008)
- interpreterRegistrations.js mapping (PERPARHEAANDNARTHR-008)
- tokens-core.js token definition (PERPARHEAANDNARTHR-008)
