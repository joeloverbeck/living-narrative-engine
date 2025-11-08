import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityScenarios } from '../../../common/mods/ModEntityBuilder.js';
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
    testFixture.testEnv.actionIndex.buildIndex([pushGlansIntoAssholeActionJson]);
    ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv);

    // Register the sex-anal-penetration mod's custom scope
    // This automatically loads dependency conditions like positioning:actor-in-entity-facing-away
    await testFixture.registerCustomScope(
      'sex-anal-penetration',
      'actors_with_exposed_asshole_accessible_from_behind'
    );
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

    it('should forbid positioning:fucking_anally component on actor', () => {
      expect(pushGlansIntoAssholeActionJson.forbidden_components).toEqual({
        actor: ['positioning:fucking_anally'],
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
      const scenario = testFixture.createCloseActors(['Alice', 'Bob']);

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

      // Alice needs uncovered penis
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

      const actions = testFixture.testEnv.getAvailableActions(scenario.actor.id);
      const ids = actions.map((action) => action.id);

      expect(ids).toContain('sex-anal-penetration:push_glans_into_asshole');
    });

    it('should NOT be discovered when actors are not close', async () => {
      const scenario = testFixture.createCloseActors(['Alice', 'Bob']);

      // Remove closeness components
      testFixture.testEnv.entityManager.removeComponent(scenario.actor.id, 'positioning:closeness');
      testFixture.testEnv.entityManager.removeComponent(scenario.target.id, 'positioning:closeness');

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

      const actions = testFixture.testEnv.getAvailableActions(scenario.actor.id);
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

      const actions = testFixture.testEnv.getAvailableActions(scenario.actor.id);
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

      const actions = testFixture.testEnv.getAvailableActions(scenario.actor.id);
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

      const actions = testFixture.testEnv.getAvailableActions(scenario.actor.id);
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
        'positioning:fucking_anally',
        { being_fucked_entity_id: 'other_entity', initiated: true }
      );

      const actions = testFixture.testEnv.getAvailableActions(scenario.actor.id);
      const ids = actions.map((action) => action.id);

      expect(ids).not.toContain('sex-anal-penetration:push_glans_into_asshole');
    });
  });
});
