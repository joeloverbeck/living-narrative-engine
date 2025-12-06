/**
 * @file Additional unit tests for TargetComponentValidationStage focused on
 * exercising rarely used branches and dependency fallbacks.
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  jest,
  afterEach,
} from '@jest/globals';
import { TargetComponentValidationStage } from '../../../../../src/actions/pipeline/stages/TargetComponentValidationStage.js';
import TargetValidationIOAdapter from '../../../../../src/actions/pipeline/adapters/TargetValidationIOAdapter.js';

const createLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

const createErrorContextBuilder = () => ({
  buildErrorContext: jest.fn((params) => ({ ...params })),
});

describe('TargetComponentValidationStage - additional coverage', () => {
  let validator;
  let requiredValidator;
  let logger;
  let errorContextBuilder;

  beforeEach(() => {
    validator = {
      validateTargetComponents: jest.fn(() => ({ valid: true })),
    };
    requiredValidator = {
      validateTargetRequirements: jest.fn(() => ({ valid: true })),
    };
    logger = createLogger();
    errorContextBuilder = createErrorContextBuilder();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('instantiates default optional dependencies when none are provided', () => {
    const stage = new TargetComponentValidationStage({
      targetComponentValidator: validator,
      targetRequiredComponentsValidator: requiredValidator,
      logger,
      actionErrorContextBuilder: errorContextBuilder,
    });

    expect(stage).toBeInstanceOf(TargetComponentValidationStage);
  });

  it('logs performance diagnostics when execution exceeds configured threshold', async () => {
    const configSnapshot = {
      skipValidation: false,
      logDetails: true,
      strictness: 'strict',
      performanceThreshold: 10,
      shouldSkipAction: jest.fn(() => false),
    };
    const configProvider = { getSnapshot: jest.fn(() => configSnapshot) };
    const reporter = {
      reportStageSkipped: jest.fn(),
      reportStageStart: jest.fn(),
      reportStageCompletion: jest.fn(),
      reportValidationAnalysis: jest.fn().mockResolvedValue(),
      reportPerformanceData: jest.fn().mockResolvedValue(),
    };
    const contextUpdateEmitter = {
      applyTargetValidationResults: jest.fn(),
    };

    const performanceValues = [0, 5, 7, 20];
    const performanceSpy = jest
      .spyOn(performance, 'now')
      .mockImplementation(() => performanceValues.shift() ?? 30);

    const stage = new TargetComponentValidationStage({
      targetComponentValidator: validator,
      targetRequiredComponentsValidator: requiredValidator,
      logger,
      actionErrorContextBuilder: errorContextBuilder,
      configProvider,
      validationReporter: reporter,
      contextUpdateEmitter,
    });

    const context = {
      candidateActions: [{ id: 'timed-action' }],
    };

    const result = await stage.executeInternal(context);

    expect(result.success).toBe(true);
    expect(logger.debug).toHaveBeenCalledWith(
      'Target component validation took 20.00ms for 1 actions'
    );
    performanceSpy.mockRestore();
  });

  it('short-circuits execution when validation is disabled in the configuration snapshot', async () => {
    const configSnapshot = {
      skipValidation: true,
      logDetails: true,
      strictness: 'strict',
      performanceThreshold: 5,
      shouldSkipAction: jest.fn(() => false),
    };
    const configProvider = { getSnapshot: jest.fn(() => configSnapshot) };
    const reporter = {
      reportStageSkipped: jest.fn(),
      reportStageStart: jest.fn(),
      reportStageCompletion: jest.fn(),
      reportValidationAnalysis: jest.fn(),
      reportPerformanceData: jest.fn(),
    };
    const contextUpdateEmitter = {
      applyTargetValidationResults: jest.fn(),
    };

    const stage = new TargetComponentValidationStage({
      targetComponentValidator: validator,
      targetRequiredComponentsValidator: requiredValidator,
      logger,
      actionErrorContextBuilder: errorContextBuilder,
      configProvider,
      validationReporter: reporter,
      contextUpdateEmitter,
    });

    const context = {
      candidateActions: [{ id: 'skip-me' }],
      trace: null,
    };

    const result = await stage.executeInternal(context);

    expect(configProvider.getSnapshot).toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith(
      'Target component validation is disabled via configuration'
    );
    expect(reporter.reportStageSkipped).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: 'Target component validation skipped (disabled in config)',
      })
    );
    expect(
      contextUpdateEmitter.applyTargetValidationResults
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        validatedItems: expect.any(Array),
      })
    );
    expect(result.success).toBe(true);
    expect(result.data.candidateActions).toEqual([{ id: 'skip-me' }]);
    expect(result.continueProcessing).toBe(true);
  });

  it('honors injected collaborators, lenient validation, and pruning metadata', async () => {
    const shouldSkipAction = jest.fn((action) => action.id === 'skip-action');
    const configSnapshot = {
      skipValidation: false,
      logDetails: true,
      strictness: 'lenient',
      performanceThreshold: 0,
      shouldSkipAction,
    };
    const configProvider = { getSnapshot: jest.fn(() => configSnapshot) };

    const pruner = {
      prune: jest.fn(() => ({
        keptTargets: {
          primary: [{ id: 'entity:allowed' }],
        },
        removedTargets: [
          {
            role: 'primary',
            candidate: { id: 'entity:removed' },
          },
        ],
        removalReasons: ['Removed due to missing prerequisites'],
      })),
    };

    const reporter = {
      reportStageSkipped: jest.fn(),
      reportStageStart: jest.fn(),
      reportStageCompletion: jest.fn(),
      reportValidationAnalysis: jest.fn().mockResolvedValue(),
      reportPerformanceData: jest.fn().mockResolvedValue(),
    };

    const contextUpdateEmitter = {
      applyTargetValidationResults: jest.fn(),
    };

    validator.validateTargetComponents.mockReturnValue({
      valid: false,
      reason: 'non-critical failure',
    });
    requiredValidator.validateTargetRequirements.mockReturnValue({
      valid: false,
      reason: 'missing component',
    });

    const stage = new TargetComponentValidationStage({
      targetComponentValidator: validator,
      targetRequiredComponentsValidator: requiredValidator,
      logger,
      actionErrorContextBuilder: errorContextBuilder,
      targetCandidatePruner: pruner,
      configProvider,
      validationReporter: reporter,
      contextUpdateEmitter,
    });

    const skipEntry = {
      actionDef: { id: 'skip-action' },
      resolvedTargets: null,
      targetDefinitions: null,
      targetContexts: [],
    };

    const validatedActionDef = {
      id: 'lenient-action',
      targetDefinitions: {
        primary: { placeholder: 'primary_placeholder' },
      },
    };

    const lenientEntry = {
      actionDef: validatedActionDef,
      resolvedTargets: {
        primary: [{ id: 'entity:allowed' }, { id: 'entity:removed' }],
      },
      targetDefinitions: validatedActionDef.targetDefinitions,
      targetContexts: [
        {
          type: 'entity',
          placeholder: 'primary_placeholder',
          entityId: 'entity:allowed',
        },
        {
          type: 'entity',
          placeholder: 'primary_placeholder',
          entityId: 'entity:removed',
        },
        { type: 'note' },
      ],
    };

    const context = {
      actionsWithTargets: [skipEntry, lenientEntry],
      trace: { startSpan: jest.fn(), endSpan: jest.fn() },
    };

    const result = await stage.executeInternal(context);

    expect(pruner.prune).toHaveBeenCalledTimes(1);
    expect(validator.validateTargetComponents).toHaveBeenCalledWith(
      validatedActionDef,
      expect.objectContaining({ primary: expect.any(Array) })
    );
    expect(requiredValidator.validateTargetRequirements).toHaveBeenCalledWith(
      validatedActionDef,
      expect.any(Object)
    );
    expect(logger.debug).toHaveBeenCalledWith(
      "Skipping validation for action 'skip-action' based on configuration"
    );
    expect(logger.debug).toHaveBeenCalledWith(
      "Action 'lenient-action' allowed in lenient mode despite: Allowed in lenient mode"
    );
    expect(logger.debug).toHaveBeenCalledWith(
      "Action 'lenient-action' filtered out: Removed due to missing prerequisites"
    );
    expect(reporter.reportStageStart).toHaveBeenCalledWith(
      expect.objectContaining({ candidateCount: 2, strictness: 'lenient' })
    );
    expect(reporter.reportStageCompletion).toHaveBeenCalled();

    const emitterArgs =
      contextUpdateEmitter.applyTargetValidationResults.mock.calls[0][0];
    expect(emitterArgs.validatedItems).toHaveLength(1);
    expect(emitterArgs.metadata.stageUpdates).toEqual([
      expect.objectContaining({
        actionId: 'lenient-action',
        removalReasons: ['Removed due to missing prerequisites'],
      }),
    ]);

    const rebuiltActions = result.data.actionsWithTargets || [];
    expect(rebuiltActions).toHaveLength(1);
    expect(rebuiltActions[0].actionDef.id).toBe('skip-action');
  });

  it('surfaces validation errors through error context builder', async () => {
    const error = new Error('validation exploded');
    validator.validateTargetComponents.mockImplementation(() => {
      throw error;
    });
    const failureContext = { error: error.message };
    errorContextBuilder.buildErrorContext.mockReturnValue(failureContext);

    const configSnapshot = {
      skipValidation: false,
      logDetails: false,
      strictness: 'strict',
      performanceThreshold: 5,
      shouldSkipAction: jest.fn(() => false),
    };
    const configProvider = { getSnapshot: jest.fn(() => configSnapshot) };

    const reporter = {
      reportStageSkipped: jest.fn(),
      reportStageStart: jest.fn(),
      reportStageCompletion: jest.fn(),
      reportValidationAnalysis: jest.fn(),
      reportPerformanceData: jest.fn(),
    };

    const stage = new TargetComponentValidationStage({
      targetComponentValidator: validator,
      targetRequiredComponentsValidator: requiredValidator,
      logger,
      actionErrorContextBuilder: errorContextBuilder,
      configProvider,
      validationReporter: reporter,
    });

    const context = {
      candidateActions: [{ id: 'failing-action' }],
      actor: { id: 'actor-1' },
    };

    const result = await stage.executeInternal(context);

    expect(result.success).toBe(false);
    expect(errorContextBuilder.buildErrorContext).toHaveBeenCalledWith(
      expect.objectContaining({
        error,
        actorId: 'actor-1',
        additionalContext: expect.objectContaining({
          stage: 'target_component_validation',
        }),
      })
    );
    expect(logger.error).toHaveBeenCalledWith(
      `Error during target component validation: ${error.message}`,
      error
    );
    expect(result.errors).toEqual([failureContext]);
  });

  it('filters actions missing required target candidates after validation', async () => {
    const configSnapshot = {
      skipValidation: false,
      logDetails: false,
      strictness: 'strict',
      performanceThreshold: 5,
      shouldSkipAction: jest.fn(() => false),
    };
    const configProvider = { getSnapshot: jest.fn(() => configSnapshot) };

    const pruner = {
      prune: jest.fn(() => ({
        keptTargets: { primary: [] },
        removedTargets: [],
        removalReasons: [],
      })),
    };

    const reporter = {
      reportStageSkipped: jest.fn(),
      reportStageStart: jest.fn(),
      reportStageCompletion: jest.fn(),
      reportValidationAnalysis: jest.fn().mockResolvedValue(),
      reportPerformanceData: jest.fn().mockResolvedValue(),
    };

    const stage = new TargetComponentValidationStage({
      targetComponentValidator: validator,
      targetRequiredComponentsValidator: requiredValidator,
      logger,
      actionErrorContextBuilder: errorContextBuilder,
      configProvider,
      validationReporter: reporter,
      targetCandidatePruner: pruner,
    });

    const actionDef = {
      id: 'missing-target',
      targetDefinitions: {
        primary: { placeholder: 'primary_placeholder' },
      },
    };

    const context = {
      actionsWithTargets: [
        {
          actionDef,
          resolvedTargets: { primary: [] },
          targetDefinitions: actionDef.targetDefinitions,
          targetContexts: [
            {
              type: 'entity',
              placeholder: 'primary_placeholder',
              entityId: 'entity:1',
            },
            {
              type: 'entity',
              placeholder: 'secondary_placeholder',
              entityId: 'entity:secondary',
            },
          ],
        },
      ],
    };

    const result = await stage.executeInternal(context);

    expect(logger.debug).toHaveBeenCalledWith(
      "Filtering action 'missing-target' - missing resolved candidates for required target 'primary'"
    );
    expect(result.success).toBe(true);
    expect(result.data.actionsWithTargets).toHaveLength(0);
    expect(result.continueProcessing).toBe(false);
  });

  it('retains actions when target definitions are empty or unresolved', async () => {
    const configSnapshot = {
      skipValidation: false,
      logDetails: false,
      strictness: 'strict',
      performanceThreshold: 5,
      shouldSkipAction: jest.fn(() => false),
    };
    const configProvider = { getSnapshot: jest.fn(() => configSnapshot) };

    const reporter = {
      reportStageSkipped: jest.fn(),
      reportStageStart: jest.fn(),
      reportStageCompletion: jest.fn(),
      reportValidationAnalysis: jest.fn().mockResolvedValue(),
      reportPerformanceData: jest.fn().mockResolvedValue(),
    };

    const stage = new TargetComponentValidationStage({
      targetComponentValidator: validator,
      targetRequiredComponentsValidator: requiredValidator,
      logger,
      actionErrorContextBuilder: errorContextBuilder,
      configProvider,
      validationReporter: reporter,
    });

    const context = {
      actionsWithTargets: [
        {
          actionDef: { id: 'no-defs', targetDefinitions: {} },
          resolvedTargets: {},
          targetDefinitions: {},
          targetContexts: [],
        },
        {
          actionDef: {
            id: 'null-resolved',
            targetDefinitions: {
              primary: { placeholder: 'primary_placeholder' },
            },
          },
          resolvedTargets: null,
          targetDefinitions: {
            primary: { placeholder: 'primary_placeholder' },
          },
          targetContexts: [],
        },
      ],
    };

    const result = await stage.executeInternal(context);

    expect(result.success).toBe(true);
    expect(result.data.actionsWithTargets).toHaveLength(2);
  });

  it('handles missing metadata gracefully when recording pruning updates', async () => {
    const configSnapshot = {
      skipValidation: false,
      logDetails: false,
      strictness: 'strict',
      performanceThreshold: 5,
      shouldSkipAction: jest.fn(() => false),
    };
    const configProvider = { getSnapshot: jest.fn(() => configSnapshot) };
    const reporter = {
      reportStageSkipped: jest.fn(),
      reportStageStart: jest.fn(),
      reportStageCompletion: jest.fn(),
      reportValidationAnalysis: jest.fn().mockResolvedValue(),
      reportPerformanceData: jest.fn().mockResolvedValue(),
    };
    const contextUpdateEmitter = {
      applyTargetValidationResults: jest.fn(),
    };

    const stage = new TargetComponentValidationStage({
      targetComponentValidator: validator,
      targetRequiredComponentsValidator: requiredValidator,
      logger,
      actionErrorContextBuilder: errorContextBuilder,
      configProvider,
      validationReporter: reporter,
      contextUpdateEmitter,
      targetCandidatePruner: {
        prune: jest.fn(() => ({
          keptTargets: null,
          removedTargets: [],
          removalReasons: [],
        })),
      },
    });

    const normalizedItems = [
      {
        actionDef: { id: 'metadata-test' },
        resolvedTargets: null,
        targetDefinitions: null,
        targetContexts: [],
        sourceFormat: 'candidateActions',
        originalIndex: 0,
        originalRef: null,
      },
    ];

    const normalizeSpy = jest
      .spyOn(TargetValidationIOAdapter.prototype, 'normalize')
      .mockReturnValue({
        format: 'candidateActions',
        items: normalizedItems,
        metadata: null,
      });

    const rebuildSpy = jest
      .spyOn(TargetValidationIOAdapter.prototype, 'rebuild')
      .mockReturnValue({
        data: { candidateActions: [{ id: 'metadata-test' }] },
        continueProcessing: true,
      });

    const context = { candidateActions: [{ id: 'metadata-test' }] };

    const result = await stage.executeInternal(context);

    expect(normalizeSpy).toHaveBeenCalled();
    expect(rebuildSpy).toHaveBeenCalled();
    expect(
      contextUpdateEmitter.applyTargetValidationResults
    ).toHaveBeenCalledWith(expect.objectContaining({ metadata: null }));
    expect(result.success).toBe(true);
  });

  it('returns empty results when adapter reports an empty format', async () => {
    const configSnapshot = {
      skipValidation: false,
      logDetails: false,
      strictness: 'strict',
      performanceThreshold: 5,
      shouldSkipAction: jest.fn(() => false),
    };
    const configProvider = { getSnapshot: jest.fn(() => configSnapshot) };

    const reporter = {
      reportStageSkipped: jest.fn(),
      reportStageStart: jest.fn(),
      reportStageCompletion: jest.fn(),
      reportValidationAnalysis: jest.fn().mockResolvedValue(),
      reportPerformanceData: jest.fn().mockResolvedValue(),
    };

    const stage = new TargetComponentValidationStage({
      targetComponentValidator: validator,
      targetRequiredComponentsValidator: requiredValidator,
      logger,
      actionErrorContextBuilder: errorContextBuilder,
      configProvider,
      validationReporter: reporter,
    });

    const normalizeSpy = jest
      .spyOn(TargetValidationIOAdapter.prototype, 'normalize')
      .mockReturnValue({
        format: 'empty',
        items: [],
        metadata: { actor: null },
      });

    const rebuildSpy = jest
      .spyOn(TargetValidationIOAdapter.prototype, 'rebuild')
      .mockReturnValue({
        data: { candidateActions: [] },
        continueProcessing: false,
      });

    const context = {};

    const result = await stage.executeInternal(context);

    expect(normalizeSpy).toHaveBeenCalled();
    expect(rebuildSpy).toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.data.candidateActions).toEqual([]);
    expect(result.continueProcessing).toBe(false);
  });

  it('preserves target contexts when pruned targets are unavailable', async () => {
    const configSnapshot = {
      skipValidation: false,
      logDetails: false,
      strictness: 'strict',
      performanceThreshold: 5,
      shouldSkipAction: jest.fn(() => false),
    };
    const configProvider = { getSnapshot: jest.fn(() => configSnapshot) };

    const reporter = {
      reportStageSkipped: jest.fn(),
      reportStageStart: jest.fn(),
      reportStageCompletion: jest.fn(),
      reportValidationAnalysis: jest.fn().mockResolvedValue(),
      reportPerformanceData: jest.fn().mockResolvedValue(),
    };

    const pruner = {
      prune: jest.fn(() => ({
        keptTargets: null,
        removedTargets: [],
        removalReasons: [],
      })),
    };

    const contextUpdateEmitter = {
      applyTargetValidationResults: jest.fn(),
    };

    const stage = new TargetComponentValidationStage({
      targetComponentValidator: validator,
      targetRequiredComponentsValidator: requiredValidator,
      logger,
      actionErrorContextBuilder: errorContextBuilder,
      configProvider,
      validationReporter: reporter,
      targetCandidatePruner: pruner,
      contextUpdateEmitter,
    });

    const context = {
      actionsWithTargets: [
        {
          actionDef: { id: 'no-pruned-targets' },
          resolvedTargets: null,
          targetDefinitions: null,
          targetContexts: [
            {
              type: 'entity',
              placeholder: 'primary_placeholder',
              entityId: 'entity:1',
            },
          ],
        },
      ],
    };

    await stage.executeInternal(context);

    const { validatedItems } =
      contextUpdateEmitter.applyTargetValidationResults.mock.calls[0][0];
    expect(validatedItems[0].targetContexts).toEqual([
      {
        type: 'entity',
        placeholder: 'primary_placeholder',
        entityId: 'entity:1',
      },
    ]);
  });

  it('retains contexts when no placeholders are resolved during pruning', async () => {
    const configSnapshot = {
      skipValidation: false,
      logDetails: false,
      strictness: 'strict',
      performanceThreshold: 5,
      shouldSkipAction: jest.fn(() => false),
    };
    const configProvider = { getSnapshot: jest.fn(() => configSnapshot) };

    const reporter = {
      reportStageSkipped: jest.fn(),
      reportStageStart: jest.fn(),
      reportStageCompletion: jest.fn(),
      reportValidationAnalysis: jest.fn().mockResolvedValue(),
      reportPerformanceData: jest.fn().mockResolvedValue(),
    };

    const pruner = {
      prune: jest.fn(() => ({
        keptTargets: { secondary: [{ id: 'entity:secondary' }] },
        removedTargets: [],
        removalReasons: [],
      })),
    };

    const contextUpdateEmitter = {
      applyTargetValidationResults: jest.fn(),
    };

    const stage = new TargetComponentValidationStage({
      targetComponentValidator: validator,
      targetRequiredComponentsValidator: requiredValidator,
      logger,
      actionErrorContextBuilder: errorContextBuilder,
      configProvider,
      validationReporter: reporter,
      targetCandidatePruner: pruner,
      contextUpdateEmitter,
    });

    const context = {
      actionsWithTargets: [
        {
          actionDef: {
            id: 'unresolved-placeholders',
            targetDefinitions: {
              primary: { placeholder: 'primary_placeholder' },
            },
          },
          resolvedTargets: {
            secondary: [{ id: 'entity:secondary' }],
          },
          targetDefinitions: {
            primary: { placeholder: 'primary_placeholder' },
          },
          targetContexts: [
            {
              type: 'entity',
              placeholder: 'secondary_placeholder',
              entityId: 'entity:secondary',
            },
          ],
        },
      ],
    };

    await stage.executeInternal(context);

    const { items } =
      contextUpdateEmitter.applyTargetValidationResults.mock.calls[0][0];

    expect(items[0].targetContexts).toEqual([
      {
        type: 'entity',
        placeholder: 'secondary_placeholder',
        entityId: 'entity:secondary',
      },
    ]);
  });
});
