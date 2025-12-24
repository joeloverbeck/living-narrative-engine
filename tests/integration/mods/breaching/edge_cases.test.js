/**
 * @file Integration edge case tests for breaching:saw_through_barred_blocker
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModActionTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ScopeResolverHelpers } from '../../../common/mods/scopeResolverHelpers.js';
import ChanceCalculationService from '../../../../src/combat/services/ChanceCalculationService.js';
import SkillResolverService from '../../../../src/combat/services/SkillResolverService.js';
import ModifierCollectorService from '../../../../src/combat/services/ModifierCollectorService.js';
import ModifierContextBuilder from '../../../../src/combat/services/ModifierContextBuilder.js';
import ProbabilityCalculatorService from '../../../../src/combat/services/ProbabilityCalculatorService.js';
import OutcomeDeterminerService from '../../../../src/combat/services/OutcomeDeterminerService.js';
import sawThroughRule from '../../../../data/mods/breaching/rules/handle_saw_through_barred_blocker.rule.json' assert { type: 'json' };
import sawThroughCondition from '../../../../data/mods/breaching/conditions/event-is-action-saw-through-barred-blocker.condition.json' assert { type: 'json' };
import sawThroughAction from '../../../../data/mods/breaching/actions/saw_through_barred_blocker.action.json' assert { type: 'json' };

const ACTION_ID = 'breaching:saw_through_barred_blocker';

const forceOutcome =
  (outcome) =>
  (params, ctx) => {
    ctx.evaluationContext.context[params.result_variable] = {
      outcome,
      roll: 1,
      threshold: 100,
      margin: -99,
      isCritical: outcome === 'CRITICAL_SUCCESS',
      actorSkill: 10,
      targetSkill: 0,
      breakdown: {},
    };
  };

const registerSawableScope = (fixture) => {
  const customResolver = function (context) {
    const em = this.entityManager || fixture.testEnv.entityManager;
    const actor = context.actor || context.actorEntity;

    if (!actor) return { success: true, value: new Set() };

    const position = em.getComponentData(actor.id, 'core:position');
    if (!position?.locationId) return { success: true, value: new Set() };

    const exits = em.getComponentData(position.locationId, 'locations:exits');
    const exitsList = Array.isArray(exits) ? exits : exits?.exits || [];

    if (!Array.isArray(exitsList)) return { success: true, value: new Set() };

    const blockers = new Set();
    exitsList.forEach((exit) => {
      if (!exit.blocker) return;

      const blockerId = exit.blocker;
      const isBarred = em.hasComponent(blockerId, 'blockers:is_barred');
      const hasResistance = em.hasComponent(
        blockerId,
        'blockers:structural_resistance'
      );
      const progress = em.getComponentData(blockerId, 'core:progress_tracker');
      const progressValue = progress ? progress.value : 0;

      if (isBarred && hasResistance && progressValue === 0) {
        blockers.add(blockerId);
      }
    });

    return { success: true, value: blockers };
  };

  ScopeResolverHelpers._registerResolvers(
    fixture.testEnv,
    fixture.testEnv.entityManager,
    { 'blockers:sawable_barred_blockers': customResolver }
  );
};

const buildScopeContext = (fixture, actorId) => {
  const actor = fixture.entityManager.getEntityInstance(actorId);
  const components = actor?.getAllComponents
    ? actor.getAllComponents()
    : actor?.components || {};
  const actorContext = { id: actorId, components };
  const position = components['core:position'];
  const context = {
    actor: actorContext,
    actorEntity: actorContext,
    targets: {},
  };

  if (position?.locationId) {
    context.location = { id: position.locationId };
    context.actorLocation = position.locationId;
  }

  return context;
};

const createChanceCalcService = (entities) => {
  const entityMap = new Map(entities.map((entity) => [entity.id, entity]));
  const entityManager = {
    getComponentData: (entityId, componentId) => {
      const entity = entityMap.get(entityId);
      return entity?.components?.[componentId] ?? null;
    },
    hasComponent: (entityId, componentId) => {
      const entity = entityMap.get(entityId);
      return Boolean(entity?.components?.[componentId]);
    },
    getEntity: (entityId) => entityMap.get(entityId) ?? null,
  };

  const logger = {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  };

  return new ChanceCalculationService({
    skillResolverService: new SkillResolverService({ entityManager, logger }),
    modifierCollectorService: new ModifierCollectorService({
      entityManager,
      modifierContextBuilder: new ModifierContextBuilder({
        entityManager,
        logger,
      }),
      logger,
    }),
    probabilityCalculatorService: new ProbabilityCalculatorService({ logger }),
    outcomeDeterminerService: new OutcomeDeterminerService({ logger }),
    logger,
  });
};

describe('breaching:saw_through_barred_blocker edge cases', () => {
  let fixture;

  beforeEach(async () => {
    fixture = new ModActionTestFixture(
      'breaching',
      ACTION_ID,
      sawThroughRule,
      sawThroughCondition,
      { skipValidation: true }
    );
    await fixture.initialize();
    registerSawableScope(fixture);
  });

  afterEach(() => {
    fixture.cleanup();
  });

  it('keeps the action discoverable with multiple valid targets in scopes', async () => {
    const locationId = fixture.createEntity({
      id: 'test-location',
      components: [{ componentId: 'core:location', data: {} }],
    });
    const targetLocationId = fixture.createEntity({
      id: 'test-target-location',
      components: [{ componentId: 'core:location', data: {} }],
    });

    const blockerOne = fixture.createEntity({
      id: 'blocker-one',
      components: [
        { componentId: 'blockers:is_barred', data: {} },
        { componentId: 'blockers:structural_resistance', data: { value: 45 } },
      ],
    });
    const blockerTwo = fixture.createEntity({
      id: 'blocker-two',
      components: [
        { componentId: 'blockers:is_barred', data: {} },
        { componentId: 'blockers:structural_resistance', data: { value: 55 } },
      ],
    });

    await fixture.modifyComponent(locationId, 'locations:exits', [
      { direction: 'north', target: targetLocationId, blocker: blockerOne },
      { direction: 'east', target: targetLocationId, blocker: blockerTwo },
    ]);

    const actorId = fixture.createEntity({
      id: 'test-actor',
      components: [
        { componentId: 'core:actor', data: {} },
        { componentId: 'core:position', data: { locationId } },
        { componentId: 'skills:craft_skill', data: { value: 60 } },
        { componentId: 'inventory:inventory', data: { items: [] } },
      ],
    });

    const toolOne = fixture.createEntity({
      id: 'tool-one',
      components: [
        { componentId: 'items-core:item', data: {} },
        { componentId: 'breaching:allows_abrasive_sawing', data: {} },
        { componentId: 'items:owned_by', data: { entityId: actorId } },
      ],
    });
    const toolTwo = fixture.createEntity({
      id: 'tool-two',
      components: [
        { componentId: 'items-core:item', data: {} },
        { componentId: 'breaching:allows_abrasive_sawing', data: {} },
        { componentId: 'items:owned_by', data: { entityId: actorId } },
      ],
    });

    await fixture.modifyComponent(actorId, 'inventory:inventory', {
      items: [toolOne, toolTwo],
    });

    const context = buildScopeContext(fixture, actorId);
    const blockersResult = fixture.testEnv.unifiedScopeResolver.resolveSync(
      'blockers:sawable_barred_blockers',
      context
    );
    const toolsResult = fixture.testEnv.unifiedScopeResolver.resolveSync(
      'breaching:abrasive_sawing_tools',
      context
    );

    expect(blockersResult.success).toBe(true);
    expect(Array.from(blockersResult.value)).toEqual(
      expect.arrayContaining([blockerOne, blockerTwo])
    );
    expect(toolsResult.success).toBe(true);
    expect(Array.from(toolsResult.value)).toEqual(
      expect.arrayContaining([toolOne, toolTwo])
    );

    const actions = fixture.discoverActions(actorId);
    expect(actions).toContainAction(ACTION_ID);
  });

  it('excludes blockers from discovery once progress is recorded', async () => {
    const locationId = fixture.createEntity({
      id: 'test-location-progress',
      components: [{ componentId: 'core:location', data: {} }],
    });
    const targetLocationId = fixture.createEntity({
      id: 'test-target-location-progress',
      components: [{ componentId: 'core:location', data: {} }],
    });

    const blockerId = fixture.createEntity({
      id: 'blocker-progress',
      components: [
        { componentId: 'blockers:is_barred', data: {} },
        { componentId: 'blockers:structural_resistance', data: { value: 40 } },
      ],
    });

    await fixture.modifyComponent(locationId, 'locations:exits', [
      { direction: 'north', target: targetLocationId, blocker: blockerId },
    ]);

    const actorId = fixture.createEntity({
      id: 'test-actor-progress',
      components: [
        { componentId: 'core:actor', data: {} },
        { componentId: 'core:position', data: { locationId } },
        { componentId: 'skills:craft_skill', data: { value: 60 } },
        { componentId: 'inventory:inventory', data: { items: [] } },
      ],
    });

    const toolId = fixture.createEntity({
      id: 'tool-progress',
      components: [
        { componentId: 'items-core:item', data: {} },
        { componentId: 'breaching:allows_abrasive_sawing', data: {} },
        { componentId: 'items:owned_by', data: { entityId: actorId } },
      ],
    });

    await fixture.modifyComponent(actorId, 'inventory:inventory', {
      items: [toolId],
    });

    fixture.testEnv.operationRegistry.register(
      'RESOLVE_OUTCOME',
      forceOutcome('SUCCESS')
    );

    await fixture.executeAction(actorId, blockerId, {
      skipDiscovery: true,
      additionalPayload: {
        primaryId: blockerId,
        secondaryId: toolId,
      },
    });

    const blockerAfter = fixture.entityManager.getEntityInstance(blockerId);
    expect(blockerAfter).toHaveComponent('core:progress_tracker');
    expect(blockerAfter.components['core:progress_tracker'].value).toBe(1);

    const context = buildScopeContext(fixture, actorId);
    const blockersResult = fixture.testEnv.unifiedScopeResolver.resolveSync(
      'blockers:sawable_barred_blockers',
      context
    );

    expect(blockersResult.success).toBe(true);
    expect(Array.from(blockersResult.value)).not.toContain(blockerId);

    const actions = fixture.discoverActions(actorId);
    expect(actions).not.toContainAction(ACTION_ID);
  });

  it('drops and unwields the tool on FUMBLE', async () => {
    const locationId = fixture.createEntity({
      id: 'test-location-fumble',
      components: [{ componentId: 'core:location', data: {} }],
    });
    const targetLocationId = fixture.createEntity({
      id: 'test-target-location-fumble',
      components: [{ componentId: 'core:location', data: {} }],
    });

    const blockerId = fixture.createEntity({
      id: 'blocker-fumble',
      components: [
        { componentId: 'blockers:is_barred', data: {} },
        { componentId: 'blockers:structural_resistance', data: { value: 35 } },
      ],
    });

    await fixture.modifyComponent(locationId, 'locations:exits', [
      { direction: 'north', target: targetLocationId, blocker: blockerId },
    ]);

    const actorId = fixture.createEntity({
      id: 'test-actor-fumble',
      components: [
        { componentId: 'core:actor', data: {} },
        { componentId: 'core:position', data: { locationId } },
        { componentId: 'skills:craft_skill', data: { value: 60 } },
        { componentId: 'inventory:inventory', data: { items: [] } },
        {
          componentId: 'item-handling-states:wielding',
          data: { wielded_item_ids: [] },
        },
      ],
    });

    const toolId = fixture.createEntity({
      id: 'tool-fumble',
      components: [
        { componentId: 'items-core:item', data: {} },
        { componentId: 'breaching:allows_abrasive_sawing', data: {} },
        { componentId: 'items:owned_by', data: { entityId: actorId } },
      ],
    });

    await fixture.modifyComponent(actorId, 'inventory:inventory', {
      items: [toolId],
    });
    await fixture.modifyComponent(actorId, 'item-handling-states:wielding', {
      wielded_item_ids: [toolId],
    });

    fixture.testEnv.operationRegistry.register(
      'RESOLVE_OUTCOME',
      forceOutcome('FUMBLE')
    );

    await fixture.executeAction(actorId, blockerId, {
      skipDiscovery: true,
      additionalPayload: {
        primaryId: blockerId,
        secondaryId: toolId,
      },
    });

    const actorAfter = fixture.entityManager.getEntityInstance(actorId);
    const inventoryAfter = fixture.entityManager.getComponentData(
      actorId,
      'inventory:inventory'
    );
    const toolAfter = fixture.entityManager.getEntityInstance(toolId);

    expect(actorAfter).toNotHaveComponent('item-handling-states:wielding');
    expect(inventoryAfter.items).not.toContain(toolId);
    expect(toolAfter.components['core:position'].locationId).toBe(locationId);
  });

  it('clamps chance values at craft/resistance boundaries', () => {
    const actorLow = {
      id: 'actor-low',
      components: {
        'skills:craft_skill': { value: 0 },
      },
    };
    const targetHigh = {
      id: 'target-high',
      components: {
        'blockers:structural_resistance': { value: 100 },
      },
    };

    const actorHigh = {
      id: 'actor-high',
      components: {
        'skills:craft_skill': { value: 100 },
      },
    };
    const targetLow = {
      id: 'target-low',
      components: {
        'blockers:structural_resistance': { value: 0 },
      },
    };

    const chanceService = createChanceCalcService([
      actorLow,
      targetHigh,
      actorHigh,
      targetLow,
    ]);

    const lowChance = chanceService.calculateForDisplay({
      actorId: actorLow.id,
      primaryTargetId: targetHigh.id,
      actionDef: sawThroughAction,
    });
    const highChance = chanceService.calculateForDisplay({
      actorId: actorHigh.id,
      primaryTargetId: targetLow.id,
      actionDef: sawThroughAction,
    });

    expect(lowChance.chance).toBe(5);
    expect(lowChance.displayText).toBe('5%');
    expect(highChance.chance).toBe(95);
    expect(highChance.displayText).toBe('95%');
  });
});
