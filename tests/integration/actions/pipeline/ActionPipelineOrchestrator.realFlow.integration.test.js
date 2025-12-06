/**
 * @file Integration tests for ActionPipelineOrchestrator using real pipeline stages.
 * @description Exercises the orchestrator with actual pipeline stage implementations to
 *              validate the full discovery flow and ensure stage interactions remain wired.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ActionPipelineOrchestrator } from '../../../../src/actions/actionPipelineOrchestrator.js';
import { PipelineStage } from '../../../../src/actions/pipeline/PipelineStage.js';
import { PipelineResult } from '../../../../src/actions/pipeline/PipelineResult.js';
import { TargetComponentValidator } from '../../../../src/actions/validation/TargetComponentValidator.js';
import { createMockTargetRequiredComponentsValidator } from '../../../common/mockFactories/actions.js';

/**
 * Simple multi-target stage that mirrors the essential behaviour of the real implementation
 * without pulling in the heavy dependency graph. It resolves the target contexts for each
 * candidate action so the formatting stage can operate on concrete data.
 */
class SimpleMultiTargetStage extends PipelineStage {
  /**
   * @param {object} entityManager - Entity manager supplying entity lookups.
   */
  constructor(entityManager) {
    super('MultiTargetResolution');
    this.entityManager = entityManager;
  }

  /**
   * Resolves target contexts for each candidate action.
   *
   * @param {object} context - Pipeline execution context.
   * @returns {Promise<PipelineResult>} Result carrying actionsWithTargets payload.
   */
  async executeInternal(context) {
    const { candidateActions = [] } = context;

    const actionsWithTargets = candidateActions.map((actionDef) => {
      const targetRef = actionDef.target_entity;
      const resolvedTarget = targetRef
        ? this.entityManager.getEntityInstance(targetRef.id)
        : null;

      const targetContexts = resolvedTarget
        ? [
            {
              entityId: resolvedTarget.id,
              entity: resolvedTarget,
            },
          ]
        : [];

      return {
        actionDef,
        targetContexts,
      };
    });

    return PipelineResult.success({
      data: {
        actionsWithTargets,
      },
    });
  }
}

describe('ActionPipelineOrchestrator real pipeline flow', () => {
  /** @type {import('../../../../src/actions/actionPipelineOrchestrator.js').ActionPipelineOrchestrator} */
  let orchestrator;
  let logger;
  let entityManager;
  let actionIndex;
  let commandFormatter;
  let safeEventDispatcher;
  let errorBuilder;
  let targetComponentValidator;
  let candidateActions;
  let actorEntity;
  let targetEntity;

  beforeEach(() => {
    actorEntity = {
      id: 'actor:test-agent',
      components: ['core:actor', 'core:sentient'],
    };

    targetEntity = {
      id: 'entity:friend',
      components: ['core:friend'],
    };

    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    entityManager = {
      getAllComponentTypesForEntity: jest.fn((entityId) => {
        if (entityId === actorEntity.id) {
          return actorEntity.components;
        }
        if (entityId === targetEntity.id) {
          return targetEntity.components;
        }
        return [];
      }),
      getEntityInstance: jest.fn((entityId) => {
        if (entityId === actorEntity.id) {
          return actorEntity;
        }
        if (entityId === targetEntity.id) {
          return targetEntity;
        }
        return null;
      }),
      getEntityById: jest.fn((entityId) => {
        if (entityId === actorEntity.id) {
          return actorEntity;
        }
        if (entityId === targetEntity.id) {
          return targetEntity;
        }
        return null;
      }),
      hasComponent: jest.fn((entityId, component) =>
        entityManager
          .getAllComponentTypesForEntity(entityId)
          .includes(component)
      ),
    };

    candidateActions = [
      {
        id: 'core:wave',
        name: 'Wave Hello',
        command: 'wave',
        description: 'Offer a friendly greeting.',
        target_entity: { id: targetEntity.id },
        forbidden_components: {
          target: ['core:unavailable'],
        },
      },
    ];

    actionIndex = {
      getCandidateActions: jest.fn(() => candidateActions),
    };

    commandFormatter = {
      format: jest.fn((actionDef, targetContext) => ({
        ok: true,
        value: `${actionDef.command}:${targetContext.entityId}`,
      })),
    };

    safeEventDispatcher = {
      dispatch: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    };

    errorBuilder = {
      buildErrorContext: jest.fn(({ error, actionDef }) => ({
        stage: 'test',
        actionId: actionDef?.id ?? 'unknown',
        error: error?.message ?? String(error ?? 'unknown error'),
      })),
    };

    targetComponentValidator = new TargetComponentValidator({
      logger,
      entityManager,
    });

    const targetRequiredComponentsValidator =
      createMockTargetRequiredComponentsValidator();

    orchestrator = new ActionPipelineOrchestrator({
      actionIndex,
      prerequisiteService: { evaluate: jest.fn() },
      targetService: { resolveTargets: jest.fn() },
      formatter: commandFormatter,
      entityManager,
      safeEventDispatcher,
      getEntityDisplayNameFn: (entityId) => `Display:${entityId}`,
      errorBuilder,
      logger,
      unifiedScopeResolver: { resolve: jest.fn() },
      targetContextBuilder: { build: jest.fn() },
      multiTargetResolutionStage: new SimpleMultiTargetStage(entityManager),
      targetComponentValidator,
      targetRequiredComponentsValidator,
    });
  });

  it('executes the full pipeline and formats discovered actions', async () => {
    const trace = {
      info: jest.fn(),
      step: jest.fn(),
      success: jest.fn(),
      failure: jest.fn(),
    };

    const result = await orchestrator.discoverActions(
      actorEntity,
      { mood: 'cheerful' },
      { trace }
    );

    expect(result.actions).toHaveLength(1);
    expect(result.actions[0]).toEqual(
      expect.objectContaining({
        id: 'core:wave',
        command: `wave:${targetEntity.id}`,
        params: { targetId: targetEntity.id },
      })
    );
    expect(result.errors).toEqual([]);
    expect(result.trace).toBe(trace);

    expect(actionIndex.getCandidateActions).toHaveBeenCalledWith(
      actorEntity,
      trace
    );
    expect(commandFormatter.format).toHaveBeenCalledWith(
      candidateActions[0],
      expect.objectContaining({ entityId: targetEntity.id }),
      entityManager,
      expect.any(Object),
      expect.any(Object)
    );

    expect(logger.debug).toHaveBeenCalledWith(
      `Starting action discovery pipeline for actor ${actorEntity.id}`
    );
    expect(logger.debug).toHaveBeenCalledWith(
      `Action discovery pipeline completed for actor ${actorEntity.id}. Found 1 actions, 0 errors.`
    );
  });

  it('supports discovery without optional trace configuration', async () => {
    const result = await orchestrator.discoverActions(actorEntity, {
      mood: 'neutral',
    });

    expect(result.actions).toHaveLength(1);
    expect(result.errors).toEqual([]);
    expect(result.trace).toBeUndefined();
    expect(actionIndex.getCandidateActions).toHaveBeenCalledWith(
      actorEntity,
      undefined
    );
  });

  it('halts further stages when no candidate actions are available', async () => {
    actionIndex.getCandidateActions.mockReturnValueOnce([]);

    const trace = {
      info: jest.fn(),
      step: jest.fn(),
    };

    const result = await orchestrator.discoverActions(
      actorEntity,
      { mood: 'isolated' },
      { trace }
    );

    expect(result.actions).toEqual([]);
    expect(result.errors).toEqual([]);
    expect(commandFormatter.format).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith(
      `Action discovery pipeline completed for actor ${actorEntity.id}. Found 0 actions, 0 errors.`
    );
  });
});
