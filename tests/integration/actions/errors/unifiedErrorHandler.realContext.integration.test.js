import { describe, it, expect, beforeEach } from '@jest/globals';
import { UnifiedErrorHandler } from '../../../../src/actions/errors/unifiedErrorHandler.js';
import { ActionErrorContextBuilder } from '../../../../src/actions/errors/actionErrorContextBuilder.js';
import { FixSuggestionEngine } from '../../../../src/actions/errors/fixSuggestionEngine.js';
import { TraceContext } from '../../../../src/actions/tracing/traceContext.js';
import {
  ERROR_PHASES,
  FIX_TYPES,
} from '../../../../src/actions/errors/actionErrorTypes.js';

class TestLogger {
  constructor() {
    this.logs = {
      info: [],
      warn: [],
      error: [],
      debug: [],
    };
  }

  info(...args) {
    this.logs.info.push(args);
  }

  warn(...args) {
    this.logs.warn.push(args);
  }

  error(...args) {
    this.logs.error.push(args);
  }

  debug(...args) {
    this.logs.debug.push(args);
  }
}

class TestEntityManager {
  constructor(entityMap) {
    this.entityMap = entityMap;
  }

  getEntityInstance(id) {
    const entry = this.entityMap[id];
    return entry ? entry.entity : null;
  }

  getAllComponentTypesForEntity(id) {
    const entry = this.entityMap[id];
    return entry ? Object.keys(entry.components) : [];
  }

  getComponentData(id, componentId) {
    const entry = this.entityMap[id];
    if (!entry) {
      return null;
    }
    return entry.components[componentId] ?? null;
  }
}

class TestGameDataRepository {
  getComponentDefinition(id) {
    return { id };
  }

  getConditionDefinition(id) {
    return { id };
  }
}

class TestActionIndex {
  constructor(actions) {
    this.actions = actions;
  }

  getCandidateActions() {
    return this.actions;
  }
}

describe('UnifiedErrorHandler real integration', () => {
  let logger;
  let handler;
  let actionDefinition;
  let actorId;

  beforeEach(() => {
    actorId = 'actor-1';
    logger = new TestLogger();

    const entityManager = new TestEntityManager({
      [actorId]: {
        entity: { id: actorId, type: 'humanoid' },
        components: {
          'core:name': { text: 'Rhea' },
          'core:location': { value: 'central-hub' },
          'inventory:items': { list: ['lamp', 'map'] },
        },
      },
    });

    const fixSuggestionEngine = new FixSuggestionEngine({
      logger,
      gameDataRepository: new TestGameDataRepository(),
      actionIndex: new TestActionIndex([{ id: 'core:move', name: 'Move' }]),
    });

    const errorContextBuilder = new ActionErrorContextBuilder({
      entityManager,
      logger,
      fixSuggestionEngine,
    });

    handler = new UnifiedErrorHandler({
      actionErrorContextBuilder: errorContextBuilder,
      logger,
    });

    actionDefinition = {
      id: 'core:move',
      name: 'Move',
      prerequisites: [{ hasComponent: 'core:location' }],
    };
  });

  it('builds structured error context with trace instrumentation and suggestions', () => {
    const trace = new TraceContext();
    trace.step('Checking prerequisites', 'PrerequisiteEvaluationService', {
      input: { component: 'core:location' },
    });
    trace.failure('Scope resolution failed', 'TargetResolutionService', {
      scope: 'movement:adjacent',
    });
    trace.data('Final context snapshot', 'ActionPipeline', {
      completed: false,
    });

    const error = new Error("Missing component 'core:location'");
    error.name = 'ComponentNotFoundError';

    const context = handler.createContext({
      error,
      phase: ERROR_PHASES.VALIDATION,
      actionDef: actionDefinition,
      actorId,
      targetId: 'target-9',
      trace,
      additionalContext: { scope: 'movement', stageHint: 'validation' },
    });

    expect(logger.logs.error).toHaveLength(1);
    expect(logger.logs.error[0][0]).toContain('Error in validation phase');
    expect(context.actionId).toBe(actionDefinition.id);
    expect(context.actorId).toBe(actorId);
    expect(context.targetId).toBe('target-9');
    expect(context.environmentContext.scope).toBe('movement');
    expect(context.environmentContext.errorName).toBe('ComponentNotFoundError');
    expect(context.evaluationTrace.steps.length).toBeGreaterThan(0);
    expect(context.evaluationTrace.failurePoint).toBe(
      'Scope resolution failed'
    );

    const missingComponentFix = context.suggestedFixes.find(
      (fix) => fix.type === FIX_TYPES.MISSING_COMPONENT
    );
    expect(missingComponentFix).toBeDefined();
    expect(missingComponentFix.details.componentId).toBe('core:location');
  });

  it('provides phase-specific helpers and fallback handling for missing definitions', () => {
    const discoveryContext = handler.handleDiscoveryError(
      new Error('discovery failed'),
      {
        actorId,
        actionDef: actionDefinition,
      }
    );
    expect(discoveryContext.phase).toBe(ERROR_PHASES.DISCOVERY);
    expect(discoveryContext.environmentContext.stage).toBe('discovery');

    const executionContext = handler.handleExecutionError(
      new Error('execution failed'),
      {
        actorId,
        actionDef: actionDefinition,
        targetId: 'target-10',
      }
    );
    expect(executionContext.phase).toBe(ERROR_PHASES.EXECUTION);
    expect(executionContext.environmentContext.stage).toBe('execution');
    expect(executionContext.targetId).toBe('target-10');

    const validationContext = handler.handleValidationError(
      new Error('validation failed'),
      {
        actorId,
        actionDef: actionDefinition,
        targetId: 'target-11',
      }
    );
    expect(validationContext.phase).toBe(ERROR_PHASES.VALIDATION);
    expect(validationContext.environmentContext.stage).toBe('validation');

    const processingContext = handler.handleProcessingError(
      new Error('processing failed'),
      {
        actorId,
        stage: 'dispatch',
        actionDef: actionDefinition,
      }
    );
    expect(processingContext.phase).toBe(ERROR_PHASES.EXECUTION);
    expect(processingContext.environmentContext.stage).toBe(
      'command_processing_dispatch'
    );

    const fallbackContext = handler.createContext({
      error: new Error('no action provided'),
      phase: ERROR_PHASES.DISCOVERY,
      actionDef: null,
      actorId,
    });
    expect(fallbackContext.actionDefinition.id).toBe('unknown');
  });

  it('logs errors without building context', () => {
    handler.logError('Processing failure', new Error('bad state'), {
      stage: 'dispatch',
      subsystem: 'command-processing',
    });

    expect(logger.logs.error).toHaveLength(1);
    expect(logger.logs.error[0][0]).toBe('Processing failure');
    expect(logger.logs.error[0][1].stage).toBe('dispatch');
    expect(logger.logs.error[0][1].error).toBe('bad state');
  });

  it('creates simple error response objects for UI display', () => {
    const response = handler.createSimpleErrorResponse(
      new Error('internal failure'),
      'Unable to complete the requested action.'
    );

    expect(response).toEqual({
      success: false,
      error: 'Unable to complete the requested action.',
      details: 'internal failure',
    });
  });
});
