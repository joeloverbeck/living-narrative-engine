/**
 * @file Integration test for UnifiedErrorHandler interacting with the real
 * ActionErrorContextBuilder and FixSuggestionEngine classes.
 *
 * The goal is to exercise the full stack of error context creation without
 * resorting to jest mocks so that the integration coverage reflects how these
 * services collaborate in production.
 */

import { describe, it, beforeEach, expect } from '@jest/globals';
import { UnifiedErrorHandler } from '../../../../src/actions/errors/unifiedErrorHandler.js';
import { ActionErrorContextBuilder } from '../../../../src/actions/errors/actionErrorContextBuilder.js';
import { FixSuggestionEngine } from '../../../../src/actions/errors/fixSuggestionEngine.js';
import {
  ERROR_PHASES,
  FIX_TYPES,
} from '../../../../src/actions/errors/actionErrorTypes.js';
import {
  TraceContext,
  TRACE_DATA,
  TRACE_INFO,
} from '../../../../src/actions/tracing/traceContext.js';

/**
 * Lightweight logger implementation that records the payload of each call so
 * assertions can be made on the interactions between the services under test.
 */
class RecordingLogger {
  constructor() {
    this.debugLogs = [];
    this.infoLogs = [];
    this.warnLogs = [];
    this.errorLogs = [];
  }

  debug(message, extra) {
    this.debugLogs.push({ message, extra });
  }

  info(message, extra) {
    this.infoLogs.push({ message, extra });
  }

  warn(message, extra) {
    this.warnLogs.push({ message, extra });
  }

  error(message, extra) {
    this.errorLogs.push({ message, extra });
  }
}

/**
 * Simple in-memory entity manager that fulfils the contract expected by
 * ActionErrorContextBuilder while avoiding jest.fn() mocks.
 */
class InMemoryEntityManager {
  constructor(entities) {
    this.entities = new Map(Object.entries(entities));
  }

  getEntityInstance(entityId) {
    const entity = this.entities.get(entityId);
    if (!entity) {
      throw new Error(`Unknown entity: ${entityId}`);
    }
    return {
      id: entityId,
      type: entity.type,
      components: this.#clone(entity.components),
    };
  }

  getAllComponentTypesForEntity(entityId) {
    const entity = this.entities.get(entityId);
    return entity ? Object.keys(entity.components) : [];
  }

  getComponentData(entityId, componentType) {
    const entity = this.entities.get(entityId);
    return entity?.components?.[componentType]
      ? this.#clone(entity.components[componentType])
      : undefined;
  }

  #clone(value) {
    return JSON.parse(JSON.stringify(value));
  }
}

/**
 * Minimal game data repository that satisfies the required interface for
 * FixSuggestionEngine.
 */
class SimpleGameDataRepository {
  constructor(componentDefinitions = {}, conditionDefinitions = {}) {
    this.componentDefinitions = componentDefinitions;
    this.conditionDefinitions = conditionDefinitions;
  }

  getComponentDefinition(id) {
    return this.componentDefinitions[id] ?? null;
  }

  getConditionDefinition(id) {
    return this.conditionDefinitions[id] ?? null;
  }
}

/**
 * Minimal action index used by FixSuggestionEngine. The current implementation
 * of the engine only validates that the dependency exposes the
 * getCandidateActions method, so this is intentionally small.
 */
class StaticActionIndex {
  constructor(actions = []) {
    this.actions = actions;
  }

  getCandidateActions() {
    return this.actions;
  }
}

describe('UnifiedErrorHandler – real module integration', () => {
  let logger;
  let entityManager;
  let gameDataRepository;
  let actionIndex;
  let fixSuggestionEngine;
  let errorContextBuilder;
  let handler;

  const actionDefinition = {
    id: 'test:dash',
    name: 'Dash Forward',
    scope: 'adjacent',
    prerequisites: [
      { hasComponent: 'core:mobility' },
      {
        and: [
          { hasComponent: 'core:inventory' },
          {
            or: [
              { hasComponent: 'core:hands' },
              { hasComponent: 'core:telekinesis' },
            ],
          },
        ],
      },
    ],
  };

  beforeEach(() => {
    logger = new RecordingLogger();

    entityManager = new InMemoryEntityManager({
      'actor-1': {
        type: 'actor',
        components: {
          'core:actor': { name: 'Aria' },
          'core:location': { value: 'observatory' },
        },
      },
    });

    gameDataRepository = new SimpleGameDataRepository();
    actionIndex = new StaticActionIndex([actionDefinition]);

    fixSuggestionEngine = new FixSuggestionEngine({
      logger,
      gameDataRepository,
      actionIndex,
    });

    errorContextBuilder = new ActionErrorContextBuilder({
      entityManager,
      logger,
      fixSuggestionEngine,
    });

    handler = new UnifiedErrorHandler({
      actionErrorContextBuilder: errorContextBuilder,
      logger,
    });
  });

  it('builds a validation context with rich suggestions and actor snapshot', () => {
    const error = new Error("Missing component 'core:mobility' for actor");
    error.name = 'ComponentNotFoundError';

    const context = handler.handleValidationError(error, {
      actorId: 'actor-1',
      actionDef: actionDefinition,
      additionalContext: { requestId: 'req-77' },
    });

    expect(logger.errorLogs).toHaveLength(1);
    expect(logger.errorLogs[0]).toMatchObject({
      message: 'Error in validation phase',
      extra: expect.objectContaining({
        actionId: 'test:dash',
        actorId: 'actor-1',
        requestId: 'req-77',
        stage: 'validation',
      }),
    });

    expect(context.actionId).toBe('test:dash');
    expect(context.actorSnapshot).toMatchObject({
      id: 'actor-1',
      location: 'observatory',
    });

    const mobilityFix = context.suggestedFixes.find(
      (fix) => fix.details?.componentId === 'core:mobility'
    );
    expect(mobilityFix).toBeDefined();
    expect(mobilityFix.type).toBe(FIX_TYPES.MISSING_COMPONENT);
    expect(mobilityFix.confidence).toBe(0.9);

    const prerequisiteFixes = context.suggestedFixes.filter(
      (fix) =>
        fix.type === FIX_TYPES.MISSING_COMPONENT &&
        fix.details?.source === 'prerequisite_analysis'
    );
    expect(prerequisiteFixes.length).toBeGreaterThan(0);
    expect(prerequisiteFixes.map((fix) => fix.details.componentId)).toEqual(
      expect.arrayContaining([
        'core:inventory',
        'core:hands',
        'core:telekinesis',
      ])
    );
  });

  it('captures evaluation trace data when execution errors occur', () => {
    const trace = new TraceContext();
    trace.step('Checking mobility prerequisites', 'PrerequisiteValidator', {
      input: { actorId: 'actor-1' },
      output: { valid: false },
    });
    trace.error(
      'Scope resolution failed for adjacent tiles',
      'ScopeResolutionService',
      {
        input: { scope: 'adjacent' },
        output: { matches: [] },
      }
    );
    trace.info('Evaluating condition_ref_core:mana', 'JsonLogicEngine', {
      input: { condition_ref: 'core:mana' },
      output: { value: 0 },
    });
    trace.info('Json logic evaluation completed', 'JsonLogicEngine', {
      input: { some: 'input' },
      output: { result: true },
    });
    trace.addLog(TRACE_DATA, 'Final context snapshot', 'TraceCollector', {
      resolvedTargets: [],
    });

    const error = new Error('No valid targets resolved');

    const context = handler.handleExecutionError(error, {
      actorId: 'actor-1',
      actionDef: actionDefinition,
      targetId: 'target-9',
      trace,
      additionalContext: { pipelineId: 'pipeline-42' },
    });

    expect(context.environmentContext).toMatchObject({
      phase: ERROR_PHASES.EXECUTION,
      pipelineId: 'pipeline-42',
      stage: 'execution',
    });
    expect(context.targetId).toBe('target-9');

    const { steps, failurePoint, finalContext } = context.evaluationTrace;
    expect(steps.length).toBeGreaterThanOrEqual(3);
    expect(failurePoint).toBe('Scope resolution failed for adjacent tiles');
    expect(finalContext).toMatchObject({ resolvedTargets: [] });

    const stepTypes = new Set(steps.map((step) => step.type));
    expect(stepTypes.has('prerequisite')).toBe(true);
    expect(stepTypes.has('scope')).toBe(true);
    expect(stepTypes.has('condition_ref')).toBe(true);
    expect(stepTypes.has('json_logic')).toBe(true);
  });

  it('creates discovery contexts with the correct stage metadata', () => {
    const context = handler.handleDiscoveryError(
      new Error('Discovery failure'),
      {
        actorId: 'actor-1',
        actionDef: actionDefinition,
        additionalContext: { scenario: 'search' },
      }
    );

    expect(context.environmentContext).toMatchObject({
      stage: 'discovery',
      scenario: 'search',
    });
    expect(logger.errorLogs.at(-1).extra.stage).toBe('discovery');
  });

  it('tracks the processing stage when command workflows fail', () => {
    const context = handler.handleProcessingError(
      new Error('Directive failure'),
      {
        actorId: 'actor-1',
        stage: 'directive',
        additionalContext: { step: 'apply_directive' },
      }
    );

    expect(context.environmentContext.stage).toBe(
      'command_processing_directive'
    );
    expect(context.environmentContext.step).toBe('apply_directive');
  });

  it('logs lightweight errors and builds simple error responses', () => {
    const transientError = new Error('Transient network error');

    handler.logError('Failed to notify observers', transientError, {
      channel: 'websocket',
    });

    const response = handler.createSimpleErrorResponse(
      transientError,
      'Something went wrong'
    );

    expect(logger.errorLogs.at(-1)).toMatchObject({
      message: 'Failed to notify observers',
      extra: expect.objectContaining({ channel: 'websocket' }),
    });
    expect(response).toEqual({
      success: false,
      error: 'Something went wrong',
      details: 'Transient network error',
    });
  });

  it('enforces dependency contracts for builder and logger', () => {
    expect(
      () =>
        new UnifiedErrorHandler({
          actionErrorContextBuilder: errorContextBuilder,
        })
    ).toThrow('UnifiedErrorHandler requires logger');

    expect(
      () => new UnifiedErrorHandler({ actionErrorContextBuilder: null, logger })
    ).toThrow('UnifiedErrorHandler requires actionErrorContextBuilder');
  });

  it('handles missing optional context across phases', () => {
    const discoveryContext = handler.handleDiscoveryError(
      new Error('Discovered nothing'),
      {
        actorId: 'actor-1',
      }
    );

    expect(discoveryContext.actionDefinition).toMatchObject({
      id: 'unknown',
      name: 'Unknown Action',
    });
    expect(discoveryContext.actionId).toBe('unknown');
    expect(discoveryContext.targetId).toBeNull();
    expect(discoveryContext.environmentContext).toEqual(
      expect.objectContaining({
        stage: 'discovery',
        phase: ERROR_PHASES.DISCOVERY,
      })
    );

    const executionContext = handler.handleExecutionError(
      new Error('Execution pipeline failed'),
      {
        actorId: 'actor-1',
        actionDef: actionDefinition,
      }
    );

    expect(executionContext.targetId).toBeNull();
    expect(executionContext.environmentContext).toEqual(
      expect.objectContaining({
        stage: 'execution',
        phase: ERROR_PHASES.EXECUTION,
      })
    );

    const validationContext = handler.handleValidationError(
      new Error('Validation halted'),
      {
        actorId: 'actor-1',
        actionDef: actionDefinition,
      }
    );

    expect(validationContext.targetId).toBeNull();
    expect(validationContext.environmentContext).toEqual(
      expect.objectContaining({
        stage: 'validation',
        phase: ERROR_PHASES.VALIDATION,
      })
    );

    const processingContext = handler.handleProcessingError(
      new Error('Directive orchestration failure'),
      {
        actorId: 'actor-1',
        stage: 'dispatch',
      }
    );

    expect(processingContext.actionDefinition).toMatchObject({
      id: 'unknown',
      name: 'Unknown Action',
    });
    expect(processingContext.environmentContext).toEqual(
      expect.objectContaining({
        stage: 'command_processing_dispatch',
        phase: ERROR_PHASES.EXECUTION,
      })
    );
    expect(processingContext.environmentContext).not.toHaveProperty('step');
  });

  it('creates contexts and logs without optional parameters', () => {
    const directContext = handler.createContext({
      error: new Error('Direct context failure'),
      phase: ERROR_PHASES.EXECUTION,
      actorId: 'actor-1',
    });

    expect(directContext.actionDefinition).toMatchObject({
      id: 'unknown',
      name: 'Unknown Action',
    });
    expect(directContext.additionalContext).toEqual({});
    expect(directContext.environmentContext).toEqual(
      expect.objectContaining({
        phase: ERROR_PHASES.EXECUTION,
      })
    );
    expect(directContext.environmentContext).not.toHaveProperty('stage');

    const logCountAfterContext = logger.errorLogs.length;
    const bareError = new Error('Bare logging failure');

    handler.logError('Minimal log context', bareError);

    expect(logger.errorLogs).toHaveLength(logCountAfterContext + 1);
    const finalLog = logger.errorLogs.at(-1);
    expect(finalLog).toMatchObject({
      message: 'Minimal log context',
      extra: expect.objectContaining({
        error: 'Bare logging failure',
      }),
    });
    expect(finalLog.extra).not.toHaveProperty('channel');
  });
});
