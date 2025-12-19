/**
 * @file Integration tests verifying that intimate actions cannot target actors who are giving blowjobs.
 * @description Ensures that when Actor B is giving Actor A a blowjob, other actors cannot perform
 * mouth-based intimate actions on Actor B (since their mouth is occupied).
 * Tests the forbidden_components.target restriction for blowjob scenarios.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityScenarios,
  ModEntityBuilder,
} from '../../../common/mods/ModEntityBuilder.js';

// Import action definitions
import kissCheekAction from '../../../../data/mods/kissing/actions/kiss_cheek.action.json';
import kissForeheadGentlyAction from '../../../../data/mods/kissing/actions/kiss_forehead_gently.action.json';
import leanInForDeepKissAction from '../../../../data/mods/kissing/actions/lean_in_for_deep_kiss.action.json';
import nibbleEarlobePlayfullyAction from '../../../../data/mods/kissing/actions/nibble_earlobe_playfully.action.json';
import peckOnLipsAction from '../../../../data/mods/kissing/actions/peck_on_lips.action.json';
import suckOnNeckToLeaveHickeyAction from '../../../../data/mods/kissing/actions/suck_on_neck_to_leave_hickey.action.json';

/**
 * Test suite for verifying that actors giving blowjobs cannot be targeted
 * by intimate mouth-based actions.
 */
describe('Kissing actions forbidden when targeting actor giving blowjob', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'kissing',
      'kissing:kiss_cheek'
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  describe('Action structure validation', () => {
    it('kiss_cheek should have sex-states:giving_blowjob as forbidden target component', () => {
      expect(kissCheekAction.forbidden_components.target).toContain(
        'sex-states:giving_blowjob'
      );
    });

    it('kiss_forehead_gently should have sex-states:giving_blowjob as forbidden target component', () => {
      expect(kissForeheadGentlyAction.forbidden_components.target).toContain(
        'sex-states:giving_blowjob'
      );
    });

    it('lean_in_for_deep_kiss should have sex-states:giving_blowjob as forbidden target component', () => {
      expect(leanInForDeepKissAction.forbidden_components.target).toContain(
        'sex-states:giving_blowjob'
      );
    });

    it('nibble_earlobe_playfully should have sex-states:giving_blowjob as forbidden target component', () => {
      expect(
        nibbleEarlobePlayfullyAction.forbidden_components.target
      ).toContain('sex-states:giving_blowjob');
    });

    it('peck_on_lips should have sex-states:giving_blowjob as forbidden target component', () => {
      expect(peckOnLipsAction.forbidden_components.target).toContain(
        'sex-states:giving_blowjob'
      );
    });

    it('suck_on_neck_to_leave_hickey should have sex-states:giving_blowjob as forbidden target component', () => {
      expect(
        suckOnNeckToLeaveHickeyAction.forbidden_components.target
      ).toContain('sex-states:giving_blowjob');
    });
  });

  describe('Three-actor scenario: Cannot target actor giving blowjob', () => {
    /**
     * Helper to configure action discovery for kissing actions
     *
     * @param actionDefinition
     * @param scopeName
     */
    const configureActionDiscovery = (actionDefinition, scopeName) => {
      const { testEnv } = testFixture;
      if (!testEnv) {
        return;
      }

      testEnv.actionIndex.buildIndex([actionDefinition]);

      const scopeResolver = testEnv.unifiedScopeResolver;
      const originalResolve =
        scopeResolver.__kissingOriginalResolve ||
        scopeResolver.resolveSync.bind(scopeResolver);

      scopeResolver.__kissingOriginalResolve = originalResolve;
      scopeResolver.resolveSync = (scope, context) => {
        if (
          scope === scopeName ||
          scope === 'kissing:close_actors_facing_each_other' ||
          scope === 'kissing:actors_with_mouth_facing_each_other' ||
          scope === 'kissing:close_actors_facing_each_other_or_behind_target' ||
          scope ===
            'kissing:close_actors_with_ear_subtype_facing_each_other_or_behind_target' ||
          scope ===
            'kissing:close_actors_with_mouth_facing_each_other_or_behind_target'
        ) {
          const actorId = context?.actor?.id;
          if (!actorId) {
            return { success: true, value: new Set() };
          }

          const { entityManager } = testEnv;
          const actorEntity = entityManager.getEntityInstance(actorId);
          if (!actorEntity) {
            return { success: true, value: new Set() };
          }

          const closeness =
            actorEntity.components?.['personal-space-states:closeness']?.partners;
          if (!Array.isArray(closeness) || closeness.length === 0) {
            return { success: true, value: new Set() };
          }

          return { success: true, value: new Set(closeness) };
        }

        return originalResolve(scope, context);
      };
    };

    /**
     * Creates a three-actor scenario where:
     * - Actor A is receiving a blowjob from Actor B
     * - Actor B is giving a blowjob to Actor A
     * - Actor C is a third party
     */
    const createThreeActorBlowjobScenario = () => {
      const actorA = new ModEntityBuilder('actorA')
        .withName('Alice')
        .atLocation('room1')
        .asActor()
        .build();

      const actorB = new ModEntityBuilder('actorB')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .build();

      const actorC = new ModEntityBuilder('actorC')
        .withName('Charlie')
        .atLocation('room1')
        .asActor()
        .build();

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');

      // Alice is receiving a blowjob from Bob
      actorA.components['sex-states:receiving_blowjob'] = {
        giving_entity_id: actorB.id,
        consented: true,
      };

      // Bob is giving a blowjob to Alice
      actorB.components['sex-states:giving_blowjob'] = {
        receiving_entity_id: actorA.id,
        initiated: true,
        consented: true,
      };

      // Set up closeness for all three actors
      actorA.components['personal-space-states:closeness'] = {
        partners: [actorB.id, actorC.id],
      };
      actorB.components['personal-space-states:closeness'] = {
        partners: [actorA.id, actorC.id],
      };
      actorC.components['personal-space-states:closeness'] = {
        partners: [actorA.id, actorB.id],
      };

      return { room, actorA, actorB, actorC };
    };

    it('should NOT allow Actor C to kiss_cheek Actor B (who is giving blowjob)', async () => {
      const scenario = createThreeActorBlowjobScenario();
      testFixture.reset([
        scenario.room,
        scenario.actorA,
        scenario.actorB,
        scenario.actorC,
      ]);
      configureActionDiscovery(
        kissCheekAction,
        'kissing:close_actors_facing_each_other'
      );

      // Charlie tries to kiss Bob's cheek (Bob is giving blowjob)
      await expect(async () => {
        await testFixture.executeAction(scenario.actorC.id, scenario.actorB.id);
      }).rejects.toThrow(/forbidden component.*sex-states:giving_blowjob/i);
    });

    it('should NOT allow Actor C to kiss_forehead_gently Actor B (who is giving blowjob)', async () => {
      const scenario = createThreeActorBlowjobScenario();
      testFixture.reset([
        scenario.room,
        scenario.actorA,
        scenario.actorB,
        scenario.actorC,
      ]);
      configureActionDiscovery(
        kissForeheadGentlyAction,
        'kissing:close_actors_facing_each_other'
      );

      await expect(async () => {
        await testFixture.executeAction(scenario.actorC.id, scenario.actorB.id);
      }).rejects.toThrow(/forbidden component.*sex-states:giving_blowjob/i);
    });

    it('should NOT allow Actor C to lean_in_for_deep_kiss Actor B (who is giving blowjob)', async () => {
      const scenario = createThreeActorBlowjobScenario();
      testFixture.reset([
        scenario.room,
        scenario.actorA,
        scenario.actorB,
        scenario.actorC,
      ]);
      configureActionDiscovery(
        leanInForDeepKissAction,
        'kissing:actors_with_mouth_facing_each_other'
      );

      await expect(async () => {
        await testFixture.executeAction(scenario.actorC.id, scenario.actorB.id);
      }).rejects.toThrow(/forbidden component.*sex-states:giving_blowjob/i);
    });

    it('should NOT allow Actor C to nibble_earlobe_playfully Actor B (who is giving blowjob)', async () => {
      const scenario = createThreeActorBlowjobScenario();
      testFixture.reset([
        scenario.room,
        scenario.actorA,
        scenario.actorB,
        scenario.actorC,
      ]);
      configureActionDiscovery(
        nibbleEarlobePlayfullyAction,
        'kissing:close_actors_with_ear_subtype_facing_each_other_or_behind_target'
      );

      await expect(async () => {
        await testFixture.executeAction(scenario.actorC.id, scenario.actorB.id);
      }).rejects.toThrow(/forbidden component.*sex-states:giving_blowjob/i);
    });

    it('should NOT allow Actor C to peck_on_lips Actor B (who is giving blowjob)', async () => {
      const scenario = createThreeActorBlowjobScenario();
      testFixture.reset([
        scenario.room,
        scenario.actorA,
        scenario.actorB,
        scenario.actorC,
      ]);
      configureActionDiscovery(
        peckOnLipsAction,
        'kissing:close_actors_with_mouth_facing_each_other_or_behind_target'
      );

      await expect(async () => {
        await testFixture.executeAction(scenario.actorC.id, scenario.actorB.id);
      }).rejects.toThrow(/forbidden component.*sex-states:giving_blowjob/i);
    });

    it('should NOT allow Actor C to suck_on_neck_to_leave_hickey Actor B (who is giving blowjob)', async () => {
      const scenario = createThreeActorBlowjobScenario();
      testFixture.reset([
        scenario.room,
        scenario.actorA,
        scenario.actorB,
        scenario.actorC,
      ]);
      configureActionDiscovery(
        suckOnNeckToLeaveHickeyAction,
        'kissing:close_actors_facing_each_other_or_behind_target'
      );

      await expect(async () => {
        await testFixture.executeAction(scenario.actorC.id, scenario.actorB.id);
      }).rejects.toThrow(/forbidden component.*sex-states:giving_blowjob/i);
    });

    it('should ALLOW Actor A (receiving blowjob) to kiss_cheek Actor C (third party)', async () => {
      const scenario = createThreeActorBlowjobScenario();
      testFixture.reset([
        scenario.room,
        scenario.actorA,
        scenario.actorB,
        scenario.actorC,
      ]);
      configureActionDiscovery(
        kissCheekAction,
        'kissing:close_actors_facing_each_other'
      );

      // Alice (receiving blowjob) kisses Charlie (third party) - should succeed
      await expect(
        testFixture.executeAction(scenario.actorA.id, scenario.actorC.id)
      ).resolves.not.toThrow();
    });

    it('should ALLOW Actor C to kiss_cheek Actor A (who is receiving, not giving)', async () => {
      const scenario = createThreeActorBlowjobScenario();
      testFixture.reset([
        scenario.room,
        scenario.actorA,
        scenario.actorB,
        scenario.actorC,
      ]);
      configureActionDiscovery(
        kissCheekAction,
        'kissing:close_actors_facing_each_other'
      );

      // Charlie kisses Alice (who is receiving, not giving) - should succeed
      await expect(
        testFixture.executeAction(scenario.actorC.id, scenario.actorA.id)
      ).resolves.not.toThrow();
    });
  });
});
