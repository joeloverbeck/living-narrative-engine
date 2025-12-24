/**
 * @file Integration tests for warding:extract_spiritual_corruption action discovery.
 * @description Ensures the extract spiritual corruption action is surfaced only when the actor, target, and anchor prerequisites are met.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModActionTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import extractAction from '../../../../data/mods/warding/actions/extract_spiritual_corruption.action.json';

const ACTION_ID = 'warding:extract_spiritual_corruption';

describe('warding:extract_spiritual_corruption action discovery', () => {
  let testFixture;
  let configureActionDiscovery;

  beforeEach(async () => {
    testFixture = new ModActionTestFixture('warding', ACTION_ID, null, null);
    await testFixture.initialize();

    configureActionDiscovery = () => {
      const { testEnv } = testFixture;
      if (!testEnv) return;

      testEnv.actionIndex.buildIndex([extractAction]);

      const scopeResolver = testEnv.unifiedScopeResolver;
      const originalResolve =
        scopeResolver.__extractSpiritualCorruptionOriginalResolve ||
        scopeResolver.resolveSync.bind(scopeResolver);

      scopeResolver.__extractSpiritualCorruptionOriginalResolve =
        originalResolve;
      scopeResolver.resolveSync = (scopeName, context) => {
        if (scopeName === 'warding:corrupted_actors') {
          const actorId = context?.actor?.id;
          if (!actorId) return { success: true, value: new Set() };

          const { entityManager } = testEnv;
          const actorLocation = entityManager.getComponentData(
            actorId,
            'core:position'
          )?.locationId;
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

        if (scopeName === 'warding:spiritual_anchors_in_inventory') {
          const actorId = context?.actor?.id;
          if (!actorId) return { success: true, value: new Set() };

          const { entityManager } = testEnv;
          const inventory =
            entityManager.getComponentData(actorId, 'items:inventory')?.items ||
            [];

          const anchors = new Set();
          for (const itemId of inventory) {
            const isItem = entityManager.getComponentData(itemId, 'items-core:item');
            const isAnchor = entityManager.getComponentData(
              itemId,
              'warding:is_spiritual_anchor'
            );

            if (isItem && isAnchor) {
              anchors.add(itemId);
            }
          }

          return { success: true, value: anchors };
        }

        return originalResolve(scopeName, context);
      };
    };
  });

  afterEach(() => {
    if (
      testFixture?.testEnv?.unifiedScopeResolver
        ?.__extractSpiritualCorruptionOriginalResolve
    ) {
      testFixture.testEnv.unifiedScopeResolver.resolveSync =
        testFixture.testEnv.unifiedScopeResolver.__extractSpiritualCorruptionOriginalResolve;
    }

    if (testFixture) {
      testFixture.cleanup();
    }
  });

  const setupScenario = ({
    targetComponents = {},
    anchorComponents = {},
    actorCustomizer,
  } = {}) => {
    const room = ModEntityScenarios.createRoom('room1', 'Sanctum');

    const targetBuilder = new ModEntityBuilder('test:target')
      .withName('Corrupted Entity')
      .atLocation('room1')
      .withLocationComponent('room1')
      .asActor()
      .withComponent('warding:corrupted', {});

    const target = targetBuilder.build();
    Object.assign(target.components, targetComponents);

    const anchorBuilder = new ModEntityBuilder('test:anchor')
      .withName('Containment Vessel')
      .atLocation('room1')
      .withLocationComponent('room1')
      .withComponent('items-core:item', {})
      .withComponent('items-core:portable', { weight: 0.8 })
      .withComponent('warding:is_spiritual_anchor', {});

    const anchor = anchorBuilder.build();
    Object.assign(anchor.components, anchorComponents);

    const actorBuilder = new ModEntityBuilder('test:actor')
      .withName('Ward Caster')
      .atLocation('room1')
      .withLocationComponent('room1')
      .asActor()
      .withComponent('skills:warding_skill', { value: 40 })
      .withComponent('items:inventory', { items: [anchor.id], capacity: 3 });

    const actor = actorBuilder.build();

    if (typeof actorCustomizer === 'function') {
      actorCustomizer({ actor, target, anchor });
    }

    testFixture.reset([room, actor, target, anchor]);
    return { actor, target, anchor };
  };

  describe('Action structure', () => {
    it('uses opposed ratio contest with warding vs resolve skills', () => {
      expect(extractAction.chanceBased.contestType).toBe('opposed');
      expect(extractAction.chanceBased.formula).toBe('ratio');
      expect(extractAction.chanceBased.actorSkill.component).toBe(
        'skills:warding_skill'
      );
      expect(extractAction.chanceBased.targetSkill.component).toBe(
        'skills:resolve_skill'
      );
      expect(extractAction.chanceBased.targetSkill.targetRole).toBe('primary');
    });

    it('has Cool Grey Modern visual scheme', () => {
      expect(extractAction.visual.backgroundColor).toBe('#424242');
      expect(extractAction.visual.textColor).toBe('#fafafa');
    });

    it('renders the expected template', () => {
      expect(extractAction.template).toBe(
        'extract spiritual corruption from {target} with {anchor} ({chance}% chance)'
      );
    });
  });

  describe('Action discovery scenarios', () => {
    it('is available when actor has warding skill, target is corrupted, and anchor is present', () => {
      const { actor } = setupScenario();
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).toContain(ACTION_ID);
    });

    it('is not available when actor lacks the warding skill', () => {
      const { actor } = setupScenario({
        actorCustomizer: ({ actor }) => {
          delete actor.components['skills:warding_skill'];
        },
      });
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
        .withComponent('skills:warding_skill', { value: 40 });

      const anchor = new ModEntityBuilder('test:anchor')
        .withName('Containment Vessel')
        .withComponent('items-core:item', {})
        .withComponent('warding:is_spiritual_anchor', {})
        .build();

      actor.withComponent('items:inventory', {
        items: [anchor.id],
        capacity: 3,
      });

      const builtActor = actor.build();

      const target = new ModEntityBuilder('test:target')
        .withName('Unaffected Entity')
        .atLocation('room1')
        .withLocationComponent('room1')
        .asActor()
        .build();

      testFixture.reset([room, builtActor, anchor, target]);
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });

    it('is not available without a spiritual anchor in the inventory', () => {
      const room = ModEntityScenarios.createRoom('room1', 'Sanctum');

      const actor = new ModEntityBuilder('test:actor')
        .withName('Ward Caster')
        .atLocation('room1')
        .withLocationComponent('room1')
        .asActor()
        .withComponent('skills:warding_skill', { value: 40 });

      const target = new ModEntityBuilder('test:target')
        .withName('Corrupted Entity')
        .atLocation('room1')
        .withLocationComponent('room1')
        .asActor()
        .withComponent('warding:corrupted', {})
        .build();

      // Non-anchor item present in inventory, should not satisfy secondary scope
      const mundaneItem = new ModEntityBuilder('test:mundane_item')
        .withName('Mundane Object')
        .withComponent('items-core:item', {})
        .build();

      actor.withComponent('items:inventory', {
        items: [mundaneItem.id],
        capacity: 3,
      });

      const builtActor = actor.build();

      testFixture.reset([room, builtActor, target, mundaneItem]);
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        builtActor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });

    it('is blocked by actor forbidden components (e.g., being restrained)', () => {
      const { actor } = setupScenario({
        actorCustomizer: ({ actor }) => {
          actor.components['physical-control-states:being_restrained'] = {
            restrainer_id: 'other',
          };
        },
      });
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });
  });

  describe('Modifiers and metadata', () => {
    it('includes all extraction modifiers with correct tags/values', () => {
      const modifiers = extractAction.chanceBased.modifiers;
      const unrestrained = modifiers.find(
        (m) => m.tag === 'target unrestrained'
      );
      const restrained = modifiers.find((m) => m.tag === 'target restrained');
      const warded = modifiers.find((m) => m.tag === 'target warded');
      const downed = modifiers.find((m) => m.tag === 'target downed');

      expect(unrestrained?.value).toBe(-10);
      expect(restrained?.value).toBe(10);
      expect(warded?.value).toBe(5);
      expect(downed?.value).toBe(-5);

      [unrestrained, restrained, warded, downed].forEach((modifier) => {
        expect(modifier?.targetRole).toBe('primary');
      });
    });

    it('caps chance between 5 and 95 with 5/95 critical thresholds', () => {
      expect(extractAction.chanceBased.bounds.min).toBe(5);
      expect(extractAction.chanceBased.bounds.max).toBe(95);
      expect(extractAction.chanceBased.outcomes.criticalSuccessThreshold).toBe(
        5
      );
      expect(extractAction.chanceBased.outcomes.criticalFailureThreshold).toBe(
        95
      );
    });
  });
});
