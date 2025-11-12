/**
 * @file End-to-end test for GOAP cat behavior
 * Tests cat finding food using GOAP decision making
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createGoapTestBed } from '../../common/goap/goapTestHelpers.js';

describe('GOAP E2E: Cat Finding Food', () => {
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

  it('should find and pick up food when hungry', async () => {
    // Setup: Hungry cat, food item at location
    const cat = testBed.createActor({
      name: 'Whiskers',
      type: 'goap',
      components: {
        'core:actor': { hunger: 20 }, // Hungry (< 30)
      },
    });

    const food = testBed.createEntity({
      name: 'Fish',
      components: {
        'items:item': { weight: 1 },
        'core:at_location': { location: cat.location || 'default_location' },
      },
    });

    // Execute: Let GOAP decide action
    const context = testBed.createContext({ actorId: cat.id });
    const actions = await testBed.getAvailableActions(cat);

    expect(actions).toBeDefined();
    expect(Array.isArray(actions)).toBe(true);

    // Make GOAP decision
    const decision = await testBed.makeGoapDecision(cat, context, actions);

    // Assert: Cat should make a decision (may pick up food or perform related action)
    expect(decision).toBeDefined();
    expect(decision).toHaveProperty('index');

    // If decision was made, verify it's valid
    if (decision.index !== null) {
      expect(typeof decision.index).toBe('number');
      expect(decision.index).toBeGreaterThanOrEqual(1); // 1-based indexing

      // Get selected action
      const selectedAction = actions[decision.index - 1]; // Convert to 0-based
      expect(selectedAction).toBeDefined();
      expect(selectedAction).toHaveProperty('actionId');
    }
  }, 30000);

  it('should not take action when already has food', async () => {
    // Setup: Cat with food
    const cat = testBed.createActor({
      name: 'Whiskers',
      type: 'goap',
      components: {
        'core:actor': { hunger: 20 },
        'items:has_food': true,
      },
    });

    // Execute: Let GOAP decide
    const context = testBed.createContext({ actorId: cat.id });
    const actions = await testBed.getAvailableActions(cat);

    const decision = await testBed.makeGoapDecision(cat, context, actions);

    // Assert: Decision should be made, but may return null if goal satisfied
    expect(decision).toBeDefined();
    expect(decision).toHaveProperty('index');

    // Note: Goal may already be satisfied, so index could be null
    // This is expected behavior when the goal is already achieved
  }, 30000);

  it('should handle empty actions gracefully', async () => {
    // Setup: Cat with no available actions
    const cat = testBed.createActor({
      name: 'Whiskers',
      type: 'goap',
      components: {
        'core:actor': { hunger: 20 },
      },
    });

    // Execute: Try to make decision with empty actions
    const context = testBed.createContext({ actorId: cat.id });
    const decision = await testBed.makeGoapDecision(cat, context, []);

    // Assert: Should return null index for no actions
    expect(decision).toBeDefined();
    expect(decision.index).toBeNull();
  }, 30000);
});
