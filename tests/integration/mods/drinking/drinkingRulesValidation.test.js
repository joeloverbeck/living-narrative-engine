/**
 * @file Integration tests for drinking rule validation and execution
 * @description Tests that drinking rules (handle_drink_from, handle_drink_entirely)
 * pass validation and can execute successfully. This test was created to reproduce
 * and fix validation errors reported in logs/errors.log.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import drinkFromRule from '../../../../data/mods/drinking/rules/handle_drink_from.rule.json' assert { type: 'json' };
import drinkEntirelyRule from '../../../../data/mods/drinking/rules/handle_drink_entirely.rule.json' assert { type: 'json' };

/**
 * Creates a standardized drinking scenario with actor, location, and drinkable container.
 *
 * @param {string} actorName - Name for the actor
 * @param {string} locationId - Location for the scenario
 * @param {string} containerId - Container ID for the drinkable
 * @returns {object} Object with room, actor, and container entities
 */
function setupDrinkingScenario(
  actorName = 'Alice',
  locationId = 'tavern1',
  containerId = 'waterskin-1'
) {
  const room = ModEntityScenarios.createRoom(locationId, 'Tavern');

  const actor = new ModEntityBuilder('test:actor1')
    .withName(actorName)
    .atLocation(locationId)
    .asActor()
    .withComponent('inventory:inventory', {
      items: [containerId],
      capacity: { maxWeight: 50, maxItems: 10 },
    })
    .build();

  const container = new ModEntityBuilder(containerId)
    .withName('waterskin')
    .withComponent('items-core:item', {})
    .withComponent('items-core:portable', {})
    .withComponent('containers-core:liquid_container', {
      currentVolume: 500, // 500ml of liquid
      maxVolume: 1000, // 1L capacity
      liquidType: 'water',
      sealed: false,
    })
    .withComponent('drinking:drinkable', {
      servingSize: 100, // 100ml per sip
      flavorProfile: {
        primary: 'refreshing',
        secondary: 'clean',
        intensity: 'mild',
      },
    })
    .build();

  return { room, actor, container };
}

/**
 * Asserts that the provided events include a successful turn end.
 *
 * @param {Array<object>} events - Events emitted during the action execution
 * @returns {object} The matching turn ended event
 */
function expectSuccessfulTurnEnd(events) {
  const turnEndedEvent = events.find(
    (event) => event.eventType === 'core:turn_ended'
  );
  expect(turnEndedEvent).toBeDefined();
  expect(turnEndedEvent.payload.success).toBe(true);
  return turnEndedEvent;
}

describe('Drinking Rules Validation and Execution', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('drinking', 'drinking:drink_from');
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  describe('Rule Validation', () => {
    it('should validate handle_drink_from.rule.json structure', () => {
      // Verify rule has required fields
      expect(drinkFromRule.$schema).toBe(
        'schema://living-narrative-engine/rule.schema.json'
      );
      expect(drinkFromRule.rule_id).toBe('handle_drink_from');
      expect(drinkFromRule.event_type).toBe('core:attempt_action');
      expect(drinkFromRule.actions).toBeInstanceOf(Array);
      expect(drinkFromRule.actions.length).toBeGreaterThan(0);

      // Verify all operations have type fields
      drinkFromRule.actions.forEach((operation, index) => {
        expect(operation.type).toBeDefined();
        expect(typeof operation.type).toBe('string');
        expect(operation.type).not.toBe('');
        expect(operation.parameters).toBeDefined();
      });

      // Verify DRINK_FROM operation exists
      const drinkFromOp = drinkFromRule.actions.find(
        (op) => op.type === 'DRINK_FROM'
      );
      expect(drinkFromOp).toBeDefined();
      expect(drinkFromOp.parameters.actorEntity).toBeDefined();
      expect(drinkFromOp.parameters.containerEntity).toBeDefined();
      expect(drinkFromOp.parameters.result_variable).toBe('drinkResult');
    });

    it('should validate handle_drink_entirely.rule.json structure', () => {
      // Verify rule has required fields
      expect(drinkEntirelyRule.$schema).toBe(
        'schema://living-narrative-engine/rule.schema.json'
      );
      expect(drinkEntirelyRule.rule_id).toBe('handle_drink_entirely');
      expect(drinkEntirelyRule.event_type).toBe('core:attempt_action');
      expect(drinkEntirelyRule.actions).toBeInstanceOf(Array);
      expect(drinkEntirelyRule.actions.length).toBeGreaterThan(0);

      // Verify all operations have type fields
      drinkEntirelyRule.actions.forEach((operation, index) => {
        expect(operation.type).toBeDefined();
        expect(typeof operation.type).toBe('string');
        expect(operation.type).not.toBe('');
        expect(operation.parameters).toBeDefined();
      });

      // Verify DRINK_ENTIRELY operation exists
      const drinkEntirelyOp = drinkEntirelyRule.actions.find(
        (op) => op.type === 'DRINK_ENTIRELY'
      );
      expect(drinkEntirelyOp).toBeDefined();
      expect(drinkEntirelyOp.parameters.actorEntity).toBeDefined();
      expect(drinkEntirelyOp.parameters.containerEntity).toBeDefined();
      expect(drinkEntirelyOp.parameters.result_variable).toBe('drinkResult');
    });

    it('should load drinking mod without validation errors', async () => {
      // This test will fail if the mod loader encounters validation errors
      // The fixture creation process loads the mod, so if we get here, validation passed
      expect(testFixture).toBeDefined();
      expect(testFixture.testEnv).toBeDefined();
      expect(testFixture.testEnv.entityManager).toBeDefined();
      expect(testFixture.testEnv.eventBus).toBeDefined();
    });
  });

  describe('DRINK_FROM Execution', () => {
    it('should execute drink_from action successfully', async () => {
      const { room, actor, container } = setupDrinkingScenario();

      // Setup fixture with entities using reset
      testFixture.reset([room, actor, container]);

      // Execute the drink_from action - should complete without errors
      await expect(
        testFixture.executeAction(actor.id, container.id)
      ).resolves.not.toThrow();

      // Verify events were dispatched
      const events = testFixture.events;
      expect(events).toBeDefined();
      expect(events.length).toBeGreaterThan(0);

      // Verify turn ended successfully
      expectSuccessfulTurnEnd(events);

      // Verify perception events were dispatched
      const perceptionEvents = events.filter(
        (event) => event.eventType === 'core:perceptible_event'
      );
      expect(perceptionEvents.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle empty container gracefully', async () => {
      const { room, actor, container } = setupDrinkingScenario();

      // Make container empty
      container.components['containers-core:liquid_container'].currentVolume = 0;

      testFixture.reset([room, actor, container]);

      // Execute the drink_from action - should handle empty container
      await expect(
        testFixture.executeAction(actor.id, container.id)
      ).resolves.toBeDefined();
    });
  });

  describe('DRINK_ENTIRELY Execution', () => {
    it('should execute drink_entirely action successfully', async () => {
      // Create new fixture for drink_entirely action
      const entirelyFixture = await ModTestFixture.forAction(
        'drinking',
        'drinking:drink_entirely'
      );

      try {
        const { room, actor, container } = setupDrinkingScenario();

        // Set container to have small amount for complete consumption
        container.components['containers-core:liquid_container'].currentVolume = 100;

        entirelyFixture.reset([room, actor, container]);

        // Execute the drink_entirely action - should complete without errors
        await expect(
          entirelyFixture.executeAction(actor.id, container.id)
        ).resolves.not.toThrow();

        // Verify events were dispatched
        const events = entirelyFixture.events;
        expect(events).toBeDefined();
        expect(events.length).toBeGreaterThan(0);

        // Verify turn ended successfully
        expectSuccessfulTurnEnd(events);
      } finally {
        entirelyFixture.cleanup();
      }
    });
  });
});
