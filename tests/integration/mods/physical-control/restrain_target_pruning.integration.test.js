/**
 * @file Regression test for physical-control:restrain_target target pruning.
 * @description Ensures forbidden/required component filtering is applied per target
 *              so one invalid target does not invalidate the action for others.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { TargetComponentValidationStage } from '../../../../src/actions/pipeline/stages/TargetComponentValidationStage.js';
import { TargetComponentValidator } from '../../../../src/actions/validation/TargetComponentValidator.js';
import TargetRequiredComponentsValidator from '../../../../src/actions/validation/TargetRequiredComponentsValidator.js';
import restrainTargetAction from '../../../../data/mods/physical-control/actions/restrain_target.action.json' assert { type: 'json' };

const createLogger = () => ({
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
});

const createEntityManager = (componentMap) => ({
  getEntityInstance: (id) => ({ id }),
  hasComponent: (id, componentId) =>
    Array.isArray(componentMap[id]) && componentMap[id].includes(componentId),
  getAllComponentTypesForEntity: (id) => componentMap[id] || [],
});

const createActionErrorContextBuilder = () => ({
  buildErrorContext: () => ({}),
});

describe('physical-control:restrain_target target pruning', () => {
  let logger;
  let entityManager;
  let stage;

  beforeEach(() => {
    logger = createLogger();
    entityManager = createEntityManager({});
    stage = new TargetComponentValidationStage({
      targetComponentValidator: new TargetComponentValidator({
        logger,
        entityManager,
      }),
      targetRequiredComponentsValidator: new TargetRequiredComponentsValidator({
        logger,
      }),
      logger,
      actionErrorContextBuilder: createActionErrorContextBuilder(),
    });
  });

  it('keeps restrain_target available for unrestrained candidates after pruning restrained targets', async () => {
    const componentMap = {
      'actor:grappler': ['core:actor', 'skills:grappling_skill'],
      'actor:restrained': [
        'core:actor',
        'skills:grappling_skill',
        'positioning:being_restrained',
      ],
      'actor:free-1': ['core:actor', 'skills:grappling_skill'],
      'actor:free-2': ['core:actor', 'skills:grappling_skill'],
      'actor:free-3': ['core:actor', 'skills:grappling_skill'],
    };

    entityManager = createEntityManager(componentMap);
    stage = new TargetComponentValidationStage({
      targetComponentValidator: new TargetComponentValidator({
        logger,
        entityManager,
      }),
      targetRequiredComponentsValidator: new TargetRequiredComponentsValidator({
        logger,
      }),
      logger,
      actionErrorContextBuilder: createActionErrorContextBuilder(),
    });

    const resolvedTargets = {
      primary: [
        buildTarget('actor:restrained', componentMap),
        buildTarget('actor:free-1', componentMap),
        buildTarget('actor:free-2', componentMap),
        buildTarget('actor:free-3', componentMap),
      ],
    };

    const targetContexts = resolvedTargets.primary.map((target) => ({
      type: 'entity',
      entityId: target.id,
      placeholder: 'target',
    }));

    const result = await stage.executeInternal({
      actor: { id: 'actor:grappler' },
      actionsWithTargets: [
        {
          actionDef: restrainTargetAction,
          resolvedTargets,
          targetDefinitions: restrainTargetAction.targets,
          targetContexts,
          isMultiTarget: true,
        },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.data.actionsWithTargets).toHaveLength(1);

    const keptTargets =
      result.data.actionsWithTargets[0].resolvedTargets.primary;
    expect(Array.isArray(keptTargets)).toBe(true);
    expect(keptTargets.map((t) => t.id)).toEqual([
      'actor:free-1',
      'actor:free-2',
      'actor:free-3',
    ]);

    const keptContexts =
      result.data.actionsWithTargets[0].targetContexts.map(
        (ctx) => ctx.entityId
      );
    expect(keptContexts).toEqual(['actor:free-1', 'actor:free-2', 'actor:free-3']);
  });

  it('prunes targets missing required components without invalidating other candidates', async () => {
    const componentMap = {
      'actor:grappler': ['core:actor', 'skills:grappling_skill'],
      'actor:eligible': ['core:actor', 'skills:grappling_skill', 'traits:eligible'],
      'actor:ineligible-1': ['core:actor', 'skills:grappling_skill'],
      'actor:ineligible-2': ['core:actor', 'skills:grappling_skill'],
    };

    entityManager = createEntityManager(componentMap);
    stage = new TargetComponentValidationStage({
      targetComponentValidator: new TargetComponentValidator({
        logger,
        entityManager,
      }),
      targetRequiredComponentsValidator: new TargetRequiredComponentsValidator({
        logger,
      }),
      logger,
      actionErrorContextBuilder: createActionErrorContextBuilder(),
    });

    const actionWithRequirements = {
      ...restrainTargetAction,
      id: 'physical-control:restrain_target:required-target-component',
      required_components: {
        ...restrainTargetAction.required_components,
        primary: ['traits:eligible'],
      },
    };

    const resolvedTargets = {
      primary: [
        buildTarget('actor:eligible', componentMap),
        buildTarget('actor:ineligible-1', componentMap),
        buildTarget('actor:ineligible-2', componentMap),
      ],
    };

    const targetContexts = resolvedTargets.primary.map((target) => ({
      type: 'entity',
      entityId: target.id,
      placeholder: 'target',
    }));

    const result = await stage.executeInternal({
      actor: { id: 'actor:grappler' },
      actionsWithTargets: [
        {
          actionDef: actionWithRequirements,
          resolvedTargets,
          targetDefinitions: actionWithRequirements.targets,
          targetContexts,
          isMultiTarget: true,
        },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.data.actionsWithTargets).toHaveLength(1);
    const keptTargets =
      result.data.actionsWithTargets[0].resolvedTargets.primary;
    expect(keptTargets.map((t) => t.id)).toEqual(['actor:eligible']);
  });
});
const buildTarget = (id, componentMap) => {
  const componentList = componentMap[id] || [];
  const componentObj = componentList.reduce((acc, key) => {
    acc[key] = {};
    return acc;
  }, {});
  return { id, components: componentObj };
};
