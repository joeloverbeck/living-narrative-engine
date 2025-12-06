import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';

import { ActionPipelineOrchestrator } from '../../../../src/actions/actionPipelineOrchestrator.js';
import { PipelineResult } from '../../../../src/actions/pipeline/PipelineResult.js';
import { ComponentFilteringStage } from '../../../../src/actions/pipeline/stages/ComponentFilteringStage.js';
import { PrerequisiteEvaluationStage } from '../../../../src/actions/pipeline/stages/PrerequisiteEvaluationStage.js';
import { TargetComponentValidationStage } from '../../../../src/actions/pipeline/stages/TargetComponentValidationStage.js';
import { ActionFormattingStage } from '../../../../src/actions/pipeline/stages/ActionFormattingStage.js';

const actor = { id: 'actor-001' };
const baseContext = { worldState: 'peaceful' };

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createErrorBuilder = () => ({
  buildErrorContext: jest.fn((params) => ({
    error: params.error?.message ?? 'error',
    stage: params.additionalContext?.stage ?? 'unknown',
  })),
});

const createDependencies = (overrides = {}) => {
  const logger = createLogger();
  const multiTargetResolutionStage = {
    name: 'MultiTargetResolution',
    execute: jest.fn(async (context) => {
      // Track stage execution order
      stageOrder.push('MultiTargetResolution');
      return PipelineResult.success({
        data: {
          resolvedTargets: context.candidateActions.map((action) => ({
            id: `${action.id}:target`,
          })),
        },
      });
    }),
  };

  return {
    logger,
    dependencies: {
      actionIndex: { getCandidateActions: jest.fn(() => []) },
      prerequisiteService: {
        evaluate: jest.fn(async () => ({ passed: true })),
      },
      targetService: {
        resolveTargets: jest.fn(() => ({ success: true, value: [] })),
      },
      formatter: {
        formatActionCommand: jest.fn((action, targets) => ({
          ok: true,
          value: `${action.id}:${targets.length}`,
        })),
      },
      entityManager: {
        getAllComponentTypesForEntity: jest.fn(() => ['core:sentient']),
      },
      safeEventDispatcher: { dispatch: jest.fn() },
      getEntityDisplayNameFn: jest.fn((entity) => entity?.id ?? 'unknown'),
      errorBuilder: createErrorBuilder(),
      logger,
      unifiedScopeResolver: {
        resolve: jest.fn(() => ({ success: true, value: new Set() })),
      },
      targetContextBuilder: {
        build: jest.fn(() => ({ type: 'entity', entityId: 'npc-1' })),
      },
      multiTargetResolutionStage,
      targetComponentValidator: {
        validateTargetComponents: jest.fn(() => ({
          success: true,
          invalidTargets: [],
        })),
      },
      targetRequiredComponentsValidator: {
        validateTargetRequirements: jest.fn(() => ({
          success: true,
          missingRequirements: [],
        })),
      },
      ...overrides,
    },
    multiTargetResolutionStage,
  };
};

// Module-level variable accessible by createDependencies
let stageOrder = [];

describe('ActionPipelineOrchestrator real pipeline flow', () => {
  let orchestrator;
  let trace;

  beforeEach(() => {
    jest.restoreAllMocks();
    stageOrder = [];
    trace = {
      step: jest.fn(),
      info: jest.fn(),
      success: jest.fn(),
      failure: jest.fn(),
      data: jest.fn(),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('propagates pipeline context and halts when a stage requests termination', async () => {
    const { dependencies, logger, multiTargetResolutionStage } =
      createDependencies();

    const candidates = [
      { id: 'action:warmup', template: 'wave' },
      { id: 'action:sing', template: 'sing' },
    ];

    jest
      .spyOn(ComponentFilteringStage.prototype, 'executeInternal')
      .mockImplementation(function executeComponentFiltering(context) {
        stageOrder.push(this.name);
        expect(context.actor).toBe(actor);
        expect(context.candidateActions).toEqual([]);
        expect(context.trace).toBe(trace);
        return Promise.resolve(
          PipelineResult.success({
            data: { candidateActions: candidates },
            continueProcessing: true,
          })
        );
      });

    jest
      .spyOn(PrerequisiteEvaluationStage.prototype, 'executeInternal')
      .mockImplementation(function executePrereq(context) {
        stageOrder.push(this.name);
        expect(context.candidateActions).toEqual(candidates);
        return Promise.resolve(
          PipelineResult.success({
            data: { candidateActions: [candidates[1]] },
            errors: [{ phase: 'prereq', actionId: candidates[0].id }],
          })
        );
      });

    const haltResult = PipelineResult.success({
      data: { candidateActions: [candidates[1]] },
      errors: [{ phase: 'target-validation', actionId: candidates[1].id }],
      continueProcessing: false,
    });

    jest
      .spyOn(TargetComponentValidationStage.prototype, 'executeInternal')
      .mockImplementation(function executeTargetValidation(context) {
        stageOrder.push(this.name);
        expect(context.candidateActions).toEqual([candidates[1]]);
        return Promise.resolve(haltResult);
      });

    const formattingSpy = jest
      .spyOn(ActionFormattingStage.prototype, 'executeInternal')
      .mockImplementation(function executeFormatting() {
        stageOrder.push(this.name);
        return Promise.resolve(
          PipelineResult.success({
            actions: [{ id: 'formatted:sing', label: 'Sing with style' }],
            errors: [{ phase: 'formatting', message: 'should not be reached' }],
          })
        );
      });

    orchestrator = new ActionPipelineOrchestrator(dependencies);

    const result = await orchestrator.discoverActions(actor, baseContext, {
      trace,
    });

    expect(logger.debug).toHaveBeenNthCalledWith(
      1,
      `Starting action discovery pipeline for actor ${actor.id}`
    );
    expect(logger.debug).toHaveBeenLastCalledWith(
      `Action discovery pipeline completed for actor ${actor.id}. Found 0 actions, 2 errors.`
    );

    expect(stageOrder).toEqual([
      'ComponentFiltering',
      'PrerequisiteEvaluation',
      'MultiTargetResolution',
      'TargetComponentValidation',
    ]);
    expect(multiTargetResolutionStage.execute).toHaveBeenCalled();
    expect(formattingSpy).not.toHaveBeenCalled();

    expect(result.actions).toEqual([]);
    expect(result.errors).toEqual([
      { phase: 'prereq', actionId: 'action:warmup' },
      { phase: 'target-validation', actionId: 'action:sing' },
    ]);
    expect(result.trace).toBe(trace);
  });

  it('surfaces pipeline execution errors when a stage throws', async () => {
    const { dependencies, logger } = createDependencies();

    const componentSpy = jest
      .spyOn(ComponentFilteringStage.prototype, 'executeInternal')
      .mockImplementation(function executeComponentFiltering() {
        stageOrder.push(this.name);
        return Promise.resolve(
          PipelineResult.success({
            data: {
              candidateActions: [{ id: 'action:wave', template: 'wave' }],
            },
          })
        );
      });

    const failingError = new Error('prerequisites exploded');

    jest
      .spyOn(PrerequisiteEvaluationStage.prototype, 'executeInternal')
      .mockImplementation(function executePrereq() {
        stageOrder.push(this.name);
        throw failingError;
      });

    const targetSpy = jest.spyOn(
      TargetComponentValidationStage.prototype,
      'executeInternal'
    );
    const formattingSpy = jest.spyOn(
      ActionFormattingStage.prototype,
      'executeInternal'
    );

    orchestrator = new ActionPipelineOrchestrator(dependencies);

    const result = await orchestrator.discoverActions(actor, baseContext);

    expect(logger.debug).toHaveBeenNthCalledWith(
      1,
      `Starting action discovery pipeline for actor ${actor.id}`
    );
    expect(logger.debug).toHaveBeenLastCalledWith(
      `Action discovery pipeline completed for actor ${actor.id}. Found 0 actions, 1 errors.`
    );

    expect(stageOrder).toEqual([
      'ComponentFiltering',
      'PrerequisiteEvaluation',
    ]);
    expect(componentSpy).toHaveBeenCalledTimes(1);
    expect(targetSpy).not.toHaveBeenCalled();
    expect(formattingSpy).not.toHaveBeenCalled();

    expect(result.actions).toEqual([]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toEqual(
      expect.objectContaining({
        error: failingError.message,
        phase: 'PIPELINE_EXECUTION',
        stageName: 'PrerequisiteEvaluation',
      })
    );
  });
});
