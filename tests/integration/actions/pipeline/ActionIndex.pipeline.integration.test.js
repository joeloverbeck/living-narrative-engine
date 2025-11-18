/**
 * @file Integration tests that exercise ActionIndex through the full action discovery pipeline.
 * @description These scenarios focus on ActionIndex behaviour that currently lacks
 *              integration coverage, including forbidden component filtering and trace logging.
 */

import { describe, it, expect, jest } from '@jest/globals';
import { ActionPipelineOrchestrator } from '../../../../src/actions/actionPipelineOrchestrator.js';
import { ActionIndex } from '../../../../src/actions/actionIndex.js';
import { PipelineStage } from '../../../../src/actions/pipeline/PipelineStage.js';
import { PipelineResult } from '../../../../src/actions/pipeline/PipelineResult.js';
import SimpleEntityManager from '../../../common/entities/simpleEntityManager.js';

const ACTOR_ID = 'actor-hero';
const TARGET_ID = 'villager-mentor';

/**
 * Minimal multi-target stage that resolves a single primary target so downstream stages run.
 */
class SimpleMultiTargetResolutionStage extends PipelineStage {
  constructor(entityManager, targetId) {
    super('MultiTargetResolutionStage');
    this.entityManager = entityManager;
    this.targetId = targetId;
  }

  async executeInternal(context) {
    const { candidateActions = [], actor } = context;
    const targetEntity = this.entityManager.getEntityInstance(this.targetId);

    const actionsWithTargets = candidateActions.map((actionDef) => ({
      actionDef,
      targetContexts: [
        {
          entityId: targetEntity?.id,
          type: 'primary',
          label: 'Primary',
          entity: targetEntity,
        },
      ],
      resolvedTargets: {
        primary: targetEntity,
        actor,
      },
    }));

    return PipelineResult.success({
      data: {
        candidateActions,
        actionsWithTargets,
      },
    });
  }
}

/**
 *
 */
function createLogger() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

/**
 *
 * @param root0
 * @param root0.actions
 * @param root0.actorComponents
 * @param root0.preBuild
 */
function createOrchestratorScenario({ actions, actorComponents, preBuild }) {
  const logger = createLogger();

  const entityManager = new SimpleEntityManager([
    {
      id: ACTOR_ID,
      components: actorComponents,
    },
    {
      id: TARGET_ID,
      components: {
        identity: { name: 'Mentor Aria' },
      },
    },
  ]);

  const actionIndex = new ActionIndex({ logger, entityManager });
  if (preBuild) {
    preBuild(actionIndex);
  }
  actionIndex.buildIndex(actions);

  const prerequisiteService = {
    evaluate: jest.fn(() => true),
  };

  const commandFormatter = {
    format: jest.fn((actionDef, targetContext, manager, _options, { displayNameFn }) => {
      const entity = manager.getEntityInstance(targetContext.entityId);
      const targetName = displayNameFn(entity, targetContext.entityId, logger);
      return { ok: true, value: `${actionDef.name} -> ${targetName}` };
    }),
  };

  const orchestrator = new ActionPipelineOrchestrator({
    actionIndex,
    prerequisiteService,
    targetService: { resolveTargets: jest.fn() },
    formatter: commandFormatter,
    entityManager,
    safeEventDispatcher: { dispatch: jest.fn() },
    getEntityDisplayNameFn: (entity, fallback) =>
      entity?.components?.identity?.name ?? fallback,
    errorBuilder: {
      buildErrorContext: jest.fn((input) => ({ ...input, stage: 'action-index-integration' })),
    },
    logger,
    unifiedScopeResolver: { resolve: jest.fn() },
    targetContextBuilder: { build: jest.fn() },
    multiTargetResolutionStage: new SimpleMultiTargetResolutionStage(
      entityManager,
      TARGET_ID,
    ),
    targetComponentValidator: {
      validateTargetComponents: jest.fn(() => ({ valid: true })),
      validateEntityComponents: jest.fn(() => ({ valid: true })),
    },
    targetRequiredComponentsValidator: {
      validateTargetRequirements: jest.fn(() => ({ valid: true, missingComponents: [] })),
    },
  });

  return {
    orchestrator,
    logger,
    actionIndex,
    commandFormatter,
    prerequisiteService,
    entityManager,
  };
}

describe('ActionIndex integration coverage', () => {
  it('filters forbidden actions and records trace data for missing components', async () => {
    const actions = [
      undefined,
      {
        id: 'core:help',
        name: 'Offer Help',
        template: 'help {target}',
        required_components: { actor: ['skill:empathy'] },
      },
      {
        id: 'core:steal',
        name: 'Steal Item',
        template: 'steal {target}',
        required_components: { actor: ['skill:empathy', 'skill:theft'] },
      },
      {
        id: 'core:secret',
        name: 'Share Secret',
        template: 'share secret with {target}',
        required_components: { actor: ['skill:empathy'] },
        forbidden_components: { actor: ['trait:honest'] },
      },
      {
        id: 'core:meditate',
        name: 'Meditate',
        template: 'meditate',
      },
    ];

    const { orchestrator, logger } = createOrchestratorScenario({
      actions,
      actorComponents: {
        'skill:empathy': { level: 2 },
        'trait:honest': { value: true },
      },
    });

    const trace = {
      info: jest.fn(),
      data: jest.fn(),
      success: jest.fn(),
      step: jest.fn(),
    };

    const result = await orchestrator.discoverActions(
      { id: ACTOR_ID },
      { mood: 'kind' },
      { trace },
    );

    expect(result.actions).toHaveLength(2);
    expect(result.actions.map((action) => action.id)).toEqual(
      expect.arrayContaining(['core:help', 'core:meditate']),
    );
    expect(result.actions.map((action) => action.id)).not.toContain('core:secret');
    expect(result.actions.map((action) => action.id)).not.toContain('core:steal');

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Skipping invalid action definition'),
    );

    expect(
      trace.info.mock.calls.some(
        ([message, , metadata]) =>
          message.includes('Removed 1 actions due to forbidden components.') &&
          metadata.removedActionIds.includes('core:secret'),
      ),
    ).toBe(true);

    expect(
      trace.info.mock.calls.some(
        ([message, , metadata]) =>
          message.includes("Excluding action 'core:steal' - actor missing required components.") &&
          metadata.required.includes('skill:theft'),
      ),
    ).toBe(true);

    expect(trace.success).toHaveBeenCalledWith(
      expect.stringContaining('Final candidate list contains 2 unique actions'),
      'ActionIndex.getCandidateActions',
      expect.objectContaining({ actionIds: expect.arrayContaining(['core:help', 'core:meditate']) }),
    );
  });

  it('warns when the index is built with invalid data before recovering with valid actions', async () => {
    const preBuild = (index) => index.buildIndex(null);

    const { orchestrator, logger, actionIndex } = createOrchestratorScenario({
      actions: [
        {
          id: 'core:observe',
          name: 'Observe',
          template: 'observe {target}',
          required_components: { actor: ['skill:awareness'] },
        },
      ],
      actorComponents: {
        'skill:awareness': { level: 1 },
      },
      preBuild,
    });

    expect(logger.warn).toHaveBeenCalledWith(
      'ActionIndex.buildIndex: allActionDefinitions must be an array. Skipping index build.',
    );

    const result = await orchestrator.discoverActions(
      { id: ACTOR_ID },
      { focus: 'alert' },
    );

    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].id).toBe('core:observe');

    actionIndex.buildIndex(undefined);
    expect(logger.warn).toHaveBeenCalledWith(
      'ActionIndex.buildIndex: allActionDefinitions must be an array. Skipping index build.',
    );
  });
});
