/**
 * @file Integration tests verifying lift_onto_lap actions are forbidden when actor has giving_blowjob component.
 * @description Tests the forbidden_components.actor restriction for blowjob scenarios.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityScenarios,
  ModEntityBuilder,
} from '../../../common/mods/ModEntityBuilder.js';
import liftOntoLapFaceToFaceAction from '../../../../data/mods/positioning/actions/lift_onto_lap_face_to_face.action.json';
import liftOntoLapFacingAwayAction from '../../../../data/mods/positioning/actions/lift_onto_lap_facing_away.action.json';

describe('lift_onto_lap actions - giving_blowjob forbidden component', () => {
  let testFixture;
  let configureActionDiscovery;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'positioning',
      'positioning:lift_onto_lap_face_to_face'
    );

    configureActionDiscovery = (actions) => {
      const { testEnv } = testFixture;
      if (!testEnv) {
        return;
      }

      testEnv.actionIndex.buildIndex(actions);

      const scopeResolver = testEnv.unifiedScopeResolver;
      const originalResolve =
        scopeResolver.__liftLapOriginalResolve ||
        scopeResolver.resolveSync.bind(scopeResolver);

      scopeResolver.__liftLapOriginalResolve = originalResolve;
      scopeResolver.resolveSync = (scopeName, context) => {
        if (scopeName === 'positioning:actors_both_sitting_close') {
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
            actorEntity.components?.['positioning:closeness']?.partners || [];
          const actorSittingOn =
            actorEntity.components?.['positioning:sitting_on'];

          if (!actorSittingOn || closeness.length === 0) {
            return { success: true, value: new Set() };
          }

          const validTargets = closeness.filter((partnerId) => {
            const partner = entityManager.getEntityInstance(partnerId);
            if (!partner) {
              return false;
            }
            return !!partner.components?.['positioning:sitting_on'];
          });

          return { success: true, value: new Set(validTargets) };
        }

        return originalResolve(scopeName, context);
      };
    };
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  describe('Action structure validation', () => {
    it('lift_onto_lap_face_to_face should have sex-states:giving_blowjob as forbidden component', () => {
      expect(liftOntoLapFaceToFaceAction.forbidden_components.actor).toContain(
        'sex-states:giving_blowjob'
      );
    });

    it('lift_onto_lap_facing_away should have sex-states:giving_blowjob as forbidden component', () => {
      expect(liftOntoLapFacingAwayAction.forbidden_components.actor).toContain(
        'sex-states:giving_blowjob'
      );
    });
  });

  describe('lift_onto_lap_face_to_face', () => {
    const ACTION_ID = 'positioning:lift_onto_lap_face_to_face';

    describe('Baseline: Action available without giving_blowjob', () => {
      it('should be available when both actors sitting close', () => {
        const room = ModEntityScenarios.createRoom('room1', 'Test Room');
        const chair1 = new ModEntityBuilder('chair1')
          .withName('Chair 1')
          .atLocation('room1')
          .build();
        const chair2 = new ModEntityBuilder('chair2')
          .withName('Chair 2')
          .atLocation('room1')
          .build();

        const actor = new ModEntityBuilder('actor1')
          .withName('Alice')
          .atLocation('room1')
          .asActor()
          .build();

        const target = new ModEntityBuilder('target1')
          .withName('Bob')
          .atLocation('room1')
          .asActor()
          .build();

        actor.components['positioning:sitting_on'] = { furniture_id: 'chair1' };
        target.components['positioning:sitting_on'] = {
          furniture_id: 'chair2',
        };
        actor.components['positioning:closeness'] = { partners: [target.id] };
        target.components['positioning:closeness'] = { partners: [actor.id] };

        testFixture.reset([room, chair1, chair2, actor, target]);
        configureActionDiscovery([liftOntoLapFaceToFaceAction]);

        const availableActions = testFixture.testEnv.getAvailableActions(
          actor.id
        );
        const ids = availableActions.map((action) => action.id);

        expect(ids).toContain(ACTION_ID);
      });
    });

    describe('Forbidden: Action not available when actor giving blowjob', () => {
      it('should NOT be available when actor has giving_blowjob component', () => {
        const room = ModEntityScenarios.createRoom('room1', 'Test Room');
        const chair1 = new ModEntityBuilder('chair1')
          .withName('Chair 1')
          .atLocation('room1')
          .build();
        const chair2 = new ModEntityBuilder('chair2')
          .withName('Chair 2')
          .atLocation('room1')
          .build();

        const actor = new ModEntityBuilder('actor1')
          .withName('Charlie')
          .atLocation('room1')
          .asActor()
          .build();

        const target = new ModEntityBuilder('target1')
          .withName('Dana')
          .atLocation('room1')
          .asActor()
          .build();

        actor.components['positioning:sitting_on'] = { furniture_id: 'chair1' };
        target.components['positioning:sitting_on'] = {
          furniture_id: 'chair2',
        };
        actor.components['positioning:closeness'] = { partners: [target.id] };
        target.components['positioning:closeness'] = { partners: [actor.id] };

        // Actor is giving a blowjob
        actor.components['sex-states:giving_blowjob'] = {
          receiving_entity_id: target.id,
          initiated: true,
          consented: true,
        };

        testFixture.reset([room, chair1, chair2, actor, target]);
        configureActionDiscovery([liftOntoLapFaceToFaceAction]);

        const availableActions = testFixture.testEnv.getAvailableActions(
          actor.id
        );
        const ids = availableActions.map((action) => action.id);

        expect(ids).not.toContain(ACTION_ID);
      });
    });
  });

  describe('lift_onto_lap_facing_away', () => {
    const ACTION_ID = 'positioning:lift_onto_lap_facing_away';

    describe('Baseline: Action available without giving_blowjob', () => {
      it('should be available when both actors sitting close', () => {
        const room = ModEntityScenarios.createRoom('room1', 'Test Room');
        const chair1 = new ModEntityBuilder('chair1')
          .withName('Chair 1')
          .atLocation('room1')
          .build();
        const chair2 = new ModEntityBuilder('chair2')
          .withName('Chair 2')
          .atLocation('room1')
          .build();

        const actor = new ModEntityBuilder('actor1')
          .withName('Eve')
          .atLocation('room1')
          .asActor()
          .build();

        const target = new ModEntityBuilder('target1')
          .withName('Frank')
          .atLocation('room1')
          .asActor()
          .build();

        actor.components['positioning:sitting_on'] = { furniture_id: 'chair1' };
        target.components['positioning:sitting_on'] = {
          furniture_id: 'chair2',
        };
        actor.components['positioning:closeness'] = { partners: [target.id] };
        target.components['positioning:closeness'] = { partners: [actor.id] };

        testFixture.reset([room, chair1, chair2, actor, target]);
        configureActionDiscovery([liftOntoLapFacingAwayAction]);

        const availableActions = testFixture.testEnv.getAvailableActions(
          actor.id
        );
        const ids = availableActions.map((action) => action.id);

        expect(ids).toContain(ACTION_ID);
      });
    });

    describe('Forbidden: Action not available when actor giving blowjob', () => {
      it('should NOT be available when actor has giving_blowjob component', () => {
        const room = ModEntityScenarios.createRoom('room1', 'Test Room');
        const chair1 = new ModEntityBuilder('chair1')
          .withName('Chair 1')
          .atLocation('room1')
          .build();
        const chair2 = new ModEntityBuilder('chair2')
          .withName('Chair 2')
          .atLocation('room1')
          .build();

        const actor = new ModEntityBuilder('actor1')
          .withName('Grace')
          .atLocation('room1')
          .asActor()
          .build();

        const target = new ModEntityBuilder('target1')
          .withName('Henry')
          .atLocation('room1')
          .asActor()
          .build();

        actor.components['positioning:sitting_on'] = { furniture_id: 'chair1' };
        target.components['positioning:sitting_on'] = {
          furniture_id: 'chair2',
        };
        actor.components['positioning:closeness'] = { partners: [target.id] };
        target.components['positioning:closeness'] = { partners: [actor.id] };

        // Actor is giving a blowjob
        actor.components['sex-states:giving_blowjob'] = {
          receiving_entity_id: target.id,
          initiated: true,
          consented: true,
        };

        testFixture.reset([room, chair1, chair2, actor, target]);
        configureActionDiscovery([liftOntoLapFacingAwayAction]);

        const availableActions = testFixture.testEnv.getAvailableActions(
          actor.id
        );
        const ids = availableActions.map((action) => action.id);

        expect(ids).not.toContain(ACTION_ID);
      });
    });
  });
});
