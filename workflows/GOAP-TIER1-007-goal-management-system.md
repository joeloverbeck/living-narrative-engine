# GOAP-TIER1-007: Goal Management System

**Phase:** 2 (Goal System)
**Timeline:** Weeks 9-10
**Status:** Not Started
**Dependencies:** GOAP-TIER1-005 (Phase 1 complete)

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

## Files to Create

- [ ] `src/goap/goals/goalManager.js`
- [ ] `src/goap/goals/goalStateEvaluator.js`
- [ ] `data/mods/core/goals/find_food.goal.json`
- [ ] `data/mods/core/goals/rest_safely.goal.json`
- [ ] `data/mods/core/goals/defeat_enemy.goal.json`

## Files to Update

- [ ] `src/dependencyInjection/registrations/goapRegistrations.js` - Register GoalManager and GoalStateEvaluator

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

## Testing Requirements

### Unit Tests

**File:** `tests/unit/goap/goals/goalManager.test.js`

- Select goal (single relevant goal)
- Select goal (multiple goals, sorted by priority)
- Select goal (no relevant goals)
- Select goal (all goals satisfied)
- Evaluate relevance (true)
- Evaluate relevance (false)
- Evaluate goal satisfaction (true)
- Evaluate goal satisfaction (false)
- Get goals for actor

**File:** `tests/unit/goap/goals/goalStateEvaluator.test.js`

- Evaluate JSON Logic goal state (true)
- Evaluate JSON Logic goal state (false)
- Evaluate component existence check (true)
- Evaluate component existence check (false)
- Calculate distance (satisfied)
- Calculate distance (unsatisfied)
- Handle composite conditions
- Handle nested component paths

**Coverage Target:** 90% branches, 95% functions/lines

### Integration Tests

**File:** `tests/integration/goap/goalSelection.integration.test.js`

- Select goal for cat actor (hungry)
- Select goal for cat actor (tired)
- Select goal for goblin actor (enemy present)
- No goal selected when all satisfied
- Goal priority ordering
- Real goal definitions from files

## Documentation Requirements

- [ ] Create `docs/goap/goal-system.md` with:
  - Goal definition format
  - Relevance conditions (JSON Logic)
  - Goal state conditions (JSON Logic)
  - Accessing component data in goal conditions
  - Creating goals for creature types
  - Priority tuning
  - Troubleshooting goal selection
  - Examples for cat, goblin, monster
  - Common JSON Logic patterns for goals

## Acceptance Criteria

- [ ] GoalManager class implemented
- [ ] GoalStateEvaluator class implemented
- [ ] Goal selection algorithm works correctly
- [ ] Supports JSON Logic goal states
- [ ] Accesses component data via `actor.components.*` paths
- [ ] Selects highest priority relevant goal
- [ ] Filters out satisfied goals
- [ ] Integrates with IGameDataRepository for goal definitions
- [ ] All unit tests pass with 90%+ coverage
- [ ] All integration tests pass
- [ ] Example goal definitions created (find_food, rest_safely, defeat_enemy)
- [ ] Documentation complete
- [ ] ESLint passes
- [ ] TypeScript type checking passes

## Success Metrics

- ✅ Correctly selects goals by priority
- ✅ Relevance evaluation accurate
- ✅ Goal satisfaction evaluation accurate
- ✅ Handles edge cases gracefully
- ✅ Works with real goal definitions

## Notes

- **JSON Logic Only:** Goal states use JSON Logic conditions (per goal.schema.json)
- **Component Access:** Access entity components via `{ "var": "actor.components.core:actor" }`
- **No Custom Operators Needed:** Standard JSON Logic is sufficient for goal evaluation
- **Performance:** Goal selection should be fast (<10ms)
- **Extensibility:** Design for future dynamic priority calculations
- **IGameDataRepository:** Goals accessed via repository, not separate loader interface

## Related Tickets

- Depends on: GOAP-TIER1-005 (Phase 1 complete)
- Blocks: GOAP-TIER1-008 (Action Selector Implementation)
