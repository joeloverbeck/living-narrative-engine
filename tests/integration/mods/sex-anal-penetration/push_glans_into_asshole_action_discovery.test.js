import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import { ScopeResolverHelpers } from '../../../common/mods/scopeResolverHelpers.js';
import '../../../common/mods/domainMatchers.js';
import pushGlansIntoAssholeActionJson from '../../../../data/mods/sex-anal-penetration/actions/push_glans_into_asshole.action.json' assert { type: 'json' };

describe('sex-anal-penetration:push_glans_into_asshole - Action Discovery', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'sex-anal-penetration',
      'sex-anal-penetration:push_glans_into_asshole'
    );
    testFixture.testEnv.actionIndex.buildIndex([
      pushGlansIntoAssholeActionJson,
    ]);
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  describe('Action structure validation', () => {
    it('should have correct action metadata', () => {
      expect(pushGlansIntoAssholeActionJson).toMatchObject({
        id: 'sex-anal-penetration:push_glans_into_asshole',
        name: 'Push Glans Into Asshole',
        template: "push your glans into {primary}'s asshole",
      });
    });

    it('should have dark teal visual styling matching mod palette', () => {
      expect(pushGlansIntoAssholeActionJson.visual).toEqual({
        backgroundColor: '#053b3f',
        textColor: '#e0f7f9',
        hoverBackgroundColor: '#075055',
        hoverTextColor: '#f1feff',
      });
    });

    it('should require positioning:closeness component on actor', () => {
      expect(pushGlansIntoAssholeActionJson.required_components).toEqual({
        actor: ['positioning:closeness'],
      });
    });

    it('should forbid sex-states:fucking_anally and sex-states:fucking_vaginally components on actor', () => {
      expect(pushGlansIntoAssholeActionJson.forbidden_components).toEqual({
        actor: ['sex-states:fucking_anally', 'sex-states:fucking_vaginally'],
      });
    });

    it('should have prerequisites for uncovered penis', () => {
      expect(pushGlansIntoAssholeActionJson.prerequisites).toHaveLength(2);
      expect(pushGlansIntoAssholeActionJson.prerequisites[0]).toMatchObject({
        logic: {
          hasPartOfType: ['actor', 'penis'],
        },
        failure_message: 'You need a penis to perform this action.',
      });
      expect(pushGlansIntoAssholeActionJson.prerequisites[1]).toMatchObject({
        logic: {
          not: {
            isSocketCovered: ['actor', 'penis'],
          },
        },
        failure_message: 'Your penis must be uncovered to perform this action.',
      });
    });
  });

  describe('Action discovery scenarios', () => {
    it('should be discovered when close actors with exposed asshole accessible from behind', async () => {
      // Build entities with anatomy using ModEntityBuilder pattern
      const actorGroinId = 'actor_groin';
      const actorPenisId = 'actor_penis';

      const actor = new ModEntityBuilder('alice')
        .withName('Alice')
        .atLocation('room1')
        .withBody(actorGroinId)
        .asActor()
        .closeToEntity('bob')
        .build();

      const target = new ModEntityBuilder('bob')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .closeToEntity('alice')
        .withComponent('positioning:facing_away', {
          facing_away_from: ['alice'],
        })
        .withComponent('anatomy:body_part_types', { types: ['asshole'] })
        .withComponent('clothing:socket_coverage', { sockets: {} })
        .build();

      const actorGroin = new ModEntityBuilder(actorGroinId)
        .asBodyPart({
          parent: null,
          children: [actorPenisId],
          subType: 'pelvis',
        })
        .build();

      const actorPenis = new ModEntityBuilder(actorPenisId)
        .asBodyPart({
          parent: actorGroinId,
          children: [],
          subType: 'penis',
        })
        .build();

      const room = new ModEntityBuilder('room1').withName('Room').build();

      const entities = [room, actor, target, actorGroin, actorPenis];

      // Reset with all entities
      testFixture.reset(entities);

      // CRITICAL: reset() replaces action index with empty one
      // Must re-register the action after reset
      testFixture.testEnv.actionIndex.buildIndex([
        pushGlansIntoAssholeActionJson,
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

      const actions = testFixture.testEnv.getAvailableActions('alice');
      const ids = actions.map((action) => action.id);

      expect(ids).toContain('sex-anal-penetration:push_glans_into_asshole');
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

      // Alice has uncovered penis
      testFixture.testEnv.entityManager.addComponent(
        scenario.actor.id,
        'anatomy:body_part_types',
        { types: ['penis'] }
      );
      testFixture.testEnv.entityManager.addComponent(
        scenario.actor.id,
        'clothing:socket_coverage',
        { sockets: {} }
      );

      const actions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = actions.map((action) => action.id);

      expect(ids).not.toContain('sex-anal-penetration:push_glans_into_asshole');
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

      // Alice has uncovered penis
      testFixture.testEnv.entityManager.addComponent(
        scenario.actor.id,
        'anatomy:body_part_types',
        { types: ['penis'] }
      );
      testFixture.testEnv.entityManager.addComponent(
        scenario.actor.id,
        'clothing:socket_coverage',
        { sockets: {} }
      );

      const actions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = actions.map((action) => action.id);

      expect(ids).not.toContain('sex-anal-penetration:push_glans_into_asshole');
    });

    it("should NOT be discovered when actor's penis is covered", async () => {
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

      // Alice has penis but it's covered
      testFixture.testEnv.entityManager.addComponent(
        scenario.actor.id,
        'anatomy:body_part_types',
        { types: ['penis'] }
      );
      testFixture.testEnv.entityManager.addComponent(
        scenario.actor.id,
        'clothing:socket_coverage',
        { sockets: { penis: { covered: true } } }
      );

      const actions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = actions.map((action) => action.id);

      expect(ids).not.toContain('sex-anal-penetration:push_glans_into_asshole');
    });

    it('should NOT be discovered when actor lacks penis anatomy', async () => {
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

      // Alice has no penis
      testFixture.testEnv.entityManager.addComponent(
        scenario.actor.id,
        'anatomy:body_part_types',
        { types: [] }
      );
      testFixture.testEnv.entityManager.addComponent(
        scenario.actor.id,
        'clothing:socket_coverage',
        { sockets: {} }
      );

      const actions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = actions.map((action) => action.id);

      expect(ids).not.toContain('sex-anal-penetration:push_glans_into_asshole');
    });

    it('should NOT be discovered when actor already has fucking_anally component', async () => {
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

      // Alice has uncovered penis
      testFixture.testEnv.entityManager.addComponent(
        scenario.actor.id,
        'anatomy:body_part_types',
        { types: ['penis'] }
      );
      testFixture.testEnv.entityManager.addComponent(
        scenario.actor.id,
        'clothing:socket_coverage',
        { sockets: {} }
      );

      // Alice is already fucking someone anally
      testFixture.testEnv.entityManager.addComponent(
        scenario.actor.id,
        'sex-states:fucking_anally',
        { being_fucked_entity_id: 'other_entity', initiated: true }
      );

      const actions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = actions.map((action) => action.id);

      expect(ids).not.toContain('sex-anal-penetration:push_glans_into_asshole');
    });

    it('should NOT be discovered when actor already has fucking_vaginally component', async () => {
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

      // Alice has uncovered penis
      testFixture.testEnv.entityManager.addComponent(
        scenario.actor.id,
        'anatomy:body_part_types',
        { types: ['penis'] }
      );
      testFixture.testEnv.entityManager.addComponent(
        scenario.actor.id,
        'clothing:socket_coverage',
        { sockets: {} }
      );

      // Alice is already fucking someone vaginally (cannot use same penis for anal)
      testFixture.testEnv.entityManager.addComponent(
        scenario.actor.id,
        'sex-states:fucking_vaginally',
        { targetId: 'other_entity' }
      );

      const actions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = actions.map((action) => action.id);

      expect(ids).not.toContain('sex-anal-penetration:push_glans_into_asshole');
    });
  });
});
