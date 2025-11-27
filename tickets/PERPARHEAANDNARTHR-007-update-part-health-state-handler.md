# PERPARHEAANDNARTHR-007: UPDATE_PART_HEALTH_STATE Handler Implementation

**Status:** Ready
**Priority:** Critical (Phase 3)
**Estimated Effort:** 1 day
**Dependencies:**
- PERPARHEAANDNARTHR-001 (Part Health Component)
- PERPARHEAANDNARTHR-002 (Health Thresholds Lookup)
- PERPARHEAANDNARTHR-006 (UPDATE_PART_HEALTH_STATE Schema)

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
 */

import BaseOperationHandler from './baseOperationHandler.js';
import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * @typedef {import('../../entities/entityManager.js').default} EntityManager
 * @typedef {import('../../events/safeEventDispatcher.js').default} SafeEventDispatcher
 * @typedef {import('../jsonLogicEvaluationService.js').default} JsonLogicEvaluationService
 */

class UpdatePartHealthStateHandler extends BaseOperationHandler {
  /** @type {EntityManager} */
  #entityManager;

  /** @type {SafeEventDispatcher} */
  #eventDispatcher;

  /** @type {JsonLogicEvaluationService} */
  #jsonLogicService;

  /**
   * @param {object} deps
   * @param {EntityManager} deps.entityManager
   * @param {SafeEventDispatcher} deps.eventDispatcher
   * @param {JsonLogicEvaluationService} deps.jsonLogicService
   * @param {object} deps.logger
   */
  constructor({ entityManager, eventDispatcher, jsonLogicService, logger }) {
    super({ logger });

    validateDependency(entityManager, 'IEntityManager', logger, {
      requiredMethods: ['getEntityById', 'hasComponent', 'getComponent', 'updateComponent']
    });
    validateDependency(eventDispatcher, 'ISafeEventDispatcher', logger, {
      requiredMethods: ['dispatch']
    });
    validateDependency(jsonLogicService, 'IJsonLogicEvaluationService', logger, {
      requiredMethods: ['evaluate']
    });

    this.#entityManager = entityManager;
    this.#eventDispatcher = eventDispatcher;
    this.#jsonLogicService = jsonLogicService;
  }

  /**
   * @param {object} context
   * @returns {Promise<void>}
   */
  async execute(context) {
    const { parameters } = context;
    const { part_entity_ref } = parameters;

    // Resolve part entity ID
    const partEntityId = this.#resolveEntityRef(part_entity_ref, context);
    if (!partEntityId) {
      throw new Error('UPDATE_PART_HEALTH_STATE: Failed to resolve part_entity_ref');
    }

    // Verify entity exists and has part_health component
    const entity = this.#entityManager.getEntityById(partEntityId);
    if (!entity) {
      throw new Error(`UPDATE_PART_HEALTH_STATE: Entity not found: ${partEntityId}`);
    }

    if (!this.#entityManager.hasComponent(partEntityId, 'anatomy:part_health')) {
      throw new Error(`UPDATE_PART_HEALTH_STATE: Entity ${partEntityId} missing anatomy:part_health component`);
    }

    // Get current health data
    const healthComponent = this.#entityManager.getComponent(partEntityId, 'anatomy:part_health');
    const { currentHealth, maxHealth, state: previousState, turnsInState } = healthComponent;

    // Calculate percentage and determine new state
    const percentage = (currentHealth / maxHealth) * 100;
    const newState = this.#calculateState(percentage);

    // Determine if state changed
    const stateChanged = newState !== previousState;
    const newTurnsInState = stateChanged ? 0 : (turnsInState || 0) + 1;

    // Update component
    this.#entityManager.updateComponent(partEntityId, 'anatomy:part_health', {
      ...healthComponent,
      state: newState,
      turnsInState: newTurnsInState
    });

    // Dispatch state changed event ONLY if state actually changed
    if (stateChanged) {
      const partType = this.#getPartType(partEntityId);
      const ownerEntityId = this.#getOwnerEntityId(partEntityId);
      const isDeterioration = this.#isDeterioration(previousState, newState);

      this.#eventDispatcher.dispatch('anatomy:part_state_changed', {
        partEntityId,
        ownerEntityId,
        partType,
        previousState,
        newState,
        turnsInPreviousState: turnsInState || 0,
        healthPercentage: percentage,
        isDeterioration,
        timestamp: Date.now()
      });

      this._logger.debug(`UPDATE_PART_HEALTH_STATE: ${partEntityId} state ${previousState} -> ${newState}`);
    } else {
      this._logger.debug(`UPDATE_PART_HEALTH_STATE: ${partEntityId} state unchanged (${newState}), turnsInState: ${newTurnsInState}`);
    }
  }

  /**
   * Calculate state from health percentage
   * @private
   * @param {number} percentage
   * @returns {string}
   */
  #calculateState(percentage) {
    if (percentage > 75) return 'healthy';
    if (percentage > 50) return 'bruised';
    if (percentage > 25) return 'wounded';
    if (percentage > 0) return 'badly_damaged';
    return 'destroyed';
  }

  /**
   * Determine if state change is deterioration (worse health)
   * @private
   * @param {string} previousState
   * @param {string} newState
   * @returns {boolean}
   */
  #isDeterioration(previousState, newState) {
    const stateOrder = ['healthy', 'bruised', 'wounded', 'badly_damaged', 'destroyed'];
    const prevIndex = stateOrder.indexOf(previousState);
    const newIndex = stateOrder.indexOf(newState);
    return newIndex > prevIndex;
  }

  /**
   * Resolve entity reference (string or JSON Logic)
   * @private
   */
  #resolveEntityRef(ref, context) {
    if (typeof ref === 'string') {
      return ref;
    }
    if (typeof ref === 'object') {
      return this.#jsonLogicService.evaluate(ref, context);
    }
    return null;
  }

  /**
   * Get part subType from anatomy:part component
   * @private
   */
  #getPartType(entityId) {
    if (this.#entityManager.hasComponent(entityId, 'anatomy:part')) {
      const partComponent = this.#entityManager.getComponent(entityId, 'anatomy:part');
      return partComponent.subType || 'unknown';
    }
    return 'unknown';
  }

  /**
   * Get owner entity ID (parent character) if determinable
   * @private
   */
  #getOwnerEntityId(entityId) {
    if (this.#entityManager.hasComponent(entityId, 'anatomy:part')) {
      const partComponent = this.#entityManager.getComponent(entityId, 'anatomy:part');
      return partComponent.ownerEntityId || null;
    }
    return null;
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
