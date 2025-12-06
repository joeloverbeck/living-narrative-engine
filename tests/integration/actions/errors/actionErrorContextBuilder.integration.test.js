/**
 * @file Integration tests for ActionErrorContextBuilder using real FixSuggestionEngine
 *       and a concrete entity manager implementation.
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { ActionErrorContextBuilder } from '../../../../src/actions/errors/actionErrorContextBuilder.js';
import { FixSuggestionEngine } from '../../../../src/actions/errors/fixSuggestionEngine.js';
import {
  EVALUATION_STEP_TYPES,
  FIX_TYPES,
} from '../../../../src/actions/errors/actionErrorTypes.js';
import {
  TraceContext,
  TRACE_STEP,
  TRACE_INFO,
  TRACE_ERROR,
  TRACE_FAILURE,
  TRACE_SUCCESS,
  TRACE_DATA,
} from '../../../../src/actions/tracing/traceContext.js';

/**
 * Minimal in-memory action index used for integration tests.
 */
class InMemoryActionIndex {
  #candidates;

  constructor(candidates = []) {
    this.#candidates = candidates;
  }

  /**
   * @returns {Array<object>} Candidate actions available to the actor.
   */
  getCandidateActions() {
    return this.#candidates;
  }
}

/**
 * Minimal in-memory repository for action and component definitions.
 */
class InMemoryGameDataRepository {
  #actions;

  constructor(actions = []) {
    this.#actions = new Map(actions.map((action) => [action.id, action]));
  }

  /**
   * @param {string} id
   * @returns {object|undefined}
   */
  getAction(id) {
    return this.#actions.get(id);
  }

  /**
   * @param {object} action
   * @returns {void}
   */
  registerAction(action) {
    this.#actions.set(action.id, action);
  }

  /**
   * @param {string} id
   * @returns {{id: string, name: string}}
   */
  getComponentDefinition(id) {
    return { id, name: `Component ${id}` };
  }

  /**
   * @param {string} id
   * @returns {{id: string, description: string}}
   */
  getConditionDefinition(id) {
    return { id, description: `Condition ${id}` };
  }
}

/**
 * Lightweight entity manager that exposes the real component data without mocks.
 */
class IntegrationEntityManager {
  #entities;

  /**
   * @param {Array<{id: string, type?: string, components: Record<string, any>}>} entities
   */
  constructor(entities = []) {
    this.#entities = new Map();
    for (const entity of entities) {
      this.#entities.set(entity.id, {
        id: entity.id,
        type: entity.type ?? 'integration:entity',
        components: entity.components,
      });
    }
  }

  /**
   * @param {string} id
   * @returns {{id: string, type: string, components: Record<string, any>}}
   */
  getEntityInstance(id) {
    const entity = this.#entities.get(id);
    if (!entity) {
      throw new Error(`Unknown entity ${id}`);
    }
    return {
      id: entity.id,
      type: entity.type,
      components: entity.components,
    };
  }

  /**
   * @param {string} entityId
   * @returns {string[]}
   */
  getAllComponentTypesForEntity(entityId) {
    const entity = this.#entities.get(entityId);
    if (!entity) {
      return [];
    }
    return Object.keys(entity.components);
  }

  /**
   * @param {string} entityId
   * @param {string} componentType
   * @returns {any}
   */
  getComponentData(entityId, componentType) {
    const entity = this.#entities.get(entityId);
    return entity?.components?.[componentType] ?? null;
  }
}

describe('ActionErrorContextBuilder integration', () => {
  let logger;
  let gameDataRepository;
  let actionIndex;
  let suggestionEngine;

  beforeEach(() => {
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    gameDataRepository = new InMemoryGameDataRepository();
    actionIndex = new InMemoryActionIndex();
    suggestionEngine = new FixSuggestionEngine({
      logger,
      gameDataRepository,
      actionIndex,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('builds comprehensive error context with sanitized snapshots and evaluation trace data', () => {
    const largeString = 'A'.repeat(12000);
    const longInventory = Array.from({ length: 105 }, (_, index) => ({
      slot: index,
      label: `item-${index}`,
    }));
    const circularComponent = { label: 'loop' };
    circularComponent.self = circularComponent;

    const entityManager = new IntegrationEntityManager([
      {
        id: 'actor-1',
        type: 'integration:actor',
        components: {
          'core:actor': {
            name: 'Integration Actor',
            biography: 'Extensive background data',
          },
          'core:location': { value: 'observation-deck' },
          'core:inventory': { items: longInventory },
          'core:notes': { text: 'N'.repeat(1200) },
          'core:huge': { transcript: largeString },
          'core:circular': circularComponent,
          'core:nested': {
            layers: [
              {
                stage: 'outer',
                children: [{ stage: 'inner', tags: ['alpha', 'beta'] }],
              },
            ],
            metadata: { critical: true, notes: null },
          },
          'core:state': { value: 'stunned' },
          'core:status': { bleeding: false, focused: true },
          'core:condition': { fatigue: 'heavy', morale: 'low' },
          'core:optional': { note: null },
        },
      },
    ]);

    const actionDef = {
      id: 'integration:complex-action',
      scope: 'companions',
      prerequisites: [
        { hasComponent: 'core:mobility' },
        {
          all: [
            { hasComponent: 'core:discipline' },
            {
              any: [
                { hasComponent: 'core:focus' },
                { hasComponent: 'core:perception' },
              ],
            },
            [
              { hasComponent: 'core:resilience' },
              { hasComponent: 'core:resolve' },
            ],
          ],
        },
      ],
    };
    gameDataRepository.registerAction(actionDef);

    const builder = new ActionErrorContextBuilder({
      entityManager,
      logger,
      fixSuggestionEngine: suggestionEngine,
    });

    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-01-01T10:00:00.000Z'));

    const trace = new TraceContext();
    const addLog = (type, message, source, data) => {
      trace.addLog(type, message, source, data);
      jest.advanceTimersByTime(5);
    };

    addLog(TRACE_STEP, 'Prerequisite check started', 'PrerequisiteEvaluator', {
      input: { stage: 'initial' },
      output: { success: true },
    });
    addLog(TRACE_STEP, 'JsonLogic evaluation succeeded', 'JsonLogicEvaluator', {
      input: { expression: 'valid' },
      output: { result: true },
    });
    addLog(TRACE_INFO, 'General validation info', 'ValidationEngine', {
      sample: 'info',
    });
    addLog(
      TRACE_ERROR,
      'condition_ref core:mobility failed',
      'ValidationEngine',
      {
        input: { condition_ref: 'core:mobility' },
        output: { success: false },
      }
    );
    addLog(
      TRACE_FAILURE,
      'Scope service failed to resolve target',
      'ScopeResolutionService',
      {
        input: { attempt: 1 },
      }
    );
    addLog(TRACE_DATA, 'Final context snapshot', 'TraceCollector', {
      outcome: 'aborted',
      attempts: 1,
    });
    addLog(TRACE_SUCCESS, 'Post evaluation summary', 'SummaryReporter');

    const error = new Error(
      'Scope resolution failed: missing component core:mobility, invalid state detected, and no target available'
    );
    error.name = 'ComponentNotFoundError';

    const additionalContext = { correlationId: 'corr-123', severity: 'high' };

    const errorContext = builder.buildErrorContext({
      error,
      actionDef,
      actorId: 'actor-1',
      targetId: 'target-42',
      phase: 'validation',
      trace,
      additionalContext,
    });

    expect(errorContext.actionId).toBe(actionDef.id);
    expect(errorContext.actorId).toBe('actor-1');
    expect(errorContext.targetId).toBe('target-42');

    const snapshot = errorContext.actorSnapshot;
    expect(snapshot.location).toBe('observation-deck');
    expect(typeof snapshot.metadata.capturedAt).toBe('number');
    expect(snapshot.metadata.entityType).toBe('integration:actor');

    const sanitizedNotes = snapshot.components['core:notes'].text;
    expect(sanitizedNotes.endsWith('...(truncated)')).toBe(true);
    expect(sanitizedNotes.length).toBe(1000 + '...(truncated)'.length);

    const sanitizedInventory = snapshot.components['core:inventory'].items;
    expect(sanitizedInventory).toHaveLength(101);
    expect(sanitizedInventory[100]).toEqual({
      _truncated: true,
      _originalLength: 105,
    });

    const hugeComponent = snapshot.components['core:huge'];
    expect(hugeComponent._truncated).toBe(true);
    expect(hugeComponent._reason).toBe('Component too large');
    expect(hugeComponent._size).toBeGreaterThan(10000);

    expect(snapshot.components['core:circular']).toEqual({
      _error: true,
      _reason: 'Failed to serialize component',
    });

    expect(
      snapshot.components['core:nested'].layers[0].children[0].tags
    ).toEqual(['alpha', 'beta']);
    expect(snapshot.components['core:optional'].note).toBeNull();

    const stepTypes = errorContext.evaluationTrace.steps.map(
      (step) => step.type
    );
    expect(stepTypes).toEqual([
      EVALUATION_STEP_TYPES.PREREQUISITE,
      EVALUATION_STEP_TYPES.JSON_LOGIC,
      EVALUATION_STEP_TYPES.VALIDATION,
      EVALUATION_STEP_TYPES.CONDITION_REF,
      EVALUATION_STEP_TYPES.SCOPE,
      EVALUATION_STEP_TYPES.VALIDATION,
      EVALUATION_STEP_TYPES.VALIDATION,
    ]);

    const durations = errorContext.evaluationTrace.steps.map(
      (step) => step.duration
    );
    for (let i = 1; i < durations.length; i += 1) {
      expect(durations[i]).toBeGreaterThanOrEqual(durations[i - 1]);
    }

    expect(errorContext.evaluationTrace.failurePoint).toBe(
      'condition_ref core:mobility failed'
    );
    expect(errorContext.evaluationTrace.finalContext).toEqual({
      outcome: 'aborted',
      attempts: 1,
    });

    const fixTypes = new Set(
      errorContext.suggestedFixes.map((fix) => fix.type)
    );
    expect(fixTypes).toEqual(
      new Set([
        FIX_TYPES.MISSING_COMPONENT,
        FIX_TYPES.INVALID_STATE,
        FIX_TYPES.SCOPE_RESOLUTION,
        FIX_TYPES.MISSING_PREREQUISITE,
        FIX_TYPES.INVALID_TARGET,
      ])
    );
    for (let i = 1; i < errorContext.suggestedFixes.length; i += 1) {
      expect(
        errorContext.suggestedFixes[i - 1].confidence
      ).toBeGreaterThanOrEqual(errorContext.suggestedFixes[i].confidence);
    }

    expect(errorContext.environmentContext).toMatchObject({
      correlationId: 'corr-123',
      severity: 'high',
      errorName: 'ComponentNotFoundError',
      phase: 'validation',
      timestamp: errorContext.timestamp,
    });
    expect(errorContext.additionalContext).toEqual(additionalContext);
  });

  it('falls back to minimal snapshot when entity capture fails', () => {
    class FaultyEntityManager {
      getEntityInstance() {
        throw new Error('Entity lookup failed');
      }

      getAllComponentTypesForEntity() {
        return [];
      }

      getComponentData() {
        return null;
      }
    }

    const builder = new ActionErrorContextBuilder({
      entityManager: new FaultyEntityManager(),
      logger,
      fixSuggestionEngine: suggestionEngine,
    });

    const actionDef = {
      id: 'integration:fallback',
      scope: 'none',
      prerequisites: [],
    };
    const error = new Error('Target not found for action');
    const trace = new TraceContext();
    trace.addLog(TRACE_INFO, 'Starting resolution phase', 'ValidationEngine', {
      detail: 'setup',
    });

    const context = builder.buildErrorContext({
      error,
      actionDef,
      actorId: 'unknown-actor',
      phase: 'resolution',
      trace,
    });

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Failed to create complete actor snapshot'),
      expect.any(Error)
    );
    expect(context.actorSnapshot.components).toEqual({});
    expect(context.actorSnapshot.location).toBe('unknown');
    expect(context.actorSnapshot.metadata.error).toBe(
      'Failed to capture snapshot'
    );

    expect(context.evaluationTrace.steps).toHaveLength(1);
    expect(context.evaluationTrace.steps[0].type).toBe(
      EVALUATION_STEP_TYPES.VALIDATION
    );
    expect(context.evaluationTrace.steps[0].success).toBe(true);

    const fallbackFixTypes = new Set(
      context.suggestedFixes.map((fix) => fix.type)
    );
    expect(fallbackFixTypes.has(FIX_TYPES.INVALID_TARGET)).toBe(true);
    expect(context.environmentContext.phase).toBe('resolution');
  });

  it('uses default fallbacks when optional context is missing', () => {
    const minimalEntityManager = new IntegrationEntityManager([
      {
        id: 'actor-2',
        type: '',
        components: {
          'core:actor': { name: 'Fallback Actor' },
          'core:flags': { ready: true },
        },
      },
    ]);

    const builder = new ActionErrorContextBuilder({
      entityManager: minimalEntityManager,
      logger,
      fixSuggestionEngine: suggestionEngine,
    });

    const error = new Error('Scope resolution error without context');
    error.name = 'ScopeResolutionError';

    const withoutTrace = builder.buildErrorContext({
      error,
      actionDef: { scope: 'any:scope' },
      actorId: 'actor-2',
      phase: 'validation',
    });

    expect(withoutTrace.actionId).toBeNull();
    expect(withoutTrace.targetId).toBeNull();
    expect(withoutTrace.additionalContext).toEqual({});
    expect(withoutTrace.actorSnapshot.location).toBe('none');
    expect(withoutTrace.actorSnapshot.metadata.entityType).toBe('unknown');
    expect(withoutTrace.evaluationTrace).toEqual({
      steps: [],
      finalContext: {},
      failurePoint: 'Unknown',
    });
    expect(
      withoutTrace.suggestedFixes.some(
        (fix) => fix.type === FIX_TYPES.SCOPE_RESOLUTION
      )
    ).toBe(true);

    const emptyTrace = new TraceContext();
    const withEmptyTrace = builder.buildErrorContext({
      error,
      actionDef: { scope: 'any:scope' },
      actorId: 'actor-2',
      phase: 'resolution',
      trace: emptyTrace,
    });

    expect(withEmptyTrace.phase).toBe('resolution');
    expect(withEmptyTrace.evaluationTrace.steps).toHaveLength(0);
    expect(withEmptyTrace.evaluationTrace.failurePoint).toBe('Unknown');
    expect(withEmptyTrace.environmentContext).toMatchObject({
      errorName: 'ScopeResolutionError',
      phase: 'resolution',
    });
  });
});
