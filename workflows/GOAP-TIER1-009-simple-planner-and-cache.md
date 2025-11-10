# GOAP-TIER1-009: Simple Planner and Cache

**Phase:** 3 (Simple One-Step GOAP Planner)
**Timeline:** Weeks 13-14
**Status:** Not Started
**Dependencies:** GOAP-TIER1-008 (Action Selector Implementation)

## Overview

Implement the SimplePlanner class and PlanCache for one-step greedy planning. This provides the core planning functionality and validates the planning infrastructure before investing in a full A* backward-chaining planner.

## Objectives

1. Implement SimplePlanner class
2. Implement PlanCache class
3. Implement plan creation
4. Implement plan validation
5. Implement cache invalidation strategy
6. Test with real scenarios

## Technical Details

### 1. SimplePlanner Class

**File:** `src/goap/planning/simplePlanner.js`

```javascript
/**
 * @file Simple one-step planner for GOAP
 * Validates planning infrastructure before full A* implementation
 */

import { validateDependency, assertPresent } from '../../utils/dependencyUtils.js';
import { string } from '../../utils/validationCore.js';

/**
 * One-step greedy planner (foundation for future A* planner)
 */
class SimplePlanner {
  #logger;
  #actionSelector;
  #goalManager;

  /**
   * @param {Object} params - Dependencies
   * @param {Object} params.logger - Logger instance
   * @param {Object} params.actionSelector - Action selector service
   * @param {Object} params.goalManager - Goal manager service
   */
  constructor({ logger, actionSelector, goalManager }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug']
    });
    validateDependency(actionSelector, 'IActionSelector', logger, {
      requiredMethods: ['selectAction', 'calculateProgress']
    });
    validateDependency(goalManager, 'IGoalManager', logger, {
      requiredMethods: ['isGoalSatisfied']
    });

    this.#logger = logger;
    this.#actionSelector = actionSelector;
    this.#goalManager = goalManager;
  }

  /**
   * Finds best single action to move toward goal
   * @param {Object} goal - Selected goal
   * @param {Array<Object>} availableActions - Actions from discovery
   * @param {string} actorId - Entity ID of actor
   * @param {Object} context - World state context
   * @returns {Object|null} Best action or null
   */
  plan(goal, availableActions, actorId, context) {
    assertPresent(goal, 'Goal is required');
    assertPresent(availableActions, 'Available actions required');
    string.assertNonBlank(actorId, 'actorId', 'plan', this.#logger);

    this.#logger.debug(`Planning for goal ${goal.id} with ${availableActions.length} actions`);

    try {
      // Use action selector to pick best action
      const selectedAction = this.#actionSelector.selectAction(
        availableActions,
        goal,
        actorId,
        context
      );

      if (!selectedAction) {
        this.#logger.debug(`No action selected for goal ${goal.id}`);
        return null;
      }

      this.#logger.info(`Planned action ${selectedAction.id} for goal ${goal.id}`);
      return selectedAction;
    } catch (error) {
      this.#logger.error(`Failed to plan for goal ${goal.id}`, error);
      return null;
    }
  }

  /**
   * Creates a plan object with single action
   * @param {Object} action - Selected action
   * @param {Object} goal - Goal being pursued
   * @returns {Object} Plan object
   */
  createPlan(action, goal) {
    assertPresent(action, 'Action is required');
    assertPresent(goal, 'Goal is required');

    const plan = {
      goalId: goal.id,
      steps: [
        {
          actionId: action.id,
          targetId: action.targetId || null,
          tertiaryTargetId: action.tertiaryTargetId || null,
          reasoning: this.#generateReasoning(action, goal)
        }
      ],
      createdAt: Date.now(),
      validUntil: null // No expiration for simple planner
    };

    this.#logger.debug(`Created plan: ${JSON.stringify(plan)}`);
    return plan;
  }

  /**
   * Validates if plan is still applicable
   * @param {Object} plan - Plan object
   * @param {Object} context - Current world state
   * @returns {boolean} True if plan valid
   */
  validatePlan(plan, context) {
    assertPresent(plan, 'Plan is required');
    assertPresent(context, 'Context is required');

    try {
      // For simple planner, minimal validation
      // More sophisticated validation in Tier 2

      // Check if plan expired (if expiration set)
      if (plan.validUntil && Date.now() > plan.validUntil) {
        this.#logger.debug('Plan expired');
        return false;
      }

      // Check if plan has steps
      if (!plan.steps || plan.steps.length === 0) {
        this.#logger.debug('Plan has no steps');
        return false;
      }

      // Plan is valid
      return true;
    } catch (error) {
      this.#logger.error('Failed to validate plan', error);
      return false;
    }
  }

  // Private helper methods

  #generateReasoning(action, goal) {
    // Generate human-readable reasoning for plan
    const effectCount = action.planningEffects?.effects?.length || 0;
    return `Action ${action.id} has ${effectCount} effects that move toward goal ${goal.id}`;
  }
}

export default SimplePlanner;
```

### 2. PlanCache Class

**File:** `src/goap/planning/planCache.js`

```javascript
/**
 * @file Plan cache for GOAP planning
 * Caches plans to avoid replanning every turn
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { string } from '../../utils/validationCore.js';

/**
 * Caches plans for actors
 */
class PlanCache {
  #logger;
  #cache;

  /**
   * @param {Object} params - Dependencies
   * @param {Object} params.logger - Logger instance
   */
  constructor({ logger }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug']
    });

    this.#logger = logger;
    this.#cache = new Map();
  }

  /**
   * Gets cached plan for actor
   * @param {string} actorId - Entity ID of actor
   * @returns {Object|null} Cached plan or null
   */
  get(actorId) {
    string.assertNonBlank(actorId, 'actorId', 'get', this.#logger);

    const plan = this.#cache.get(actorId);

    if (plan) {
      this.#logger.debug(`Cache hit for ${actorId}`);
    } else {
      this.#logger.debug(`Cache miss for ${actorId}`);
    }

    return plan || null;
  }

  /**
   * Stores plan for actor
   * @param {string} actorId - Entity ID of actor
   * @param {Object} plan - Plan object
   */
  set(actorId, plan) {
    string.assertNonBlank(actorId, 'actorId', 'set', this.#logger);

    if (!plan) {
      this.#logger.warn(`Attempted to cache null plan for ${actorId}`);
      return;
    }

    this.#cache.set(actorId, plan);
    this.#logger.debug(`Cached plan for ${actorId}: goal ${plan.goalId}`);
  }

  /**
   * Checks if plan exists for actor
   * @param {string} actorId - Entity ID of actor
   * @returns {boolean} True if plan cached
   */
  has(actorId) {
    string.assertNonBlank(actorId, 'actorId', 'has', this.#logger);

    return this.#cache.has(actorId);
  }

  /**
   * Invalidates cached plan for actor
   * @param {string} actorId - Entity ID of actor
   */
  invalidate(actorId) {
    string.assertNonBlank(actorId, 'actorId', 'invalidate', this.#logger);

    const hadPlan = this.#cache.has(actorId);
    this.#cache.delete(actorId);

    if (hadPlan) {
      this.#logger.debug(`Invalidated plan for ${actorId}`);
    }
  }

  /**
   * Invalidates all plans for specific goal
   * @param {string} goalId - Goal ID
   */
  invalidateGoal(goalId) {
    string.assertNonBlank(goalId, 'goalId', 'invalidateGoal', this.#logger);

    let count = 0;
    for (const [actorId, plan] of this.#cache.entries()) {
      if (plan.goalId === goalId) {
        this.#cache.delete(actorId);
        count++;
      }
    }

    if (count > 0) {
      this.#logger.debug(`Invalidated ${count} plans for goal ${goalId}`);
    }
  }

  /**
   * Clears all cached plans
   */
  clear() {
    const size = this.#cache.size;
    this.#cache.clear();

    if (size > 0) {
      this.#logger.debug(`Cleared ${size} cached plans`);
    }
  }

  /**
   * Gets cache statistics
   * @returns {Object} Cache stats
   */
  getStats() {
    return {
      size: this.#cache.size,
      actors: Array.from(this.#cache.keys())
    };
  }
}

export default PlanCache;
```

## Files to Create

- [ ] `src/goap/planning/simplePlanner.js`
- [ ] `src/goap/planning/planCache.js`

## Files to Update

- [ ] `src/dependencyInjection/registrations/goapRegistrations.js` - Register SimplePlanner and PlanCache

## Testing Requirements

### Unit Tests

**File:** `tests/unit/goap/planning/simplePlanner.test.js`

- Plan with single action
- Plan with multiple actions (selects best)
- Plan with no applicable actions
- Create plan (valid action and goal)
- Validate plan (valid)
- Validate plan (expired)
- Validate plan (no steps)
- Generate reasoning

**File:** `tests/unit/goap/planning/planCache.test.js`

- Get cached plan (hit)
- Get cached plan (miss)
- Set plan
- Set null plan (warning)
- Has plan (true)
- Has plan (false)
- Invalidate plan
- Invalidate goal (multiple plans)
- Clear cache
- Get stats

**Coverage Target:** 90% branches, 95% functions/lines

### Integration Tests

**File:** `tests/integration/goap/planning.integration.test.js`

- Plan for find_food goal
- Plan for rest_safely goal
- Plan caching across multiple turns
- Plan invalidation on state change
- No plan when goal satisfied
- No plan when no actions available

## Documentation Requirements

- [ ] Create `docs/goap/simple-planner.md` with:
  - One-step planning algorithm
  - Plan structure
  - Plan caching strategy
  - Plan validation
  - Cache invalidation strategies
  - Limitations vs. full A* planner
  - Migration path to Tier 2
  - Examples

## Acceptance Criteria

- [ ] SimplePlanner class implemented
- [ ] PlanCache class implemented
- [ ] Plan creation works correctly
- [ ] Plan validation works correctly
- [ ] Cache stores and retrieves plans
- [ ] Cache invalidation works
- [ ] All unit tests pass with 90%+ coverage
- [ ] All integration tests pass
- [ ] ESLint passes
- [ ] TypeScript type checking passes
- [ ] Documentation complete

## Success Metrics

- ✅ Planner selects best action
- ✅ Plans cached correctly
- ✅ Cache reduces replanning overhead
- ✅ Plan validation accurate
- ✅ Performance < 5ms per plan

## Notes

- **One-Step Only:** Tier 1 plans only one action ahead
- **Cache Performance:** Significantly reduces planning overhead
- **Validation:** Simple validation for Tier 1, sophisticated for Tier 2
- **Foundation:** Architecture supports future A* implementation

## Related Tickets

- Depends on: GOAP-TIER1-008 (Action Selector)
- Blocks: GOAP-TIER1-010 (GOAP Integration and E2E Testing)
