import { describe, it, expect, beforeEach } from '@jest/globals';
import { UnifiedErrorHandler } from '../../../../src/actions/errors/unifiedErrorHandler.js';
import { ActionErrorContextBuilder } from '../../../../src/actions/errors/actionErrorContextBuilder.js';
import { FixSuggestionEngine } from '../../../../src/actions/errors/fixSuggestionEngine.js';
import { ActionIndex } from '../../../../src/actions/actionIndex.js';
import { TraceContext } from '../../../../src/actions/tracing/traceContext.js';
import { FIX_TYPES, ERROR_PHASES } from '../../../../src/actions/errors/actionErrorTypes.js';
import SimpleEntityManager from '../../../common/entities/simpleEntityManager.js';
import { TestDataFactory } from '../../../common/actions/testDataFactory.js';

class RecordingLogger {
  constructor() {
    this.debugEntries = [];
    this.infoEntries = [];
    this.warnEntries = [];
    this.errorEntries = [];
  }

  debug(message, details) {
    this.debugEntries.push({ message, details });
  }

  info(message, details) {
    this.infoEntries.push({ message, details });
  }

  warn(message, details) {
    this.warnEntries.push({ message, details });
  }

  error(message, details) {
    this.errorEntries.push({ message, details });
  }
}

class TestGameDataRepository {
  getComponentDefinition(componentId) {
    return { id: componentId, name: `Component ${componentId}` };
  }

  getConditionDefinition(conditionId) {
    return { id: conditionId, description: `Condition ${conditionId}` };
  }
}

/**
 *
 */
function createHandlerHarness() {
  const logger = new RecordingLogger();

  const entityManager = new SimpleEntityManager([
    {
      id: 'hero-1',
      components: {
        'core:location': { value: 'command-center' },
        'core:inventory': { items: [] },
        'core:status': { state: 'wounded' },
      },
    },
    {
      id: 'friend-1',
      components: {
        'core:location': { value: 'command-center' },
        'core:position': { locationId: 'command-center' },
      },
    },
  ]);

  const actions = TestDataFactory.createBasicActions();

  const actionIndex = new ActionIndex({
    logger,
    entityManager,
  });
  actionIndex.buildIndex(actions);

  const fixSuggestionEngine = new FixSuggestionEngine({
    logger,
    gameDataRepository: new TestGameDataRepository(),
    actionIndex,
  });

  const actionErrorContextBuilder = new ActionErrorContextBuilder({
    entityManager,
    logger,
    fixSuggestionEngine,
  });

  const handler = new UnifiedErrorHandler({
    actionErrorContextBuilder,
    logger,
  });

  return {
    logger,
    entityManager,
    actions,
    fixSuggestionEngine,
    actionErrorContextBuilder,
    handler,
  };
}

describe('UnifiedErrorHandler full-stack integration', () => {
  let harness;

  beforeEach(() => {
    harness = createHandlerHarness();
  });

  it('produces rich execution error context with real collaborators', () => {
    const { handler, actions, logger } = harness;
    const executionAction = actions.find((action) => action.id === 'movement:go');

    const trace = new TraceContext();
    trace.info('Actor components loaded', 'ComponentFilteringStage', {
      input: { actorId: 'hero-1' },
    });
    trace.failure("Missing component 'core:position'", 'TargetComponentValidator', {
      output: { missing: 'core:position' },
    });

    const missingComponentError = new Error(
      "Missing component 'core:position' on actor hero-1"
    );
    missingComponentError.name = 'ComponentNotFoundError';

    const context = handler.handleExecutionError(missingComponentError, {
      actorId: 'hero-1',
      actionDef: executionAction,
      targetId: 'friend-1',
      trace,
      additionalContext: { requestId: 'trace-1' },
    });

    expect(context.actorId).toBe('hero-1');
    expect(context.actionDefinition.id).toBe('movement:go');
    expect(context.targetId).toBe('friend-1');
    expect(context.environmentContext.stage).toBe('execution');
    expect(context.environmentContext.errorName).toBe('ComponentNotFoundError');
    expect(context.additionalContext.requestId).toBe('trace-1');

    expect(context.actorSnapshot.location).toBe('command-center');
    expect(context.actorSnapshot.components['core:location'].value).toBe(
      'command-center'
    );

    expect(context.evaluationTrace.steps.length).toBeGreaterThanOrEqual(1);
    expect(context.evaluationTrace.failurePoint).toContain('Missing component');

    const suggestionTypes = context.suggestedFixes.map((fix) => fix.type);
    expect(suggestionTypes).toContain(FIX_TYPES.MISSING_COMPONENT);

    const missingComponentFix = context.suggestedFixes.find(
      (fix) => fix.type === FIX_TYPES.MISSING_COMPONENT
    );
    expect(missingComponentFix?.details?.componentId).toBe('core:position');

    expect(logger.errorEntries.length).toBeGreaterThanOrEqual(1);
    const loggedError = logger.errorEntries[0];
    expect(loggedError.message).toBe('Error in execution phase');
    expect(loggedError.details?.actorId).toBe('hero-1');
  });

  it('creates context for discovery, validation, and processing phases', () => {
    const { handler, logger } = harness;

    const discoveryError = new Error('No candidate actions resolved');
    const discoveryContext = handler.handleDiscoveryError(discoveryError, {
      actorId: 'hero-1',
      additionalContext: { scenario: 'discovery' },
    });
    expect(discoveryContext.environmentContext.stage).toBe('discovery');
    expect(discoveryContext.actionDefinition.name).toBe('Unknown Action');
    expect(discoveryContext.additionalContext.scenario).toBe('discovery');

    const discoveryTrace = new TraceContext();
    discoveryTrace.info('Discovery trace entry', 'DiscoveryStage');
    const tracedDiscovery = handler.handleDiscoveryError(new Error('Trace flow'), {
      actorId: 'hero-1',
      actionDef: { id: 'core:look', name: 'Look' },
      trace: discoveryTrace,
    });
    expect(tracedDiscovery.evaluationTrace.steps.length).toBeGreaterThan(0);

    const validationError = new Error('Targets invalid');
    const validationContext = handler.handleValidationError(validationError, {
      actorId: 'hero-1',
      actionDef: { id: 'core:test', name: 'Test Action' },
      targetId: 'friend-1',
      additionalContext: { reason: 'invalid-target' },
    });
    expect(validationContext.environmentContext.stage).toBe('validation');
    expect(validationContext.additionalContext.reason).toBe('invalid-target');

    const validationTrace = new TraceContext();
    validationTrace.info('Validation trace entry', 'ValidationStage');
    const tracedValidation = handler.handleValidationError(
      new Error('Validation trace flow'),
      {
        actorId: 'hero-1',
        actionDef: { id: 'core:test', name: 'Test Action' },
        trace: validationTrace,
      }
    );
    expect(tracedValidation.targetId).toBeNull();
    expect(tracedValidation.evaluationTrace.steps.length).toBeGreaterThan(0);

    const processingError = new Error('Dispatch failed');
    const processingContext = handler.handleProcessingError(processingError, {
      actorId: 'hero-1',
      stage: 'dispatch',
      actionDef: { id: 'core:wait', name: 'Wait' },
    });
    expect(processingContext.environmentContext.stage).toBe(
      'command_processing_dispatch'
    );

    const processingWithAction = handler.handleProcessingError(
      new Error('Interpretation failure'),
      {
        actorId: 'hero-1',
        stage: 'interpretation',
        actionDef: { id: 'core:wait', name: 'Wait' },
        additionalContext: { step: 'interpretation' },
      }
    );
    expect(processingWithAction.additionalContext.step).toBe('interpretation');

    handler.logError('Non-critical issue', new Error('auxiliary failure'), {
      subsystem: 'integration-test',
    });
    handler.logError('Bare issue', new Error('bare failure'));

    const simple = handler.createSimpleErrorResponse(
      new Error('user facing'),
      'Readable message'
    );
    expect(simple).toEqual({
      success: false,
      error: 'Readable message',
      details: 'user facing',
    });

    const auxiliaryLog = logger.errorEntries.find((entry) =>
      entry.details?.subsystem
    );
    expect(auxiliaryLog?.details?.subsystem).toBe('integration-test');
  });

  it('honours optional parameters across the API surface', () => {
    const { handler, actions } = harness;
    const executionAction = actions.find((action) => action.id === 'movement:go');

    const executionWithoutTarget = handler.handleExecutionError(
      new Error('Execution without target'),
      {
        actorId: 'hero-1',
        actionDef: executionAction,
        trace: new TraceContext(),
      }
    );
    expect(executionWithoutTarget.targetId).toBeNull();

    const executionWithoutTrace = handler.handleExecutionError(
      new Error('Execution without trace'),
      {
        actorId: 'hero-1',
        actionDef: executionAction,
      }
    );
    expect(executionWithoutTrace.evaluationTrace.steps.length).toBe(0);

    const processingWithNullAction = handler.handleProcessingError(
      new Error('Processing with default action def'),
      {
        actorId: 'hero-1',
        stage: 'directive',
      }
    );
    expect(processingWithNullAction.actionDefinition.id).toBe('unknown');
  });

  it('allows direct context creation with minimal data', () => {
    const { handler } = harness;
    const minimal = handler.createContext({
      error: new Error('Minimal issue'),
      phase: ERROR_PHASES.DISCOVERY,
      actionDef: null,
      actorId: 'hero-1',
    });

    expect(minimal.actionDefinition.name).toBe('Unknown Action');
    expect(minimal.additionalContext).toEqual({});
    expect(minimal.targetId).toBeNull();
  });

  it('enforces constructor dependency requirements', () => {
    const logger = new RecordingLogger();

    expect(() => new UnifiedErrorHandler({ logger })).toThrow(
      'UnifiedErrorHandler requires actionErrorContextBuilder'
    );

    const builderStub = { buildErrorContext: () => ({}) };
    expect(
      () => new UnifiedErrorHandler({ actionErrorContextBuilder: builderStub })
    ).toThrow('UnifiedErrorHandler requires logger');
  });
});
