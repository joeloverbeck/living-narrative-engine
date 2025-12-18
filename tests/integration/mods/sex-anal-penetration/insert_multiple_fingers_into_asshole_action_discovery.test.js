import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityScenarios } from '../../../common/mods/ModEntityBuilder.js';
import { ScopeResolverHelpers } from '../../../common/mods/scopeResolverHelpers.js';
import '../../../common/mods/domainMatchers.js';
import insertMultipleFingersIntoAssholeActionJson from '../../../../data/mods/sex-anal-penetration/actions/insert_multiple_fingers_into_asshole.action.json' assert { type: 'json' };

describe('sex-anal-penetration:insert_multiple_fingers_into_asshole action discovery', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'sex-anal-penetration',
      'sex-anal-penetration:insert_multiple_fingers_into_asshole'
    );
    testFixture.testEnv.actionIndex.buildIndex([
      insertMultipleFingersIntoAssholeActionJson,
    ]);
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  describe('Action structure validation', () => {
    it('should have correct action metadata', () => {
      expect(insertMultipleFingersIntoAssholeActionJson).toMatchObject({
        id: 'sex-anal-penetration:insert_multiple_fingers_into_asshole',
        name: 'Insert Multiple Fingers into Asshole',
        template: "insert multiple fingers into {primary}'s asshole",
      });
    });

    it('should have dark teal visual styling matching mod palette', () => {
      expect(insertMultipleFingersIntoAssholeActionJson.visual).toEqual({
        backgroundColor: '#053b3f',
        textColor: '#e0f7f9',
        hoverBackgroundColor: '#075055',
        hoverTextColor: '#f1feff',
      });
    });

    it('should have no anatomy prerequisites for actor', () => {
      expect(insertMultipleFingersIntoAssholeActionJson.prerequisites).toEqual(
        []
      );
    });

    it('should require positioning:closeness component on actor', () => {
      expect(
        insertMultipleFingersIntoAssholeActionJson.required_components
      ).toEqual({
        actor: ['positioning:closeness'],
      });
    });
  });

  describe('Action discovery scenarios', () => {
    it('should be discovered when actor is close to target with exposed asshole accessible from behind', async () => {
      const scenario = testFixture.createCloseActors(['Alice', 'Bob']);

      // CRITICAL: createCloseActors calls reset() which replaces action index with empty one
      // Must re-register the action after reset
      testFixture.testEnv.actionIndex.buildIndex([
        insertMultipleFingersIntoAssholeActionJson,
      ]);

      // Register scopes AFTER reset() so they use the current entityManager
      ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv);

      // Manual scope override for sex-anal-penetration scope (avoids DSL/manual conflict)
      const originalResolveSync =
        testFixture.testEnv.unifiedScopeResolver.resolveSync.bind(
          testFixture.testEnv.unifiedScopeResolver
        );
      testFixture.testEnv.unifiedScopeResolver.resolveSync = (
        scopeName,
        context
      ) => {
        if (
          scopeName ===
          'sex-anal-penetration:actors_with_exposed_asshole_accessible_from_behind'
        ) {
          const actorId = context?.actor?.id;
          if (!actorId) return { success: true, value: new Set() };

          const actor =
            testFixture.testEnv.entityManager.getEntityInstance(actorId);
          const closenessPartners =
            actor?.components?.['positioning:closeness']?.partners;

          if (
            !Array.isArray(closenessPartners) ||
            closenessPartners.length === 0
          ) {
            return { success: true, value: new Set() };
          }

          const validPartners = closenessPartners.filter((partnerId) => {
            const partner =
              testFixture.testEnv.entityManager.getEntityInstance(partnerId);
            if (!partner) return false;

            // Check if partner has asshole
            const hasParts =
              partner.components?.['anatomy:body_part_types']?.types || [];
            if (!hasParts.includes('asshole')) return false;

            // Check if asshole is uncovered
            const socketCoverage =
              partner.components?.['clothing:socket_coverage']?.sockets || {};
            if (socketCoverage.asshole?.covered) return false;

            // Check if partner is facing away from actor OR lying down
            const facingAway =
              partner.components?.['positioning:facing_away']
                ?.facing_away_from || [];
            const isLyingDown = partner.components?.['positioning:lying_down'];

            return facingAway.includes(actorId) || isLyingDown;
          });

          return { success: true, value: new Set(validPartners) };
        }
        return originalResolveSync(scopeName, context);
      };

      // Make Bob face away from Alice and expose his asshole
      testFixture.testEnv.entityManager.addComponent(
        scenario.target.id,
        'positioning:facing_away',
        { facing_away_from: [scenario.actor.id] }
      );
      testFixture.testEnv.entityManager.addComponent(
        scenario.target.id,
        'anatomy:body_part_types',
        { types: ['asshole'] }
      );
      testFixture.testEnv.entityManager.addComponent(
        scenario.target.id,
        'clothing:socket_coverage',
        { sockets: {} }
      );

      const actions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = actions.map((action) => action.id);

      expect(ids).toContain(
        'sex-anal-penetration:insert_multiple_fingers_into_asshole'
      );
    });

    it('should NOT be discovered when actors are not close', async () => {
      const scenario = testFixture.createCloseActors(['Alice', 'Bob']);

      // Remove closeness components
      testFixture.testEnv.entityManager.removeComponent(
        scenario.actor.id,
        'positioning:closeness'
      );
      testFixture.testEnv.entityManager.removeComponent(
        scenario.target.id,
        'positioning:closeness'
      );

      // Setup target with exposed asshole facing away
      testFixture.testEnv.entityManager.addComponent(
        scenario.target.id,
        'positioning:facing_away',
        { facing_away_from: [scenario.actor.id] }
      );
      testFixture.testEnv.entityManager.addComponent(
        scenario.target.id,
        'anatomy:body_part_types',
        { types: ['asshole'] }
      );
      testFixture.testEnv.entityManager.addComponent(
        scenario.target.id,
        'clothing:socket_coverage',
        { sockets: {} }
      );

      const actions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = actions.map((action) => action.id);

      expect(ids).not.toContain(
        'sex-anal-penetration:insert_multiple_fingers_into_asshole'
      );
    });

    it("should NOT be discovered when target's asshole is covered", async () => {
      const scenario = testFixture.createCloseActors(['Alice', 'Bob']);

      // Make Bob face away from Alice
      testFixture.testEnv.entityManager.addComponent(
        scenario.target.id,
        'positioning:facing_away',
        { facing_away_from: [scenario.actor.id] }
      );
      testFixture.testEnv.entityManager.addComponent(
        scenario.target.id,
        'anatomy:body_part_types',
        { types: ['asshole'] }
      );
      // Cover the asshole socket
      testFixture.testEnv.entityManager.addComponent(
        scenario.target.id,
        'clothing:socket_coverage',
        { sockets: { asshole: { covered: true } } }
      );

      const actions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = actions.map((action) => action.id);

      expect(ids).not.toContain(
        'sex-anal-penetration:insert_multiple_fingers_into_asshole'
      );
    });

    it('should NOT be discovered when target does not have asshole body part', async () => {
      const scenario = testFixture.createCloseActors(['Alice', 'Bob']);

      // Make Bob face away from Alice but without asshole
      testFixture.testEnv.entityManager.addComponent(
        scenario.target.id,
        'positioning:facing_away',
        { facing_away_from: [scenario.actor.id] }
      );
      testFixture.testEnv.entityManager.addComponent(
        scenario.target.id,
        'anatomy:body_part_types',
        { types: [] }
      );
      testFixture.testEnv.entityManager.addComponent(
        scenario.target.id,
        'clothing:socket_coverage',
        { sockets: {} }
      );

      const actions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = actions.map((action) => action.id);

      expect(ids).not.toContain(
        'sex-anal-penetration:insert_multiple_fingers_into_asshole'
      );
    });

    it('should NOT be discovered when actor has fucking_anally component', async () => {
      const scenario = testFixture.createCloseActors(['Alice', 'Bob']);

      // Make Bob face away from Alice with exposed asshole
      testFixture.testEnv.entityManager.addComponent(
        scenario.target.id,
        'positioning:facing_away',
        { facing_away_from: [scenario.actor.id] }
      );
      testFixture.testEnv.entityManager.addComponent(
        scenario.target.id,
        'anatomy:body_part_types',
        { types: ['asshole'] }
      );
      testFixture.testEnv.entityManager.addComponent(
        scenario.target.id,
        'clothing:socket_coverage',
        { sockets: {} }
      );

      // Alice is actively fucking someone anally
      testFixture.testEnv.entityManager.addComponent(
        scenario.actor.id,
        'sex-states:fucking_anally',
        { being_fucked_entity_id: 'other_entity', initiated: true }
      );

      const actions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = actions.map((action) => action.id);

      expect(ids).not.toContain(
        'sex-anal-penetration:insert_multiple_fingers_into_asshole'
      );
    });
  });
});
