/**
 * @file Integration tests for physical-control:break_free_from_restraint action discovery.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModActionTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import { ScopeResolverHelpers } from '../../../common/mods/scopeResolverHelpers.js';
import breakFreeAction from '../../../../data/mods/physical-control/actions/break_free_from_restraint.action.json' assert { type: 'json' };

const ACTION_ID = 'physical-control:break_free_from_restraint';

describe('physical-control:break_free_from_restraint action discovery', () => {
  let testFixture;
  let configureActionDiscovery;

  beforeEach(async () => {
    testFixture = new ModActionTestFixture(
      'physical-control',
      ACTION_ID,
      null,
      null
    );
    await testFixture.initialize();
    await ScopeResolverHelpers.registerCustomScope(
      testFixture.testEnv,
      'physical-control',
      'restraining_entity_from_being_restrained',
      { loadConditions: false }
    );

    configureActionDiscovery = () => {
      const { testEnv } = testFixture;
      if (!testEnv) {
        return;
      }

      testEnv.actionIndex.buildIndex([breakFreeAction]);
    };
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  const setupScenario = (options = {}) => {
    const {
      withBeingRestrained = true,
      withMutualLink = true,
      restrainerId = 'actor:restrainer',
      createTarget = true,
      includeBystander = false,
    } = options;

    const room = ModEntityScenarios.createRoom('room1', 'Training Room');

    const actorBuilder = new ModEntityBuilder('actor:restrained')
      .withName('Restrained Actor')
      .asActor()
      .atLocation('room1')
      .withLocationComponent('room1');

    if (withBeingRestrained) {
      actorBuilder.withComponent('positioning:being_restrained', {
        restraining_entity_id: restrainerId,
      });
    }

    const actor = actorBuilder.build();

    const entities = [room, actor];
    let target = null;

    if (createTarget) {
      const targetBuilder = new ModEntityBuilder(restrainerId)
        .withName('Restrainer')
        .asActor()
        .atLocation('room1')
        .withLocationComponent('room1');

      if (withMutualLink) {
        targetBuilder.withComponent('positioning:restraining', {
          restrained_entity_id: actor.id,
          initiated: true,
        });
      }

      target = targetBuilder.build();
      entities.push(target);
    }

    if (includeBystander) {
      entities.push(
        new ModEntityBuilder('actor:bystander')
          .withName('Bystander')
          .asActor()
          .atLocation('room1')
          .withLocationComponent('room1')
          .build()
      );
    }

    testFixture.reset(entities);
    return { actor, target };
  };

  describe('Action requirements', () => {
    it('requires positioning:being_restrained on the actor', () => {
      expect(breakFreeAction.required_components.actor).toContain(
        'positioning:being_restrained'
      );
    });

    it('requires the primary target to be actively restraining someone', () => {
      expect(breakFreeAction.required_components.primary).toContain(
        'positioning:restraining'
      );
    });
  });

  describe('Action discovery scenarios', () => {
    it('is available when the actor is restrained and the restrainer is linked back', () => {
      const { actor } = setupScenario();
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).toContain(ACTION_ID);
    });

    it('is not available when the actor is not restrained', () => {
      const { actor } = setupScenario({
        withBeingRestrained: false,
      });
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });

    it('is not available when the restraining link points to a missing entity', () => {
      const { actor } = setupScenario({
        createTarget: false,
        restrainerId: 'actor:missing',
      });
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });

    it('is not available when the referenced restrainer no longer has a matching restraining component', () => {
      const { actor } = setupScenario({
        withMutualLink: false,
      });
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });

    it('scope resolves only the restraining entity', () => {
      const { actor, target } = setupScenario({ includeBystander: true });

      const resolution = testFixture.testEnv.unifiedScopeResolver.resolveSync(
        'physical-control:restraining_entity_from_being_restrained',
        { actor }
      );

      expect(resolution.success).toBe(true);
      expect(resolution.value).toBeInstanceOf(Set);
      expect([...resolution.value]).toEqual([target.id]);
    });
  });
});
