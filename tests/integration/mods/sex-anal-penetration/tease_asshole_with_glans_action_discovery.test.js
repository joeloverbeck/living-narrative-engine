/**
 * @file Integration tests for sex-anal-penetration:tease_asshole_with_glans action discovery.
 * @description Tests forbidden components including fucking_anally.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityScenarios } from '../../../common/mods/ModEntityBuilder.js';
import { ScopeResolverHelpers } from '../../../common/mods/scopeResolverHelpers.js';
import '../../../common/mods/domainMatchers.js';
import teaseAssholeWithGlansActionJson from '../../../../data/mods/sex-anal-penetration/actions/tease_asshole_with_glans.action.json' assert { type: 'json' };

describe('sex-anal-penetration:tease_asshole_with_glans action discovery', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'sex-anal-penetration',
      'sex-anal-penetration:tease_asshole_with_glans'
    );
    testFixture.testEnv.actionIndex.buildIndex([teaseAssholeWithGlansActionJson]);
    ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv);

    await testFixture.registerCustomScope(
      'sex-anal-penetration',
      'actors_with_exposed_asshole_accessible_from_behind'
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  describe('Forbidden components validation', () => {
    it('should NOT be discovered when actor has fucking_anally component', () => {
      const scenario = testFixture.createCloseActors(['Alice', 'Bob']);

      // Make Bob face away from Alice with exposed asshole
      scenario.target.components['positioning:facing_away'] = {
        facing_away_from: [scenario.actor.id],
      };
      scenario.target.components['anatomy:body_part_types'] = {
        types: ['asshole'],
      };
      scenario.target.components['clothing:socket_coverage'] = {
        sockets: {},
      };

      // Alice has uncovered penis
      scenario.actor.components['anatomy:body_part_types'] = {
        types: ['penis'],
      };
      scenario.actor.components['clothing:socket_coverage'] = {
        sockets: {},
      };

      // Alice is actively fucking someone anally
      scenario.actor.components['positioning:fucking_anally'] = {
        being_fucked_entity_id: 'other_entity',
        initiated: true,
      };

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);

      const actions = testFixture.testEnv.getAvailableActions(scenario.actor.id);
      const ids = actions.map((action) => action.id);

      expect(ids).not.toContain('sex-anal-penetration:tease_asshole_with_glans');
    });

    it('should NOT be discovered when actor has fucking_vaginally component', () => {
      const scenario = testFixture.createCloseActors(['Alice', 'Bob']);

      // Make Bob face away from Alice with exposed asshole
      scenario.target.components['positioning:facing_away'] = {
        facing_away_from: [scenario.actor.id],
      };
      scenario.target.components['anatomy:body_part_types'] = {
        types: ['asshole'],
      };
      scenario.target.components['clothing:socket_coverage'] = {
        sockets: {},
      };

      // Alice has uncovered penis
      scenario.actor.components['anatomy:body_part_types'] = {
        types: ['penis'],
      };
      scenario.actor.components['clothing:socket_coverage'] = {
        sockets: {},
      };

      // Alice is actively fucking someone vaginally (cannot use same penis for anal)
      scenario.actor.components['positioning:fucking_vaginally'] = {
        targetId: 'other_entity',
      };

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);

      const actions = testFixture.testEnv.getAvailableActions(scenario.actor.id);
      const ids = actions.map((action) => action.id);

      expect(ids).not.toContain('sex-anal-penetration:tease_asshole_with_glans');
    });
  });
});
