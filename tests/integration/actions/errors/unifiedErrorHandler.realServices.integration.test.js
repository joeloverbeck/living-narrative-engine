/**
 * @file Integration tests for UnifiedErrorHandler using real service collaborators.
 * @description Verifies that the unified handler produces rich error context when wired to
 *              ActionErrorContextBuilder, FixSuggestionEngine, and CommandDispatcher without
 *              relying on mocked core modules.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { UnifiedErrorHandler } from '../../../../src/actions/errors/unifiedErrorHandler.js';
import { ActionErrorContextBuilder } from '../../../../src/actions/errors/actionErrorContextBuilder.js';
import { FixSuggestionEngine } from '../../../../src/actions/errors/fixSuggestionEngine.js';
import { ActionIndex } from '../../../../src/actions/actionIndex.js';
import { CommandDispatcher } from '../../../../src/turns/states/helpers/services/commandDispatcher.js';
import { TraceContext } from '../../../../src/actions/tracing/traceContext.js';
import { FIX_TYPES, ERROR_PHASES } from '../../../../src/actions/errors/actionErrorTypes.js';
import SimpleEntityManager from '../../../common/entities/simpleEntityManager.js';
import { TestDataFactory } from '../../../common/actions/testDataFactory.js';

/**
 * Lightweight in-memory game data repository required by FixSuggestionEngine.
 */
class TestGameDataRepository {
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
 * Builds a fully wired UnifiedErrorHandler with real collaborators.
 *
 * @returns {{
 *   handler: UnifiedErrorHandler,
 *   actionErrorContextBuilder: ActionErrorContextBuilder,
 *   fixSuggestionEngine: FixSuggestionEngine,
 *   actionIndex: ActionIndex,
 *   entityManager: SimpleEntityManager,
 *   logger: ReturnType<typeof createTestLogger>,
 *   actions: ReturnType<typeof TestDataFactory.createBasicActions>
 * }}
 */
function createUnifiedErrorHandlerHarness() {
  const logger = createTestLogger();

  const entityManager = new SimpleEntityManager([
    {
      id: 'hero-1',
      components: {
        'core:location': { value: 'command-center' },
        'core:status': { state: 'wounded', stamina: 2 },
        'core:inventory': { items: [] },
        // Intentionally omit core:position to trigger missing component suggestions
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
    handler,
    actionErrorContextBuilder,
    fixSuggestionEngine,
    actionIndex,
    entityManager,
    logger,
    actions,
  };
}

/**
 * Creates a minimal logger capturing invocations for assertions.
 */
function createTestLogger() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

describe('UnifiedErrorHandler real service integration', () => {
  let harness;

  beforeEach(() => {
    harness = createUnifiedErrorHandlerHarness();
  });

  it('builds actionable error context when command dispatching fails', async () => {
    const { handler, actionErrorContextBuilder, entityManager, logger } = harness;

    const dispatchError = new Error("Missing component 'core:position' on actor hero-1");
    dispatchError.name = 'ComponentNotFoundError';

    class ThrowingCommandProcessor {
      async dispatchAction() {
        throw dispatchError;
      }
    }

    const commandProcessor = new ThrowingCommandProcessor();
    const dispatcher = new CommandDispatcher({
      commandProcessor,
      unifiedErrorHandler: handler,
      logger,
    });

    const buildSpy = jest.spyOn(actionErrorContextBuilder, 'buildErrorContext');

    const actor = entityManager.getEntityInstance('hero-1');
    const turnContext = {
      getActor: () => actor,
    };
    const turnAction = {
      actionDefinitionId: 'movement:go',
      commandString: 'go to the plaza',
    };

    const result = await dispatcher.dispatch({
      turnContext,
      actor,
      turnAction,
      stateName: 'CommandPhase',
    });

    expect(result).toBeNull();

    expect(logger.error).toHaveBeenCalledWith(
      'Error in execution phase',
      expect.objectContaining({
        error: dispatchError.message,
        stack: dispatchError.stack,
        actionId: 'movement:go',
        actorId: 'hero-1',
        targetId: null,
        phase: ERROR_PHASES.EXECUTION,
        stateName: 'CommandPhase',
        commandString: 'go to the plaza',
      })
    );

    expect(buildSpy).toHaveBeenCalled();
    const context = buildSpy.mock.results[0].value;
    expect(context.actionId).toBe('movement:go');
    expect(context.actorSnapshot.id).toBe('hero-1');
    expect(context.environmentContext).toEqual(
      expect.objectContaining({
        stateName: 'CommandPhase',
        commandString: 'go to the plaza',
        errorName: 'ComponentNotFoundError',
      })
    );
    expect(context.suggestedFixes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: FIX_TYPES.MISSING_COMPONENT,
          details: expect.objectContaining({
            componentId: 'core:position',
            actorId: 'hero-1',
          }),
        }),
      ])
    );
  });

  it('produces phase-specific contexts using the real builder collaborators', () => {
    const { handler, logger, actions } = harness;
    logger.error.mockClear();

    const actionDef = actions.find((action) => action.id === 'movement:go');
    const trace = new TraceContext();
    trace.step('Validating movement prerequisites', 'PrerequisiteService', {
      input: { actorId: 'hero-1' },
      output: { valid: true },
    });
    trace.failure('Missing component core:position', 'PrerequisiteService', {
      component: 'core:position',
    });

    const discoveryContext = handler.handleDiscoveryError(new Error('discovery failed'), {
      actorId: 'hero-1',
      actionDef,
      trace,
      additionalContext: { route: 'north wing' },
    });
    expect(discoveryContext.phase).toBe(ERROR_PHASES.DISCOVERY);
    expect(discoveryContext.additionalContext.stage).toBe('discovery');
    expect(discoveryContext.environmentContext).toEqual(
      expect.objectContaining({ route: 'north wing' })
    );

    const executionContext = handler.handleExecutionError(new Error('execution hiccup'), {
      actorId: 'hero-1',
      actionDef,
      targetId: 'friend-1',
      additionalContext: { attempt: 1 },
    });
    expect(executionContext.phase).toBe(ERROR_PHASES.EXECUTION);
    expect(executionContext.targetId).toBe('friend-1');
    expect(executionContext.additionalContext.stage).toBe('execution');

    const validationContext = handler.handleValidationError(new Error('validation failed'), {
      actorId: 'hero-1',
      actionDef,
      trace,
      additionalContext: { check: 'prerequisites' },
    });
    expect(validationContext.phase).toBe(ERROR_PHASES.VALIDATION);
    expect(validationContext.additionalContext.stage).toBe('validation');
    expect(validationContext.evaluationTrace.steps.length).toBeGreaterThan(0);
    expect(validationContext.evaluationTrace.failurePoint).toContain('Missing component');

    const processingContext = handler.handleProcessingError(new Error('processing broke'), {
      actorId: 'hero-1',
      stage: 'interpretation',
      actionDef,
      additionalContext: { retry: false },
    });
    expect(processingContext.additionalContext.stage).toBe(
      'command_processing_interpretation'
    );

    const fallbackContext = handler.handleProcessingError(
      new Error('processing without action definition'),
      {
        actorId: 'hero-1',
        stage: 'dispatch',
      }
    );
    expect(fallbackContext.actionDefinition).toEqual({
      id: 'unknown',
      name: 'Unknown Action',
    });

    handler.logError('Manual diagnostics', new Error('log failure'), { severity: 'high' });
    expect(logger.error).toHaveBeenLastCalledWith('Manual diagnostics', {
      error: 'log failure',
      stack: expect.any(String),
      severity: 'high',
    });

    const simple = handler.createSimpleErrorResponse(
      new Error('fatal issue'),
      'User facing message'
    );
    expect(simple).toEqual({
      success: false,
      error: 'User facing message',
      details: 'fatal issue',
    });
  });
});
