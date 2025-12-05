/**
 * @file Integration tests for hexing:corrupting_gaze action discovery.
 * @description Ensures corrupting gaze availability gates on hexer marker, positioning forbiddances, target corruption state, and local actor scope.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModActionTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import corruptingGazeAction from '../../../../data/mods/hexing/actions/corrupting_gaze.action.json';

const ACTION_ID = 'hexing:corrupting_gaze';

describe('hexing:corrupting_gaze action discovery', () => {
  let testFixture;
  let configureActionDiscovery;

  beforeEach(async () => {
    testFixture = new ModActionTestFixture('hexing', ACTION_ID, null, null);
    await testFixture.initialize();

    configureActionDiscovery = () => {
      const { testEnv } = testFixture;
      if (!testEnv) return;

      testEnv.actionIndex.buildIndex([corruptingGazeAction]);

      const scopeResolver = testEnv.unifiedScopeResolver;
      const originalResolve =
        scopeResolver.__corruptingGazeOriginalResolve ||
        scopeResolver.resolveSync.bind(scopeResolver);

      scopeResolver.__corruptingGazeOriginalResolve = originalResolve;
      scopeResolver.resolveSync = (scopeName, context) => {
        if (scopeName === 'core:actors_in_location') {
          const actorId = context?.actor?.id;
          if (!actorId) return { success: true, value: new Set() };

          const { entityManager } = testEnv;
          const actorLocation =
            entityManager.getComponentData(actorId, 'core:position')
              ?.locationId;
          if (!actorLocation) return { success: true, value: new Set() };

          const targets = new Set();
          for (const entityId of entityManager.getEntityIds()) {
            if (entityId === actorId) continue;

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
        ?.__corruptingGazeOriginalResolve
    ) {
      testFixture.testEnv.unifiedScopeResolver.resolveSync =
        testFixture.testEnv.unifiedScopeResolver.__corruptingGazeOriginalResolve;
    }

    if (testFixture) {
      testFixture.cleanup();
    }
  });

  const setupScenario = ({
    targetComponents = {},
    actorComponents = {},
    targetLocation = 'room1',
    actorCustomizer,
  } = {}) => {
    const room = ModEntityScenarios.createRoom('room1', 'Hexed Chamber');
    const otherRoom = ModEntityScenarios.createRoom('room2', 'Distant Hall');

    const actorBuilder = new ModEntityBuilder('test:actor')
      .withName('Hexer')
      .atLocation('room1')
      .withLocationComponent('room1')
      .asActor()
      .withComponent('hexing:is_hexer', {})
      .withComponent('skills:resolve_skill', { value: 25 });

    const actor = actorBuilder.build();
    Object.assign(actor.components, actorComponents);

    const targetBuilder = new ModEntityBuilder('test:target')
      .withName('Witness')
      .atLocation(targetLocation)
      .withLocationComponent(targetLocation)
      .asActor();

    const target = targetBuilder.build();
    Object.assign(target.components, targetComponents);

    if (typeof actorCustomizer === 'function') {
      actorCustomizer({ actor, target });
    }

    const entities = [room, otherRoom, actor, target];
    testFixture.reset(entities);
    return { actor, target };
  };

  describe('Action structure', () => {
    it('uses opposed resolve vs resolve ratio contest with bounds and modifiers', () => {
      expect(corruptingGazeAction.chanceBased.enabled).toBe(true);
      expect(corruptingGazeAction.chanceBased.contestType).toBe('opposed');
      expect(corruptingGazeAction.chanceBased.formula).toBe('ratio');
      expect(corruptingGazeAction.chanceBased.actorSkill.component).toBe(
        'skills:resolve_skill'
      );
      expect(corruptingGazeAction.chanceBased.targetSkill.component).toBe(
        'skills:resolve_skill'
      );
      expect(corruptingGazeAction.chanceBased.targetSkill.targetRole).toBe(
        'primary'
      );
      expect(corruptingGazeAction.chanceBased.bounds).toEqual({
        min: 5,
        max: 95,
      });

      const modifierTags = corruptingGazeAction.chanceBased.modifiers.map(
        (m) => m.tag
      );
      expect(modifierTags).toContain("you're downed");
      expect(modifierTags).toContain('target restrained');
    });

    it('applies Hexed Nightshade visual scheme and template', () => {
      expect(corruptingGazeAction.template).toBe(
        'cast a corrupting gaze at {target} ({chance}% chance)'
      );
      expect(corruptingGazeAction.visual).toMatchObject({
        backgroundColor: '#1f0d2a',
        textColor: '#e8ffd5',
        hoverBackgroundColor: '#2f1837',
        hoverTextColor: '#f5ffe7',
      });
    });
  });

  describe('Action discovery scenarios', () => {
    it('is available when actor is a hexer and target is uncorrupted in the same location', () => {
      const { actor } = setupScenario();
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).toContain(ACTION_ID);
    });

    it('is not available when actor lacks hexer marker', () => {
      const { actor } = setupScenario({
        actorComponents: { 'hexing:is_hexer': undefined },
      });
      delete actor.components['hexing:is_hexer'];
      configureActionDiscovery();

      const ids = testFixture.testEnv
        .getAvailableActions(actor.id)
        .map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });

    it('is not available when actor is doing a complex performance', () => {
      const { actor } = setupScenario({
        actorComponents: { 'positioning:doing_complex_performance': {} },
      });
      configureActionDiscovery();

      const ids = testFixture.testEnv
        .getAvailableActions(actor.id)
        .map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });

    it('is not available when actor is restrained', () => {
      const { actor } = setupScenario({
        actorComponents: { 'positioning:being_restrained': {} },
      });
      configureActionDiscovery();

      const ids = testFixture.testEnv
        .getAvailableActions(actor.id)
        .map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });

    it('is not available when target is already corrupted', () => {
      const { actor } = setupScenario({
        targetComponents: { 'warding:corrupted': {} },
      });
      configureActionDiscovery();

      const ids = testFixture.testEnv
        .getAvailableActions(actor.id)
        .map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });

    it('respects core:actors_in_location scope', () => {
      const { actor } = setupScenario({ targetLocation: 'room2' });
      configureActionDiscovery();

      const ids = testFixture.testEnv
        .getAvailableActions(actor.id)
        .map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });
  });
});
