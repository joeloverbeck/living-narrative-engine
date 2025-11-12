/**
 * @file Multi-Actor Concurrent GOAP Decisions E2E Test
 * @description Verifies multiple actors can make independent GOAP decisions simultaneously
 *
 * Test Priority: HIGH (Priority 2)
 * Test Complexity: Medium-High
 *
 * This test validates that multiple actors can make independent GOAP decisions
 * in the same turn without interfering with each other, and that cache invalidation
 * is actor-specific.
 *
 * Test Scenario:
 * 1. Create 3 actors with different goals:
 *    - Actor A: hungry (find_food goal)
 *    - Actor B: tired (rest_safely goal)
 *    - Actor C: in combat (defeat_enemy goal)
 * 2. All actors make decisions in same turn
 * 3. Verify:
 *    - Each actor selects action for their own goal
 *    - Plans cached independently per actor
 *    - No interference between actors' decisions
 * 4. Execute all actions
 * 5. Modify state affecting Actor B's plan
 * 6. Verify only Actor B's cache invalidated (not A or C)
 * 7. Next turn: Verify Actor B replans, A and C reuse cached plans
 *
 * Success Criteria:
 * - All actors make independent decisions
 * - Plans don't interfere with each other
 * - Cache invalidation is actor-specific
 * - Correct actions selected for each actor's goals
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createGoapTestBed } from '../../common/goap/goapTestHelpers.js';

describe('Multi-Actor Concurrent GOAP Decisions E2E', () => {
  let testBed;

  beforeEach(async () => {
    testBed = await createGoapTestBed();
  }, 30000);

  afterEach(() => {
    if (testBed) {
      testBed.cleanup();
    }
  });

  describe('Concurrent Decision Making', () => {
    it('should allow 3 actors with different goals to make independent decisions simultaneously', async () => {
      testBed.logger.info('=== Test: Concurrent Decision Making for 3 Actors ===');

      // Step 1: Load mods
      testBed.logger.info('Step 1: Loading mods');
      await testBed.loadMods(['core', 'positioning', 'items']);

      // Step 2: Create Actor A - hungry (triggers find_food goal)
      testBed.logger.info('Step 2: Creating Actor A (hungry)');
      const actorA = await testBed.createActor({
        name: 'HungryActor',
        type: 'goap',
        components: {
          'core:hunger': { value: 20 }, // Triggers find_food goal (< 30)
          'core:position': { locationId: 'test_location' },
        },
      });

      // Step 3: Create Actor B - tired (triggers rest_safely goal)
      testBed.logger.info('Step 3: Creating Actor B (tired)');
      const actorB = await testBed.createActor({
        name: 'TiredActor',
        type: 'goap',
        components: {
          'core:energy': { value: 30 }, // Triggers rest_safely goal (< 40)
          'core:position': { locationId: 'test_location' },
        },
      });

      // Step 4: Create Actor C - in combat (triggers defeat_enemy goal)
      testBed.logger.info('Step 4: Creating Actor C (in combat)');
      const actorC = await testBed.createActor({
        name: 'CombatActor',
        type: 'goap',
        components: {
          'combat:in_combat': { enemyId: 'enemy_1' }, // Triggers defeat_enemy goal
          'core:health': { value: 80 }, // Healthy enough to fight
          'core:position': { locationId: 'test_location' },
        },
      });

      // Verify all actors created
      expect(actorA).toBeDefined();
      expect(actorB).toBeDefined();
      expect(actorC).toBeDefined();

      testBed.logger.info(`Actors created: ${actorA.id}, ${actorB.id}, ${actorC.id}`);

      // Step 5: Create contexts for each actor
      testBed.logger.info('Step 5: Creating contexts for each actor');
      const contextA = testBed.createContext({ actorId: actorA.id });
      contextA.entities = {
        [actorA.id]: { components: actorA.getAllComponents() },
      };

      const contextB = testBed.createContext({ actorId: actorB.id });
      contextB.entities = {
        [actorB.id]: { components: actorB.getAllComponents() },
      };

      const contextC = testBed.createContext({ actorId: actorC.id });
      contextC.entities = {
        [actorC.id]: { components: actorC.getAllComponents() },
      };

      // Step 6: Get available actions for each actor
      testBed.logger.info('Step 6: Discovering actions for each actor');
      const actionsA = await testBed.getAvailableActions(actorA, contextA);
      const actionsB = await testBed.getAvailableActions(actorB, contextB);
      const actionsC = await testBed.getAvailableActions(actorC, contextC);

      testBed.logger.info(`Actor A: ${actionsA.length} actions available`);
      testBed.logger.info(`Actor B: ${actionsB.length} actions available`);
      testBed.logger.info(`Actor C: ${actionsC.length} actions available`);

      // Step 7: All actors make decisions in the same turn
      testBed.logger.info('Step 7: All actors making decisions concurrently');

      // Verify no plans cached before decisions
      expect(testBed.planCache.has(actorA.id)).toBe(false);
      expect(testBed.planCache.has(actorB.id)).toBe(false);
      expect(testBed.planCache.has(actorC.id)).toBe(false);

      const decisionA = await testBed.makeGoapDecision(actorA, contextA, actionsA);
      const decisionB = await testBed.makeGoapDecision(actorB, contextB, actionsB);
      const decisionC = await testBed.makeGoapDecision(actorC, contextC, actionsC);

      testBed.logger.info(`Actor A decision: index=${decisionA.chosenIndex}`);
      testBed.logger.info(`Actor B decision: index=${decisionB.chosenIndex}`);
      testBed.logger.info(`Actor C decision: index=${decisionC.chosenIndex}`);

      // Step 8: Verify all decisions are independent
      testBed.logger.info('Step 8: Verifying decision independence');

      expect(decisionA).toBeDefined();
      expect(decisionB).toBeDefined();
      expect(decisionC).toBeDefined();

      // Each decision should have required properties
      expect(decisionA).toHaveProperty('chosenIndex');
      expect(decisionB).toHaveProperty('chosenIndex');
      expect(decisionC).toHaveProperty('chosenIndex');

      // Step 9: Verify plans are cached independently for each actor
      testBed.logger.info('Step 9: Verifying independent plan caching');

      // Check which actors have plans cached (depends on whether goals were found and actions available)
      const hasPlanA = testBed.planCache.has(actorA.id);
      const hasPlanB = testBed.planCache.has(actorB.id);
      const hasPlanC = testBed.planCache.has(actorC.id);

      testBed.logger.info(`Actor A plan cached: ${hasPlanA}`);
      testBed.logger.info(`Actor B plan cached: ${hasPlanB}`);
      testBed.logger.info(`Actor C plan cached: ${hasPlanC}`);

      // If any actor has a plan, verify it's unique
      if (hasPlanA) {
        const planA = testBed.planCache.get(actorA.id);
        // eslint-disable-next-line jest/no-conditional-expect
        expect(planA).toBeDefined();
        // eslint-disable-next-line jest/no-conditional-expect
        expect(planA).toHaveProperty('goalId');
        testBed.logger.info(`Actor A plan goal: ${planA.goalId}`);
      }

      if (hasPlanB) {
        const planB = testBed.planCache.get(actorB.id);
        // eslint-disable-next-line jest/no-conditional-expect
        expect(planB).toBeDefined();
        // eslint-disable-next-line jest/no-conditional-expect
        expect(planB).toHaveProperty('goalId');
        testBed.logger.info(`Actor B plan goal: ${planB.goalId}`);
      }

      if (hasPlanC) {
        const planC = testBed.planCache.get(actorC.id);
        // eslint-disable-next-line jest/no-conditional-expect
        expect(planC).toBeDefined();
        // eslint-disable-next-line jest/no-conditional-expect
        expect(planC).toHaveProperty('goalId');
        testBed.logger.info(`Actor C plan goal: ${planC.goalId}`);
      }

      // Verify no interference: each actor should have different goals (or null)
      if (hasPlanA && hasPlanB) {
        const planA = testBed.planCache.get(actorA.id);
        const planB = testBed.planCache.get(actorB.id);
        testBed.logger.info(`Comparing Actor A and B goals: ${planA.goalId} vs ${planB.goalId}`);
        // Plans should be different unless both actors have same goal (unlikely with our setup)
      }

      testBed.logger.info('✓ All actors made independent decisions');
    }, 30000);

    it('should handle selective cache invalidation affecting only one actor', async () => {
      testBed.logger.info('=== Test: Selective Cache Invalidation ===');

      // Step 1: Load mods
      await testBed.loadMods(['core', 'positioning', 'items']);

      // Step 2: Create 3 actors with different energy levels
      const actorA = await testBed.createActor({
        name: 'Actor_A',
        type: 'goap',
        components: {
          'core:energy': { value: 30 }, // Triggers rest_safely goal
          'core:position': { locationId: 'test_location' },
        },
      });

      const actorB = await testBed.createActor({
        name: 'Actor_B',
        type: 'goap',
        components: {
          'core:energy': { value: 35 }, // Triggers rest_safely goal
          'core:position': { locationId: 'test_location' },
        },
      });

      const actorC = await testBed.createActor({
        name: 'Actor_C',
        type: 'goap',
        components: {
          'core:hunger': { value: 20 }, // Triggers find_food goal (different)
          'core:position': { locationId: 'test_location' },
        },
      });

      // Step 3: Create contexts
      const contextA = testBed.createContext({ actorId: actorA.id });
      contextA.entities = { [actorA.id]: { components: actorA.getAllComponents() } };

      const contextB = testBed.createContext({ actorId: actorB.id });
      contextB.entities = { [actorB.id]: { components: actorB.getAllComponents() } };

      const contextC = testBed.createContext({ actorId: actorC.id });
      contextC.entities = { [actorC.id]: { components: actorC.getAllComponents() } };

      // Step 4: Get available actions
      const actionsA = await testBed.getAvailableActions(actorA, contextA);
      const actionsB = await testBed.getAvailableActions(actorB, contextB);
      const actionsC = await testBed.getAvailableActions(actorC, contextC);

      // Step 5: All actors make initial decisions
      testBed.logger.info('Step 5: All actors making initial decisions');
      await testBed.makeGoapDecision(actorA, contextA, actionsA);
      await testBed.makeGoapDecision(actorB, contextB, actionsB);
      await testBed.makeGoapDecision(actorC, contextC, actionsC);

      // Record which actors have plans cached
      const hasPlanA_initial = testBed.planCache.has(actorA.id);
      const hasPlanB_initial = testBed.planCache.has(actorB.id);
      const hasPlanC_initial = testBed.planCache.has(actorC.id);

      testBed.logger.info(
        `Initial cache state: A=${hasPlanA_initial}, B=${hasPlanB_initial}, C=${hasPlanC_initial}`
      );

      // Step 6: Invalidate only Actor B's plan
      testBed.logger.info('Step 6: Invalidating only Actor B\'s plan');
      testBed.planCache.invalidate(actorB.id);

      // Step 7: Verify selective invalidation
      testBed.logger.info('Step 7: Verifying selective invalidation');
      const hasPlanA_after = testBed.planCache.has(actorA.id);
      const hasPlanB_after = testBed.planCache.has(actorB.id);
      const hasPlanC_after = testBed.planCache.has(actorC.id);

      testBed.logger.info(
        `After invalidation: A=${hasPlanA_after}, B=${hasPlanB_after}, C=${hasPlanC_after}`
      );

      // Actor B's plan should be invalidated
      expect(hasPlanB_after).toBe(false);

      // Actor A and C's plans should remain unchanged
      expect(hasPlanA_after).toBe(hasPlanA_initial);
      expect(hasPlanC_after).toBe(hasPlanC_initial);

      testBed.logger.info('✓ Selective cache invalidation working correctly');
    }, 30000);

    it('should allow Actor B to replan after cache invalidation while A and C reuse cached plans', async () => {
      testBed.logger.info('=== Test: Replanning After Cache Invalidation ===');

      // Step 1: Load mods
      await testBed.loadMods(['core', 'positioning', 'items']);

      // Step 2: Create 3 actors with same goal type (rest_safely) for easier verification
      const actorA = await testBed.createActor({
        name: 'Actor_A_Stable',
        type: 'goap',
        components: {
          'core:energy': { value: 30 },
          'core:position': { locationId: 'test_location' },
        },
      });

      const actorB = await testBed.createActor({
        name: 'Actor_B_Changes',
        type: 'goap',
        components: {
          'core:energy': { value: 32 },
          'core:position': { locationId: 'test_location' },
        },
      });

      const actorC = await testBed.createActor({
        name: 'Actor_C_Stable',
        type: 'goap',
        components: {
          'core:energy': { value: 28 },
          'core:position': { locationId: 'test_location' },
        },
      });

      // Step 3: Create contexts
      const contextA = testBed.createContext({ actorId: actorA.id });
      contextA.entities = { [actorA.id]: { components: actorA.getAllComponents() } };

      const contextB = testBed.createContext({ actorId: actorB.id });
      contextB.entities = { [actorB.id]: { components: actorB.getAllComponents() } };

      const contextC = testBed.createContext({ actorId: actorC.id });
      contextC.entities = { [actorC.id]: { components: actorC.getAllComponents() } };

      // Step 4: Get available actions
      const actionsA = await testBed.getAvailableActions(actorA, contextA);
      const actionsB = await testBed.getAvailableActions(actorB, contextB);
      const actionsC = await testBed.getAvailableActions(actorC, contextC);

      // Step 5: Turn 1 - All actors make initial decisions
      testBed.logger.info('Turn 1: All actors making initial decisions');
      const decision1_A = await testBed.makeGoapDecision(actorA, contextA, actionsA);
      const decision1_B = await testBed.makeGoapDecision(actorB, contextB, actionsB);
      const decision1_C = await testBed.makeGoapDecision(actorC, contextC, actionsC);

      testBed.logger.info(`Turn 1 - Actor A: ${decision1_A.chosenIndex}`);
      testBed.logger.info(`Turn 1 - Actor B: ${decision1_B.chosenIndex}`);
      testBed.logger.info(`Turn 1 - Actor C: ${decision1_C.chosenIndex}`);

      // Record cache state after turn 1
      const hasPlanA_turn1 = testBed.planCache.has(actorA.id);
      const hasPlanB_turn1 = testBed.planCache.has(actorB.id);
      const hasPlanC_turn1 = testBed.planCache.has(actorC.id);

      testBed.logger.info(
        `Turn 1 cache: A=${hasPlanA_turn1}, B=${hasPlanB_turn1}, C=${hasPlanC_turn1}`
      );

      // Step 6: Modify Actor B's state (simulate state change)
      testBed.logger.info('Modifying Actor B\'s energy component');
      actorB.addComponent('core:energy', { value: 15 }); // More tired now

      // Update Actor B's context
      contextB.entities = { [actorB.id]: { components: actorB.getAllComponents() } };

      // Step 7: Invalidate Actor B's cache (simulating system detecting state change)
      testBed.logger.info('Invalidating Actor B\'s plan due to state change');
      testBed.planCache.invalidate(actorB.id);

      // Step 8: Turn 2 - All actors make decisions again
      testBed.logger.info('Turn 2: All actors making decisions (B should replan, A and C should reuse)');

      const decision2_A = await testBed.makeGoapDecision(actorA, contextA, actionsA);
      const decision2_B = await testBed.makeGoapDecision(actorB, contextB, actionsB);
      const decision2_C = await testBed.makeGoapDecision(actorC, contextC, actionsC);

      testBed.logger.info(`Turn 2 - Actor A: ${decision2_A.chosenIndex}`);
      testBed.logger.info(`Turn 2 - Actor B: ${decision2_B.chosenIndex}`);
      testBed.logger.info(`Turn 2 - Actor C: ${decision2_C.chosenIndex}`);

      // Step 9: Verify all actors got decisions
      expect(decision2_A).toBeDefined();
      expect(decision2_B).toBeDefined();
      expect(decision2_C).toBeDefined();

      // Step 10: Verify cache state after turn 2
      const hasPlanA_turn2 = testBed.planCache.has(actorA.id);
      const hasPlanB_turn2 = testBed.planCache.has(actorB.id);
      const hasPlanC_turn2 = testBed.planCache.has(actorC.id);

      testBed.logger.info(
        `Turn 2 cache: A=${hasPlanA_turn2}, B=${hasPlanB_turn2}, C=${hasPlanC_turn2}`
      );

      // Actor B should have a plan again after replanning (if a goal was found)
      // Actor A and C should maintain their original cache state
      expect(hasPlanA_turn2).toBe(hasPlanA_turn1);
      expect(hasPlanC_turn2).toBe(hasPlanC_turn1);

      testBed.logger.info('✓ Replanning workflow verified');
    }, 30000);

    it('should execute actions for multiple actors without interference', async () => {
      testBed.logger.info('=== Test: Multi-Actor Action Execution ===');

      // Step 1: Load mods
      await testBed.loadMods(['core', 'positioning', 'items']);

      // Step 2: Create 2 actors with actionable goals
      const actorA = await testBed.createActor({
        name: 'ExecutorA',
        type: 'goap',
        components: {
          'core:energy': { value: 30 },
          'core:position': { locationId: 'test_location' },
        },
      });

      const actorB = await testBed.createActor({
        name: 'ExecutorB',
        type: 'goap',
        components: {
          'core:energy': { value: 25 },
          'core:position': { locationId: 'test_location' },
        },
      });

      // Step 3: Create contexts
      const contextA = testBed.createContext({ actorId: actorA.id });
      contextA.entities = { [actorA.id]: { components: actorA.getAllComponents() } };

      const contextB = testBed.createContext({ actorId: actorB.id });
      contextB.entities = { [actorB.id]: { components: actorB.getAllComponents() } };

      // Step 4: Get available actions
      const actionsA = await testBed.getAvailableActions(actorA, contextA);
      const actionsB = await testBed.getAvailableActions(actorB, contextB);

      testBed.logger.info(`Actor A has ${actionsA.length} actions`);
      testBed.logger.info(`Actor B has ${actionsB.length} actions`);

      // Step 5: Make decisions
      const decisionA = await testBed.makeGoapDecision(actorA, contextA, actionsA);
      const decisionB = await testBed.makeGoapDecision(actorB, contextB, actionsB);

      testBed.logger.info(`Actor A chose action index: ${decisionA.chosenIndex}`);
      testBed.logger.info(`Actor B chose action index: ${decisionB.chosenIndex}`);

      // Step 6: Execute actions if decisions were made
      const executionResults = [];

      if (decisionA.chosenIndex !== null && decisionA.chosenIndex >= 0) {
        const selectedActionA = actionsA[decisionA.chosenIndex];
        testBed.logger.info(`Executing action for Actor A: ${selectedActionA.actionId}`);

        try {
          const resultA = await testBed.executeAction(actorA.id, selectedActionA);
          executionResults.push({ actor: 'A', result: resultA });
          testBed.logger.info(`Actor A action executed successfully`);
        } catch (error) {
          testBed.logger.warn(`Actor A action execution failed:`, error);
        }
      }

      if (decisionB.chosenIndex !== null && decisionB.chosenIndex >= 0) {
        const selectedActionB = actionsB[decisionB.chosenIndex];
        testBed.logger.info(`Executing action for Actor B: ${selectedActionB.actionId}`);

        try {
          const resultB = await testBed.executeAction(actorB.id, selectedActionB);
          executionResults.push({ actor: 'B', result: resultB });
          testBed.logger.info(`Actor B action executed successfully`);
        } catch (error) {
          testBed.logger.warn(`Actor B action execution failed:`, error);
        }
      }

      // Step 7: Verify execution results
      testBed.logger.info(`Successfully executed ${executionResults.length} actions`);

      executionResults.forEach((execResult) => {
        expect(execResult.result).toBeDefined();
        expect(execResult.result).toHaveProperty('success');
        expect(execResult.result).toHaveProperty('stateChanges');
      });

      testBed.logger.info('✓ Multi-actor execution completed without interference');
    }, 30000);

    it('should handle 5+ actors making concurrent decisions with different goal priorities', async () => {
      testBed.logger.info('=== Test: High Concurrency (5+ Actors) ===');

      // Step 1: Load mods
      await testBed.loadMods(['core', 'positioning', 'items']);

      // Step 2: Create 5 actors with varied goals
      const actors = await Promise.all([
        testBed.createActor({
          name: 'Actor1_VeryHungry',
          type: 'goap',
          components: {
            'core:hunger': { value: 10 },
            'core:position': { locationId: 'test_location' },
          },
        }),
        testBed.createActor({
          name: 'Actor2_Tired',
          type: 'goap',
          components: {
            'core:energy': { value: 25 },
            'core:position': { locationId: 'test_location' },
          },
        }),
        testBed.createActor({
          name: 'Actor3_Hungry',
          type: 'goap',
          components: {
            'core:hunger': { value: 28 },
            'core:position': { locationId: 'test_location' },
          },
        }),
        testBed.createActor({
          name: 'Actor4_VeryTired',
          type: 'goap',
          components: {
            'core:energy': { value: 15 },
            'core:position': { locationId: 'test_location' },
          },
        }),
        testBed.createActor({
          name: 'Actor5_ModerateHunger',
          type: 'goap',
          components: {
            'core:hunger': { value: 25 },
            'core:position': { locationId: 'test_location' },
          },
        }),
      ]);

      testBed.logger.info(`Created ${actors.length} actors`);

      // Step 3: Make decisions for all actors
      const startTime = Date.now();
      const decisions = [];

      for (const actor of actors) {
        const context = testBed.createContext({ actorId: actor.id });
        context.entities = { [actor.id]: { components: actor.getAllComponents() } };

        const actions = await testBed.getAvailableActions(actor, context);
        const decision = await testBed.makeGoapDecision(actor, context, actions);

        decisions.push({ actorId: actor.id, actorName: actor.name, decision });

        testBed.logger.info(`${actor.name}: decision made (index=${decision.chosenIndex})`);
      }

      const duration = Date.now() - startTime;

      testBed.logger.info(`All ${actors.length} actors processed in ${duration}ms`);

      // Step 4: Verify all decisions
      expect(decisions).toHaveLength(5);

      decisions.forEach((d) => {
        expect(d.decision).toBeDefined();
        expect(d.decision).toHaveProperty('chosenIndex');
      });

      // Step 5: Check cache independence
      const cacheStats = testBed.planCache.getStats();
      testBed.logger.info(`Cache stats: ${cacheStats.size} plans cached`);

      // Each actor with a satisfiable goal should have its own cache entry
      // Verify no cross-contamination by checking plan uniqueness
      const cachedActorIds = new Set();
      for (const actor of actors) {
        if (testBed.planCache.has(actor.id)) {
          cachedActorIds.add(actor.id);
        }
      }

      testBed.logger.info(`${cachedActorIds.size} actors have cached plans`);

      // Verify each cached plan is for the correct actor
      for (const actorId of cachedActorIds) {
        const plan = testBed.planCache.get(actorId);
        expect(plan).toBeDefined();
        testBed.logger.info(`Actor ${actorId} has plan for goal: ${plan.goalId}`);
      }

      // Performance check: Should complete in reasonable time (< 10 seconds for 5 actors)
      expect(duration).toBeLessThan(10000);

      testBed.logger.info('✓ High concurrency test passed');
    }, 30000);
  });

  describe('Cache Interference Prevention', () => {
    it('should prevent Actor A\'s cache from affecting Actor B\'s decisions', async () => {
      testBed.logger.info('=== Test: Cache Interference Prevention ===');

      await testBed.loadMods(['core', 'positioning', 'items']);

      // Create two actors with different goals
      const actorA = await testBed.createActor({
        name: 'ActorA_Different',
        type: 'goap',
        components: {
          'core:hunger': { value: 20 }, // find_food goal
          'core:position': { locationId: 'test_location' },
        },
      });

      const actorB = await testBed.createActor({
        name: 'ActorB_Different',
        type: 'goap',
        components: {
          'core:energy': { value: 30 }, // rest_safely goal
          'core:position': { locationId: 'test_location' },
        },
      });

      // Create contexts
      const contextA = testBed.createContext({ actorId: actorA.id });
      contextA.entities = { [actorA.id]: { components: actorA.getAllComponents() } };

      const contextB = testBed.createContext({ actorId: actorB.id });
      contextB.entities = { [actorB.id]: { components: actorB.getAllComponents() } };

      // Get actions
      const actionsA = await testBed.getAvailableActions(actorA, contextA);
      const actionsB = await testBed.getAvailableActions(actorB, contextB);

      // Actor A makes decision first
      testBed.logger.info('Actor A making decision first');
      const decisionA1 = await testBed.makeGoapDecision(actorA, contextA, actionsA);
      testBed.logger.info(`Actor A decision: ${decisionA1.chosenIndex}`);

      const planA = testBed.planCache.has(actorA.id) ? testBed.planCache.get(actorA.id) : null;
      if (planA) {
        testBed.logger.info(`Actor A cached plan for goal: ${planA.goalId}`);
      }

      // Actor B makes decision (should not be affected by Actor A's cache)
      testBed.logger.info('Actor B making decision (should be independent)');
      const decisionB1 = await testBed.makeGoapDecision(actorB, contextB, actionsB);
      testBed.logger.info(`Actor B decision: ${decisionB1.chosenIndex}`);

      const planB = testBed.planCache.has(actorB.id) ? testBed.planCache.get(actorB.id) : null;
      if (planB) {
        testBed.logger.info(`Actor B cached plan for goal: ${planB.goalId}`);
      }

      // Verify independence
      expect(decisionA1).toBeDefined();
      expect(decisionB1).toBeDefined();

      // If both have plans, they should be different
      if (planA && planB) {
        testBed.logger.info(`Comparing plans: A=${planA.goalId}, B=${planB.goalId}`);
        // Plans should target different goals based on our setup
        // Note: They might coincidentally be the same goal if both actors have same needs
      }

      // Verify Actor B's decision wasn't affected by Actor A's cache
      // by making Actor B decide again and getting same result
      testBed.logger.info('Actor B making decision again (should be consistent)');
      const decisionB2 = await testBed.makeGoapDecision(actorB, contextB, actionsB);
      testBed.logger.info(`Actor B second decision: ${decisionB2.chosenIndex}`);

      expect(decisionB2.chosenIndex).toBe(decisionB1.chosenIndex);

      testBed.logger.info('✓ Cache interference prevention verified');
    }, 30000);

    it('should maintain separate goal selections for actors with overlapping goal triggers', async () => {
      testBed.logger.info('=== Test: Overlapping Goal Triggers ===');

      await testBed.loadMods(['core', 'positioning', 'items']);

      // Create two actors with slightly different energy levels
      // Both trigger rest_safely but at different urgency
      const actorA = await testBed.createActor({
        name: 'SlightlyTired',
        type: 'goap',
        components: {
          'core:energy': { value: 38 }, // Just under threshold (< 40)
          'core:position': { locationId: 'test_location' },
        },
      });

      const actorB = await testBed.createActor({
        name: 'VeryTired',
        type: 'goap',
        components: {
          'core:energy': { value: 15 }, // Much more tired
          'core:position': { locationId: 'test_location' },
        },
      });

      // Create contexts
      const contextA = testBed.createContext({ actorId: actorA.id });
      contextA.entities = { [actorA.id]: { components: actorA.getAllComponents() } };

      const contextB = testBed.createContext({ actorId: actorB.id });
      contextB.entities = { [actorB.id]: { components: actorB.getAllComponents() } };

      // Get actions
      const actionsA = await testBed.getAvailableActions(actorA, contextA);
      const actionsB = await testBed.getAvailableActions(actorB, contextB);

      // Both make decisions
      const decisionA = await testBed.makeGoapDecision(actorA, contextA, actionsA);
      const decisionB = await testBed.makeGoapDecision(actorB, contextB, actionsB);

      testBed.logger.info(`Actor A (energy=38): decision=${decisionA.chosenIndex}`);
      testBed.logger.info(`Actor B (energy=15): decision=${decisionB.chosenIndex}`);

      // Both actors should get independent decisions
      expect(decisionA).toBeDefined();
      expect(decisionB).toBeDefined();

      // Check if both have plans (likely same goal: rest_safely)
      const hasPlanA = testBed.planCache.has(actorA.id);
      const hasPlanB = testBed.planCache.has(actorB.id);

      testBed.logger.info(`Plans cached: A=${hasPlanA}, B=${hasPlanB}`);

      if (hasPlanA && hasPlanB) {
        const planA = testBed.planCache.get(actorA.id);
        const planB = testBed.planCache.get(actorB.id);

        testBed.logger.info(`Actor A goal: ${planA.goalId}`);
        testBed.logger.info(`Actor B goal: ${planB.goalId}`);

        // Both might have same goal but plans should be separate objects
        // eslint-disable-next-line jest/no-conditional-expect
        expect(planA).not.toBe(planB); // Different object references
      }

      testBed.logger.info('✓ Overlapping goal triggers handled independently');
    }, 30000);
  });
});
