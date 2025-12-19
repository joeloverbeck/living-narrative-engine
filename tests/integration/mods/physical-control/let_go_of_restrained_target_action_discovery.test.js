/**
 * @file Integration tests for physical-control:let_go_of_restrained_target action discovery.
 * @description Ensures only the actively restrained target is eligible and the action is deterministic.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModActionTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import letGoAction from '../../../../data/mods/physical-control/actions/let_go_of_restrained_target.action.json' assert { type: 'json' };

const ACTION_ID = 'physical-control:let_go_of_restrained_target';

describe('physical-control:let_go_of_restrained_target action discovery', () => {
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

    configureActionDiscovery = () => {
      const { testEnv } = testFixture;
      if (!testEnv) {
        return;
      }

      testEnv.actionIndex.buildIndex([letGoAction]);

      const scopeResolver = testEnv.unifiedScopeResolver;
      const originalResolve =
        scopeResolver.__letGoOriginalResolve ||
        scopeResolver.resolveSync.bind(scopeResolver);

      scopeResolver.__letGoOriginalResolve = originalResolve;
      scopeResolver.resolveSync = (scopeName, context) => {
        if (scopeName === 'physical-control:restrained_entity_i_am_holding') {
          const actorId = context?.actor?.id;
          if (!actorId) {
            return { success: true, value: new Set() };
          }

          const { entityManager } = testEnv;
          const actorEntity = entityManager.getEntityInstance(actorId);
          if (!actorEntity) {
            return { success: true, value: new Set() };
          }

          const restraining =
            actorEntity.components?.['physical-control-states:restraining'] || null;
          const targetId = restraining?.restrained_entity_id;

          if (!targetId) {
            return { success: true, value: new Set() };
          }

          const target = entityManager.getEntityInstance(targetId);
          if (!target) {
            return { success: true, value: new Set() };
          }

          const beingRestrained =
            target.components?.['physical-control-states:being_restrained'] || null;
          if (beingRestrained?.restraining_entity_id !== actorId) {
            return { success: true, value: new Set() };
          }

          return { success: true, value: new Set([targetId]) };
        }

        return originalResolve(scopeName, context);
      };
    };
  });

  afterEach(() => {
    if (testFixture?.testEnv?.unifiedScopeResolver?.__letGoOriginalResolve) {
      testFixture.testEnv.unifiedScopeResolver.resolveSync =
        testFixture.testEnv.unifiedScopeResolver.__letGoOriginalResolve;
    }

    if (testFixture) {
      testFixture.cleanup();
    }
  });

  const setupScenario = (options = {}) => {
    const room = ModEntityScenarios.createRoom('room1', 'Training Room');

    const actorBuilder = new ModEntityBuilder('test:actor')
      .withName('Warden')
      .atLocation('room1')
      .withLocationComponent('room1')
      .asActor();

    const actor = actorBuilder.build();

    const targetBuilder = new ModEntityBuilder('test:target')
      .withName('Detainee')
      .atLocation('room1')
      .withLocationComponent('room1')
      .asActor();

    const target = targetBuilder.build();

    if (options.addRestraining !== false) {
      actor.components['physical-control-states:restraining'] = {
        restrained_entity_id: target.id,
        initiated: true,
      };
    }

    if (options.addBeingRestrained !== false) {
      target.components['physical-control-states:being_restrained'] = {
        restraining_entity_id: actor.id,
      };
    }

    const entities = [room, actor, target];

    if (options.extraActorsCount) {
      for (let i = 0; i < options.extraActorsCount; i += 1) {
        const extra = new ModEntityBuilder(`test:observer-${i + 1}`)
          .withName(`Observer ${i + 1}`)
          .atLocation('room1')
          .withLocationComponent('room1')
          .asActor()
          .build();
        entities.push(extra);
      }
    }

    if (options.omitTarget) {
      entities.splice(entities.indexOf(target), 1);
    }

    testFixture.reset(entities);
    return { actor, target };
  };

  describe('Action structure', () => {
    it('is deterministic without chance configuration', () => {
      expect(letGoAction.chanceBased).toBeUndefined();
      expect(letGoAction.generateCombinations).toBe(false);
      expect(letGoAction.template).toBe('let go of {target}');
      expect(letGoAction.required_components.actor).toEqual([
        'physical-control-states:restraining',
      ]);
      expect(letGoAction.targets.primary.scope).toBe(
        'physical-control:restrained_entity_i_am_holding'
      );
    });
  });

  describe('Action discovery scenarios', () => {
    it('is available when the actor is restraining a valid target linked back to them', () => {
      const { actor } = setupScenario();
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).toContain(ACTION_ID);
    });

    it('is not available when the actor lacks physical-control-states:restraining', () => {
      const { actor } = setupScenario({ addRestraining: false });
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });

    it('is not available when the restrained entity reference is stale or missing', () => {
      const { actor } = setupScenario({ omitTarget: true });
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });

    it('is not available when the target is missing the reciprocal being_restrained link', () => {
      const { actor } = setupScenario({ addBeingRestrained: false });
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });

    it('remains available when other actors are present but only the restrained target matches the scope', () => {
      const { actor, target } = setupScenario({ extraActorsCount: 2 });
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        actor.id
      );
      const action = availableActions.find(({ id }) => id === ACTION_ID);

      expect(action).toBeDefined();
      const scopeResult = testFixture.testEnv.unifiedScopeResolver.resolveSync(
        'physical-control:restrained_entity_i_am_holding',
        { actor: testFixture.entityManager.getEntityInstance(actor.id) }
      );
      expect(Array.from(scopeResult.value)).toEqual([target.id]);
    });
  });
});
