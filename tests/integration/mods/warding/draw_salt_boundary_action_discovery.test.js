/**
 * @file Integration tests for warding:draw_salt_boundary action discovery.
 * @description Ensures the draw salt boundary action is available only when appropriate conditions are met.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModActionTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import drawSaltBoundaryAction from '../../../../data/mods/warding/actions/draw_salt_boundary.action.json';

const ACTION_ID = 'warding:draw_salt_boundary';

describe('warding:draw_salt_boundary action discovery', () => {
  let testFixture;
  let configureActionDiscovery;

  beforeEach(async () => {
    testFixture = new ModActionTestFixture('warding', ACTION_ID, null, null);
    await testFixture.initialize();

    configureActionDiscovery = () => {
      const { testEnv } = testFixture;
      if (!testEnv) {
        return;
      }

      testEnv.actionIndex.buildIndex([drawSaltBoundaryAction]);

      const scopeResolver = testEnv.unifiedScopeResolver;
      const originalResolve =
        scopeResolver.__drawSaltBoundaryOriginalResolve ||
        scopeResolver.resolveSync.bind(scopeResolver);

      scopeResolver.__drawSaltBoundaryOriginalResolve = originalResolve;
      scopeResolver.resolveSync = (scopeName, context) => {
        if (scopeName === 'warding:corrupted_actors') {
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
            const isCorrupted = entityManager.getComponentData(
              entityId,
              'warding:corrupted'
            );

            if (
              position?.locationId === actorLocation &&
              isActor &&
              isCorrupted
            ) {
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
        ?.__drawSaltBoundaryOriginalResolve
    ) {
      testFixture.testEnv.unifiedScopeResolver.resolveSync =
        testFixture.testEnv.unifiedScopeResolver.__drawSaltBoundaryOriginalResolve;
    }

    if (testFixture) {
      testFixture.cleanup();
    }
  });

  const setupScenario = (targetComponents = {}, actorOptions = {}) => {
    const room = ModEntityScenarios.createRoom('room1', 'Sanctum');

    const actorBuilder = new ModEntityBuilder('test:actor')
      .withName('Ward Caster')
      .atLocation('room1')
      .withLocationComponent('room1')
      .asActor()
      .withComponent('skills:warding_skill', { value: 30 });

    const actor = actorBuilder.build();

    const targetBuilder = new ModEntityBuilder('test:target')
      .withName('Corrupted Entity')
      .atLocation('room1')
      .withLocationComponent('room1')
      .asActor()
      .withComponent('warding:corrupted', {});

    const target = targetBuilder.build();
    Object.assign(target.components, targetComponents);

    if (typeof actorOptions.actorCustomizer === 'function') {
      actorOptions.actorCustomizer({ actor, target });
    }

    testFixture.reset([room, actor, target]);
    return { actor, target };
  };

  describe('Action structure', () => {
    it('requires actor to have warding_skill component', () => {
      expect(drawSaltBoundaryAction.required_components.actor).toContain(
        'skills:warding_skill'
      );
    });

    it('uses fixed_difficulty contest type', () => {
      expect(drawSaltBoundaryAction.chanceBased.contestType).toBe(
        'fixed_difficulty'
      );
    });

    it('has fixedDifficulty of 50', () => {
      expect(drawSaltBoundaryAction.chanceBased.fixedDifficulty).toBe(50);
    });

    it('uses linear formula', () => {
      expect(drawSaltBoundaryAction.chanceBased.formula).toBe('linear');
    });

    it('has Cool Grey Modern visual scheme', () => {
      expect(drawSaltBoundaryAction.visual.backgroundColor).toBe('#424242');
      expect(drawSaltBoundaryAction.visual.textColor).toBe('#fafafa');
    });
  });

  describe('Action discovery scenarios', () => {
    it('is available when actor has warding skill and target is corrupted', () => {
      const { actor } = setupScenario();
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).toContain(ACTION_ID);
    });

    it('is not available when actor lacks the warding skill', () => {
      const { actor } = setupScenario(
        {},
        {
          actorCustomizer: ({ actor }) => {
            delete actor.components['skills:warding_skill'];
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

    it('is not available when target is not corrupted', () => {
      const room = ModEntityScenarios.createRoom('room1', 'Sanctum');

      const actor = new ModEntityBuilder('test:actor')
        .withName('Ward Caster')
        .atLocation('room1')
        .withLocationComponent('room1')
        .asActor()
        .withComponent('skills:warding_skill', { value: 30 })
        .build();

      // Target without warding:corrupted component
      const target = new ModEntityBuilder('test:target')
        .withName('Normal Entity')
        .atLocation('room1')
        .withLocationComponent('room1')
        .asActor()
        .build();

      testFixture.reset([room, actor, target]);
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });

    it('is not available when no targets exist in location', () => {
      const room = ModEntityScenarios.createRoom('room1', 'Sanctum');

      const actor = new ModEntityBuilder('test:actor')
        .withName('Ward Caster')
        .atLocation('room1')
        .withLocationComponent('room1')
        .asActor()
        .withComponent('skills:warding_skill', { value: 30 })
        .build();

      testFixture.reset([room, actor]);
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });

    it('does not target the actor themselves', () => {
      const room = ModEntityScenarios.createRoom('room1', 'Sanctum');

      // Actor is also corrupted - should not target self
      const actor = new ModEntityBuilder('test:actor')
        .withName('Corrupted Ward Caster')
        .atLocation('room1')
        .withLocationComponent('room1')
        .asActor()
        .withComponent('skills:warding_skill', { value: 30 })
        .withComponent('warding:corrupted', {})
        .build();

      testFixture.reset([room, actor]);
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        actor.id
      );
      const ids = availableActions.map((action) => action.id);

      // Action should not be available since the only corrupted entity is the actor themselves
      expect(ids).not.toContain(ACTION_ID);
    });

    it('is not available when target is already warded by salt', () => {
      const { actor } = setupScenario({
        'warding:warded_by_salt': {},
      });
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });
  });

  describe('Action modifiers', () => {
    it('has forbidden_components for primary target including warded_by_salt', () => {
      expect(drawSaltBoundaryAction.forbidden_components.primary).toContain(
        'warding:warded_by_salt'
      );
    });

    it('has modifier for unrestrained target (-15 penalty)', () => {
      const unrestrainedModifier =
        drawSaltBoundaryAction.chanceBased.modifiers.find(
          (m) => m.tag === 'target unrestrained'
        );
      expect(unrestrainedModifier).toBeDefined();
      expect(unrestrainedModifier.type).toBe('flat');
      expect(unrestrainedModifier.value).toBe(-15);
      expect(unrestrainedModifier.targetRole).toBe('primary');
    });

    it('has modifier for restrained target (+15 bonus)', () => {
      const restrainedModifier =
        drawSaltBoundaryAction.chanceBased.modifiers.find(
          (m) => m.tag === 'target restrained'
        );
      expect(restrainedModifier).toBeDefined();
      expect(restrainedModifier.type).toBe('flat');
      expect(restrainedModifier.value).toBe(15);
      expect(restrainedModifier.targetRole).toBe('primary');
    });

    it('has modifier for fallen target (+10 bonus)', () => {
      const fallenModifier = drawSaltBoundaryAction.chanceBased.modifiers.find(
        (m) => m.tag === 'target downed'
      );
      expect(fallenModifier).toBeDefined();
      expect(fallenModifier.type).toBe('flat');
      expect(fallenModifier.value).toBe(10);
      expect(fallenModifier.targetRole).toBe('primary');
    });
  });
});
