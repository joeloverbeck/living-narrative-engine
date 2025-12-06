/**
 * @file Real pipeline integration tests for ActionPipelineOrchestrator.
 * @description Exercises the orchestrator with concrete pipeline stage implementations
 *              (no Jest mocks) to validate candidate discovery and formatting flows.
 */

import { describe, it, expect, jest } from '@jest/globals';
import { ActionPipelineOrchestrator } from '../../../../src/actions/actionPipelineOrchestrator.js';
import { ActionIndex } from '../../../../src/actions/actionIndex.js';
import { PipelineStage } from '../../../../src/actions/pipeline/PipelineStage.js';
import { PipelineResult } from '../../../../src/actions/pipeline/PipelineResult.js';
import SimpleEntityManager from '../../../common/entities/simpleEntityManager.js';

const ACTOR_ID = 'actor-1';
const TARGET_ID = 'villager-1';

/**
 * Simple multi-target resolution stage used for integration tests.
 * Enhances candidate actions with resolved targets so downstream stages can operate normally.
 */
class SimpleMultiTargetResolutionStage extends PipelineStage {
  /**
   * @param {SimpleEntityManager} entityManager - Entity manager providing entity lookups.
   * @param {string} targetId - Identifier of the primary target entity.
   */
  constructor(entityManager, targetId) {
    super('MultiTargetResolutionStage');
    this.entityManager = entityManager;
    this.targetId = targetId;
  }

  /**
   * @inheritdoc
   */
  async executeInternal(context) {
    const { candidateActions = [], actor } = context;
    const targetEntity = this.entityManager.getEntityInstance(this.targetId);

    const actionsWithTargets = candidateActions.map((actionDef) => {
      const enrichedAction = {
        ...actionDef,
        resolvedTargets: {
          primary: targetEntity,
          actor,
        },
        target_entities: {
          primary: targetEntity,
        },
      };

      return {
        actionDef: enrichedAction,
        targetContexts: [
          {
            entityId: targetEntity?.id,
            type: 'primary',
            label: 'Primary',
            entity: targetEntity,
          },
        ],
      };
    });

    return PipelineResult.success({
      data: {
        candidateActions: actionsWithTargets.map(({ actionDef }) => actionDef),
        actionsWithTargets,
      },
      continueProcessing: candidateActions.length > 0,
    });
  }
}

/**
 * Factory for a fresh logger mock bundle.
 *
 * @returns {{debug: jest.Mock, info: jest.Mock, warn: jest.Mock, error: jest.Mock}}
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
 * Builds an orchestrator instance with real pipeline stages and configurable fixtures.
 *
 * @param {object} options - Scenario configuration.
 * @param {Record<string, any>} options.actorComponents - Components assigned to the actor entity.
 * @param {Array<object>} options.actions - Action definitions to feed into the ActionIndex.
 * @param {Record<string, boolean>} [options.prerequisiteDecisions] - Optional overrides controlling prerequisite outcomes per action id.
 * @returns {object} Prepared orchestrator and supporting test doubles.
 */
function createOrchestratorScenario({
  actorComponents,
  actions,
  prerequisiteDecisions = {},
}) {
  const logger = createLogger();
  const entityManager = new SimpleEntityManager([
    {
      id: ACTOR_ID,
      components: actorComponents,
    },
    {
      id: TARGET_ID,
      components: {
        identity: { name: 'Edda the Villager' },
      },
    },
  ]);

  const actionIndex = new ActionIndex({ logger, entityManager });
  actionIndex.buildIndex(actions);

  const prerequisiteService = {
    evaluate: jest.fn((_, actionDef) => {
      const decision = prerequisiteDecisions[actionDef.id];
      return decision !== undefined ? decision : true;
    }),
  };

  const targetComponentValidator = {
    validateTargetComponents: jest.fn(() => ({ valid: true })),
  };

  const targetRequiredComponentsValidator = {
    validateTargetRequirements: jest.fn(() => ({ valid: true })),
  };

  const commandFormatter = {
    format: jest.fn(
      (actionDef, targetContext, manager, _options, { displayNameFn }) => {
        const entity = manager.getEntityInstance(targetContext.entityId);
        const targetName = displayNameFn(
          entity,
          targetContext.entityId,
          logger
        );
        return { ok: true, value: `${actionDef.name} -> ${targetName}` };
      }
    ),
  };

  const safeEventDispatcher = { dispatch: jest.fn() };

  const errorBuilder = {
    buildErrorContext: jest.fn((input) => ({
      ...input,
      stage: 'integration-test',
    })),
  };

  const orchestrator = new ActionPipelineOrchestrator({
    actionIndex,
    prerequisiteService,
    targetService: { resolveTargets: jest.fn() },
    formatter: commandFormatter,
    entityManager,
    safeEventDispatcher,
    getEntityDisplayNameFn: (entity, fallback) =>
      entity?.components?.identity?.name || fallback,
    errorBuilder,
    logger,
    unifiedScopeResolver: { resolve: jest.fn() },
    targetContextBuilder: { build: jest.fn() },
    multiTargetResolutionStage: new SimpleMultiTargetResolutionStage(
      entityManager,
      TARGET_ID
    ),
    targetComponentValidator,
    targetRequiredComponentsValidator,
  });

  return {
    orchestrator,
    logger,
    actionIndex,
    prerequisiteService,
    commandFormatter,
    targetComponentValidator,
    targetRequiredComponentsValidator,
    safeEventDispatcher,
    errorBuilder,
  };
}

describe('ActionPipelineOrchestrator real pipeline flow', () => {
  it('discovers and formats actions end-to-end with concrete stage implementations', async () => {
    const actions = [
      {
        id: 'core:greet',
        name: 'Greet Villager',
        template: 'greet {target}',
        prerequisites: [{ id: 'greet-allowed' }],
      },
      {
        id: 'core:heal',
        name: 'Heal Ally',
        template: 'heal {target}',
        prerequisites: [{ id: 'heal-blocked' }],
        required_components: { actor: ['skill:healing'] },
      },
    ];

    const { orchestrator, logger, prerequisiteService, commandFormatter } =
      createOrchestratorScenario({
        actorComponents: {
          'skill:charm': { level: 3 },
          'skill:healing': { level: 2 },
        },
        actions,
        prerequisiteDecisions: {
          'core:greet': true,
          'core:heal': false,
        },
      });

    const trace = {
      step: jest.fn(),
      info: jest.fn(),
      success: jest.fn(),
      data: jest.fn(),
    };

    const result = await orchestrator.discoverActions(
      { id: ACTOR_ID },
      { mood: 'cheerful' },
      { trace }
    );

    expect(result.actions).toHaveLength(1);
    expect(result.actions[0]).toMatchObject({
      id: 'core:greet',
      command: 'Greet Villager -> Edda the Villager',
    });
    expect(result.errors).toEqual([]);
    expect(result.trace).toBe(trace);

    expect(prerequisiteService.evaluate).toHaveBeenCalledTimes(2);
    expect(commandFormatter.format).toHaveBeenCalledTimes(1);
    expect(logger.debug).toHaveBeenCalledWith(
      `Starting action discovery pipeline for actor ${ACTOR_ID}`
    );
    expect(logger.debug).toHaveBeenCalledWith(
      `Action discovery pipeline completed for actor ${ACTOR_ID}. Found 1 actions, 0 errors.`
    );
  });

  it('returns no actions when component filtering yields no candidates', async () => {
    const actions = [
      {
        id: 'core:heal',
        name: 'Heal Ally',
        template: 'heal {target}',
        prerequisites: [{ id: 'heal-required' }],
        required_components: { actor: ['skill:healing'] },
      },
    ];

    const { orchestrator, logger, prerequisiteService, commandFormatter } =
      createOrchestratorScenario({
        actorComponents: {},
        actions,
        prerequisiteDecisions: {
          'core:heal': true,
        },
      });

    const result = await orchestrator.discoverActions(
      { id: ACTOR_ID },
      { mood: 'calm' }
    );

    expect(result.actions).toEqual([]);
    expect(result.errors).toEqual([]);
    expect(result.trace).toBeUndefined();

    expect(prerequisiteService.evaluate).not.toHaveBeenCalled();
    expect(commandFormatter.format).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith(
      `Starting action discovery pipeline for actor ${ACTOR_ID}`
    );
    expect(logger.debug).toHaveBeenCalledWith(
      `Action discovery pipeline completed for actor ${ACTOR_ID}. Found 0 actions, 0 errors.`
    );
  });
});
