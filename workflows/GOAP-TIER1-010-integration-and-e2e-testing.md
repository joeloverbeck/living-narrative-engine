# GOAP-TIER1-010: GOAP Integration and E2E Testing

**Phase:** 3 (Simple One-Step GOAP Planner)
**Timeline:** Weeks 15-16
**Status:** Not Started
**Dependencies:** GOAP-TIER1-009 (Simple Planner and Cache)

## Overview

Integrate the complete GOAP Tier 1 system with the existing turn system by updating GoapDecisionProvider. Create comprehensive end-to-end tests with real scenarios (cat finding food, goblin attacking, etc.) and ensure the complete workflow functions correctly.

## Objectives

1. Update GoapDecisionProvider to use GOAP components
2. Integrate with turn system
3. Integrate with action discovery
4. Create E2E test scenarios
5. Performance optimization
6. Final validation and documentation

## Technical Details

### 1. Update GoapDecisionProvider

**File:** `src/turns/providers/goapDecisionProvider.js`

Replace placeholder implementation with complete GOAP logic:

```javascript
/**
 * @file GOAP decision provider for non-sentient actors
 * Uses goal-oriented action planning for creature AI
 */

import DelegatingDecisionProvider from './delegatingDecisionProvider.js';
import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * Decision provider using GOAP (Goal-Oriented Action Planning)
 */
class GoapDecisionProvider extends DelegatingDecisionProvider {
  #goalManager;
  #simplePlanner;
  #planCache;
  #logger;
  #safeEventDispatcher;

  /**
   * @param {Object} params - Dependencies
   * @param {Object} params.goalManager - Goal manager service
   * @param {Object} params.simplePlanner - Simple planner service
   * @param {Object} params.planCache - Plan cache service
   * @param {Object} params.logger - Logger instance
   * @param {Object} params.safeEventDispatcher - Safe event dispatcher
   */
  constructor({
    goalManager,
    simplePlanner,
    planCache,
    logger,
    safeEventDispatcher
  }) {
    // Create delegate function for GOAP decision logic
    const delegate = async (actor, context, actions) => {
      return this.#decideActionInternal(actor, context, actions);
    };

    super({ delegate, logger, safeEventDispatcher });

    validateDependency(goalManager, 'IGoalManager', logger, {
      requiredMethods: ['selectGoal', 'isGoalSatisfied']
    });
    validateDependency(simplePlanner, 'ISimplePlanner', logger, {
      requiredMethods: ['plan', 'validatePlan', 'createPlan']
    });
    validateDependency(planCache, 'IPlanCache', logger, {
      requiredMethods: ['get', 'set', 'invalidate']
    });

    this.#goalManager = goalManager;
    this.#simplePlanner = simplePlanner;
    this.#planCache = planCache;
    this.#logger = logger;
    this.#safeEventDispatcher = safeEventDispatcher;
  }

  /**
   * Internal decision logic for GOAP agent
   * @param {Object} actor - Actor entity object
   * @param {Object} context - Decision context
   * @param {Array<Object>} actions - Available indexed actions
   * @returns {Promise<Object>} Decision result with { index: number|null }
   * @private
   */
  async #decideActionInternal(actor, context, actions) {
    const actorId = actor.id;

    this.#logger.debug(`GOAP decision for ${actorId} with ${actions.length} actions`);

    // Step 1: Validate input
    if (!Array.isArray(actions) || actions.length === 0) {
      this.#logger.debug(`No actions available for ${actorId}`);
      return { index: null };
    }

    // Step 2: Check cached plan
    let plan = this.#planCache.get(actorId);

    // Step 3: Validate cached plan
    if (plan && !this.#simplePlanner.validatePlan(plan, context)) {
      this.#logger.debug(`Cached plan for ${actorId} invalid, replanning`);
      this.#planCache.invalidate(actorId);
      plan = null;
    }

    // Step 4: If no valid plan, create new one
    if (!plan) {
      // Select goal
      const goal = this.#goalManager.selectGoal(actorId, context);

      if (!goal) {
        this.#logger.debug(`No relevant goal for ${actorId}, no action`);
        return { index: null };
      }

      // Check if goal already satisfied
      if (this.#goalManager.isGoalSatisfied(goal, actorId, context)) {
        this.#logger.debug(`Goal ${goal.id} already satisfied for ${actorId}`);
        return { index: null };
      }

      // Plan action - extract action data from indexed actions
      const actionData = actions.map(a => ({
        id: a.id,
        targetId: a.targetId,
        tertiaryTargetId: a.tertiaryTargetId,
        planningEffects: a.planningEffects,
        index: a.index
      }));

      const plannedAction = this.#simplePlanner.plan(goal, actionData, actorId, context);

      if (!plannedAction) {
        this.#logger.debug(`No action found for goal ${goal.id}`);
        return { index: null };
      }

      // Create and cache plan
      plan = this.#simplePlanner.createPlan(plannedAction, goal);
      this.#planCache.set(actorId, plan);
    }

    // Step 5: Execute first step of plan
    const step = plan.steps[0];

    // Find action in indexed actions array
    const actionMatch = actions.find(a => a.id === step.actionId);

    if (!actionMatch) {
      this.#logger.warn(`Planned action ${step.actionId} not in available actions`);
      this.#planCache.invalidate(actorId);
      return { index: null };
    }

    this.#logger.info(
      `Actor ${actorId} executing ${step.actionId} for goal ${plan.goalId}`
    );

    return { index: actionMatch.index };
  }
}

export default GoapDecisionProvider;
```

### 2. Update Available Actions Provider

**File:** `src/data/providers/availableActionsProvider.js`

Filter actions for GOAP actors:

```javascript
async function getAvailableActions(actor) {
  const validActions = await this.#actionDiscovery.discover(actor);

  const playerType = determineSpecificPlayerType(actor);

  if (playerType === 'goap') {
    // Filter to actions with planning effects only
    const plannableActions = validActions.filter(action => action.planningEffects);

    this.#logger.debug(
      `Filtered ${validActions.length} actions to ${plannableActions.length} plannable actions for GOAP actor`
    );

    return plannableActions;
  }

  return validActions;
}
```

### 3. Update Mods Loader

**File:** `src/loaders/modsLoader.js`

Ensure goal loading:

```javascript
async function loadMods(modList) {
  // ... existing loaders ...

  // Load goals
  this.#logger.info('Loading goals...');
  await this.#goalLoader.load(modList);

  // ... continue ...
}
```

## End-to-End Test Scenarios

### Scenario 1: Cat Finding Food

**File:** `tests/e2e/goap/catBehavior.e2e.test.js`

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';

describe('GOAP E2E: Cat Finding Food', () => {
  let testBed;

  beforeEach(async () => {
    testBed = createTestBed();
    await testBed.loadMods(['core', 'positioning', 'items']);
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should find and pick up food when hungry', async () => {
    // Setup: Hungry cat, food item at location
    const cat = testBed.createActor({
      name: 'Whiskers',
      type: 'goap',
      components: {
        'core:actor': { hunger: 20 } // Hungry (< 30)
      }
    });

    const food = testBed.createEntity({
      name: 'Fish',
      components: {
        'items:item': { weight: 1 },
        'core:at_location': { location: cat.location }
      }
    });

    // Execute: Let GOAP decide action
    const context = testBed.createContext({ actorId: cat.id });
    const actions = await testBed.getAvailableActions(cat);

    const decision = await testBed.makeGoapDecision(cat, context, actions);

    // Assert: Cat should pick up food
    expect(decision.index).not.toBeNull();

    const selectedAction = actions[decision.index];
    expect(selectedAction.id).toBe('items:pick_up_item');
    expect(selectedAction.targetId).toBe(food.id);

    // Execute action
    await testBed.executeAction(cat.id, selectedAction);

    // Verify: Cat has food
    expect(testBed.hasComponent(cat.id, 'items:inventory_item')).toBe(true);
  });

  it('should not take action when already has food', async () => {
    // Setup: Cat with food
    const cat = testBed.createActor({
      name: 'Whiskers',
      type: 'goap',
      components: {
        'core:actor': { hunger: 20 },
        'items:has_food': true
      }
    });

    // Execute: Let GOAP decide
    const context = testBed.createContext({ actorId: cat.id });
    const actions = await testBed.getAvailableActions(cat);

    const decision = await testBed.makeGoapDecision(cat, context, actions);

    // Assert: No action (goal already satisfied)
    expect(decision.index).toBeNull();
  });
});
```

### Scenario 2: Goblin Attacking Enemy

**File:** `tests/e2e/goap/goblinBehavior.e2e.test.js`

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';

describe('GOAP E2E: Goblin Combat', () => {
  let testBed;

  beforeEach(async () => {
    testBed = createTestBed();
    await testBed.loadMods(['core', 'positioning', 'combat', 'items']);
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should pick up weapon before attacking enemy', async () => {
    // Setup: Hostile goblin, enemy, weapon at location
    const goblin = testBed.createActor({
      name: 'Gruk',
      type: 'goap',
      components: {
        'core:hostile': true
      }
    });

    const enemy = testBed.createActor({
      name: 'Hero',
      components: {
        'core:enemy': true
      }
    });

    const weapon = testBed.createEntity({
      name: 'Sword',
      components: {
        'items:item': { weight: 3 },
        'items:weapon': { damage: 10 },
        'core:at_location': { location: goblin.location }
      }
    });

    // Execute turn 1: Should pick up weapon
    const context1 = testBed.createContext({ actorId: goblin.id });
    const actions1 = await testBed.getAvailableActions(goblin);
    const decision1 = await testBed.makeGoapDecision(goblin, context1, actions1);

    expect(decision1.index).not.toBeNull();

    const action1 = actions1[decision1.index];
    expect(action1.id).toBe('items:pick_up_item');
    expect(action1.targetId).toBe(weapon.id);

    await testBed.executeAction(goblin.id, action1);

    // Execute turn 2: Should attack enemy
    const context2 = testBed.createContext({ actorId: goblin.id });
    const actions2 = await testBed.getAvailableActions(goblin);
    const decision2 = await testBed.makeGoapDecision(goblin, context2, actions2);

    expect(decision2.index).not.toBeNull();

    const action2 = actions2[decision2.index];
    expect(action2.id).toBe('combat:attack');
    expect(action2.targetId).toBe(enemy.id);
  });
});
```

### Scenario 3: Multiple Actors

**File:** `tests/e2e/goap/multipleActors.e2e.test.js`

```javascript
describe('GOAP E2E: Multiple Actors', () => {
  it('should handle 5 GOAP actors with different goals', async () => {
    const testBed = createTestBed();
    await testBed.loadMods(['core', 'positioning', 'items']);

    // Create 5 actors with different needs
    const actors = [
      testBed.createActor({ name: 'Cat1', type: 'goap', hunger: 20 }),
      testBed.createActor({ name: 'Cat2', type: 'goap', energy: 30 }),
      testBed.createActor({ name: 'Cat3', type: 'goap', hunger: 25 }),
      testBed.createActor({ name: 'Cat4', type: 'goap', energy: 35 }),
      testBed.createActor({ name: 'Cat5', type: 'goap', hunger: 15 })
    ];

    // Execute turns for all actors
    const startTime = Date.now();

    for (const actor of actors) {
      const context = testBed.createContext({ actorId: actor.id });
      const actions = await testBed.getAvailableActions(actor);
      const decision = await testBed.makeGoapDecision(actor, context, actions);

      // Should select some action
      expect(decision.index).toBeDefined();
    }

    const duration = Date.now() - startTime;

    // Performance: Should complete in < 500ms (< 100ms per actor)
    expect(duration).toBeLessThan(500);
  });
});
```

## Files to Update

- [ ] `src/turns/providers/goapDecisionProvider.js` - Complete implementation
- [ ] `src/data/providers/availableActionsProvider.js` - Filter for GOAP
- [ ] `src/loaders/modsLoader.js` - Ensure goal loading
- [ ] `src/dependencyInjection/registrations/turnsRegistrations.js` - Update GoapDecisionProvider registration

## Files to Create

### E2E Tests
- [ ] `tests/e2e/goap/catBehavior.e2e.test.js`
- [ ] `tests/e2e/goap/goblinBehavior.e2e.test.js`
- [ ] `tests/e2e/goap/monsterBehavior.e2e.test.js`
- [ ] `tests/e2e/goap/multipleActors.e2e.test.js`

### Integration Tests
- [ ] `tests/integration/goap/goapWorkflow.integration.test.js`
- [ ] `tests/integration/goap/turnIntegration.test.js`
- [ ] `tests/integration/goap/actionDiscoveryIntegration.test.js`

### Test Helpers
- [ ] `tests/common/goap/goapTestHelpers.js`

## Testing Requirements

### Integration Tests

**File:** `tests/integration/goap/goapWorkflow.integration.test.js`

- Full GOAP workflow end-to-end
- Goal selection → action selection → execution
- Plan caching across turns
- Plan invalidation on state changes
- Multiple actors with different goals

**File:** `tests/integration/goap/turnIntegration.test.js`

- GoapDecisionProvider in turn system
- Action discovery integration
- Turn execution with GOAP actors
- Mixed LLM and GOAP actors

### E2E Tests

- Cat finding and eating food
- Cat resting when tired
- Goblin attacking enemy
- Goblin picking up weapon first
- Multiple actors (5+) with different goals
- Performance benchmarks

**Coverage Target:** 90% branches, 95% functions/lines

### Performance Tests

**File:** `tests/performance/goap/goapWorkflow.performance.test.js`

```javascript
describe('GOAP Workflow Performance', () => {
  it('should complete decision in < 100ms per actor', async () => {
    const testBed = createTestBed();
    const actor = testBed.createActor({ type: 'goap' });

    const iterations = 100;
    const startTime = Date.now();

    for (let i = 0; i < iterations; i++) {
      const context = testBed.createContext({ actorId: actor.id });
      const actions = await testBed.getAvailableActions(actor);
      await testBed.makeGoapDecision(actor, context, actions);
    }

    const duration = Date.now() - startTime;
    const avgTime = duration / iterations;

    expect(avgTime).toBeLessThan(100); // < 100ms per decision
  });
});
```

## Documentation Requirements

- [ ] Update `docs/goap/README.md` with:
  - Complete system overview
  - Integration with turn system
  - How to use GOAP for creatures
  - Examples for different creature types
  - Performance characteristics
  - Troubleshooting guide

- [ ] Create `docs/goap/getting-started.md` with:
  - Quick start guide
  - Creating a GOAP actor
  - Defining goals
  - Generating effects
  - Testing scenarios

- [ ] Update main `README.md` with:
  - GOAP Tier 1 feature announcement
  - Link to GOAP docs

## Acceptance Criteria

- [ ] GoapDecisionProvider fully implemented
- [ ] Integration with turn system complete
- [ ] Integration with action discovery complete
- [ ] All E2E tests pass
- [ ] All integration tests pass
- [ ] Performance tests meet targets (<100ms per actor)
- [ ] Cat scenario works end-to-end
- [ ] Goblin scenario works end-to-end
- [ ] Multiple actors scenario works
- [ ] No regression in existing tests
- [ ] ESLint passes on all files
- [ ] TypeScript type checking passes
- [ ] Documentation complete and reviewed

## Success Metrics

- ✅ Complete GOAP workflow functional
- ✅ All test scenarios pass
- ✅ Performance targets met:
  - Goal selection: < 10ms
  - Action selection: < 50ms
  - Total decision: < 100ms per actor
- ✅ Works with 5+ concurrent GOAP actors
- ✅ No conflicts with LLM agents
- ✅ Clear documentation
- ✅ Zero critical bugs

## Final Validation Checklist

### Functional
- [ ] Effects generated for 100+ actions
- [ ] Goals load correctly from files
- [ ] Goal selection works by priority
- [ ] Action selection works greedily
- [ ] Plans cache correctly
- [ ] Plan invalidation works
- [ ] GOAP actors make decisions
- [ ] Actions execute successfully

### Performance
- [ ] Effects generation < 5s for all actions
- [ ] Goal selection < 10ms per actor
- [ ] Action selection < 50ms per actor
- [ ] Plan creation < 5ms
- [ ] Total decision < 100ms per actor

### Quality
- [ ] 90% branch coverage, 95% function/line coverage
- [ ] All tests green
- [ ] No ESLint errors
- [ ] No TypeScript errors
- [ ] Documentation complete

### Integration
- [ ] Works with existing turn system
- [ ] Works with action discovery
- [ ] Coexists with LLM agents
- [ ] No breaking changes to existing code

## Notes

- **Final Integration:** This ticket completes GOAP Tier 1
- **Backward Compatible:** Must not break existing LLM agents
- **Performance Critical:** Decision speed impacts gameplay
- **Documentation Essential:** Users need clear guidance

## Related Tickets

- Depends on: GOAP-TIER1-009 (Simple Planner and Cache)
- Completes: All of Phase 3 and GOAP Tier 1
- Enables: Future GOAP Tier 2 development

## Migration to Tier 2

This ticket establishes the foundation for Tier 2 features:
- Full A* backward-chaining planner
- Multi-step plans
- More sophisticated heuristics
- Hierarchical planning
- Multi-agent coordination

All architecture decisions in Tier 1 support these future enhancements.
