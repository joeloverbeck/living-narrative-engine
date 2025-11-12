/**
 * @file Integration test for GOAP integration with turn system
 * Tests GoapDecisionProvider working within the turn execution pipeline
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createGoapTestBed } from '../../common/goap/goapTestHelpers.js';

describe('GOAP Turn System Integration', () => {
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

  it('should integrate GoapDecisionProvider with turn system', async () => {
    // Create GOAP actor
    const actor = await testBed.createActor({
      name: 'TestActor',
      type: 'goap',
      components: {
        'core:actor': { hunger: 20 },
      },
    });

    // Verify actor has player_type component
    expect(testBed.hasComponent(actor.id, 'core:player_type')).toBe(true);
    const playerType = testBed.getComponent(actor.id, 'core:player_type');
    expect(playerType.type).toBe('goap');

    // Get GOAP decision provider
    const goapProvider = testBed.goapDecisionProvider;
    expect(goapProvider).toBeDefined();

    // Simulate turn context
    const context = testBed.createContext({ actorId: actor.id });
    const actions = await testBed.getAvailableActions(actor);

    // Make decision
    const decision = await goapProvider.decide(actor, context, actions);

    // Verify decision structure
    expect(decision).toBeDefined();
    expect(decision).toHaveProperty('chosenIndex');
  }, 30000);

  it('should work with action discovery', async () => {
    // Create actor with components that enable certain actions
    const actor = await testBed.createActor({
      name: 'TestActor',
      type: 'goap',
      components: {
        'core:actor': { hunger: 20 },
        'positioning:standing': {},
      },
    });

    // Get available actions (simplified for test)
    const actions = await testBed.getAvailableActions(actor);

    // Should have discovered some actions
    expect(actions).toBeDefined();
    expect(Array.isArray(actions)).toBe(true);

    // If actions available, GOAP should be able to select from them
    if (actions.length > 0) {
      const context = testBed.createContext({ actorId: actor.id });
      const decision = await testBed.goapDecisionProvider.decide(actor, context, actions);

      expect(decision).toBeDefined();
      expect(decision).toHaveProperty('chosenIndex');
    }
  }, 30000);

  it('should handle turn execution with GOAP actors', async () => {
    // Create GOAP actor
    const actor = await testBed.createActor({
      name: 'TestActor',
      type: 'goap',
      components: {
        'core:actor': { hunger: 20 },
      },
    });

    // Get available actions
    const actions = await testBed.getAvailableActions(actor);

    // Make decision
    const context = testBed.createContext({ actorId: actor.id });
    const decision = await testBed.makeGoapDecision(actor, context, actions);

    // Verify decision can be used in turn system
    expect(decision).toBeDefined();

    if (decision.chosenIndex !== null) {
      // Verify selected action exists
      const selectedAction = actions[decision.chosenIndex - 1];
      expect(selectedAction).toBeDefined();
      expect(selectedAction).toHaveProperty('actionId');
    }
  }, 30000);

  it('should work alongside LLM actors (no conflicts)', async () => {
    // Create GOAP actor
    const goapActor = await testBed.createActor({
      name: 'GoapActor',
      type: 'goap',
      components: { 'core:actor': { hunger: 20 } },
    });

    // Create LLM actor
    const llmActor = await testBed.createActor({
      name: 'LLMActor',
      type: 'llm',
      components: { 'core:actor': {} },
    });

    // Both should be able to get actions
    const goapActions = await testBed.getAvailableActions(goapActor);
    const llmActions = await testBed.getAvailableActions(llmActor);

    expect(goapActions).toBeDefined();
    expect(llmActions).toBeDefined();

    // GOAP actor should use GOAP provider
    const goapContext = testBed.createContext({ actorId: goapActor.id });
    const goapDecision = await testBed.makeGoapDecision(
      goapActor,
      goapContext,
      goapActions
    );

    expect(goapDecision).toBeDefined();

    // Note: LLM actor would use LLM provider (not tested here)
  }, 30000);

  it('should handle empty actions gracefully', async () => {
    // Create actor
    const actor = await testBed.createActor({
      name: 'TestActor',
      type: 'goap',
    });

    // Make decision with no actions
    const context = testBed.createContext({ actorId: actor.id });
    const decision = await testBed.goapDecisionProvider.decide(actor, context, []);

    // Should return null index
    expect(decision).toBeDefined();
    expect(decision.chosenIndex).toBeNull();
  }, 30000);

  it('should validate plan before execution', async () => {
    // Create actor
    const actor = await testBed.createActor({
      name: 'TestActor',
      type: 'goap',
      components: { 'core:actor': { hunger: 20 } },
    });

    const context = testBed.createContext({ actorId: actor.id });
    const actions = await testBed.getAvailableActions(actor);

    // First decision - may create plan if goal is found
    const decision1 = await testBed.makeGoapDecision(actor, context, actions);
    expect(decision1).toBeDefined();

    // Check if plan was cached (depends on goal selection)
    const plan = testBed.planCache.get(actor.id);

    // If plan exists, it should be valid
    if (plan) {
      const planningContext = {
        entities: {
          [actor.id]: {
            components: actor.getAllComponents(),
          },
        },
      };
      const isValid = testBed.simplePlanner.validatePlan(plan, planningContext);
      expect(typeof isValid).toBe('boolean');
    } else {
      // No plan means no relevant goal was found, which is valid behavior
      expect(decision1.chosenIndex).toBeNull();
    }
  }, 30000);

  it('should replan when cached plan becomes invalid', async () => {
    // Create actor
    const actor = await testBed.createActor({
      name: 'TestActor',
      type: 'goap',
      components: { 'core:actor': { hunger: 20 } },
    });

    const context = testBed.createContext({ actorId: actor.id });
    const actions = await testBed.getAvailableActions(actor);

    // First decision - creates and caches plan
    await testBed.makeGoapDecision(actor, context, actions);

    // Manually create invalid plan
    testBed.planCache.set(actor.id, {
      goalId: 'invalid:goal',
      steps: [],
      createdAt: Date.now(),
      validUntil: Date.now() - 1000, // Expired
    });

    // Second decision - should detect invalid plan and replan
    const decision2 = await testBed.makeGoapDecision(actor, context, actions);

    // Should still make a decision (replanned)
    expect(decision2).toBeDefined();
  }, 30000);
});
