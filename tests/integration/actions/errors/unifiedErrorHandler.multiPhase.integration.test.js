/**
 * @file Multi-phase integration tests for UnifiedErrorHandler
 * @description Verifies that the handler coordinates with real collaborators
 *              (ActionErrorContextBuilder, FixSuggestionEngine, ActionIndex, TraceContext)
 *              to build rich error contexts across discovery, validation, execution,
 *              and command-processing stages without relying on Jest mocks.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { UnifiedErrorHandler } from '../../../../src/actions/errors/unifiedErrorHandler.js';
import { ActionErrorContextBuilder } from '../../../../src/actions/errors/actionErrorContextBuilder.js';
import { FixSuggestionEngine } from '../../../../src/actions/errors/fixSuggestionEngine.js';
import { ActionIndex } from '../../../../src/actions/actionIndex.js';
import {
  TraceContext,
  TRACE_FAILURE,
  TRACE_STEP,
  TRACE_DATA,
} from '../../../../src/actions/tracing/traceContext.js';
import {
  ERROR_PHASES,
  FIX_TYPES,
} from '../../../../src/actions/errors/actionErrorTypes.js';
import SimpleEntityManager from '../../../common/entities/simpleEntityManager.js';

class RecordingLogger {
  constructor() {
    this.errors = [];
    this.warns = [];
    this.infos = [];
    this.debugs = [];
  }

  error(message, context) {
    this.errors.push({ message, context });
  }

  warn(message, context) {
    this.warns.push({ message, context });
  }

  info(message, context) {
    this.infos.push({ message, context });
  }

  debug(message, context) {
    this.debugs.push({ message, context });
  }

  group() {}
  groupCollapsed() {}
  groupEnd() {}
  table() {}
}

class InMemoryGameDataRepository {
  getComponentDefinition(componentId) {
    return { id: componentId, name: `Component ${componentId}` };
  }

  getConditionDefinition(conditionId) {
    return {
      id: conditionId,
      description: `Condition ${conditionId}`,
      logic: { var: conditionId },
    };
  }
}

/**
 *
 */
function createHarness() {
  const logger = new RecordingLogger();

  const entityManager = new SimpleEntityManager([
    {
      id: 'hero-1',
      components: {
        'core:location': { value: 'command-center' },
        'core:status': { mood: 'tired', stamina: 1 },
        'core:inventory': { items: ['map', 'radio', 'rope'] },
        'core:trustworthy': { value: true },
      },
    },
    {
      id: 'friend-1',
      components: {
        'core:location': { value: 'command-center' },
        'core:position': { locationId: 'command-center', facing: 'north' },
      },
    },
  ]);

  const actions = [
    {
      id: 'social:befriend',
      name: 'Befriend Ally',
      command: 'befriend',
      scope: 'actors:nearby',
      required_components: {
        actor: ['core:trustworthy'],
      },
      forbidden_components: {
        actor: ['core:blocked'],
      },
      prerequisites: [
        {
          all: [
            { hasComponent: 'core:trustworthy' },
            { condition_ref: 'relationship:isFriendly' },
          ],
        },
      ],
    },
  ];

  const actionIndex = new ActionIndex({
    logger,
    entityManager,
  });
  actionIndex.buildIndex(actions);

  const fixSuggestionEngine = new FixSuggestionEngine({
    logger,
    gameDataRepository: new InMemoryGameDataRepository(),
    actionIndex,
  });

  const builder = new ActionErrorContextBuilder({
    entityManager,
    logger,
    fixSuggestionEngine,
  });

  const handler = new UnifiedErrorHandler({
    actionErrorContextBuilder: builder,
    logger,
  });

  return {
    handler,
    builder,
    fixSuggestionEngine,
    actionIndex,
    entityManager,
    logger,
    actionDefinition: actions[0],
  };
}

describe('UnifiedErrorHandler multi-phase integration', () => {
  let harness;

  beforeEach(() => {
    harness = createHarness();
  });

  it('validates constructor dependencies before wiring collaborators', () => {
    expect(
      () => new UnifiedErrorHandler({ logger: new RecordingLogger() })
    ).toThrow('UnifiedErrorHandler requires actionErrorContextBuilder');

    expect(
      () =>
        new UnifiedErrorHandler({
          actionErrorContextBuilder: harness.builder,
        })
    ).toThrow('UnifiedErrorHandler requires logger');
  });

  it('builds rich contexts across discovery, validation, execution, and processing phases', () => {
    const { handler, logger, actionDefinition } = harness;
    const actorId = 'hero-1';
    const targetId = 'friend-1';

    const discoveryTrace = new TraceContext();
    discoveryTrace.step('Collecting nearby actors', 'ScopeResolutionStage', {
      input: { actorId },
      output: { candidates: [] },
    });
    discoveryTrace.failure(
      'No valid targets discovered',
      'ScopeResolutionStage',
      { reason: 'All candidates filtered out' }
    );

    const discoveryError = new Error(
      'Scope resolution failed: no valid targets around hero-1'
    );
    discoveryError.name = 'ScopeResolutionError';

    const discoveryContext = handler.handleDiscoveryError(discoveryError, {
      actorId,
      actionDef: actionDefinition,
      trace: discoveryTrace,
      additionalContext: { attemptedScope: 'friends-nearby' },
    });

    expect(discoveryContext.phase).toBe(ERROR_PHASES.DISCOVERY);
    expect(discoveryContext.actorId).toBe(actorId);
    expect(discoveryContext.additionalContext.stage).toBe('discovery');
    expect(discoveryContext.evaluationTrace.steps).toHaveLength(2);
    expect(discoveryContext.suggestedFixes.map((fix) => fix.type)).toEqual(
      expect.arrayContaining([
        FIX_TYPES.INVALID_TARGET,
        FIX_TYPES.SCOPE_RESOLUTION,
      ])
    );

    const discoveryDefaults = handler.handleDiscoveryError(
      new Error('no targets at all'),
      { actorId }
    );
    expect(discoveryDefaults.actionDefinition.name).toBe('Unknown Action');
    expect(discoveryDefaults.additionalContext).toEqual({ stage: 'discovery' });

    const validationTrace = new TraceContext();
    validationTrace.step(
      'Validating prerequisites',
      'PrerequisiteEvaluationStage',
      {
        input: { actorId },
        output: { required: ['core:trustworthy', 'relationship:isFriendly'] },
      }
    );
    validationTrace.addLog(
      TRACE_FAILURE,
      'Missing component core:friend',
      'PrerequisiteEvaluationStage',
      { missingComponent: 'core:friend' }
    );
    validationTrace.addLog(
      TRACE_DATA,
      'Context snapshot',
      'PrerequisiteEvaluationStage',
      { component: 'core:friend', state: 'absent' }
    );

    const validationError = new Error(
      "Missing component 'core:friend' for prerequisite evaluation"
    );
    validationError.name = 'ComponentNotFoundError';

    const validationContext = handler.handleValidationError(validationError, {
      actorId,
      actionDef: actionDefinition,
      targetId,
      trace: validationTrace,
      additionalContext: { requestId: 'req-42' },
    });

    expect(validationContext.phase).toBe(ERROR_PHASES.VALIDATION);
    expect(validationContext.targetId).toBe(targetId);
    expect(validationContext.additionalContext.stage).toBe('validation');
    expect(validationContext.evaluationTrace.steps).toHaveLength(3);
    expect(validationContext.evaluationTrace.finalContext).toEqual(
      expect.objectContaining({ component: 'core:friend', state: 'absent' })
    );
    expect(validationContext.suggestedFixes.map((fix) => fix.type)).toEqual(
      expect.arrayContaining([
        FIX_TYPES.MISSING_COMPONENT,
        FIX_TYPES.MISSING_PREREQUISITE,
      ])
    );

    const validationDefaults = handler.handleValidationError(
      new Error('validation defaults'),
      { actorId, actionDef: actionDefinition }
    );
    expect(validationDefaults.targetId).toBeNull();
    expect(validationDefaults.additionalContext).toEqual({
      stage: 'validation',
    });

    const executionError = new Error(
      'Invalid state: actor stamina depleted while targeting friend-1'
    );
    executionError.name = 'InvalidStateError';

    const executionContext = handler.handleExecutionError(executionError, {
      actorId,
      actionDef: actionDefinition,
      targetId,
      additionalContext: { attempt: 3 },
    });

    expect(executionContext.phase).toBe(ERROR_PHASES.EXECUTION);
    expect(executionContext.additionalContext.stage).toBe('execution');
    expect(executionContext.suggestedFixes.map((fix) => fix.type)).toEqual(
      expect.arrayContaining([FIX_TYPES.INVALID_STATE])
    );

    const processingError = new Error(
      'Directive pipeline rejected the command'
    );

    const processingContext = handler.handleProcessingError(processingError, {
      actorId,
      stage: 'interpretation',
      actionDef: actionDefinition,
      additionalContext: { stateName: 'CommandProcessingState' },
    });

    expect(processingContext.additionalContext.stage).toBe(
      'command_processing_interpretation'
    );

    const executionDefaults = handler.handleExecutionError(
      new Error('execution defaults'),
      { actorId, actionDef: actionDefinition }
    );
    expect(executionDefaults.targetId).toBeNull();
    expect(executionDefaults.additionalContext).toEqual({ stage: 'execution' });

    const processingDefaults = handler.handleProcessingError(
      new Error('processing defaults'),
      { actorId, stage: 'dispatch' }
    );
    expect(processingDefaults.additionalContext).toEqual({
      stage: 'command_processing_dispatch',
    });

    const fallbackContext = handler.createContext({
      error: new Error('Generic pipeline failure'),
      phase: ERROR_PHASES.DISCOVERY,
      actorId,
      actionDef: null,
    });

    expect(fallbackContext.actionDefinition.name).toBe('Unknown Action');

    const plainError = new Error('Non critical issue');
    handler.logError('Observed warning', plainError, { feature: 'logging' });
    expect(logger.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: 'Observed warning',
          context: expect.objectContaining({
            error: plainError.message,
            feature: 'logging',
          }),
        }),
      ])
    );

    const response = handler.createSimpleErrorResponse(
      new Error('fatal'),
      'Operation failed'
    );
    expect(response).toEqual({
      success: false,
      error: 'Operation failed',
      details: 'fatal',
    });

    // Ensure every invocation logged through the recording logger.
    expect(logger.errors.length).toBeGreaterThanOrEqual(4);
  });
});
