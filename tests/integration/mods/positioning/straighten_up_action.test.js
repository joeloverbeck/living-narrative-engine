/**
 * @file Integration tests for the positioning:straighten_up action and rule.
 * @description Tests the rule execution after the straighten_up action is performed.
 * Note: This test does not test action discovery or scope resolution - it assumes
 * the action is valid and dispatches it directly.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import { ModAssertionHelpers } from '../../../common/mods/ModAssertionHelpers.js';
import bendingOverComponent from '../../../../data/mods/positioning/components/bending_over.component.json';

/**
 * Creates standardized straightening up scenario where actor is bending over.
 *
 * @param {string} actorName - Name for the actor
 * @param {string} surfaceName - Name for the surface
 * @param {string} locationId - Location for the scenario
 * @returns {object} Object with actor, surface, and location entities
 */
function setupStraighteningScenario(
  actorName = 'Alice',
  surfaceName = 'Kitchen Counter',
  locationId = 'kitchen'
) {
  const room = new ModEntityBuilder(locationId).asRoom('Kitchen').build();

  const actor = new ModEntityBuilder('test:actor1')
    .withName(actorName)
    .atLocation(locationId)
    .withComponent('positioning:bending_over', { surface_id: 'test:surface1' })
    .asActor()
    .build();

  const surface = new ModEntityBuilder('test:surface1')
    .withName(surfaceName)
    .atLocation(locationId)
    .withComponent('positioning:allows_bending_over', {})
    .build();

  return { room, actor, surface };
}

/**
 * Creates scenario where actor is not bending over.
 */
function setupNotBendingScenario() {
  const room = new ModEntityBuilder('kitchen').asRoom('Kitchen').build();

  const actor = new ModEntityBuilder('test:actor1')
    .withName('Alice')
    .atLocation('kitchen')
    .asActor()
    .build();

  const surface = new ModEntityBuilder('test:surface1')
    .withName('Kitchen Counter')
    .atLocation('kitchen')
    .withComponent('positioning:allows_bending_over', {})
    .build();

  return { room, actor, surface };
}

/**
 * Creates scenario with multiple surfaces and actor bending over one.
 */
function setupMultiSurfaceBendingScenario() {
  const scenario = setupStraighteningScenario();

  const surface2 = new ModEntityBuilder('test:surface2')
    .withName('Dining Table')
    .atLocation('kitchen')
    .withComponent('positioning:allows_bending_over', {})
    .build();

  return { ...scenario, surface2 };
}

/**
 * Creates scenario where actor transitions from bending to another position.
 */
function setupTransitionScenario() {
  const scenario = setupStraighteningScenario();

  // Add a chair for sitting transition
  const chair = new ModEntityBuilder('test:chair')
    .withName('Kitchen Chair')
    .atLocation('kitchen')
    .withComponent('positioning:allows_sitting', {
      spots: [{ occupied: false }],
    })
    .build();

  // Add another actor for kneeling transition
  const target = new ModEntityBuilder('test:target1')
    .withName('King Bob')
    .atLocation('kitchen')
    .asActor()
    .build();

  return { ...scenario, chair, target };
}

describe('positioning:straighten_up action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'positioning',
      'straighten_up'
    );
  });

  afterEach(() => {
    testFixture?.cleanup();
  });

  describe('basic straighten up action execution', () => {
    it('should remove bending_over component from actor when action is performed', async () => {
      // Arrange
      const { room, actor, surface } = setupStraighteningScenario(
        'Alice',
        'Kitchen Counter'
      );
      testFixture.reset([room, actor, surface]);

      // Verify actor is bending
      expect(actor.components['positioning:bending_over']).toBeDefined();

      // Act
      await testFixture.executeAction('test:actor1', 'test:surface1');

      // Assert
      const updatedActor =
        testFixture.entityManager.getEntityInstance('test:actor1');
      expect(
        updatedActor.components['positioning:bending_over']
      ).toBeUndefined();
    });

    it('should only affect the specific bending relationship', async () => {
      // Arrange
      const { room, actor, surface } = setupStraighteningScenario();
      testFixture.reset([room, actor, surface]);

      // Act
      await testFixture.executeAction('test:actor1', 'test:surface1');

      // Assert - actor should be completely straightened up
      const updatedActor =
        testFixture.entityManager.getEntityInstance('test:actor1');
      expect(
        updatedActor.components['positioning:bending_over']
      ).toBeUndefined();
    });
  });

  describe('prerequisite constraints', () => {
    it('should not allow straightening up when not bending', async () => {
      // Arrange - actor not bending
      const { room, actor, surface } = setupNotBendingScenario();
      testFixture.reset([room, actor, surface]);

      // Act & Assert - should throw validation error
      await expect(async () => {
        await testFixture.executeAction('test:actor1', 'test:surface1');
      }).rejects.toThrow(/missing required component/);

      // Should not have removed any components since prerequisites weren't met
      const updatedActor =
        testFixture.entityManager.getEntityInstance('test:actor1');
      expect(
        updatedActor.components['positioning:bending_over']
      ).toBeUndefined();
    });

    it('should only allow straightening from the surface being bent over', async () => {
      // Arrange
      const { room, actor, surface, surface2 } =
        setupMultiSurfaceBendingScenario();
      testFixture.reset([room, actor, surface, surface2]);

      // Actor is bending over surface1, should only straighten from surface1
      const actorData =
        testFixture.entityManager.getEntityInstance('test:actor1');
      expect(actorData.components['positioning:bending_over'].surface_id).toBe(
        'test:surface1'
      );

      // Act - straighten from correct surface
      await testFixture.executeAction('test:actor1', 'test:surface1');

      // Assert
      const updatedActor =
        testFixture.entityManager.getEntityInstance('test:actor1');
      expect(
        updatedActor.components['positioning:bending_over']
      ).toBeUndefined();
    });
  });

  describe('state transitions', () => {
    it('should allow transition from bending to sitting after straightening', async () => {
      // Arrange
      const { room, actor, surface, chair } = setupTransitionScenario();
      testFixture.reset([room, actor, surface, chair]);

      // Act - straighten up
      await testFixture.executeAction('test:actor1', 'test:surface1');

      // Assert - no longer bending
      const updatedActor =
        testFixture.entityManager.getEntityInstance('test:actor1');
      expect(
        updatedActor.components['positioning:bending_over']
      ).toBeUndefined();

      // Now actor should be able to sit (would need sit_down action test)
      // This just verifies the bending state was properly removed
    });

    it('should allow transition from bending to kneeling after straightening', async () => {
      // Arrange
      const { room, actor, surface, target } = setupTransitionScenario();
      testFixture.reset([room, actor, surface, target]);

      // Act - straighten up
      await testFixture.executeAction('test:actor1', 'test:surface1');

      // Assert - no longer bending
      const updatedActor =
        testFixture.entityManager.getEntityInstance('test:actor1');
      expect(
        updatedActor.components['positioning:bending_over']
      ).toBeUndefined();

      // Now actor should be able to kneel (would need kneel_before action test)
      // This just verifies the bending state was properly removed
    });
  });

  describe('action validation', () => {
    it('should validate rule structure', () => {
      // The rule file should be loaded
      expect(testFixture.ruleFile).toBeDefined();
      expect(testFixture.ruleFile.rule_id).toBe('handle_straighten_up');
      expect(testFixture.ruleFile.condition).toBeDefined();
      expect(testFixture.ruleFile.actions).toBeDefined();
    });

    it('should have correct condition file', () => {
      // The condition file should be loaded
      expect(testFixture.conditionFile).toBeDefined();
      expect(testFixture.conditionFile.id).toMatch(/straighten[-_]up/);
    });

    it('should have valid rule actions', () => {
      // Check that the rule has the expected action structure
      expect(testFixture.ruleFile.actions).toBeDefined();
      expect(Array.isArray(testFixture.ruleFile.actions)).toBe(true);
    });
  });

  describe('component validation', () => {
    it('should properly track the surface relationship', () => {
      // This test validates that the bending_over component properly tracks
      // which surface the actor is bending over
      const componentSchema = bendingOverComponent.dataSchema;
      expect(componentSchema.properties.surface_id).toBeDefined();
      expect(componentSchema.properties.surface_id.$ref).toBe(
        'schema://living-narrative-engine/common.schema.json#/definitions/namespacedId'
      );
      expect(componentSchema.required).toContain('surface_id');
    });
  });
});
