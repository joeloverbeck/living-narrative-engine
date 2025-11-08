/**
 * @file Integration tests for sex-dry-intimacy:rub_penis_between_ass_cheeks action discovery.
 * @description Tests forbidden components including fucking_anally.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityScenarios } from '../../../common/mods/ModEntityBuilder.js';
import { ScopeResolverHelpers } from '../../../common/mods/scopeResolverHelpers.js';
import '../../../common/mods/domainMatchers.js';
import rubPenisBetweenAssCheeksActionJson from '../../../../data/mods/sex-dry-intimacy/actions/rub_penis_between_ass_cheeks.action.json' assert { type: 'json' };

describe('sex-dry-intimacy:rub_penis_between_ass_cheeks action discovery', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'sex-dry-intimacy',
      'sex-dry-intimacy:rub_penis_between_ass_cheeks'
    );
    testFixture.testEnv.actionIndex.buildIndex([rubPenisBetweenAssCheeksActionJson]);
    ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv);

    await testFixture.registerCustomScope(
      'sex-dry-intimacy',
      'actors_with_exposed_ass_facing_away'
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  describe('Forbidden components validation', () => {
    it('should NOT be discovered when actor has fucking_anally component', () => {
      const scenario = testFixture.createCloseActors(['Alice', 'Bob']);

      // Make Alice be behind Bob
      scenario.actor.components['positioning:behind'] = {
        behind_entity_id: scenario.target.id,
      };

      // Alice has uncovered penis
      scenario.actor.components['anatomy:body_part_types'] = {
        types: ['penis'],
      };
      scenario.actor.components['clothing:socket_coverage'] = {
        sockets: {},
      };

      // Bob has asshole
      scenario.target.components['anatomy:body_part_types'] = {
        types: ['asshole'],
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

      expect(ids).not.toContain('sex-dry-intimacy:rub_penis_between_ass_cheeks');
    });
  });
});
