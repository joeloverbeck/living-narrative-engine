/**
 * @file Additional integration tests for UnifiedErrorHandler covering dependency validation
 *       and resilience when collaborating services encounter failures.
 * @description Uses real service implementations (ActionErrorContextBuilder, FixSuggestionEngine,
 *              ActionIndex, TraceContext) wired together to verify that the unified handler
 *              gracefully handles dependency issues without relying on jest mocks for core logic.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { UnifiedErrorHandler } from '../../../../src/actions/errors/unifiedErrorHandler.js';
import { ActionErrorContextBuilder } from '../../../../src/actions/errors/actionErrorContextBuilder.js';
import { FixSuggestionEngine } from '../../../../src/actions/errors/fixSuggestionEngine.js';
import { ActionIndex } from '../../../../src/actions/actionIndex.js';
import { TraceContext } from '../../../../src/actions/tracing/traceContext.js';
import { ERROR_PHASES } from '../../../../src/actions/errors/actionErrorTypes.js';
import SimpleEntityManager from '../../../common/entities/simpleEntityManager.js';
import { TestDataFactory } from '../../../common/actions/testDataFactory.js';

/**
 * Minimal in-memory repository satisfying FixSuggestionEngine dependencies.
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
 * Entity manager that simulates downstream failures when capturing actor snapshots.
 */
class FaultyEntityManager extends SimpleEntityManager {
  getEntityInstance(entityId) {
    throw new Error(`Entity service unavailable for ${entityId}`);
  }

  getAllComponentTypesForEntity(entityId) {
    throw new Error(`Component listing unavailable for ${entityId}`);
  }
}

/**
 * Creates a logger with jest spies for assertion.
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
 * Builds a fully wired UnifiedErrorHandler harness.
 *
 * @param {object} [options]
 * @param {boolean} [options.useFaultyEntityManager] - Whether to use the failing entity manager implementation.
 * @returns {{
 *   handler: UnifiedErrorHandler,
 *   actionErrorContextBuilder: ActionErrorContextBuilder,
 *   fixSuggestionEngine: FixSuggestionEngine,
 *   actionIndex: ActionIndex,
 *   entityManager: SimpleEntityManager,
 *   logger: ReturnType<typeof createLogger>,
 *   actions: ReturnType<typeof TestDataFactory.createBasicActions>
 * }}
 */
function createUnifiedErrorHandlerHarness({ useFaultyEntityManager = false } = {}) {
  const logger = createLogger();
  const entityManager = useFaultyEntityManager
    ? new FaultyEntityManager([
        {
          id: 'hero-1',
          components: {
            'core:location': { value: 'observatory' },
            'core:status': { state: 'fatigued' },
          },
        },
      ])
    : new SimpleEntityManager([
        {
          id: 'hero-1',
          components: {
            'core:location': { value: 'observatory' },
            'core:status': { state: 'fatigued' },
            'core:position': { locationId: 'observatory' },
          },
        },
      ]);

  const actions = TestDataFactory.createBasicActions();

  const actionIndex = new ActionIndex({ logger, entityManager });
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

describe('UnifiedErrorHandler dependency resilience integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws descriptive errors when critical dependencies are missing', () => {
    const logger = createLogger();
    const { actionErrorContextBuilder } = createUnifiedErrorHandlerHarness();

    expect(() => {
      return new UnifiedErrorHandler({
        logger,
      });
    }).toThrow('UnifiedErrorHandler requires actionErrorContextBuilder');

    expect(() => {
      return new UnifiedErrorHandler({
        actionErrorContextBuilder,
      });
    }).toThrow('UnifiedErrorHandler requires logger');
  });

  it('builds fallback error contexts when entity snapshot capture fails', () => {
    const {
      handler,
      logger,
      actions,
    } = createUnifiedErrorHandlerHarness({ useFaultyEntityManager: true });

    logger.error.mockClear();
    logger.warn.mockClear();

    const actionDef = actions.find((action) => action.id === 'movement:go');
    const trace = new TraceContext();
    trace.step('pre-check', 'TraceBootstrap', { status: 'starting' });

    const discoveryError = new Error('discovery meltdown');
    const discoveryContext = handler.handleDiscoveryError(discoveryError, {
      actorId: 'hero-404',
      actionDef,
      trace,
      additionalContext: { scenario: 'missing actor' },
    });

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Failed to create complete actor snapshot'),
      expect.any(Error)
    );

    expect(logger.error).toHaveBeenCalledWith(
      'Error in discovery phase',
      expect.objectContaining({
        error: discoveryError.message,
        actorId: 'hero-404',
        phase: ERROR_PHASES.DISCOVERY,
        scenario: 'missing actor',
      })
    );

    expect(discoveryContext.actorSnapshot).toEqual(
      expect.objectContaining({
        id: 'hero-404',
        components: {},
        location: 'unknown',
        metadata: expect.objectContaining({
          error: 'Failed to capture snapshot',
        }),
      })
    );

    const executionError = new Error('execution meltdown');
    const executionContext = handler.handleExecutionError(executionError, {
      actorId: 'hero-404',
      actionDef,
      targetId: 'friend-1',
      additionalContext: { attempt: 1 },
    });
    expect(executionContext.additionalContext.stage).toBe('execution');
    expect(logger.error).toHaveBeenCalledWith(
      'Error in execution phase',
      expect.objectContaining({
        targetId: 'friend-1',
        attempt: 1,
      })
    );

    const validationError = new Error('validation meltdown');
    const validationContext = handler.handleValidationError(validationError, {
      actorId: 'hero-404',
      actionDef,
      trace,
      additionalContext: { check: 'state' },
    });
    expect(validationContext.additionalContext.stage).toBe('validation');

    const minimalDiscovery = handler.handleDiscoveryError(
      new Error('minimal discovery'),
      { actorId: 'hero-404' }
    );
    expect(minimalDiscovery.additionalContext.stage).toBe('discovery');

    const minimalExecution = handler.handleExecutionError(
      new Error('minimal execution'),
      { actorId: 'hero-404', actionDef }
    );
    expect(minimalExecution.targetId).toBeNull();

    const minimalValidation = handler.handleValidationError(
      new Error('minimal validation'),
      { actorId: 'hero-404', actionDef }
    );

    const processingContext = handler.handleProcessingError(
      new Error('processing meltdown'),
      {
        actorId: 'hero-404',
        stage: 'dispatch',
        additionalContext: { channel: 'primary' },
      }
    );
    expect(processingContext.additionalContext.stage).toBe(
      'command_processing_dispatch'
    );

    const minimalProcessing = handler.handleProcessingError(
      new Error('minimal processing'),
      { actorId: 'hero-404', stage: 'directive' }
    );
    expect(minimalProcessing.additionalContext.stage).toBe(
      'command_processing_directive'
    );

    handler.logError('observed failure', new Error('logger meltdown'), {
      severity: 'critical',
    });
    expect(logger.error).toHaveBeenLastCalledWith(
      'observed failure',
      expect.objectContaining({
        error: 'logger meltdown',
        severity: 'critical',
      })
    );

    handler.logError('bare message', new Error('bare error'));

    const directContext = handler.createContext({
      error: new Error('direct invocation'),
      phase: ERROR_PHASES.EXECUTION,
      actionDef: null,
      actorId: 'hero-404',
    });
    expect(directContext.additionalContext).toEqual({});

    const simpleResponse = handler.createSimpleErrorResponse(
      new Error('fatal issue'),
      'User facing message'
    );
    expect(simpleResponse).toEqual({
      success: false,
      error: 'User facing message',
      details: 'fatal issue',
    });
  });
});
