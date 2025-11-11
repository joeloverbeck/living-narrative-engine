# GOAP-TIER1-007: Goal Management System

**Phase:** 2 (Goal System)
**Timeline:** Weeks 9-10
**Status:** ✅ COMPLETED
**Dependencies:** GOAP-TIER1-005 (Phase 1 complete)

> **Implementation Status**: All components of this workflow have been successfully implemented and tested. This document now serves as reference documentation for the existing goal management system.

## Overview

Implement the goal management system including GoalManager and GoalStateEvaluator. This system selects the highest-priority relevant goal for GOAP actors and evaluates goal satisfaction using JSON Logic conditions. Goals are loaded via IGameDataRepository and evaluated against the current world state.

## Objectives

1. Implement GoalManager class
2. Implement GoalStateEvaluator class
3. Integrate with IGameDataRepository for goal access
4. Support JSON Logic goal states
5. Support component access via `actor.components.*` paths
6. Implement goal selection algorithm
7. Implement goal state evaluation
8. Create goal definition examples

## Technical Details

### 1. GoalManager Class

**File:** `src/goap/goals/goalManager.js`

```javascript
/**
 * @file Goal manager for GOAP planning
 * Selects highest-priority relevant goals for actors
 */

import { validateDependency, assertPresent } from '../../utils/dependencyUtils.js';
import { string } from '../../utils/validationCore.js';

/**
 * Manages goal selection for GOAP actors
 */
class GoalManager {
  #logger;
  #gameDataRepository;
  #goalStateEvaluator;
  #jsonLogicEvaluator;
  #entityManager;

  /**
   * @param {Object} params - Dependencies
   * @param {Object} params.logger - Logger instance
   * @param {Object} params.gameDataRepository - Game data repository
   * @param {Object} params.goalStateEvaluator - Goal state evaluator
   * @param {Object} params.jsonLogicEvaluator - JSON Logic evaluator
   * @param {Object} params.entityManager - Entity manager
   */
  constructor({
    logger,
    gameDataRepository,
    goalStateEvaluator,
    jsonLogicEvaluator,
    entityManager
  }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug']
    });
    validateDependency(gameDataRepository, 'IGameDataRepository', logger, {
      requiredMethods: ['getGoalDefinition', 'getAllGoalDefinitions']
    });
    validateDependency(goalStateEvaluator, 'IGoalStateEvaluator', logger, {
      requiredMethods: ['evaluate', 'calculateDistance']
    });
    validateDependency(jsonLogicEvaluator, 'JsonLogicEvaluationService', logger, {
      requiredMethods: ['evaluate']
    });
    validateDependency(entityManager, 'IEntityManager', logger, {
      requiredMethods: ['getEntityInstance', 'hasComponent', 'getComponentData']
    });

    this.#logger = logger;
    this.#gameDataRepository = gameDataRepository;
    this.#goalStateEvaluator = goalStateEvaluator;
    this.#jsonLogicEvaluator = jsonLogicEvaluator;
    this.#entityManager = entityManager;
  }

  /**
   * Selects the highest-priority relevant goal for an actor
   * @param {string} actorId - Entity ID of actor
   * @param {Object} context - World state context
   * @returns {Object|null} Selected goal or null
   */
  selectGoal(actorId, context) {
    string.assertNonBlank(actorId, 'actorId', 'selectGoal', this.#logger);
    assertPresent(context, 'Context is required');

    this.#logger.debug(`Selecting goal for actor: ${actorId}`);

    try {
      // Step 1: Get all goals for actor
      const goals = this.getGoalsForActor(actorId);

      if (goals.length === 0) {
        this.#logger.debug(`No goals available for ${actorId}`);
        return null;
      }

      // Step 2: Filter to relevant goals
      const relevant = goals.filter(goal =>
        this.isRelevant(goal, actorId, context)
      );

      if (relevant.length === 0) {
        this.#logger.debug(`No relevant goals for ${actorId}`);
        return null;
      }

      // Step 3: Filter out already satisfied goals
      const unsatisfied = relevant.filter(goal =>
        !this.isGoalSatisfied(goal, actorId, context)
      );

      if (unsatisfied.length === 0) {
        this.#logger.debug(`All relevant goals already satisfied for ${actorId}`);
        return null;
      }

      // Step 4: Sort by priority (descending)
      unsatisfied.sort((a, b) => b.priority - a.priority);

      // Step 5: Return highest priority
      const selected = unsatisfied[0];
      this.#logger.info(`Selected goal ${selected.id} (priority ${selected.priority}) for ${actorId}`);

      return selected;
    } catch (error) {
      this.#logger.error(`Failed to select goal for ${actorId}`, error);
      return null;
    }
  }

  /**
   * Evaluates if a goal is relevant for an actor
   * @param {Object} goal - Goal definition
   * @param {string} actorId - Entity ID of actor
   * @param {Object} context - World state context
   * @returns {boolean} True if relevant
   */
  isRelevant(goal, actorId, context) {
    assertPresent(goal, 'Goal is required');
    string.assertNonBlank(actorId, 'actorId', 'isRelevant', this.#logger);

    try {
      if (!goal.relevance) {
        // No relevance condition means always relevant
        return true;
      }

      // Prepare context with actor
      const enrichedContext = {
        ...context,
        actor: this.#entityManager.getEntityInstance(actorId),
        actorId
      };

      // Evaluate relevance condition using JSON Logic
      const result = this.#jsonLogicEvaluator.evaluate(
        goal.relevance,
        enrichedContext
      );

      return !!result;
    } catch (error) {
      this.#logger.error(`Failed to evaluate relevance for goal ${goal.id}`, error);
      return false;
    }
  }

  /**
   * Evaluates if goal state is satisfied
   * @param {Object} goal - Goal definition
   * @param {string} actorId - Entity ID of actor
   * @param {Object} context - World state context
   * @returns {boolean} True if goal achieved
   */
  isGoalSatisfied(goal, actorId, context) {
    assertPresent(goal, 'Goal is required');
    string.assertNonBlank(actorId, 'actorId', 'isGoalSatisfied', this.#logger);

    try {
      return this.#goalStateEvaluator.evaluate(
        goal.goalState,
        actorId,
        context
      );
    } catch (error) {
      this.#logger.error(`Failed to evaluate goal state for ${goal.id}`, error);
      return false;
    }
  }

  /**
   * Gets all goals for an actor's mod set
   * @param {string} actorId - Entity ID of actor
   * @returns {Array<Object>} List of goals
   */
  getGoalsForActor(actorId) {
    string.assertNonBlank(actorId, 'actorId', 'getGoalsForActor', this.#logger);

    try {
      // Get actor's loaded mods
      const actor = this.#entityManager.getEntityInstance(actorId);
      if (!actor) {
        this.#logger.warn(`Actor not found: ${actorId}`);
        return [];
      }

      // For now, get all goals from all loaded mods
      // Could be filtered by actor type/components in future
      const goals = this.#gameDataRepository.getAllGoalDefinitions();

      return goals;
    } catch (error) {
      this.#logger.error(`Failed to get goals for ${actorId}`, error);
      return [];
    }
  }
}

export default GoalManager;
```

### 2. GoalStateEvaluator Class

**File:** `src/goap/goals/goalStateEvaluator.js`

```javascript
/**
 * @file Goal state evaluator for GOAP planning
 * Evaluates goal state conditions using ScopeDSL and JSON Logic
 */

import { validateDependency, assertPresent } from '../../utils/dependencyUtils.js';
import { string } from '../../utils/validationCore.js';

/**
 * Evaluates goal state conditions
 */
class GoalStateEvaluator {
  #logger;
  #jsonLogicEvaluator;
  #entityManager;

  /**
   * @param {Object} params - Dependencies
   * @param {Object} params.logger - Logger instance
   * @param {Object} params.jsonLogicEvaluator - JSON Logic evaluator
   * @param {Object} params.entityManager - Entity manager
   */
  constructor({
    logger,
    jsonLogicEvaluator,
    entityManager
  }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug']
    });
    validateDependency(jsonLogicEvaluator, 'JsonLogicEvaluationService', logger, {
      requiredMethods: ['evaluate']
    });
    validateDependency(entityManager, 'IEntityManager', logger, {
      requiredMethods: ['getEntityInstance', 'hasComponent', 'getComponentData']
    });

    this.#logger = logger;
    this.#jsonLogicEvaluator = jsonLogicEvaluator;
    this.#entityManager = entityManager;
  }

  /**
   * Evaluates if goal state condition is met
   * @param {Object} goalState - Goal state condition (JSON Logic)
   * @param {string} actorId - Entity ID of actor
   * @param {Object} context - World state context
   * @returns {boolean} True if goal state satisfied
   */
  evaluate(goalState, actorId, context) {
    assertPresent(goalState, 'Goal state is required');
    string.assertNonBlank(actorId, 'actorId', 'evaluate', this.#logger);

    try {
      // Goal states are JSON Logic conditions (per goal.schema.json)
      return this.#evaluateJsonLogic(goalState, actorId, context);
    } catch (error) {
      this.#logger.error('Failed to evaluate goal state', error);
      return false;
    }
  }

  /**
   * Calculates distance to goal state (for heuristic)
   * @param {Object} goalState - Goal state condition
   * @param {string} actorId - Entity ID of actor
   * @param {Object} context - World state context
   * @returns {number} Distance metric (0 = satisfied)
   */
  calculateDistance(goalState, actorId, context) {
    assertPresent(goalState, 'Goal state is required');
    string.assertNonBlank(actorId, 'actorId', 'calculateDistance', this.#logger);

    try {
      // If goal satisfied, distance is 0
      if (this.evaluate(goalState, actorId, context)) {
        return 0;
      }

      // For Tier 1, use simple heuristic
      // Tier 2 can implement more sophisticated distance calculation
      return 1;
    } catch (error) {
      this.#logger.error('Failed to calculate distance', error);
      return Infinity;
    }
  }

  // Private helper methods

  #evaluateJsonLogic(logic, actorId, context) {
    // Enrich context with actor entity
    const enrichedContext = {
      ...context,
      actor: this.#entityManager.getEntityInstance(actorId),
      actorId
    };

    // Standard JSON Logic evaluation
    const result = this.#jsonLogicEvaluator.evaluate(logic, enrichedContext);
    return !!result;
  }
}

export default GoalStateEvaluator;
```

### 3. Example Goal Definitions

Create example goals for testing:

**File:** `data/mods/core/goals/find_food.goal.json`

```json
{
  "$schema": "../../../schemas/goal.schema.json",
  "id": "core:find_food",
  "description": "Actor needs to find food when hungry",
  "priority": 80,
  "relevance": {
    "and": [
      { ">=": [{ "var": "actor.components.core:actor" }, null] },
      { "<": [{ "var": "actor.components.core:hunger.value" }, 30] },
      { "!": [{ "var": "actor.components.items:has_food" }] }
    ]
  },
  "goalState": {
    ">=": [{ "var": "actor.components.items:has_food" }, null]
  }
}
```

**File:** `data/mods/core/goals/rest_safely.goal.json`

```json
{
  "$schema": "../../../schemas/goal.schema.json",
  "id": "core:rest_safely",
  "description": "Actor needs to rest when tired",
  "priority": 60,
  "relevance": {
    "and": [
      { ">=": [{ "var": "actor.components.core:actor" }, null] },
      { "<": [{ "var": "actor.components.core:energy.value" }, 40] }
    ]
  },
  "goalState": {
    "and": [
      { ">=": [{ "var": "actor.components.positioning:lying_down" }, null] },
      { ">=": [{ "var": "actor.components.core:energy.value" }, 80] }
    ]
  }
}
```

## Files Created

- [x] `src/goap/goals/goalManager.js` ✅
- [x] `src/goap/goals/goalStateEvaluator.js` ✅
- [x] `data/mods/core/goals/find_food.goal.json` ✅
- [x] `data/mods/core/goals/rest_safely.goal.json` ✅
- [x] `data/mods/core/goals/defeat_enemy.goal.json` ✅

## Files Updated

- [x] `src/dependencyInjection/registrations/goapRegistrations.js` - Registered GoalManager and GoalStateEvaluator ✅

**Registration Example:**

```javascript
import GoalManager from '../../goap/goals/goalManager.js';
import GoalStateEvaluator from '../../goap/goals/goalStateEvaluator.js';

// Add to registerGoapServices function:
container.register(goapTokens.IGoalManager, GoalManager, {
  dependencies: {
    logger: coreTokens.ILogger,
    gameDataRepository: coreTokens.IGameDataRepository,
    goalStateEvaluator: goapTokens.IGoalStateEvaluator,
    jsonLogicEvaluator: coreTokens.JsonLogicEvaluationService,
    entityManager: coreTokens.IEntityManager
  }
});

container.register(goapTokens.IGoalStateEvaluator, GoalStateEvaluator, {
  dependencies: {
    logger: coreTokens.ILogger,
    jsonLogicEvaluator: coreTokens.JsonLogicEvaluationService,
    entityManager: coreTokens.IEntityManager
  }
});
```

## Testing Requirements ✅ COMPLETED

### Unit Tests ✅

**File:** `tests/unit/goap/goals/goalManager.test.js` ✅

- [x] Select goal (single relevant goal) ✅
- [x] Select goal (multiple goals, sorted by priority) ✅
- [x] Select goal (no relevant goals) ✅
- [x] Select goal (all goals satisfied) ✅
- [x] Evaluate relevance (true) ✅
- [x] Evaluate relevance (false) ✅
- [x] Evaluate goal satisfaction (true) ✅
- [x] Evaluate goal satisfaction (false) ✅
- [x] Get goals for actor ✅

**File:** `tests/unit/goap/goals/goalStateEvaluator.test.js` ✅

- [x] Evaluate JSON Logic goal state (true) ✅
- [x] Evaluate JSON Logic goal state (false) ✅
- [x] Evaluate component existence check (true) ✅
- [x] Evaluate component existence check (false) ✅
- [x] Calculate distance (satisfied) ✅
- [x] Calculate distance (unsatisfied) ✅
- [x] Handle composite conditions ✅
- [x] Handle nested component paths ✅

**Coverage Target:** ✅ Achieved - 90%+ branches, 95%+ functions/lines

### Integration Tests ✅

**File:** `tests/integration/goap/goalSelection.integration.test.js` ✅

- [x] Select goal for actor (various scenarios) ✅
- [x] No goal selected when all satisfied ✅
- [x] Goal priority ordering ✅
- [x] Real goal definitions from files ✅
- [x] Component access via `actor.components.*` pattern ✅

## Documentation Requirements

> **Note:** While comprehensive inline code documentation exists, a standalone `docs/goap/goal-system.md` guide would be beneficial for future reference. This can be created as a follow-up task if needed.

## Acceptance Criteria ✅ ALL COMPLETED

- [x] GoalManager class implemented ✅
- [x] GoalStateEvaluator class implemented ✅
- [x] Goal selection algorithm works correctly ✅
- [x] Supports JSON Logic goal states ✅
- [x] Accesses component data via `actor.components.*` paths ✅
- [x] Selects highest priority relevant goal ✅
- [x] Filters out satisfied goals ✅
- [x] Integrates with IGameDataRepository for goal definitions ✅
- [x] All unit tests pass with 90%+ coverage ✅
- [x] All integration tests pass ✅
- [x] Example goal definitions created (find_food, rest_safely, defeat_enemy) ✅
- [x] DI registrations complete (goapRegistrations.js) ✅
- [x] ESLint passes ✅
- [x] TypeScript type checking passes ✅

## Success Metrics

- ✅ Correctly selects goals by priority
- ✅ Relevance evaluation accurate
- ✅ Goal satisfaction evaluation accurate
- ✅ Handles edge cases gracefully
- ✅ Works with real goal definitions

## Implementation Notes ✅

### Verified Production Code Patterns

All assumptions in this workflow have been validated against the actual production codebase:

1. **IGameDataRepository** ✅
   - Location: `src/interfaces/IGameDataRepository.js` and `src/data/gameDataRepository.js`
   - Methods verified: `getGoalDefinition()`, `getAllGoalDefinitions()`
   - Both interface and implementation exist and match workflow expectations

2. **JsonLogicEvaluationService** ✅
   - Location: `src/logic/jsonLogicEvaluationService.js`
   - Class name and `evaluate()` method confirmed
   - Properly registered in DI container as `JsonLogicEvaluationService` (not an interface token)

3. **IEntityManager** ✅
   - Location: `src/interfaces/IEntityManager.js`
   - Methods verified: `getEntityInstance()`, `hasComponent()`, `getComponentData()`
   - Documentation: `docs/testing/entity-manager-interface.md`
   - **Important**: Use `entities` getter (not `getEntities()` method) in production code
   - **Return types**: Returns `undefined` (not `null`) for missing entities/components

4. **goal.schema.json** ✅
   - Location: `data/schemas/goal.schema.json`
   - Structure verified: `id`, `priority`, `relevance`, `goalState` fields
   - Uses `condition-container.schema.json` for JSON Logic conditions

5. **DI Tokens** ✅
   - GOAP tokens: `src/dependencyInjection/tokens/tokens-goap.js`
   - Core tokens: `src/dependencyInjection/tokens/tokens-core.js`
   - Verified tokens: `IGoalManager`, `IGoalStateEvaluator`, `JsonLogicEvaluationService`, `IEntityManager`, `IGameDataRepository`

6. **Component Access Pattern** ✅
   - Pattern `actor.components.core:actor` confirmed in production
   - Examples found in: `data/mods/core/goals/*.goal.json`
   - Properly supported by JSON Logic evaluation with entity context

7. **Goal Files** ✅
   - All three example goals exist and match workflow specifications:
     - `data/mods/core/goals/find_food.goal.json`
     - `data/mods/core/goals/rest_safely.goal.json`
     - `data/mods/core/goals/defeat_enemy.goal.json`

8. **DI Registrations** ✅
   - File: `src/dependencyInjection/registrations/goapRegistrations.js`
   - Both `GoalManager` and `GoalStateEvaluator` properly registered
   - Dependency injection configuration matches workflow examples

9. **Tests** ✅
   - Unit tests: `tests/unit/goap/goals/` (goalManager.test.js, goalStateEvaluator.test.js)
   - Integration tests: `tests/integration/goap/goalSelection.integration.test.js`
   - All test files exist with comprehensive coverage

### Key Design Decisions

- **JSON Logic Only:** Goal states use JSON Logic conditions (per goal.schema.json)
- **Component Access:** Access entity components via `{ "var": "actor.components.core:actor" }`
- **No Custom Operators Needed:** Standard JSON Logic is sufficient for goal evaluation
- **Performance:** Goal selection is optimized for fast execution (<10ms)
- **Extensibility:** Design supports future dynamic priority calculations
- **IGameDataRepository:** Goals accessed via repository, not separate loader interface
- **Error Handling:** All methods gracefully return null/false on errors with proper logging

### Testing Patterns

Following project standards from `docs/testing/mod-testing-guide.md`:
- Unit tests use mock factories from `tests/common/mockFactories/`
- Integration tests use real `JsonLogicEvaluationService` instances
- Component access in tests uses `createComponentAccessor()` from `src/logic/componentAccessor.js`
- Entity manager mocks follow `IEntityManager` interface contract

## Related Tickets

- Depends on: GOAP-TIER1-005 (Phase 1 complete)
- Blocks: GOAP-TIER1-008 (Action Selector Implementation)
