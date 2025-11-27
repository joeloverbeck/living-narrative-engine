# PERPARHEAANDNARTHR-004: MODIFY_PART_HEALTH Handler Implementation

**Status:** Ready
**Priority:** Critical (Phase 2)
**Estimated Effort:** 1 day
**Dependencies:**
- PERPARHEAANDNARTHR-001 (Part Health Component)
- PERPARHEAANDNARTHR-003 (MODIFY_PART_HEALTH Schema)

---

## Objective

Implement the `ModifyPartHealthHandler` operation handler that changes a body part's health value by a delta amount, clamps to valid bounds, and dispatches the `anatomy:part_health_changed` event.

---

## Files to Touch

### New Files
- `src/logic/operationHandlers/modifyPartHealthHandler.js`
- `tests/unit/logic/operationHandlers/modifyPartHealthHandler.test.js`

### Modified Files
- None (DI registration in separate ticket)

---

## Out of Scope

**DO NOT modify:**
- Any existing operation handlers
- Any DI registration files (covered in PERPARHEAANDNARTHR-005)
- `preValidationUtils.js` (covered in PERPARHEAANDNARTHR-005)
- Any component files
- Any event schema files
- `interpreterRegistrations.js` (covered in PERPARHEAANDNARTHR-005)
- `tokens-core.js` (covered in PERPARHEAANDNARTHR-005)

**DO NOT implement:**
- State recalculation (that's UPDATE_PART_HEALTH_STATE's job)
- Damage type handling (future iteration)
- Armor calculations (future iteration)

---

## Implementation Details

### Handler Structure

Create `src/logic/operationHandlers/modifyPartHealthHandler.js`:

```javascript
/**
 * @file Handler for MODIFY_PART_HEALTH operation
 * @description Changes a body part's health value by a delta amount
 */

import BaseOperationHandler from './baseOperationHandler.js';
import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * @typedef {import('../../entities/entityManager.js').default} EntityManager
 * @typedef {import('../../events/safeEventDispatcher.js').default} SafeEventDispatcher
 * @typedef {import('../jsonLogicEvaluationService.js').default} JsonLogicEvaluationService
 */

class ModifyPartHealthHandler extends BaseOperationHandler {
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
    const { parameters, event, variables } = context;
    const { part_entity_ref, delta, clamp_to_bounds = true } = parameters;

    // Resolve part entity ID
    const partEntityId = this.#resolveEntityRef(part_entity_ref, context);
    if (!partEntityId) {
      throw new Error('MODIFY_PART_HEALTH: Failed to resolve part_entity_ref');
    }

    // Resolve delta value
    const deltaValue = this.#resolveDelta(delta, context);
    if (typeof deltaValue !== 'number' || isNaN(deltaValue)) {
      throw new Error(`MODIFY_PART_HEALTH: Invalid delta value: ${deltaValue}`);
    }

    // Verify entity exists and has part_health component
    const entity = this.#entityManager.getEntityById(partEntityId);
    if (!entity) {
      throw new Error(`MODIFY_PART_HEALTH: Entity not found: ${partEntityId}`);
    }

    if (!this.#entityManager.hasComponent(partEntityId, 'anatomy:part_health')) {
      throw new Error(`MODIFY_PART_HEALTH: Entity ${partEntityId} missing anatomy:part_health component`);
    }

    // Get current health data
    const healthComponent = this.#entityManager.getComponent(partEntityId, 'anatomy:part_health');
    const previousHealth = healthComponent.currentHealth;
    const maxHealth = healthComponent.maxHealth;

    // Calculate new health
    let newHealth = previousHealth + deltaValue;
    if (clamp_to_bounds) {
      newHealth = Math.max(0, Math.min(newHealth, maxHealth));
    }

    // Update component
    this.#entityManager.updateComponent(partEntityId, 'anatomy:part_health', {
      ...healthComponent,
      currentHealth: newHealth
    });

    // Get part type for event payload
    const partType = this.#getPartType(partEntityId);
    const ownerEntityId = this.#getOwnerEntityId(partEntityId);

    // Dispatch health changed event
    this.#eventDispatcher.dispatch('anatomy:part_health_changed', {
      partEntityId,
      ownerEntityId,
      partType,
      previousHealth,
      newHealth,
      maxHealth,
      healthPercentage: (newHealth / maxHealth) * 100,
      delta: deltaValue,
      timestamp: Date.now()
    });

    this._logger.debug(`MODIFY_PART_HEALTH: ${partEntityId} health ${previousHealth} -> ${newHealth} (delta: ${deltaValue})`);
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
   * Resolve delta value (number or JSON Logic)
   * @private
   */
  #resolveDelta(delta, context) {
    if (typeof delta === 'number') {
      return delta;
    }
    if (typeof delta === 'object') {
      return this.#jsonLogicService.evaluate(delta, context);
    }
    return NaN;
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
    // Try to get from anatomy:part component's ownerEntityId if it exists
    if (this.#entityManager.hasComponent(entityId, 'anatomy:part')) {
      const partComponent = this.#entityManager.getComponent(entityId, 'anatomy:part');
      return partComponent.ownerEntityId || null;
    }
    return null;
  }
}

export default ModifyPartHealthHandler;
```

### Unit Test Structure

Create `tests/unit/logic/operationHandlers/modifyPartHealthHandler.test.js` with test cases for:

1. **Positive delta (healing)**
   - Health increases by delta amount
   - Clamped to maxHealth if would exceed

2. **Negative delta (damage)**
   - Health decreases by delta amount
   - Clamped to 0 if would go negative

3. **Clamping behavior**
   - `clamp_to_bounds: true` - respects [0, maxHealth]
   - `clamp_to_bounds: false` - allows overflow (edge case)

4. **Event dispatch**
   - Correct event type dispatched
   - All payload fields present and correct
   - healthPercentage calculated correctly

5. **Error handling**
   - Entity not found → throws Error
   - Missing part_health component → throws Error
   - Invalid delta (non-numeric) → throws Error

6. **JSON Logic resolution**
   - part_entity_ref as JSON Logic expression
   - delta as JSON Logic expression

---

## Acceptance Criteria

### Tests That Must Pass

1. **Unit tests:**
   ```bash
   NODE_ENV=test npx jest tests/unit/logic/operationHandlers/modifyPartHealthHandler.test.js --no-coverage --verbose
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
3. Event payload matches spec REQ-5 exactly
4. Health never goes negative when clamped
5. Health never exceeds maxHealth when clamped
6. No breaking changes to existing systems

---

## Verification Steps

```bash
# 1. Run handler unit tests
NODE_ENV=test npx jest tests/unit/logic/operationHandlers/modifyPartHealthHandler.test.js --no-coverage --verbose

# 2. Run type checking
npm run typecheck

# 3. Run full test suite
npm run test:ci

# 4. Lint the new files
npx eslint src/logic/operationHandlers/modifyPartHealthHandler.js tests/unit/logic/operationHandlers/modifyPartHealthHandler.test.js
```

---

## Reference Files

- Handler pattern: `src/logic/operationHandlers/updateHungerStateHandler.js`
- Base class: `src/logic/operationHandlers/baseOperationHandler.js`
- Event dispatch: `src/events/safeEventDispatcher.js`
- Test pattern: `tests/unit/logic/operationHandlers/updateHungerStateHandler.test.js`
