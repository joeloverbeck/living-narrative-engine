/**
 * @file Integration tests for the bending:bend_over action and rule.
 * @description Tests the rule execution after the bend_over action is performed.
 * Note: This test does not test action discovery or scope resolution - it assumes
 * the action is valid and dispatches it directly.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import bendingOverComponent from '../../../../data/mods/bending-states/components/bending_over.component.json';

/**
 * Creates standardized bending over positioning scenario.
 *
 * @param {string} actorName - Name for the actor
 * @param {string} surfaceName - Name for the surface
 * @param {string} locationId - Location for the scenario
 * @returns {object} Object with actor, surface, and location entities
 */
function setupBendingScenario(
  actorName = 'Alice',
  surfaceName = 'Kitchen Counter',
  locationId = 'kitchen'
) {
  const room = new ModEntityBuilder(locationId).asRoom('Kitchen').build();

  const actor = new ModEntityBuilder('test:actor1')
    .withName(actorName)
    .atLocation(locationId)
    .asActor()
    .build();

  const surface = new ModEntityBuilder('test:surface1')
    .withName(surfaceName)
    .atLocation(locationId)
    .withComponent('bending:allows_bending_over', {})
    .build();

  return { room, actor, surface };
}

/**
 * Creates scenario where actor is already bending over.
 *
 * @returns {object} Scenario object with entities
 */
function setupAlreadyBendingScenario() {
  const scenario = setupBendingScenario();

  // Actor is already bending over a surface
  scenario.actor.components['bending-states:bending_over'] = {
    surface_id: 'test:existing_surface',
  };

  return scenario;
}

/**
 * Creates scenario where actor is sitting on furniture.
 *
 * @returns {object} Scenario object with entities including chair
 */
function setupSittingScenario() {
  const scenario = setupBendingScenario('Alice', 'Kitchen Counter', 'kitchen');

  // Add a chair to the room
  const chair = new ModEntityBuilder('test:chair')
    .withName('Kitchen Chair')
    .atLocation('kitchen')
    .withComponent('sitting:allows_sitting', {
      spots: [{ occupied: false }],
    })
    .build();

  // Actor is sitting on the chair
  scenario.actor.components['sitting-states:sitting_on'] = {
    furniture_id: 'test:chair',
    spot_index: 0,
  };

  return { ...scenario, chair };
}

/**
 * Creates scenario where actor is kneeling.
 *
 * @returns {object} Scenario object with entities including target
 */
function setupKneelingScenario() {
  const scenario = setupBendingScenario();

  // Add another actor to kneel before
  const target = new ModEntityBuilder('test:target1')
    .withName('King Bob')
    .atLocation('kitchen')
    .asActor()
    .build();

  // Actor is kneeling before the target
  scenario.actor.components['deference-states:kneeling_before'] = {
    entityId: 'test:target1',
  };

  return { ...scenario, target };
}

/**
 * Creates multi-surface scenario.
 *
 * @returns {object} Scenario object with multiple surfaces
 */
function setupMultiSurfaceScenario() {
  const scenario = setupBendingScenario();

  const surface2 = new ModEntityBuilder('test:surface2')
    .withName('Dining Table')
    .atLocation('kitchen')
    .withComponent('bending:allows_bending_over', {})
    .build();

  return { ...scenario, surface2 };
}

/**
 * Creates scenario where actor is straddling another actor.
 *
 * @returns {object} Scenario object with entities including straddled actor
 */
function setupStraddlingScenario() {
  const scenario = setupBendingScenario();

  // Add a chair for the target to sit on
  const chair = new ModEntityBuilder('test:chair')
    .withName('Chair')
    .atLocation('kitchen')
    .build();

  // Add another actor who is being straddled
  const target = new ModEntityBuilder('test:target1')
    .withName('Bob')
    .atLocation('kitchen')
    .asActor()
    .withComponent('sitting-states:sitting_on', {
      furniture_id: 'test:chair',
      spot_index: 0,
    })
    .build();

  // Actor is straddling the target's waist
  scenario.actor.components['straddling-states:straddling_waist'] = {
    target_id: 'test:target1',
    facing_away: false,
  };

  return { ...scenario, chair, target };
}

describe('bending:bend_over action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('bending', 'bend_over');
  });

  afterEach(() => {
    testFixture?.cleanup();
  });

  describe('basic bend over action execution', () => {
    it('should add bending_over component to actor when action is performed', async () => {
      // Arrange
      const { room, actor, surface } = setupBendingScenario(
        'Alice',
        'Kitchen Counter'
      );
      testFixture.reset([room, actor, surface]);

      // Act
      await testFixture.executeAction('test:actor1', 'test:surface1');

      // Assert
      const updatedActor =
        testFixture.entityManager.getEntityInstance('test:actor1');
      expect(updatedActor.components['bending-states:bending_over']).toBeDefined();
      expect(updatedActor.components['bending-states:bending_over']).toEqual({
        surface_id: 'test:surface1',
      });
    });

    it('should handle bending over different surfaces', async () => {
      // Arrange
      const { room, actor, surface, surface2 } = setupMultiSurfaceScenario();
      testFixture.reset([room, actor, surface, surface2]);

      // Act - bend over first surface
      await testFixture.executeAction('test:actor1', 'test:surface1');

      // Assert first bend
      let updatedActor =
        testFixture.entityManager.getEntityInstance('test:actor1');
      expect(updatedActor.components['bending-states:bending_over']).toEqual({
        surface_id: 'test:surface1',
      });

      // Remove bending state manually for test
      await testFixture.entityManager.removeComponent(
        'test:actor1',
        'bending-states:bending_over'
      );

      // Act - bend over second surface
      await testFixture.executeAction('test:actor1', 'test:surface2');

      // Assert second bend
      updatedActor = testFixture.entityManager.getEntityInstance('test:actor1');
      expect(updatedActor.components['bending-states:bending_over']).toEqual({
        surface_id: 'test:surface2',
      });
    });
  });

  describe('mutual exclusivity constraints', () => {
    it('should handle bending attempt when already bending over another surface', async () => {
      // Arrange - actor already bending
      const { room, actor, surface } = setupAlreadyBendingScenario();
      testFixture.reset([room, actor, surface]);

      // Verify initial state
      const initialActor =
        testFixture.entityManager.getEntityInstance('test:actor1');
      expect(initialActor.components['bending-states:bending_over']).toEqual({
        surface_id: 'test:existing_surface',
      });

      // Act - attempt to bend over different surface
      await testFixture.executeAction('test:actor1', 'test:surface1', {
        skipDiscovery: true,
      });

      // Assert - action still executes since rule processes any bend_over event
      // The rule will add/overwrite the bending_over component
      const updatedActor =
        testFixture.entityManager.getEntityInstance('test:actor1');
      expect(updatedActor.components['bending-states:bending_over']).toEqual({
        surface_id: 'test:surface1',
      });
    });

    it('should handle bending attempt when sitting on furniture', async () => {
      // Arrange - actor sitting
      const { room, actor, surface, chair } = setupSittingScenario();
      testFixture.reset([room, actor, surface, chair]);

      // Verify initial state
      const initialActor =
        testFixture.entityManager.getEntityInstance('test:actor1');
      expect(initialActor.components['sitting-states:sitting_on']).toEqual({
        furniture_id: 'test:chair',
        spot_index: 0,
      });

      // Act - attempt to bend over surface while sitting
      await testFixture.executeAction('test:actor1', 'test:surface1', {
        skipDiscovery: true,
      });

      // Assert - rule executes and adds bending_over component
      // Note: In real gameplay, action discovery would prevent this scenario
      // due to forbidden_components, but rule testing bypasses that layer
      const updatedActor =
        testFixture.entityManager.getEntityInstance('test:actor1');
      expect(updatedActor.components['bending-states:bending_over']).toEqual({
        surface_id: 'test:surface1',
      });
      // Actor still retains sitting component as rule doesn't remove it
      expect(updatedActor.components['sitting-states:sitting_on']).toEqual({
        furniture_id: 'test:chair',
        spot_index: 0,
      });
    });

    it('should handle bending attempt when kneeling before another actor', async () => {
      // Arrange - actor kneeling
      const { room, actor, surface, target } = setupKneelingScenario();
      testFixture.reset([room, actor, surface, target]);

      // Verify initial state
      const initialActor =
        testFixture.entityManager.getEntityInstance('test:actor1');
      expect(initialActor.components['deference-states:kneeling_before']).toEqual({
        entityId: 'test:target1',
      });

      // Act - attempt to bend over surface while kneeling
      await testFixture.executeAction('test:actor1', 'test:surface1', {
        skipDiscovery: true,
      });

      // Assert - rule executes and adds bending_over component
      // Note: In real gameplay, action discovery would prevent this scenario
      // due to forbidden_components, but rule testing bypasses that layer
      const updatedActor =
        testFixture.entityManager.getEntityInstance('test:actor1');
      expect(updatedActor.components['bending-states:bending_over']).toEqual({
        surface_id: 'test:surface1',
      });
      // Actor still retains kneeling component as rule doesn't remove it
      expect(updatedActor.components['deference-states:kneeling_before']).toEqual({
        entityId: 'test:target1',
      });
    });

    it('should handle bending attempt when straddling another actor', async () => {
      // Arrange - actor straddling someone's waist
      const { room, actor, surface, chair, target } = setupStraddlingScenario();
      testFixture.reset([room, actor, surface, chair, target]);

      // Verify initial state
      const initialActor =
        testFixture.entityManager.getEntityInstance('test:actor1');
      expect(initialActor.components['straddling-states:straddling_waist']).toEqual({
        target_id: 'test:target1',
        facing_away: false,
      });

      // Act - attempt to bend over surface while straddling
      await testFixture.executeAction('test:actor1', 'test:surface1', {
        skipDiscovery: true,
      });

      // Assert - rule executes and adds bending_over component
      // Note: In real gameplay, action discovery would prevent this scenario
      // due to forbidden_components, but rule testing bypasses that layer
      const updatedActor =
        testFixture.entityManager.getEntityInstance('test:actor1');
      expect(updatedActor.components['bending-states:bending_over']).toEqual({
        surface_id: 'test:surface1',
      });
      // Actor still retains straddling component as rule doesn't remove it
      expect(updatedActor.components['straddling-states:straddling_waist']).toEqual({
        target_id: 'test:target1',
        facing_away: false,
      });
    });
  });

  describe('forbidden component enforcement', () => {
    it('rejects the action when the actor is being hugged', async () => {
      const { room, actor, surface } = setupBendingScenario();
      const hugger = new ModEntityBuilder('test:hugger')
        .withName('Charlie')
        .atLocation('kitchen')
        .asActor()
        .build();

      actor.components['hugging-states:being_hugged'] = {
        hugging_entity_id: hugger.id,
      };

      testFixture.reset([room, actor, surface, hugger]);

      await expect(
        testFixture.executeAction(actor.id, surface.id)
      ).rejects.toThrow(/forbidden component.*hugging-states:being_hugged/i);
    });

    it('rejects the action when the actor is hugging someone else', async () => {
      const { room, actor, surface } = setupBendingScenario();
      const huggee = new ModEntityBuilder('test:huggee')
        .withName('Dana')
        .atLocation('kitchen')
        .asActor()
        .build();

      actor.components['hugging-states:hugging'] = {
        embraced_entity_id: huggee.id,
        initiated: true,
      };

      testFixture.reset([room, actor, surface, huggee]);

      await expect(
        testFixture.executeAction(actor.id, surface.id)
      ).rejects.toThrow(/forbidden component.*hugging-states:hugging/i);
    });
  });

  describe('action validation', () => {
    it('should validate rule structure', () => {
      // The rule file should be loaded
      expect(testFixture.ruleFile).toBeDefined();
      expect(testFixture.ruleFile.rule_id).toBe('handle_bend_over');
      expect(testFixture.ruleFile.condition).toBeDefined();
      expect(testFixture.ruleFile.actions).toBeDefined();
    });

    it('should have correct condition file', () => {
      // The condition file should be loaded
      expect(testFixture.conditionFile).toBeDefined();
      expect(testFixture.conditionFile.id).toMatch(/bend[-_]over/);
    });

    it('should have valid rule actions', () => {
      // Check that the rule has the expected action structure
      expect(testFixture.ruleFile.actions).toBeDefined();
      expect(Array.isArray(testFixture.ruleFile.actions)).toBe(true);
    });
  });

  describe('component validation', () => {
    it('should match the expected bending_over component schema', () => {
      expect(bendingOverComponent.id).toBe('bending-states:bending_over');
      expect(bendingOverComponent.dataSchema.type).toBe('object');
      expect(bendingOverComponent.dataSchema.properties).toHaveProperty(
        'surface_id'
      );
      expect(bendingOverComponent.dataSchema.properties.surface_id.$ref).toBe(
        'schema://living-narrative-engine/common.schema.json#/definitions/namespacedId'
      );
      expect(bendingOverComponent.dataSchema.required).toContain('surface_id');
    });
  });
});
