/**
 * @file Integration tests for physical-control:restrain_target action discovery.
 * @description Ensures targets already being restrained are excluded via forbidden_components.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModActionTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import restrainTargetAction from '../../../../data/mods/physical-control/actions/restrain_target.action.json';

const ACTION_ID = 'physical-control:restrain_target';

describe('physical-control:restrain_target action discovery', () => {
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

      testEnv.actionIndex.buildIndex([restrainTargetAction]);

      const scopeResolver = testEnv.unifiedScopeResolver;
      const originalResolve =
        scopeResolver.__restrainTargetOriginalResolve ||
        scopeResolver.resolveSync.bind(scopeResolver);

      scopeResolver.__restrainTargetOriginalResolve = originalResolve;
      scopeResolver.resolveSync = (scopeName, context) => {
        if (scopeName === 'core:actors_in_location') {
          const actorId = context?.actor?.id;
          if (!actorId) {
            return { success: true, value: new Set() };
          }

          const { entityManager } = testEnv;
          const actorLocation = entityManager.getComponentData(
            actorId,
            'core:position'
          )?.locationId;

          if (!actorLocation) {
            return { success: true, value: new Set() };
          }

          const targets = new Set();
          for (const entityId of entityManager.getEntityIds()) {
            if (entityId === actorId) {
              continue;
            }

            const position = entityManager.getComponentData(
              entityId,
              'core:position'
            );
            const isActor = entityManager.getComponentData(
              entityId,
              'core:actor'
            );

            if (position?.locationId === actorLocation && isActor) {
              targets.add(entityId);
            }
          }

          return { success: true, value: targets };
        }

        return originalResolve(scopeName, context);
      };
    };
  });

  afterEach(() => {
    if (
      testFixture?.testEnv?.unifiedScopeResolver
        ?.__restrainTargetOriginalResolve
    ) {
      testFixture.testEnv.unifiedScopeResolver.resolveSync =
        testFixture.testEnv.unifiedScopeResolver.__restrainTargetOriginalResolve;
    }

    if (testFixture) {
      testFixture.cleanup();
    }
  });

  const setupScenario = (targetComponents = {}, actorOptions = {}) => {
    const room = ModEntityScenarios.createRoom('room1', 'Training Room');

    const actorBuilder = new ModEntityBuilder('test:actor')
      .withName('Grappler')
      .atLocation('room1')
      .withLocationComponent('room1')
      .asActor()
      .withComponent('skills:grappling_skill', { value: 15 })
      .withGrabbingHands(2);

    const actor = actorBuilder.build();
    const handEntities = actorBuilder.getHandEntities();

    const targetBuilder = new ModEntityBuilder('test:target')
      .withName('Target')
      .atLocation('room1')
      .withLocationComponent('room1')
      .asActor();

    const target = targetBuilder.build();
    Object.assign(target.components, targetComponents);

    if (typeof actorOptions.actorCustomizer === 'function') {
      actorOptions.actorCustomizer({ actor, target, handEntities });
    }

    testFixture.reset([room, actor, target, ...handEntities]);
    return { actor, target, handEntities };
  };

  describe('Action structure', () => {
    it('forbids restraining targets already being restrained', () => {
      expect(restrainTargetAction.forbidden_components.primary).toContain(
        'positioning:being_restrained'
      );
    });
  });

  describe('Action discovery scenarios', () => {
    it('is available when actor has grappling skill and two free grabbing appendages', () => {
      const { actor } = setupScenario();
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).toContain(ACTION_ID);
    });

    it('is not available when actor lacks the grappling skill', () => {
      const { actor } = setupScenario(
        {},
        {
          actorCustomizer: ({ actor }) => {
            delete actor.components['skills:grappling_skill'];
          },
        }
      );
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });

    it('is not available when fewer than two grabbing appendages are free', () => {
      const { actor } = setupScenario(
        {},
        {
          actorCustomizer: ({ handEntities }) => {
            handEntities.forEach((hand) => {
              if (hand.components?.['anatomy:can_grab']) {
                hand.components['anatomy:can_grab'].locked = true;
              }
            });
          },
        }
      );
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });

    it('is not available when target is already being restrained', () => {
      const { actor } = setupScenario({
        'positioning:being_restrained': {
          restraining_entity_id: 'test:other',
          consented: false,
        },
      });
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });

    it('is not available when actor is sitting on furniture', () => {
      const { actor } = setupScenario(
        {},
        {
          actorCustomizer: ({ actor }) => {
            actor.components['positioning:sitting_on'] = {
              furniture_id: 'test:couch',
              spot_index: 0,
            };
          },
        }
      );
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });
  });
});
