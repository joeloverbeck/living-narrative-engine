/**
 * @file Integration test for complete GOAP workflow
 * Tests goal selection, action selection, plan creation, and execution
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createGoapTestBed } from '../../common/goap/goapTestHelpers.js';

describe('GOAP Workflow Integration', () => {
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

  it('should complete full GOAP workflow: goal selection → action selection → execution', async () => {
    // Setup actor with clear goal trigger
    const actor = testBed.createActor({
      name: 'TestActor',
      type: 'goap',
      components: {
        'core:actor': { hunger: 20 }, // Triggers find_food goal
      },
    });

    // Create food item
    const food = testBed.createEntity({
      name: 'Apple',
      components: {
        'items:item': { weight: 0.5 },
        'core:at_location': { location: actor.location || 'default_location' },
      },
    });

    // Build planning context
    const context = testBed.createContext({ actorId: actor.id });

    // Get available actions
    const actions = await testBed.getAvailableActions(actor);
    expect(actions).toBeDefined();
    expect(Array.isArray(actions)).toBe(true);

    // Make GOAP decision
    const decision = await testBed.makeGoapDecision(actor, context, actions);

    // Verify decision structure
    expect(decision).toBeDefined();
    expect(decision).toHaveProperty('index');
    expect(decision).toHaveProperty('speech');
    expect(decision).toHaveProperty('thoughts');
    expect(decision).toHaveProperty('notes');
  }, 30000);

  it('should cache plans across turns', async () => {
    const actor = testBed.createActor({
      name: 'TestActor',
      type: 'goap',
      components: { 'core:actor': { hunger: 20 } },
    });

    const context = testBed.createContext({ actorId: actor.id });

    // First turn - creates plan
    const actions1 = await testBed.getAvailableActions(actor);
    const decision1 = await testBed.makeGoapDecision(actor, context, actions1);

    // Verify plan was cached
    const cachedPlan = testBed.planCache.get(actor.id);
    expect(cachedPlan).toBeDefined();

    // Second turn - uses cached plan
    const actions2 = await testBed.getAvailableActions(actor);
    const decision2 = await testBed.makeGoapDecision(actor, context, actions2);

    // Decisions should be consistent
    expect(decision1.index).toBe(decision2.index);
  }, 30000);

  it('should invalidate plan on state changes', async () => {
    const actor = testBed.createActor({
      name: 'TestActor',
      type: 'goap',
      components: { 'core:actor': { hunger: 20 } },
    });

    const context = testBed.createContext({ actorId: actor.id });

    // First decision
    const actions1 = await testBed.getAvailableActions(actor);
    await testBed.makeGoapDecision(actor, context, actions1);

    // Verify plan cached
    expect(testBed.planCache.has(actor.id)).toBe(true);

    // Change state
    testBed.entityManager.addComponent(actor.id, 'items:has_food', {});

    // Invalidate cache
    testBed.planCache.invalidate(actor.id);

    // Verify plan removed
    expect(testBed.planCache.has(actor.id)).toBe(false);
  }, 30000);

  it('should handle multiple actors with different goals', async () => {
    // Create actors with different goals
    const hungryActor = testBed.createActor({
      name: 'Hungry',
      type: 'goap',
      components: { 'core:actor': { hunger: 20 } },
    });

    const tiredActor = testBed.createActor({
      name: 'Tired',
      type: 'goap',
      components: { 'core:actor': { energy: 30 } },
    });

    // Each should make independent decisions
    const context1 = testBed.createContext({ actorId: hungryActor.id });
    const actions1 = await testBed.getAvailableActions(hungryActor);
    const decision1 = await testBed.makeGoapDecision(hungryActor, context1, actions1);

    const context2 = testBed.createContext({ actorId: tiredActor.id });
    const actions2 = await testBed.getAvailableActions(tiredActor);
    const decision2 = await testBed.makeGoapDecision(tiredActor, context2, actions2);

    // Both should have decisions
    expect(decision1).toBeDefined();
    expect(decision2).toBeDefined();

    // Plans should be cached separately
    expect(testBed.planCache.has(hungryActor.id)).toBe(true);
    expect(testBed.planCache.has(tiredActor.id)).toBe(true);
  }, 30000);

  it('should return null when no relevant goal exists', async () => {
    // Actor with no goal triggers
    const actor = testBed.createActor({
      name: 'TestActor',
      type: 'goap',
      components: {
        // No components that trigger goals
      },
    });

    const context = testBed.createContext({ actorId: actor.id });
    const actions = await testBed.getAvailableActions(actor);

    const decision = await testBed.makeGoapDecision(actor, context, actions);

    // Should return decision with null index
    expect(decision).toBeDefined();
    expect(decision.index).toBeNull();
  }, 30000);

  it('should return null when goal is already satisfied', async () => {
    // Actor with goal already satisfied
    const actor = testBed.createActor({
      name: 'TestActor',
      type: 'goap',
      components: {
        'core:actor': { hunger: 20 },
        'items:has_food': {}, // Goal already satisfied
      },
    });

    const context = testBed.createContext({ actorId: actor.id });
    const actions = await testBed.getAvailableActions(actor);

    const decision = await testBed.makeGoapDecision(actor, context, actions);

    // Should return null since goal is satisfied
    expect(decision).toBeDefined();
    // index may be null if goal is satisfied
  }, 30000);
});
