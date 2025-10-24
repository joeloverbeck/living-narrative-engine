/**
 * @file Integration tests verifying positioning:get_up_from_furniture is forbidden when actor has giving_blowjob component.
 * @description Tests the forbidden_components.actor restriction for blowjob scenarios.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityScenarios,
  ModEntityBuilder,
} from '../../../common/mods/ModEntityBuilder.js';
import getUpFromFurnitureAction from '../../../../data/mods/positioning/actions/get_up_from_furniture.action.json';

const ACTION_ID = 'positioning:get_up_from_furniture';

describe('positioning:get_up_from_furniture - giving_blowjob forbidden component', () => {
  let testFixture;
  let configureActionDiscovery;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('positioning', ACTION_ID);

    configureActionDiscovery = () => {
      const { testEnv } = testFixture;
      if (!testEnv) {
        return;
      }

      testEnv.actionIndex.buildIndex([getUpFromFurnitureAction]);

      const scopeResolver = testEnv.unifiedScopeResolver;
      const originalResolve =
        scopeResolver.__getUpOriginalResolve ||
        scopeResolver.resolveSync.bind(scopeResolver);

      scopeResolver.__getUpOriginalResolve = originalResolve;
      scopeResolver.resolveSync = (scopeName, context) => {
        if (scopeName === 'positioning:furniture_im_sitting_on') {
          const actorId = context?.actor?.id;
          if (!actorId) {
            return { success: true, value: new Set() };
          }

          const { entityManager } = testEnv;
          const actorEntity = entityManager.getEntityInstance(actorId);
          if (!actorEntity) {
            return { success: true, value: new Set() };
          }

          const sittingOn =
            actorEntity.components?.['positioning:sitting_on']?.furniture_id;
          if (!sittingOn) {
            return { success: true, value: new Set() };
          }

          return { success: true, value: new Set([sittingOn]) };
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
    it('should have positioning:giving_blowjob as forbidden component', () => {
      expect(getUpFromFurnitureAction.forbidden_components.actor).toContain(
        'positioning:giving_blowjob'
      );
    });
  });

  describe('Baseline: Action available without giving_blowjob', () => {
    it('should be available when actor is sitting on furniture', () => {
      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      const chair = new ModEntityBuilder('chair1')
        .withName('Chair')
        .atLocation('room1')
        .build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .asActor()
        .build();

      actor.components['positioning:sitting_on'] = {
        furniture_id: 'chair1',
      };

      testFixture.reset([room, chair, actor]);
      configureActionDiscovery();

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
      const chair = new ModEntityBuilder('chair1')
        .withName('Chair')
        .atLocation('room1')
        .build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .build();

      const target = new ModEntityBuilder('target1')
        .withName('Charlie')
        .atLocation('room1')
        .asActor()
        .build();

      actor.components['positioning:sitting_on'] = {
        furniture_id: 'chair1',
      };

      // Actor is giving a blowjob
      actor.components['positioning:giving_blowjob'] = {
        receiving_entity_id: target.id,
        initiated: true,
        consented: true,
      };

      testFixture.reset([room, chair, actor, target]);
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });
  });
});
