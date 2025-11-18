import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ActionPipelineOrchestrator } from '../../../src/actions/actionPipelineOrchestrator.js';

const mockPipelineExecute = jest.fn();
const mockPipelineConstructor = jest.fn();

/**
 *
 */
function mockCreateClassDouble() {
  const ctor = jest.fn();
  const factory = jest.fn().mockImplementation(function (...args) {
    ctor(...args);
  });
  return { factory, ctor };
}

jest.mock('../../../src/actions/pipeline/Pipeline.js', () => ({
  __esModule: true,
  Pipeline: class {
    constructor(stages, logger) {
      mockPipelineConstructor(stages, logger);
      this.execute = mockPipelineExecute;
    }
  },
}));

jest.mock('../../../src/actions/pipeline/stages/ComponentFilteringStage.js', () => ({
  __esModule: true,
  ComponentFilteringStage: (
    (globalThis.__mockStageDoubles ||= {}).componentFiltering =
      mockCreateClassDouble()
  ).factory,
}));

jest.mock('../../../src/actions/pipeline/stages/PrerequisiteEvaluationStage.js', () => ({
  __esModule: true,
  PrerequisiteEvaluationStage: (
    (globalThis.__mockStageDoubles ||= {}).prerequisite = mockCreateClassDouble()
  ).factory,
}));

jest.mock(
  '../../../src/actions/pipeline/stages/TargetComponentValidationStage.js',
  () => ({
    __esModule: true,
    TargetComponentValidationStage: (
      (globalThis.__mockStageDoubles ||= {}).targetValidation =
        mockCreateClassDouble()
    ).factory,
  })
);

jest.mock('../../../src/actions/pipeline/stages/ActionFormattingStage.js', () => ({
  __esModule: true,
  ActionFormattingStage: (
    (globalThis.__mockStageDoubles ||= {}).actionFormatting =
      mockCreateClassDouble()
  ).factory,
}));

jest.mock(
  '../../../src/actions/pipeline/services/implementations/TargetCandidatePruner.js',
  () => ({
    __esModule: true,
    default: (
      (globalThis.__mockHelperDoubles ||= {}).targetCandidatePruner =
        mockCreateClassDouble()
    ).factory,
  })
);

jest.mock(
  '../../../src/actions/pipeline/stages/TargetValidationConfigProvider.js',
  () => ({
    __esModule: true,
    default: (
      (globalThis.__mockHelperDoubles ||= {}).validationConfigProvider =
        mockCreateClassDouble()
    ).factory,
  })
);

jest.mock(
  '../../../src/actions/pipeline/stages/TargetValidationReporter.js',
  () => ({
    __esModule: true,
    default: (
      (globalThis.__mockHelperDoubles ||= {}).validationReporter =
        mockCreateClassDouble()
    ).factory,
  })
);

jest.mock(
  '../../../src/actions/pipeline/services/implementations/ContextUpdateEmitter.js',
  () => ({
    __esModule: true,
    default: (
      (globalThis.__mockHelperDoubles ||= {}).contextUpdateEmitter =
        mockCreateClassDouble()
    ).factory,
  })
);

const mockStageDoubles = globalThis.__mockStageDoubles;
const mockHelperDoubles = globalThis.__mockHelperDoubles;

describe('ActionPipelineOrchestrator', () => {
  const baseDependencies = () => ({
    actionIndex: { name: 'index' },
    prerequisiteService: { name: 'prereq' },
    targetService: { name: 'target' },
    formatter: { name: 'formatter' },
    entityManager: { name: 'manager' },
    safeEventDispatcher: { name: 'dispatcher' },
    getEntityDisplayNameFn: jest.fn(),
    errorBuilder: { name: 'errorBuilder' },
    logger: { debug: jest.fn() },
    unifiedScopeResolver: { name: 'resolver' },
    targetContextBuilder: { name: 'contextBuilder' },
    multiTargetResolutionStage: { name: 'multiStage' },
    targetComponentValidator: { name: 'componentValidator' },
    targetRequiredComponentsValidator: { name: 'requiredValidator' },
  });

  beforeEach(() => {
    mockPipelineExecute.mockReset();
    mockPipelineConstructor.mockReset();

    Object.values(mockStageDoubles).forEach(({ factory, ctor }) => {
      factory.mockClear();
      ctor.mockClear();
    });

    Object.values(mockHelperDoubles).forEach(({ factory, ctor }) => {
      factory.mockClear();
      ctor.mockClear();
    });
  });

  it('builds the pipeline with the provided dependencies and returns execution output', async () => {
    const dependencies = {
      ...baseDependencies(),
      targetCandidatePruner: { provided: 'pruner' },
      targetValidationConfigProvider: { provided: 'config' },
      targetValidationReporter: { provided: 'reporter' },
      contextUpdateEmitter: { provided: 'emitter' },
    };

    const orchestrator = new ActionPipelineOrchestrator(dependencies);

    const actor = { id: 'actor-123' };
    const context = { scene: 'intro' };
    const trace = { marker: 'trace' };
    const pipelineResult = { actions: [{ id: 'a1' }], errors: [{ id: 'e1' }] };
    mockPipelineExecute.mockResolvedValue(pipelineResult);

    const result = await orchestrator.discoverActions(actor, context, { trace });

    expect(result).toEqual({ actions: pipelineResult.actions, errors: pipelineResult.errors, trace });

    expect(mockStageDoubles.componentFiltering.factory).toHaveBeenCalledWith(
      dependencies.actionIndex,
      dependencies.errorBuilder,
      dependencies.logger,
      dependencies.entityManager
    );
    expect(mockStageDoubles.prerequisite.factory).toHaveBeenCalledWith(
      dependencies.prerequisiteService,
      dependencies.errorBuilder,
      dependencies.logger
    );
    expect(mockStageDoubles.targetValidation.factory).toHaveBeenCalledWith(
      expect.objectContaining({
        targetComponentValidator: dependencies.targetComponentValidator,
        targetRequiredComponentsValidator: dependencies.targetRequiredComponentsValidator,
        logger: dependencies.logger,
        actionErrorContextBuilder: dependencies.errorBuilder,
        targetCandidatePruner: dependencies.targetCandidatePruner,
        configProvider: dependencies.targetValidationConfigProvider,
        validationReporter: dependencies.targetValidationReporter,
        contextUpdateEmitter: dependencies.contextUpdateEmitter,
      })
    );
    expect(mockStageDoubles.actionFormatting.factory).toHaveBeenCalledWith(
      expect.objectContaining({
        commandFormatter: dependencies.formatter,
        entityManager: dependencies.entityManager,
        safeEventDispatcher: dependencies.safeEventDispatcher,
        getEntityDisplayNameFn: dependencies.getEntityDisplayNameFn,
        errorContextBuilder: dependencies.errorBuilder,
        logger: dependencies.logger,
      })
    );

    const pipelineStages = mockPipelineConstructor.mock.calls[0][0];
    expect(pipelineStages).toEqual([
      mockStageDoubles.componentFiltering.factory.mock.instances[0],
      mockStageDoubles.prerequisite.factory.mock.instances[0],
      dependencies.multiTargetResolutionStage,
      mockStageDoubles.targetValidation.factory.mock.instances[0],
      mockStageDoubles.actionFormatting.factory.mock.instances[0],
    ]);
    expect(mockPipelineConstructor).toHaveBeenCalledWith(pipelineStages, dependencies.logger);

    expect(mockPipelineExecute).toHaveBeenCalledWith({
      actor,
      actionContext: context,
      candidateActions: [],
      trace,
    });

    expect(dependencies.logger.debug).toHaveBeenNthCalledWith(
      1,
      'Starting action discovery pipeline for actor actor-123'
    );
    expect(dependencies.logger.debug).toHaveBeenNthCalledWith(
      2,
      'Action discovery pipeline completed for actor actor-123. Found 1 actions, 1 errors.'
    );

    expect(mockHelperDoubles.targetCandidatePruner.factory).not.toHaveBeenCalled();
    expect(mockHelperDoubles.validationConfigProvider.factory).not.toHaveBeenCalled();
    expect(mockHelperDoubles.validationReporter.factory).not.toHaveBeenCalled();
    expect(mockHelperDoubles.contextUpdateEmitter.factory).not.toHaveBeenCalled();
  });

  it('creates default pipeline helpers when optional dependencies are omitted', async () => {
    const dependencies = baseDependencies();
    const orchestrator = new ActionPipelineOrchestrator(dependencies);

    const actor = { id: 'actor-456' };
    const context = { scene: 'middle' };
    mockPipelineExecute.mockResolvedValue({ actions: [], errors: [] });

    await orchestrator.discoverActions(actor, context);

    expect(mockHelperDoubles.targetCandidatePruner.factory).toHaveBeenCalledWith({
      logger: dependencies.logger,
    });
    expect(mockHelperDoubles.validationConfigProvider.factory).toHaveBeenCalledTimes(1);
    expect(mockHelperDoubles.validationReporter.factory).toHaveBeenCalledWith({
      logger: dependencies.logger,
    });
    expect(mockHelperDoubles.contextUpdateEmitter.factory).toHaveBeenCalledTimes(1);

    const stageConfig = mockStageDoubles.targetValidation.ctor.mock.calls[0][0];
    expect(stageConfig.targetCandidatePruner).toBe(
      mockHelperDoubles.targetCandidatePruner.factory.mock.instances[0]
    );
    expect(stageConfig.configProvider).toBe(
      mockHelperDoubles.validationConfigProvider.factory.mock.instances[0]
    );
    expect(stageConfig.validationReporter).toBe(
      mockHelperDoubles.validationReporter.factory.mock.instances[0]
    );
    expect(stageConfig.contextUpdateEmitter).toBe(
      mockHelperDoubles.contextUpdateEmitter.factory.mock.instances[0]
    );

    expect(mockStageDoubles.componentFiltering.factory).toHaveBeenCalledTimes(1);
    expect(mockStageDoubles.prerequisite.factory).toHaveBeenCalledTimes(1);
    expect(mockStageDoubles.actionFormatting.factory).toHaveBeenCalledTimes(1);
  });
});
