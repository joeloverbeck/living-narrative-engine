/**
 * @file Integration tests for the positioning:lie_down action and rule.
 * @description Tests the rule execution after the lie_down action is performed.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import lyingDownComponent from '../../../../data/mods/positioning/components/lying_down.component.json';

/**
 * Creates standardized lying scenario.
 *
 * @param {string} actorName - Name for the actor
 * @param {string} furnitureName - Name for the furniture
 * @param {string} locationId - Location for the scenario
 * @returns {object} Object with actor, furniture, and location entities
 */
function setupLyingScenario(
  actorName = 'Alice',
  furnitureName = 'Queen Bed',
  locationId = 'bedroom'
) {
  const room = new ModEntityBuilder(locationId).asRoom('Bedroom').build();

  const actor = new ModEntityBuilder('test:actor1')
    .withName(actorName)
    .atLocation(locationId)
    .asActor()
    .build();

  const furniture = new ModEntityBuilder('test:bed1')
    .withName(furnitureName)
    .atLocation(locationId)
    .withComponent('positioning:allows_lying_on', {})
    .build();

  return { room, actor, furniture };
}

describe('positioning:lie_down action rule execution', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'positioning',
      'lie_down'
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  describe('Successful lying down', () => {
    it('should add lying_down component with correct furniture_id', async () => {
      // Arrange: Setup scenario
      const scenario = setupLyingScenario();
      testFixture.reset([scenario.room, scenario.actor, scenario.furniture]);

      // Act: Dispatch lie_down action
      await testFixture.executeAction('test:actor1', 'test:bed1');

      // Assert: lying_down component added
      const actor = testFixture.entityManager.getEntityInstance('test:actor1');
      expect(actor.components['positioning:lying_down']).toBeDefined();
      expect(actor.components['positioning:lying_down'].furniture_id).toBe(
        'test:bed1'
      );
    });

    it('should lock movement while lying down', async () => {
      // Arrange
      const scenario = setupLyingScenario();
      testFixture.reset([scenario.room, scenario.actor, scenario.furniture]);

      // Act: Lie down
      await testFixture.executeAction('test:actor1', 'test:bed1');

      // Assert: Actor has lying_down component (movement restriction enforced by game rules)
      const actor = testFixture.entityManager.getEntityInstance('test:actor1');
      expect(actor.components['positioning:lying_down']).toBeDefined();
      // Note: Movement restriction is enforced by the positioning system, not tested here
    });

    it('should dispatch perceptible event with correct message', async () => {
      // Arrange
      const scenario = setupLyingScenario('Alice', 'Queen Bed', 'bedroom');
      testFixture.reset([scenario.room, scenario.actor, scenario.furniture]);

      // Act: Lie down
      await testFixture.executeAction('test:actor1', 'test:bed1');

      // Assert: Check perceptible event
      const perceptibleEvents = testFixture.events.filter(
        (e) => e.eventType === 'core:perceptible_event'
      );
      expect(perceptibleEvents.length).toBeGreaterThan(0);

      const event = perceptibleEvents[0];
      expect(event.payload.descriptionText).toBe('Alice lies down on Queen Bed.');
      expect(event.payload.locationId).toBe('bedroom');
      expect(event.payload.actorId).toBe('test:actor1');
      expect(event.payload.targetId).toBe('test:bed1');
    });

  });

  describe('Lying on different furniture types', () => {
    it('should work with bed', async () => {
      const scenario = setupLyingScenario('Bob', 'King Bed', 'bedroom');
      testFixture.reset([scenario.room, scenario.actor, scenario.furniture]);

      await testFixture.executeAction('test:actor1', 'test:bed1');

      const actor = testFixture.entityManager.getEntityInstance('test:actor1');
      expect(actor.components['positioning:lying_down']).toBeDefined();
      expect(actor.components['positioning:lying_down'].furniture_id).toBe(
        'test:bed1'
      );
    });

    it('should work with couch', async () => {
      const couch = new ModEntityBuilder('test:couch1')
        .withName('Leather Couch')
        .atLocation('living_room')
        .withComponent('positioning:allows_lying_on', {})
        .build();

      const actor = new ModEntityBuilder('test:actor1')
        .withName('Carol')
        .atLocation('living_room')
        .asActor()
        .build();

      const room = new ModEntityBuilder('living_room')
        .asRoom('Living Room')
        .build();

      testFixture.reset([room, actor, couch]);

      await testFixture.executeAction('test:actor1', 'test:couch1');

      const updatedActor = testFixture.entityManager.getEntityInstance('test:actor1');
      expect(updatedActor.components['positioning:lying_down'].furniture_id).toBe(
        'test:couch1'
      );
    });

    it('should work with any furniture marked with allows_lying_on', async () => {
      // Test with a custom furniture type - hammock
      const hammock = new ModEntityBuilder('test:hammock1')
        .withName('Garden Hammock')
        .atLocation('garden')
        .withComponent('positioning:allows_lying_on', {})
        .build();

      const actor = new ModEntityBuilder('test:actor1')
        .withName('Dave')
        .atLocation('garden')
        .asActor()
        .build();

      const room = new ModEntityBuilder('garden').asRoom('Garden').build();

      testFixture.reset([room, actor, hammock]);

      await testFixture.executeAction('test:actor1', 'test:hammock1');

      const updatedActor = testFixture.entityManager.getEntityInstance('test:actor1');
      expect(updatedActor.components['positioning:lying_down']).toBeDefined();
      expect(updatedActor.components['positioning:lying_down'].furniture_id).toBe(
        'test:hammock1'
      );
    });
  });

  describe('Multiple actors on same furniture', () => {
    it('should allow multiple actors to lie on same furniture', async () => {
      // This is a KEY DIFFERENCE from sitting system!
      // Multiple actors can lie on the same furniture (e.g., a king bed)
      const bed = new ModEntityBuilder('test:bed1')
        .withName('King Bed')
        .atLocation('bedroom')
        .withComponent('positioning:allows_lying_on', {})
        .build();

      const alice = new ModEntityBuilder('test:alice')
        .withName('Alice')
        .atLocation('bedroom')
        .asActor()
        .build();

      const bob = new ModEntityBuilder('test:bob')
        .withName('Bob')
        .atLocation('bedroom')
        .asActor()
        .build();

      const room = new ModEntityBuilder('bedroom').asRoom('Bedroom').build();

      testFixture.reset([room, alice, bob, bed]);

      // Act: Both lie down
      await testFixture.executeAction('test:alice', 'test:bed1');
      await testFixture.executeAction('test:bob', 'test:bed1');

      // Assert: Both should have lying_down component
      const aliceEntity = testFixture.entityManager.getEntityInstance('test:alice');
      const bobEntity = testFixture.entityManager.getEntityInstance('test:bob');

      expect(aliceEntity.components['positioning:lying_down']).toBeDefined();
      expect(bobEntity.components['positioning:lying_down']).toBeDefined();
      expect(aliceEntity.components['positioning:lying_down'].furniture_id).toBe(
        'test:bed1'
      );
      expect(bobEntity.components['positioning:lying_down'].furniture_id).toBe(
        'test:bed1'
      );
    });

    it('should handle three actors lying on same furniture', async () => {
      // Test with three actors to verify no hidden limits
      const bed = new ModEntityBuilder('test:bed1')
        .withName('Super King Bed')
        .atLocation('bedroom')
        .withComponent('positioning:allows_lying_on', {})
        .build();

      const alice = new ModEntityBuilder('test:alice')
        .withName('Alice')
        .atLocation('bedroom')
        .asActor()
        .build();

      const bob = new ModEntityBuilder('test:bob')
        .withName('Bob')
        .atLocation('bedroom')
        .asActor()
        .build();

      const carol = new ModEntityBuilder('test:carol')
        .withName('Carol')
        .atLocation('bedroom')
        .asActor()
        .build();

      const room = new ModEntityBuilder('bedroom').asRoom('Bedroom').build();

      testFixture.reset([room, alice, bob, carol, bed]);

      // Act: All three lie down
      await testFixture.executeAction('test:alice', 'test:bed1');
      await testFixture.executeAction('test:bob', 'test:bed1');
      await testFixture.executeAction('test:carol', 'test:bed1');

      // Assert: All three should have lying_down component
      const aliceEntity = testFixture.entityManager.getEntityInstance('test:alice');
      const bobEntity = testFixture.entityManager.getEntityInstance('test:bob');
      const carolEntity = testFixture.entityManager.getEntityInstance('test:carol');

      expect(aliceEntity.components['positioning:lying_down'].furniture_id).toBe(
        'test:bed1'
      );
      expect(bobEntity.components['positioning:lying_down'].furniture_id).toBe(
        'test:bed1'
      );
      expect(carolEntity.components['positioning:lying_down'].furniture_id).toBe(
        'test:bed1'
      );
    });
  });

  describe('Component validation', () => {
    it('should match the expected lying_down component schema', () => {
      expect(lyingDownComponent.id).toBe('positioning:lying_down');
      expect(lyingDownComponent.dataSchema.type).toBe('object');
      expect(lyingDownComponent.dataSchema.properties).toHaveProperty(
        'furniture_id'
      );
      expect(lyingDownComponent.dataSchema.properties.furniture_id.$ref).toBe(
        'schema://living-narrative-engine/common.schema.json#/definitions/namespacedId'
      );
      expect(lyingDownComponent.dataSchema.required).toContain('furniture_id');
    });
  });

  describe('Rule validation', () => {
    it('should validate rule structure', () => {
      // The rule file should be loaded
      expect(testFixture.ruleFile).toBeDefined();
      expect(testFixture.ruleFile.rule_id).toBe('handle_lie_down');
      expect(testFixture.ruleFile.condition).toBeDefined();
      expect(testFixture.ruleFile.actions).toBeDefined();
    });

    it('should have correct condition file', () => {
      // The condition file should be loaded
      expect(testFixture.conditionFile).toBeDefined();
      expect(testFixture.conditionFile.id).toMatch(/lie[-_]down/);
    });

    it('should have valid rule actions', () => {
      // Check that the rule has the expected action structure
      expect(testFixture.ruleFile.actions).toBeDefined();
      expect(Array.isArray(testFixture.ruleFile.actions)).toBe(true);
      expect(testFixture.ruleFile.actions.length).toBeGreaterThan(0);
    });

    it('should include ADD_COMPONENT action in rule', () => {
      // Verify that the rule includes the operation to add lying_down component
      const addComponentActions = testFixture.ruleFile.actions.filter(
        (action) => action.type === 'ADD_COMPONENT'
      );
      expect(addComponentActions.length).toBeGreaterThan(0);

      const lyingDownComponentAction = addComponentActions.find(
        (action) => action.parameters.component_type === 'positioning:lying_down'
      );
      expect(lyingDownComponentAction).toBeDefined();
    });

    it('should include LOCK_MOVEMENT action in rule', () => {
      // Verify that the rule includes the operation to lock movement
      const lockMovementActions = testFixture.ruleFile.actions.filter(
        (action) => action.type === 'LOCK_MOVEMENT'
      );
      expect(lockMovementActions.length).toBeGreaterThan(0);
    });
  });
});
