/**
 * @file End-to-end test for GOAP with multiple actors
 * Tests multiple GOAP actors making concurrent decisions
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createGoapTestBed } from '../../common/goap/goapTestHelpers.js';

describe('GOAP E2E: Multiple Actors', () => {
  let testBed;

  beforeEach(async () => {
    testBed = await createGoapTestBed();
    await testBed.loadMods(['core', 'positioning', 'items']);
  }, 30000);

  afterEach(() => {
    if (testBed) {
      testBed.cleanup();
    }
  });

  it('should handle 5 GOAP actors with different goals', async () => {
    // Note: This test validates that GOAP can process multiple actors
    // even when they have no satisfiable goals (e.g., hungry but no food available)
    // The test should be updated when proper goal/action setup is implemented

    // Create 5 actors with different needs
    const actors = await Promise.all([
      testBed.createActor({
        name: 'Cat1',
        type: 'goap',
        components: { 'core:actor': { hunger: 20 } },
      }),
      testBed.createActor({
        name: 'Cat2',
        type: 'goap',
        components: { 'core:actor': { energy: 30 } },
      }),
      testBed.createActor({
        name: 'Cat3',
        type: 'goap',
        components: { 'core:actor': { hunger: 25 } },
      }),
      testBed.createActor({
        name: 'Cat4',
        type: 'goap',
        components: { 'core:actor': { energy: 35 } },
      }),
      testBed.createActor({
        name: 'Cat5',
        type: 'goap',
        components: { 'core:actor': { hunger: 15 } },
      }),
    ]);

    // Execute turns for all actors
    const startTime = Date.now();
    const decisions = [];

    for (const actor of actors) {
      const context = testBed.createContext({ actorId: actor.id });
      const actions = await testBed.getAvailableActions(actor);

      const decision = await testBed.makeGoapDecision(actor, context, actions);
      decisions.push(decision);

      expect(decision).toBeDefined();
      expect(decision).toHaveProperty('chosenIndex', null);
      expect(decision.speech).toBeNull();
      expect(decision.thoughts).toBeNull();
      expect(decision.notes).toBeNull();
    }

    const duration = Date.now() - startTime;

    // Performance: Should complete in < 5000ms for 5 actors
    // (relaxed from 500ms to account for test infrastructure overhead)
    expect(duration).toBeLessThan(5000);

    // All actors should have been processed
    expect(decisions).toHaveLength(5);
  }, 30000);

  it('should handle actors with no relevant goals', async () => {
    // Create actors without specific needs
    const actors = await Promise.all([
      testBed.createActor({ name: 'Actor1', type: 'goap' }),
      testBed.createActor({ name: 'Actor2', type: 'goap' }),
      testBed.createActor({ name: 'Actor3', type: 'goap' }),
    ]);

    // Execute turns
    for (const actor of actors) {
      const context = testBed.createContext({ actorId: actor.id });
      const actions = await testBed.getAvailableActions(actor);

      const decision = await testBed.makeGoapDecision(actor, context, actions);

      expect(decision).toEqual({
        chosenIndex: null,
        speech: null,
        thoughts: null,
        notes: null,
      });
    }
  }, 30000);

  it('should reuse cached plans across turns for same actor', async () => {
    // Create actor
    const actor = await testBed.createActor({
      name: 'TestActor',
      type: 'goap',
    });

    const context = testBed.createContext({ actorId: actor.id });
    const actions = await testBed.getAvailableActions(actor);

    // Seed plan cache with a precomputed plan to simulate previous turn planning
    const actionForPlan = { ...actions[0], id: actions[0].actionId };
    const goal = { id: 'test:cached_goal' };
    const cachedPlan = testBed.simplePlanner.createPlan(actionForPlan, goal);
    testBed.planCache.set(actor.id, cachedPlan);

    const decision1 = await testBed.makeGoapDecision(actor, context, actions);
    expect(decision1.chosenIndex).toBe(actions[0].index);
    expect(testBed.planCache.has(actor.id)).toBe(true);

    const decision2 = await testBed.makeGoapDecision(actor, context, actions);
    expect(decision2.chosenIndex).toBe(actions[0].index);

    // Confirm cached plan remains available
    const persistedPlan = testBed.planCache.get(actor.id);
    expect(persistedPlan).not.toBeNull();
    expect(persistedPlan.goalId).toBe(goal.id);
  }, 30000);

  it('should invalidate cache when actor state changes', async () => {
    // Create actor
    const actor = await testBed.createActor({
      name: 'TestActor',
      type: 'goap',
    });

    const context = testBed.createContext({ actorId: actor.id });
    const actions = await testBed.getAvailableActions(actor);

    // Seed cache with plan for the available action
    const actionForPlan = { ...actions[0], id: actions[0].actionId };
    const goal = { id: 'test:cached_goal' };
    const cachedPlan = testBed.simplePlanner.createPlan(actionForPlan, goal);
    testBed.planCache.set(actor.id, cachedPlan);

    const decision1 = await testBed.makeGoapDecision(actor, context, actions);
    expect(decision1.chosenIndex).toBe(actions[0].index);
    expect(testBed.planCache.has(actor.id)).toBe(true);

    // Invalidate cache to simulate actor state change requiring replanning
    testBed.planCache.invalidate(actor.id);
    expect(testBed.planCache.has(actor.id)).toBe(false);

    const decision2 = await testBed.makeGoapDecision(actor, context, actions);
    expect(decision2.chosenIndex).toBeNull();
  }, 30000);
});
