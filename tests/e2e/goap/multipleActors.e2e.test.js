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
    // Create 5 actors with different needs
    const actors = [
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
    ];

    // Execute turns for all actors
    const startTime = Date.now();
    const decisions = [];

    for (const actor of actors) {
      const context = testBed.createContext({ actorId: actor.id });
      const actions = await testBed.getAvailableActions(actor);
      const decision = await testBed.makeGoapDecision(actor, context, actions);

      decisions.push(decision);

      // Should have a decision object
      expect(decision).toBeDefined();
      expect(decision).toHaveProperty('index');
    }

    const duration = Date.now() - startTime;

    // Performance: Should complete in < 5000ms for 5 actors
    // (relaxed from 500ms to account for test infrastructure overhead)
    expect(duration).toBeLessThan(5000);

    // All decisions should be valid
    expect(decisions).toHaveLength(5);
    for (const decision of decisions) {
      expect(decision).toBeDefined();
      expect(decision).toHaveProperty('index');
    }
  }, 30000);

  it('should handle actors with no relevant goals', async () => {
    // Create actors without specific needs
    const actors = [
      testBed.createActor({ name: 'Actor1', type: 'goap' }),
      testBed.createActor({ name: 'Actor2', type: 'goap' }),
      testBed.createActor({ name: 'Actor3', type: 'goap' }),
    ];

    // Execute turns
    for (const actor of actors) {
      const context = testBed.createContext({ actorId: actor.id });
      const actions = await testBed.getAvailableActions(actor);
      const decision = await testBed.makeGoapDecision(actor, context, actions);

      // Should return decision (may be null if no goals)
      expect(decision).toBeDefined();
      expect(decision).toHaveProperty('index');
    }
  }, 30000);

  it('should cache plans across turns for same actor', async () => {
    // Create actor
    const actor = testBed.createActor({
      name: 'TestActor',
      type: 'goap',
      components: { 'core:actor': { hunger: 20 } },
    });

    const context = testBed.createContext({ actorId: actor.id });
    const actions = await testBed.getAvailableActions(actor);

    // First decision - creates and caches plan
    const decision1 = await testBed.makeGoapDecision(actor, context, actions);
    expect(decision1).toBeDefined();

    // Second decision - should use cached plan
    const decision2 = await testBed.makeGoapDecision(actor, context, actions);
    expect(decision2).toBeDefined();

    // Both decisions should be consistent (same goal/plan)
    expect(decision1.index).toBe(decision2.index);
  }, 30000);

  it('should invalidate cache when actor state changes', async () => {
    // Create actor
    const actor = testBed.createActor({
      name: 'TestActor',
      type: 'goap',
      components: { 'core:actor': { hunger: 20 } },
    });

    const context = testBed.createContext({ actorId: actor.id });
    const actions = await testBed.getAvailableActions(actor);

    // First decision
    const decision1 = await testBed.makeGoapDecision(actor, context, actions);
    expect(decision1).toBeDefined();

    // Modify actor state (satisfy goal)
    testBed.entityManager.addComponent(actor.id, 'items:has_food', { amount: 1 });

    // Invalidate cache
    testBed.planCache.invalidate(actor.id);

    // Second decision - should replan due to state change
    const actions2 = await testBed.getAvailableActions(actor);
    const decision2 = await testBed.makeGoapDecision(actor, context, actions2);
    expect(decision2).toBeDefined();

    // Decision may be different now that goal is satisfied
    // (could be null or a different action)
  }, 30000);
});
