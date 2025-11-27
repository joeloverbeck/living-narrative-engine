/**
 * @file Integration coverage tests for the ActionPipelineOrchestrator.
 * @description Validates that the orchestrator wires the pipeline together with the
 * expected stage dependencies and correctly propagates execution context and results.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import TargetCandidatePruner from '../../../../src/actions/pipeline/services/implementations/TargetCandidatePruner.js';
import TargetValidationConfigProvider from '../../../../src/actions/pipeline/stages/TargetValidationConfigProvider.js';
import TargetValidationReporter from '../../../../src/actions/pipeline/stages/TargetValidationReporter.js';
import ContextUpdateEmitter from '../../../../src/actions/pipeline/services/implementations/ContextUpdateEmitter.js';

const mockPipelineExecute = jest.fn();
const mockPipelineConstructor = jest.fn();

const mockComponentFilteringCtor = jest.fn();
const mockPrerequisiteEvaluationCtor = jest.fn();
const mockTargetComponentValidationCtor = jest.fn();
const mockActionFormattingCtor = jest.fn();

jest.mock('../../../../src/actions/pipeline/Pipeline.js', () => ({
  Pipeline: class {
    constructor(stages, logger) {
      mockPipelineConstructor(stages, logger);
      this.stages = stages;
      this.logger = logger;
    }

    execute(context) {
      return mockPipelineExecute(context);
    }
  },
}));

jest.mock(
  '../../../../src/actions/pipeline/stages/ComponentFilteringStage.js',
  () => ({
    ComponentFilteringStage: class {
      constructor(...args) {
        mockComponentFilteringCtor(...args);
        this.name = 'ComponentFilteringStage';
        this.execute = jest.fn();
      }
    },
  })
);

jest.mock(
  '../../../../src/actions/pipeline/stages/PrerequisiteEvaluationStage.js',
  () => ({
    PrerequisiteEvaluationStage: class {
      constructor(...args) {
        mockPrerequisiteEvaluationCtor(...args);
        this.name = 'PrerequisiteEvaluationStage';
        this.execute = jest.fn();
      }
    },
  })
);

jest.mock(
  '../../../../src/actions/pipeline/stages/TargetComponentValidationStage.js',
  () => ({
    TargetComponentValidationStage: class {
      constructor(...args) {
        mockTargetComponentValidationCtor(...args);
        this.name = 'TargetComponentValidationStage';
        this.execute = jest.fn();
      }
    },
  })
);

jest.mock(
  '../../../../src/actions/pipeline/stages/ActionFormattingStage.js',
  () => ({
    ActionFormattingStage: class {
      constructor(...args) {
        mockActionFormattingCtor(...args);
        this.name = 'ActionFormattingStage';
        this.execute = jest.fn();
      }
    },
  })
);

import { ActionPipelineOrchestrator } from '../../../../src/actions/actionPipelineOrchestrator.js';

/**
 * Resets all captured constructor calls and pipeline mocks before each test run.
 */
function resetMockState() {
  mockPipelineExecute.mockReset();
  mockPipelineConstructor.mockReset();
  mockComponentFilteringCtor.mockReset();
  mockPrerequisiteEvaluationCtor.mockReset();
  mockTargetComponentValidationCtor.mockReset();
  mockActionFormattingCtor.mockReset();
}

describe('ActionPipelineOrchestrator integration', () => {
  /** @type {import('../../../../src/actions/actionPipelineOrchestrator.js').ActionPipelineOrchestrator} */
  let orchestrator;
  let dependencies;
  let logger;

  beforeEach(() => {
    resetMockState();

    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    dependencies = {
      actionIndex: { getCandidateActions: jest.fn() },
      prerequisiteService: { evaluate: jest.fn() },
      targetService: { resolveTargets: jest.fn() },
      formatter: { formatActionCommand: jest.fn() },
      entityManager: { getEntityById: jest.fn() },
      safeEventDispatcher: { dispatch: jest.fn() },
      getEntityDisplayNameFn: jest.fn(),
      errorBuilder: { buildErrorContext: jest.fn() },
      logger,
      unifiedScopeResolver: { resolve: jest.fn() },
      targetContextBuilder: { build: jest.fn() },
      multiTargetResolutionStage: {
        name: 'MultiTargetResolutionStage',
        execute: jest.fn(),
      },
      targetComponentValidator: { validateTargetComponents: jest.fn() },
    };

    orchestrator = new ActionPipelineOrchestrator(dependencies);
  });

  it('constructs the pipeline with the expected stages and propagates execution context', async () => {
    const actor = { id: 'actor-42' };
    const actionContext = { mood: 'excited' };
    const trace = { span: 'test-trace' };

    const pipelineResult = {
      actions: [
        { id: 'action-a', label: 'Alpha' },
        { id: 'action-b', label: 'Beta' },
      ],
      errors: [{ message: 'minor issue' }],
    };

    mockPipelineExecute.mockResolvedValue(pipelineResult);

    const result = await orchestrator.discoverActions(actor, actionContext, { trace });

    expect(logger.debug).toHaveBeenNthCalledWith(
      1,
      `Starting action discovery pipeline for actor ${actor.id}`
    );
    expect(logger.debug).toHaveBeenNthCalledWith(
      2,
      `Action discovery pipeline completed for actor ${actor.id}. Found ${pipelineResult.actions.length} actions, ${pipelineResult.errors.length} errors.`
    );

    expect(mockPipelineConstructor).toHaveBeenCalledTimes(1);
    const [stages, pipelineLogger] = mockPipelineConstructor.mock.calls[0];
    expect(pipelineLogger).toBe(logger);
    expect(stages).toHaveLength(5);

    expect(mockComponentFilteringCtor).toHaveBeenCalledWith(
      dependencies.actionIndex,
      dependencies.errorBuilder,
      logger,
      dependencies.entityManager
    );
    expect(mockPrerequisiteEvaluationCtor).toHaveBeenCalledWith(
      dependencies.prerequisiteService,
      dependencies.errorBuilder,
      logger
    );
    expect(mockTargetComponentValidationCtor).toHaveBeenCalledWith(
      expect.objectContaining({
        targetComponentValidator: dependencies.targetComponentValidator,
        targetRequiredComponentsValidator: undefined,
        logger,
        actionErrorContextBuilder: dependencies.errorBuilder,
        targetCandidatePruner: expect.any(TargetCandidatePruner),
        configProvider: expect.any(TargetValidationConfigProvider),
        validationReporter: expect.any(TargetValidationReporter),
        contextUpdateEmitter: expect.any(ContextUpdateEmitter),
      })
    );
    expect(mockActionFormattingCtor).toHaveBeenCalledWith({
      commandFormatter: dependencies.formatter,
      entityManager: dependencies.entityManager,
      safeEventDispatcher: dependencies.safeEventDispatcher,
      getEntityDisplayNameFn: dependencies.getEntityDisplayNameFn,
      errorContextBuilder: dependencies.errorBuilder,
      logger,
      chanceCalculationService: null,
    });

    expect(stages[2]).toBe(dependencies.multiTargetResolutionStage);

    expect(mockPipelineExecute).toHaveBeenCalledTimes(1);
    expect(mockPipelineExecute).toHaveBeenCalledWith({
      actor,
      actionContext,
      candidateActions: [],
      trace,
    });

    expect(result).toEqual({
      actions: pipelineResult.actions,
      errors: pipelineResult.errors,
      trace,
    });
  });

  it('supports discovery without optional options object and returns empty trace by default', async () => {
    const actor = { id: 'solo-actor' };
    const actionContext = { scope: 'minimal' };

    mockPipelineExecute.mockResolvedValue({ actions: [], errors: [] });

    const result = await orchestrator.discoverActions(actor, actionContext);

    expect(mockPipelineExecute).toHaveBeenCalledWith({
      actor,
      actionContext,
      candidateActions: [],
      trace: undefined,
    });

    expect(result).toEqual({ actions: [], errors: [], trace: undefined });
  });
});
