# GOAP-TIER1-008: Action Selector Implementation

**Phase:** 2 (Goal System)
**Timeline:** Weeks 11-12
**Status:** Not Started
**Dependencies:** GOAP-TIER1-007 (Goal Management System)

## Overview

Implement the ActionSelector class that performs greedy action selection toward goals. This class simulates action effects and calculates progress toward goal states to select the best action from available options.

### Validated Assumptions (Corrected from Initial Draft)

The following assumptions have been validated against the production codebase:

1. **EntityManager API:**
   - ✅ `getEntityInstance(instanceId)` - correct method name (NOT `getEntity`)
   - ✅ `hasComponent(instanceId, componentTypeId)` - correct
   - ✅ `getComponentData(instanceId, componentTypeId)` - correct method name (NOT `getComponent`)

2. **GoalStateEvaluator:**
   - ✅ Exists in `src/goap/goals/goalStateEvaluator.js`
   - ✅ Has `evaluate(goalState, actorId, context)` method
   - ✅ Has `calculateDistance(goalState, actorId, context)` method

3. **DI Tokens:**
   - ✅ `IActionSelector` token already exists in `tokens-goap.js`
   - ⚠️ `IAbstractPreconditionSimulator` token needs to be added

4. **Abstract Preconditions:**
   - ✅ Documented structure: `{ abstractPrecondition: "name", params: [...] }`
   - ✅ Catalog available in `docs/goap/abstract-preconditions.md`

5. **Planning Effects Schema:**
   - ✅ Exists at `data/schemas/planning-effects.schema.json`
   - ✅ Defines CONDITIONAL operation with `condition` and `then` properties
   - ℹ️ No `else` property in schema (optional defensive handling in code is acceptable)

## Objectives

1. Implement ActionSelector class
2. Implement effect simulation
3. Implement progress calculation
4. Implement greedy selection algorithm
5. Integrate with planning effects
6. Handle abstract preconditions

## Technical Details

### Context Building

**Important:** The `context` parameter passed to `selectAction` must be built by the caller from EntityManager. Example structure:

```javascript
// Build context from EntityManager
const context = {
  entities: {},
  targetId: targetEntityId,
  tertiaryTargetId: tertiaryTargetEntityId
};

// Populate entity data for relevant entities
for (const entityId of relevantEntityIds) {
  const entity = entityManager.getEntityInstance(entityId);
  if (entity) {
    context.entities[entityId] = {
      components: {}
    };

    // Copy component data
    const componentIds = entityManager.getAllComponentTypesForEntity(entityId);
    for (const componentId of componentIds) {
      const data = entityManager.getComponentData(entityId, componentId);
      if (data) {
        context.entities[entityId].components[componentId] = data;
      }
    }
  }
}
```

This context building will typically be done by the planner or action selection orchestrator, not by ActionSelector itself.

### 1. ActionSelector Class

**File:** `src/goap/selection/actionSelector.js`

```javascript
/**
 * @file Action selector for GOAP planning
 * Selects actions that move toward goals using greedy selection
 */

import { validateDependency, assertPresent } from '../../utils/dependencyUtils.js';
import { string } from '../../utils/validationCore.js';

/**
 * Selects best action to move toward goal (greedy)
 */
class ActionSelector {
  #logger;
  #goalStateEvaluator;
  #entityManager;
  #abstractPreconditionSimulator;

  /**
   * @param {Object} params - Dependencies
   * @param {Object} params.logger - Logger instance
   * @param {Object} params.goalStateEvaluator - Goal state evaluator
   * @param {Object} params.entityManager - Entity manager
   * @param {Object} params.abstractPreconditionSimulator - Simulator for abstract preconditions
   */
  constructor({
    logger,
    goalStateEvaluator,
    entityManager,
    abstractPreconditionSimulator
  }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug']
    });
    validateDependency(goalStateEvaluator, 'IGoalStateEvaluator', logger, {
      requiredMethods: ['evaluate', 'calculateDistance']
    });
    validateDependency(entityManager, 'IEntityManager', logger, {
      requiredMethods: ['getEntityInstance', 'hasComponent', 'getComponentData']
    });
    validateDependency(abstractPreconditionSimulator, 'IAbstractPreconditionSimulator', logger, {
      requiredMethods: ['simulate']
    });

    this.#logger = logger;
    this.#goalStateEvaluator = goalStateEvaluator;
    this.#entityManager = entityManager;
    this.#abstractPreconditionSimulator = abstractPreconditionSimulator;
  }

  /**
   * Selects best action to move toward goal
   * @param {Array<Object>} availableActions - Actions from action discovery
   * @param {Object} goal - Selected goal
   * @param {string} actorId - Entity ID of actor
   * @param {Object} context - World state context (built by caller from EntityManager)
   *   Expected structure:
   *   {
   *     entities: { [entityId]: { components: { [componentId]: data } } },
   *     targetId: optional target entity ID,
   *     tertiaryTargetId: optional tertiary target entity ID
   *   }
   * @returns {Object|null} Selected action or null
   */
  selectAction(availableActions, goal, actorId, context) {
    assertPresent(availableActions, 'Available actions required');
    assertPresent(goal, 'Goal is required');
    string.assertNonBlank(actorId, 'actorId', 'selectAction', this.#logger);

    this.#logger.debug(`Selecting action for goal ${goal.id} (${availableActions.length} actions available)`);

    try {
      // Step 1: Filter to actions with planning effects
      const plannable = availableActions.filter(a => a.planningEffects);

      if (plannable.length === 0) {
        this.#logger.debug('No plannable actions available');
        return null;
      }

      this.#logger.debug(`${plannable.length} plannable actions found`);

      // Step 2: Calculate progress score for each action
      const scored = plannable.map(action => {
        const score = this.calculateProgress(action, goal, actorId, context);
        return { action, score };
      });

      // Filter out actions with negative or zero progress
      const positive = scored.filter(s => s.score > 0);

      if (positive.length === 0) {
        this.#logger.debug('No actions with positive progress');
        return null;
      }

      // Step 3: Sort by score (descending)
      positive.sort((a, b) => b.score - a.score);

      // Step 4: Return best action
      const selected = positive[0].action;
      this.#logger.info(
        `Selected action ${selected.id} with progress score ${positive[0].score.toFixed(2)}`
      );

      return selected;
    } catch (error) {
      this.#logger.error('Failed to select action', error);
      return null;
    }
  }

  /**
   * Calculates how much an action progresses toward goal
   * @param {Object} action - Action with planningEffects
   * @param {Object} goal - Goal definition
   * @param {string} actorId - Entity ID of actor
   * @param {Object} context - World state context
   * @returns {number} Progress score (higher = better)
   */
  calculateProgress(action, goal, actorId, context) {
    assertPresent(action, 'Action is required');
    assertPresent(goal, 'Goal is required');
    string.assertNonBlank(actorId, 'actorId', 'calculateProgress', this.#logger);

    try {
      // Step 1: Get current distance to goal
      const currentDistance = this.#goalStateEvaluator.calculateDistance(
        goal.goalState,
        actorId,
        context
      );

      // Step 2: Simulate applying action effects
      const futureState = this.simulateEffects(action, actorId, context);

      // Step 3: Get future distance to goal
      const futureDistance = this.#goalStateEvaluator.calculateDistance(
        goal.goalState,
        actorId,
        futureState
      );

      // Step 4: Progress = reduction in distance
      const progress = currentDistance - futureDistance;

      this.#logger.debug(
        `Action ${action.id}: current=${currentDistance}, ` +
        `future=${futureDistance}, progress=${progress}`
      );

      return progress;
    } catch (error) {
      this.#logger.error(`Failed to calculate progress for ${action.id}`, error);
      return 0;
    }
  }

  /**
   * Simulates applying action effects to world state
   *
   * Note: The worldState object is a simulated state structure used during planning,
   * NOT direct access to EntityManager. Structure:
   * {
   *   entities: {
   *     [entityId]: {
   *       components: {
   *         [componentId]: componentData
   *       }
   *     }
   *   },
   *   targetId: string,
   *   tertiaryTargetId: string
   * }
   *
   * @param {Object} action - Action with planningEffects
   * @param {string} actorId - Entity ID of actor
   * @param {Object} currentState - Current world state
   * @returns {Object} Simulated future state
   */
  simulateEffects(action, actorId, currentState) {
    assertPresent(action, 'Action is required');
    string.assertNonBlank(actorId, 'actorId', 'simulateEffects', this.#logger);
    assertPresent(currentState, 'Current state is required');

    if (!action.planningEffects) {
      return currentState;
    }

    try {
      // Create deep copy of current state
      const futureState = this.#cloneState(currentState);

      // Apply each effect
      for (const effect of action.planningEffects.effects) {
        this.#applyEffect(effect, actorId, futureState);
      }

      return futureState;
    } catch (error) {
      this.#logger.error(`Failed to simulate effects for ${action.id}`, error);
      return currentState;
    }
  }

  // Private helper methods

  #cloneState(state) {
    // Deep clone world state
    return JSON.parse(JSON.stringify(state));
  }

  #applyEffect(effect, actorId, state) {
    if (effect.operation === 'CONDITIONAL') {
      // Evaluate condition
      const conditionMet = this.#evaluateCondition(effect.condition, actorId, state);

      if (conditionMet) {
        // Apply then effects
        for (const thenEffect of effect.then) {
          this.#applyEffect(thenEffect, actorId, state);
        }
      } else if (effect.else) {
        // Apply else effects
        for (const elseEffect of effect.else) {
          this.#applyEffect(elseEffect, actorId, state);
        }
      }

      return;
    }

    // Resolve entity ID
    const entityId = this.#resolveEntityId(effect.entity, actorId, state);

    if (effect.operation === 'ADD_COMPONENT') {
      this.#simulateAddComponent(entityId, effect.component, effect.data || {}, state);
    } else if (effect.operation === 'REMOVE_COMPONENT') {
      this.#simulateRemoveComponent(entityId, effect.component, state);
    } else if (effect.operation === 'MODIFY_COMPONENT') {
      this.#simulateModifyComponent(entityId, effect.component, effect.updates, state);
    }
  }

  #evaluateCondition(condition, actorId, state) {
    // Check for abstract precondition structure
    // Format: { abstractPrecondition: "name", params: ["entity1", "entity2"] }
    if (condition.abstractPrecondition) {
      const functionName = condition.abstractPrecondition;
      const rawParams = condition.params || [];

      // Resolve entity references to actual IDs
      const resolvedParams = rawParams.map(param =>
        this.#resolveEntityId(param, actorId, state)
      );

      return this.#abstractPreconditionSimulator.simulate(
        functionName,
        resolvedParams,
        state
      );
    }

    // Fallback: basic JSON Logic evaluation
    // For Tier 1, we'll use a simple implementation
    // Tier 2+ can integrate full JSON Logic evaluator
    this.#logger.warn('Condition evaluation without abstract precondition not fully implemented');
    return true;
  }

  #resolveEntityId(entityRef, actorId, state) {
    if (entityRef === 'actor') return actorId;
    if (entityRef === 'target') return state.targetId;
    if (entityRef === 'tertiary_target') return state.tertiaryTargetId;
    return entityRef;
  }

  #simulateAddComponent(entityId, componentId, data, state) {
    if (!state.entities) state.entities = {};
    if (!state.entities[entityId]) state.entities[entityId] = { components: {} };
    if (!state.entities[entityId].components) state.entities[entityId].components = {};

    state.entities[entityId].components[componentId] = data;
  }

  #simulateRemoveComponent(entityId, componentId, state) {
    if (!state.entities?.[entityId]?.components) return;

    delete state.entities[entityId].components[componentId];
  }

  #simulateModifyComponent(entityId, componentId, updates, state) {
    if (!state.entities?.[entityId]?.components?.[componentId]) return;

    Object.assign(state.entities[entityId].components[componentId], updates);
  }
}

export default ActionSelector;
```

### 2. Abstract Precondition Simulator

**File:** `src/goap/simulation/abstractPreconditionSimulator.js`

```javascript
/**
 * @file Abstract precondition simulator
 * Simulates abstract preconditions during planning
 *
 * Note: This class works with simulated world state during planning,
 * not with live EntityManager queries. The worldState parameter structure:
 * {
 *   entities: {
 *     [entityId]: {
 *       components: {
 *         [componentId]: componentData
 *       }
 *     }
 *   }
 * }
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * Simulates abstract preconditions for planning
 */
class AbstractPreconditionSimulator {
  #logger;

  constructor({ logger }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug']
    });

    this.#logger = logger;
  }

  /**
   * Simulates an abstract precondition
   * @param {string} functionName - Name of abstract function
   * @param {Array} parameters - Function parameters
   * @param {Object} worldState - World state for simulation
   * @returns {boolean} Result of simulation
   */
  simulate(functionName, parameters, worldState) {
    const simulators = {
      hasInventoryCapacity: this.#simulateInventoryCapacity.bind(this),
      hasContainerCapacity: this.#simulateContainerCapacity.bind(this),
      hasComponent: this.#simulateHasComponent.bind(this)
    };

    const simulator = simulators[functionName];
    if (!simulator) {
      this.#logger.warn(`No simulator for abstract function: ${functionName}`);
      return false;
    }

    return simulator(parameters, worldState);
  }

  #simulateInventoryCapacity([actorId, itemId], worldState) {
    // Get actor inventory component
    const inventory = worldState.entities?.[actorId]?.components?.['items:inventory'];
    if (!inventory) return true; // No inventory component, assume unlimited

    // Get item component
    const item = worldState.entities?.[itemId]?.components?.['items:item'];
    if (!item) return false; // Item doesn't exist

    // Calculate current weight
    const currentWeight = this.#calculateTotalWeight(actorId, worldState);
    const itemWeight = item.weight || 0;
    const maxWeight = inventory.max_weight || Infinity;

    return (currentWeight + itemWeight) <= maxWeight;
  }

  #simulateContainerCapacity([containerId, itemId], worldState) {
    // Get container component
    const container = worldState.entities?.[containerId]?.components?.['items:container'];
    if (!container) return false; // Not a container

    // Get item component
    const item = worldState.entities?.[itemId]?.components?.['items:item'];
    if (!item) return false; // Item doesn't exist

    // Check capacity
    const currentCount = container.contents?.length || 0;
    const maxCapacity = container.max_capacity || Infinity;

    return currentCount < maxCapacity;
  }

  #simulateHasComponent([entityId, componentId], worldState) {
    return !!worldState.entities?.[entityId]?.components?.[componentId];
  }

  #calculateTotalWeight(actorId, worldState) {
    const inventory = worldState.entities?.[actorId]?.components?.['items:inventory'];
    if (!inventory?.items) return 0;

    let totalWeight = 0;
    for (const itemId of inventory.items) {
      const item = worldState.entities?.[itemId]?.components?.['items:item'];
      totalWeight += item?.weight || 0;
    }

    return totalWeight;
  }
}

export default AbstractPreconditionSimulator;
```

## Files to Create

- [ ] `src/goap/selection/actionSelector.js`
- [ ] `src/goap/simulation/abstractPreconditionSimulator.js`

## Files to Update

- [ ] `src/dependencyInjection/tokens/tokens-goap.js` - Add IAbstractPreconditionSimulator token (Note: IActionSelector already exists in tokens-goap.js)
- [ ] `src/dependencyInjection/registrations/goapRegistrations.js` - Register ActionSelector and AbstractPreconditionSimulator

## Testing Requirements

### Unit Tests

**File:** `tests/unit/goap/selection/actionSelector.test.js`

- Select action (single action)
- Select action (multiple actions, scored)
- Select action (no plannable actions)
- Select action (no positive progress)
- Calculate progress (positive)
- Calculate progress (zero)
- Calculate progress (negative)
- Simulate effects (ADD_COMPONENT)
- Simulate effects (REMOVE_COMPONENT)
- Simulate effects (MODIFY_COMPONENT)
- Simulate effects (CONDITIONAL)
- Handle abstract preconditions

**File:** `tests/unit/goap/simulation/abstractPreconditionSimulator.test.js`

- Simulate hasInventoryCapacity (success)
- Simulate hasInventoryCapacity (failure - weight limit)
- Simulate hasContainerCapacity (success)
- Simulate hasContainerCapacity (failure - count limit)
- Simulate hasComponent (true)
- Simulate hasComponent (false)
- Unknown simulator function

**Coverage Target:** 90% branches, 95% functions/lines

### Integration Tests

**File:** `tests/integration/goap/actionSelection.integration.test.js`

- Select action for find_food goal
- Select action for rest_safely goal
- Select action with conditional effects
- Select action with abstract preconditions
- Simulate effects on real world state
- Progress calculation with real goal states

## Documentation Requirements

- [ ] JSDoc comments for all public methods
- [ ] JSDoc comments for all private methods
- [ ] Add to `docs/goap/goal-system.md`:
  - Action selection algorithm
  - Effect simulation
  - Progress calculation
  - Abstract preconditions
  - Examples

## Acceptance Criteria

- [ ] ActionSelector class implemented
- [ ] Greedy selection algorithm works
- [ ] Effect simulation accurate
- [ ] Progress calculation accurate
- [ ] Handles conditional effects
- [ ] Simulates abstract preconditions
- [ ] All unit tests pass with 90%+ coverage
- [ ] All integration tests pass
- [ ] ESLint passes
- [ ] TypeScript type checking passes
- [ ] Documentation complete

## Success Metrics

- ✅ Selects best action toward goal
- ✅ Effect simulation matches expected behavior
- ✅ Progress calculation accurate
- ✅ Handles edge cases gracefully
- ✅ Performance < 50ms per actor

## Notes

- **Greedy Selection:** Tier 1 uses greedy selection (no lookahead)
- **State Simulation:** Must be fast and accurate
- **Abstract Preconditions:** Critical for conditional effects
  - Format: `{ abstractPrecondition: "functionName", params: ["entity1", "entity2"] }`
  - See [abstract-preconditions.md](../docs/goap/abstract-preconditions.md) for catalog
- **World State Structure:** Simulation uses a simplified state object with `entities[id].components[componentId]` structure
- **EntityManager Methods:** Production code uses `getEntityInstance()`, `hasComponent()`, `getComponentData()`
- **Extensibility:** Design for future A* planner integration

## Related Tickets

- Depends on: GOAP-TIER1-007 (Goal Management System)
- Blocks: GOAP-TIER1-009 (Simple Planner and Cache)
- Completes Phase 2 (Goal System)
