/**
 * @file Integration tests for ActionErrorContextBuilder
 * @description Validates that error context generation produces rich snapshots and traces.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ActionErrorContextBuilder } from '../../../../src/actions/errors/actionErrorContextBuilder.js';
import {
  EVALUATION_STEP_TYPES,
  FIX_TYPES,
} from '../../../../src/actions/errors/actionErrorTypes.js';

/**
 * Utility to build a trace log entry for the evaluation trace scenarios.
 *
 * @param {object} options
 * @param {number} options.timestamp
 * @param {string} options.type
 * @param {string} options.source
 * @param {string} options.message
 * @param {object} [options.data]
 * @returns {import('../../../../src/actions/tracing/traceContext.js').TraceLogEntry}
 */
function createTraceLog({ timestamp, type, source, message, data = {} }) {
  return {
    timestamp,
    type,
    source,
    message,
    data,
  };
}

describe('ActionErrorContextBuilder integration', () => {
  /** @type {ReturnType<typeof jest.spyOn>} */
  let dateSpy;
  let logger;
  let entityManager;
  let fixSuggestionEngine;
  let builder;
  let suggestedFixes;
  let primaryActorComponents;
  let componentsByActor;

  beforeEach(() => {
    dateSpy = jest.spyOn(Date, 'now').mockReturnValue(1700000000000);

    suggestedFixes = [
      {
        type: FIX_TYPES.SCOPE_RESOLUTION,
        description: 'Ensure there are valid targets present',
        details: { scope: 'target', hint: 'Spawn an additional NPC' },
        confidence: 0.8,
      },
    ];

    const circularComponent = {};
    circularComponent.self = circularComponent;

    primaryActorComponents = {
      'core:location': { value: 'central-plaza' },
      'core:name': 'Test Hero',
      'core:description': 'x'.repeat(1005),
      'core:inventory': Array.from({ length: 105 }, (_, index) => ({
        id: `item-${index}`,
        label: `Item ${index}`,
      })),
      'core:stats': {
        strength: 12,
        biography: 'b'.repeat(1005),
        nested: { detail: 'ready' },
      },
      'core:nuller': null,
      'core:bigData': 'y'.repeat(11000),
      'core:circular': circularComponent,
      'core:mixedArray': ['short', 'z'.repeat(1005)],
    };

    const actorWithoutLocationComponents = {
      'core:name': 'Nomad',
      'core:notes': { message: 'Wandering actor' },
      'core:inventory': [],
    };

    componentsByActor = {
      'actor-1': primaryActorComponents,
      'actor-no-location': actorWithoutLocationComponents,
    };

    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    entityManager = {
      getEntityInstance: jest.fn((actorId) => {
        if (actorId === 'missing-actor') {
          throw new Error('Actor not found');
        }
        const entityType = actorId === 'actor-no-location' ? undefined : 'actor';
        return { id: actorId, type: entityType };
      }),
      getAllComponentTypesForEntity: jest.fn((actorId) => {
        if (actorId === 'missing-actor') {
          throw new Error('Cannot list components');
        }
        const components = componentsByActor[actorId] || primaryActorComponents;
        return Object.keys(components);
      }),
      getComponentData: jest.fn((actorId, componentType) => {
        if (actorId === 'missing-actor') {
          throw new Error('No data');
        }
        const components = componentsByActor[actorId] || primaryActorComponents;
        return components[componentType];
      }),
    };

    fixSuggestionEngine = {
      suggestFixes: jest.fn().mockReturnValue(suggestedFixes),
    };

    builder = new ActionErrorContextBuilder({
      entityManager,
      logger,
      fixSuggestionEngine,
    });
  });

  afterEach(() => {
    if (dateSpy) {
      dateSpy.mockRestore();
    }
    jest.restoreAllMocks();
  });

  it('builds detailed error context with sanitized actor snapshot and evaluation trace', () => {
    const error = new Error('Scope resolution failed for action');
    error.name = 'ScopeResolutionError';

    const actionDef = {
      id: 'test:cast-spell',
      name: 'Cast Spell',
      scope: 'target',
    };

    const trace = {
      logs: [
        createTraceLog({
          timestamp: 1000,
          type: 'step',
          source: 'ValidationEngine',
          message: 'Start validation',
          data: {
            input: { actorId: 'actor-1' },
            output: { valid: true },
          },
        }),
        createTraceLog({
          timestamp: 1010,
          type: 'success',
          source: 'PrerequisiteChecker',
          message: 'Prerequisite evaluation complete',
          data: {
            input: { requirements: ['core:magic'] },
            output: { result: true },
          },
        }),
        createTraceLog({
          timestamp: 1020,
          type: 'error',
          source: 'ScopeResolver',
          message: 'Scope resolution failed',
          data: {
            input: { scope: 'target' },
            output: { matches: [] },
          },
        }),
        createTraceLog({
          timestamp: 1030,
          type: 'info',
          source: 'ConditionEvaluator',
          message: 'Processing condition_ref for mana',
          data: {
            input: { condition: 'mana' },
            output: { result: false },
          },
        }),
        createTraceLog({
          timestamp: 1040,
          type: 'success',
          source: 'JsonLogicEngine',
          message: 'Evaluated expression tree',
          data: {
            input: { expression: '>' },
            output: { result: true },
          },
        }),
        createTraceLog({
          timestamp: 1050,
          type: 'data',
          source: 'ContextCollector',
          message: 'Capturing trace context',
          data: { additional: 'info' },
        }),
        createTraceLog({
          timestamp: 1060,
          type: 'error',
          source: 'ResolutionMonitor',
          message: 'Resolution fallback triggered',
        }),
      ],
    };

    const additionalContext = { scenario: 'integration-test' };

    const result = builder.buildErrorContext({
      error,
      actionDef,
      actorId: 'actor-1',
      phase: 'resolution',
      trace,
      targetId: 'target-42',
      additionalContext,
    });

    expect(result.actionId).toBe('test:cast-spell');
    expect(result.actorId).toBe('actor-1');
    expect(result.targetId).toBe('target-42');
    expect(result.phase).toBe('resolution');
    expect(result.timestamp).toBe(1700000000000);
    expect(result.actionDefinition).toBe(actionDef);
    expect(result.error).toBe(error);

    expect(fixSuggestionEngine.suggestFixes).toHaveBeenCalledWith(
      error,
      actionDef,
      expect.objectContaining({ id: 'actor-1' }),
      'resolution'
    );
    expect(result.suggestedFixes).toBe(suggestedFixes);

    expect(entityManager.getEntityInstance).toHaveBeenCalledWith('actor-1');
    expect(entityManager.getAllComponentTypesForEntity).toHaveBeenCalledWith(
      'actor-1'
    );

    const snapshot = result.actorSnapshot;
    expect(snapshot.id).toBe('actor-1');
    expect(snapshot.location).toBe('central-plaza');
    expect(snapshot.metadata.entityType).toBe('actor');
    expect(snapshot.metadata.capturedAt).toBe(1700000000000);

    const components = snapshot.components;
    expect(components['core:name']).toBe('Test Hero');
    expect(components['core:description']).toMatch(/\.{3}\(truncated\)$/);
    expect(components['core:description'].length).toBe(1000 + '...(truncated)'.length);

    expect(Array.isArray(components['core:inventory'])).toBe(true);
    expect(components['core:inventory']).toHaveLength(101);
    expect(components['core:inventory'][0]).toEqual({
      id: 'item-0',
      label: 'Item 0',
    });
    expect(components['core:inventory'][100]).toEqual({
      _truncated: true,
      _originalLength: 105,
    });

    expect(components['core:stats'].strength).toBe(12);
    expect(components['core:stats'].biography).toMatch(/\.{3}\(truncated\)$/);
    expect(components['core:stats'].nested).toEqual({ detail: 'ready' });

    expect(components['core:nuller']).toBeNull();
    expect(components['core:bigData']).toEqual({
      _truncated: true,
      _reason: 'Component too large',
      _size: expect.any(Number),
    });
    expect(components['core:circular']).toEqual({
      _error: true,
      _reason: 'Failed to serialize component',
    });
    expect(components['core:mixedArray'][0]).toBe('short');
    expect(components['core:mixedArray'][1]).toMatch(/\.{3}\(truncated\)$/);

    const traceSteps = result.evaluationTrace.steps;
    expect(traceSteps).toHaveLength(7);
    expect(traceSteps[0]).toMatchObject({
      type: EVALUATION_STEP_TYPES.VALIDATION,
      success: true,
      duration: 0,
      message: 'Start validation',
      input: { actorId: 'actor-1' },
      output: { valid: true },
    });
    expect(traceSteps[1]).toMatchObject({
      type: EVALUATION_STEP_TYPES.PREREQUISITE,
      success: true,
      duration: 10,
      message: 'Prerequisite evaluation complete',
      input: { requirements: ['core:magic'] },
      output: { result: true },
    });
    expect(traceSteps[2]).toMatchObject({
      type: EVALUATION_STEP_TYPES.SCOPE,
      success: false,
      duration: 20,
      message: 'Scope resolution failed',
      input: { scope: 'target' },
      output: { matches: [] },
    });
    expect(traceSteps[3]).toMatchObject({
      type: EVALUATION_STEP_TYPES.CONDITION_REF,
      success: true,
      duration: 30,
      message: 'Processing condition_ref for mana',
    });
    expect(traceSteps[4]).toMatchObject({
      type: EVALUATION_STEP_TYPES.JSON_LOGIC,
      success: true,
      duration: 40,
      message: 'Evaluated expression tree',
    });
    expect(traceSteps[5]).toMatchObject({
      type: EVALUATION_STEP_TYPES.VALIDATION,
      success: false,
      duration: 50,
      message: 'Capturing trace context',
      output: { additional: 'info' },
    });
    expect(traceSteps[6]).toMatchObject({
      type: EVALUATION_STEP_TYPES.SCOPE,
      success: false,
      duration: 60,
      message: 'Resolution fallback triggered',
      input: {},
      output: {},
    });

    expect(result.evaluationTrace.failurePoint).toBe('Scope resolution failed');
    expect(result.evaluationTrace.finalContext).toEqual({ additional: 'info' });

    expect(result.environmentContext).toMatchObject({
      errorName: 'ScopeResolutionError',
      phase: 'resolution',
      timestamp: 1700000000000,
      scenario: 'integration-test',
    });
  });

  it('provides fallback snapshot when actor data cannot be resolved', () => {
    const error = new Error('Actor snapshot unavailable');
    error.name = 'MissingActorError';

    const trace = { logs: [] };

    const result = builder.buildErrorContext({
      error,
      actionDef: null,
      actorId: 'missing-actor',
      phase: 'execution',
      trace,
    });

    expect(entityManager.getEntityInstance).toHaveBeenCalledWith('missing-actor');
    expect(logger.warn).toHaveBeenCalled();
    expect(logger.warn.mock.calls[0][0]).toContain('missing-actor');

    expect(result.actorSnapshot).toEqual({
      id: 'missing-actor',
      components: {},
      location: 'unknown',
      metadata: {
        error: 'Failed to capture snapshot',
        capturedAt: 1700000000000,
      },
    });

    expect(result.suggestedFixes).toBe(suggestedFixes);
    expect(fixSuggestionEngine.suggestFixes).toHaveBeenCalledWith(
      error,
      null,
      result.actorSnapshot,
      'execution'
    );

    expect(result.evaluationTrace).toEqual({
      steps: [],
      finalContext: {},
      failurePoint: 'Unknown',
    });
    expect(result.environmentContext.errorName).toBe('MissingActorError');
    expect(result.environmentContext.phase).toBe('execution');
    expect(result.actionDefinition).toBeNull();
    expect(result.actionId).toBeNull();
    expect(result.targetId).toBeNull();
  });

  it('captures default location and type when actor metadata is incomplete', () => {
    const error = new Error('Validation failure');
    error.name = 'ValidationError';

    const actionDef = { id: 'test:basic', name: 'Basic Action' };

    const context = builder.buildErrorContext({
      error,
      actionDef,
      actorId: 'actor-no-location',
      phase: 'validation',
    });

    expect(context.actorSnapshot.location).toBe('none');
    expect(context.actorSnapshot.metadata.entityType).toBe('unknown');
    expect(context.evaluationTrace).toEqual({
      steps: [],
      finalContext: {},
      failurePoint: 'Unknown',
    });
    expect(context.actionId).toBe('test:basic');
    expect(context.targetId).toBeNull();
  });
});
