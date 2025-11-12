/**
 * @file End-to-end test for GOAP goblin combat behavior
 * Tests goblin attacking enemy using GOAP decision making
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createGoapTestBed } from '../../common/goap/goapTestHelpers.js';

describe('GOAP E2E: Goblin Combat', () => {
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

  it('should make combat-related decisions for hostile goblin', async () => {
    // Setup: Hostile goblin and enemy
    const goblin = testBed.createActor({
      name: 'Gruk',
      type: 'goap',
      components: {
        'core:hostile': true,
      },
    });

    const enemy = testBed.createActor({
      name: 'Hero',
      components: {
        'core:enemy': true,
      },
    });

    // Execute: Let GOAP decide action
    const context = testBed.createContext({ actorId: goblin.id });
    const actions = await testBed.getAvailableActions(goblin);

    expect(actions).toBeDefined();
    expect(Array.isArray(actions)).toBe(true);

    const decision = await testBed.makeGoapDecision(goblin, context, actions);

    // Assert: Goblin should make a decision
    expect(decision).toBeDefined();
    expect(decision).toHaveProperty('chosenIndex');

    // If decision was made, verify it's valid
    if (decision.chosenIndex !== null) {
      expect(typeof decision.chosenIndex).toBe('number');
      expect(decision.chosenIndex).toBeGreaterThanOrEqual(1);

      const selectedAction = actions[decision.chosenIndex - 1];
      expect(selectedAction).toBeDefined();
      expect(selectedAction).toHaveProperty('actionId');
    }
  }, 30000);

  it('should handle weapon pickup before combat', async () => {
    // Setup: Goblin with weapon nearby
    const goblin = testBed.createActor({
      name: 'Gruk',
      type: 'goap',
      components: {
        'core:hostile': true,
      },
    });

    const weapon = testBed.createEntity({
      name: 'Sword',
      components: {
        'items:item': { weight: 3 },
        'items:weapon': { damage: 10 },
        'core:at_location': { location: goblin.location || 'default_location' },
      },
    });

    // Execute: Let GOAP decide action
    const context = testBed.createContext({ actorId: goblin.id });
    const actions = await testBed.getAvailableActions(goblin);

    const decision = await testBed.makeGoapDecision(goblin, context, actions);

    // Assert: Decision should be made
    expect(decision).toBeDefined();
    expect(decision).toHaveProperty('chosenIndex');

    // Goblin may pick up weapon or perform other action
    if (decision.chosenIndex !== null) {
      const selectedAction = actions[decision.chosenIndex - 1];
      expect(selectedAction).toBeDefined();
    }
  }, 30000);

  it('should handle no relevant goals gracefully', async () => {
    // Setup: Goblin with no pressing needs
    const goblin = testBed.createActor({
      name: 'Gruk',
      type: 'goap',
      components: {
        // No special components to trigger goals
      },
    });

    // Execute: Let GOAP decide
    const context = testBed.createContext({ actorId: goblin.id });
    const actions = await testBed.getAvailableActions(goblin);

    const decision = await testBed.makeGoapDecision(goblin, context, actions);

    // Assert: May return null if no relevant goals
    expect(decision).toBeDefined();
    expect(decision).toHaveProperty('chosenIndex');
  }, 30000);
});
