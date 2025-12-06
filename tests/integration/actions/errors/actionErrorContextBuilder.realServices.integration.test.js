/**
 * @file Integration tests for ActionErrorContextBuilder using real service implementations.
 * @description Ensures error contexts capture live entity snapshots, evaluation traces,
 * and actionable fix suggestions without relying on mocked modules.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ActionErrorContextBuilder } from '../../../../src/actions/errors/actionErrorContextBuilder.js';
import { FixSuggestionEngine } from '../../../../src/actions/errors/fixSuggestionEngine.js';
import { ActionIndex } from '../../../../src/actions/actionIndex.js';
import { TraceContext } from '../../../../src/actions/tracing/traceContext.js';
import {
  EVALUATION_STEP_TYPES,
  FIX_TYPES,
  ERROR_PHASES,
} from '../../../../src/actions/errors/actionErrorTypes.js';
import { EntityManagerTestBed } from '../../../common/entities/entityManagerTestBed.js';
import { TestDataFactory } from '../../../common/actions/testDataFactory.js';

/**
 * Simple in-memory game data repository used by FixSuggestionEngine.
 */
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

describe('ActionErrorContextBuilder real services integration', () => {
  /** @type {EntityManagerTestBed} */
  let testBed;
  /** @type {ActionErrorContextBuilder} */
  let builder;
  /** @type {ReturnType<typeof TestDataFactory.createBasicActions>} */
  let actions;
  /** @type {string} */
  let actorId;

  beforeEach(async () => {
    testBed = new EntityManagerTestBed();

    actions = TestDataFactory.createBasicActions();

    const actionIndex = new ActionIndex({
      logger: testBed.mocks.logger,
      entityManager: testBed.entityManager,
    });
    actionIndex.buildIndex(actions);

    const fixSuggestionEngine = new FixSuggestionEngine({
      logger: testBed.mocks.logger,
      gameDataRepository: new InMemoryGameDataRepository(),
      actionIndex,
    });

    builder = new ActionErrorContextBuilder({
      entityManager: testBed.entityManager,
      logger: testBed.mocks.logger,
      fixSuggestionEngine,
    });

    const actor = await testBed.createEntityWithOverrides('actor', {
      instanceId: 'actor-real-services',
      overrides: {
        'core:location': { value: 'central-plaza' },
        'core:status': { state: 'injured', stamina: 2 },
        'core:journal': 'x'.repeat(11000),
        'core:note': 'b'.repeat(1005),
        'core:inventory': {
          items: Array.from({ length: 105 }, (_, index) => ({
            id: `item-${index}`,
            label: `Item ${index}`,
          })),
        },
        'core:array': Array.from(
          { length: 105 },
          (_, index) => `entry-${index}`
        ),
      },
    });

    actorId = actor.id;
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    if (testBed) {
      await testBed.cleanup();
    }
  });

  it('captures live entity state, evaluation trace, and actionable fixes', () => {
    const trace = new TraceContext();
    trace.step('Begin validation', 'ValidationEngine', {
      input: { actorId },
      output: { valid: true },
    });
    trace.info('Checking movement prerequisites', 'PrerequisiteService', {
      input: { component: 'core:position' },
      output: { hasComponent: false },
    });
    trace.failure('Missing component core:position', 'PrerequisiteService', {
      component: 'core:position',
    });

    const error = new Error(
      "Missing component 'core:position' detected during validation"
    );
    error.name = 'ComponentNotFoundError';
    const actionDef = actions.find((action) => action.id === 'movement:go');

    const context = builder.buildErrorContext({
      error,
      actionDef,
      actorId,
      phase: ERROR_PHASES.VALIDATION,
      trace,
      additionalContext: { requestId: 'ctx-42' },
    });

    expect(context.actionId).toBe(actionDef.id);
    expect(context.actorId).toBe(actorId);
    expect(context.phase).toBe(ERROR_PHASES.VALIDATION);
    expect(context.additionalContext).toEqual({ requestId: 'ctx-42' });

    expect(context.actorSnapshot.id).toBe(actorId);
    expect(context.actorSnapshot.metadata.capturedAt).toEqual(
      expect.any(Number)
    );
    expect(context.actorSnapshot.metadata.entityType).toBe('unknown');
    expect(context.actorSnapshot.location).toBe('central-plaza');

    const sanitizedComponents = context.actorSnapshot.components;
    expect(sanitizedComponents['core:status']).toEqual(
      expect.objectContaining({ state: 'injured', stamina: 2 })
    );
    expect(sanitizedComponents['core:journal']).toEqual(
      expect.objectContaining({
        _truncated: true,
        _reason: 'Component too large',
      })
    );
    expect(sanitizedComponents['core:note']).toMatch(/\.{3}\(truncated\)$/);
    expect(sanitizedComponents['core:inventory'].items).toHaveLength(101);
    expect(
      sanitizedComponents['core:inventory'].items[
        sanitizedComponents['core:inventory'].items.length - 1
      ]
    ).toEqual({ _truncated: true, _originalLength: 105 });
    expect(sanitizedComponents['core:array']).toHaveLength(101);

    expect(context.evaluationTrace.steps).toHaveLength(3);
    expect(context.evaluationTrace.steps[0]).toEqual(
      expect.objectContaining({
        type: EVALUATION_STEP_TYPES.VALIDATION,
        success: true,
      })
    );
    expect(context.evaluationTrace.steps[1]).toEqual(
      expect.objectContaining({
        type: EVALUATION_STEP_TYPES.PREREQUISITE,
        success: true,
      })
    );
    expect(context.evaluationTrace.steps[2]).toEqual(
      expect.objectContaining({
        type: EVALUATION_STEP_TYPES.PREREQUISITE,
        success: false,
      })
    );
    expect(context.evaluationTrace.failurePoint).toBe(
      'Missing component core:position'
    );

    expect(context.suggestedFixes.length).toBeGreaterThan(0);
    expect(context.suggestedFixes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: FIX_TYPES.MISSING_COMPONENT,
          details: expect.objectContaining({ componentId: 'core:position' }),
        }),
      ])
    );

    expect(context.environmentContext).toEqual(
      expect.objectContaining({
        errorName: 'ComponentNotFoundError',
        phase: ERROR_PHASES.VALIDATION,
        timestamp: expect.any(Number),
        requestId: 'ctx-42',
      })
    );
  });

  it('provides a defensive snapshot when entity data cannot be retrieved', () => {
    const failingId = 'offline-actor';

    jest
      .spyOn(testBed.entityManager, 'getEntityInstance')
      .mockImplementation(() => {
        throw new Error('Entity repository offline');
      });
    jest
      .spyOn(testBed.entityManager, 'getAllComponentTypesForEntity')
      .mockImplementation(() => {
        throw new Error('Component list unavailable');
      });
    jest
      .spyOn(testBed.entityManager, 'getComponentData')
      .mockImplementation(() => {
        throw new Error('Component data unavailable');
      });

    const error = new Error('Scope resolution failed');
    const actionDef = actions[0];

    const context = builder.buildErrorContext({
      error,
      actionDef,
      actorId: failingId,
      phase: ERROR_PHASES.DISCOVERY,
    });

    expect(testBed.mocks.logger.warn).toHaveBeenCalled();
    expect(context.actorSnapshot).toEqual(
      expect.objectContaining({
        id: failingId,
        location: 'unknown',
        components: {},
        metadata: expect.objectContaining({
          error: 'Failed to capture snapshot',
          capturedAt: expect.any(Number),
        }),
      })
    );
  });

  it('sanitizes complex component payloads and classifies evaluation phases', () => {
    const actorEntity = testBed.entityManager.getEntityInstance(actorId);
    const circularComponent = { status: 'loop' };
    circularComponent.self = circularComponent;
    actorEntity.addComponent('core:circular', circularComponent);
    actorEntity.addComponent('core:metadata', {
      optional: null,
      notes: 'short memo',
    });

    const trace = new TraceContext();
    trace.step('Pipeline bootstrapped', 'PipelineBootstrapper');
    trace.info('Resolving scope for actor', 'ScopeResolver', {
      input: { region: 'northern-district' },
    });
    trace.failure('No entities matched target', 'ScopeResolver', {
      input: { condition_ref: 'scope:adjacent', attempted: 3 },
    });
    trace.data('Collecting final evaluation context', 'TraceDataCollector', {
      summary: 'captured',
      contextSnapshot: { stamina: 2 },
    });
    trace.info('Validating condition_ref requirement', 'ConditionEngine', {
      input: { condition_ref: 'affinity:trusted' },
    });
    trace.info('Evaluating action safeguards', 'JsonLogicEvaluator', {
      input: { rule: 'json-logic' },
    });

    const error = new Error('Scope resolution error: no valid targets');
    const actionDef = actions.find((action) => action.id === 'movement:go');

    const context = builder.buildErrorContext({
      error,
      actionDef,
      actorId,
      phase: ERROR_PHASES.DISCOVERY,
      trace,
    });

    expect(context.actorSnapshot.components['core:circular']).toEqual(
      expect.objectContaining({
        _error: true,
        _reason: 'Failed to serialize component',
      })
    );
    expect(
      context.actorSnapshot.components['core:metadata'].optional
    ).toBeNull();

    expect(context.evaluationTrace.finalContext).toEqual(
      expect.objectContaining({
        summary: 'captured',
        contextSnapshot: { stamina: 2 },
      })
    );

    const stepTypes = context.evaluationTrace.steps.map((step) => step.type);
    expect(stepTypes).toEqual(
      expect.arrayContaining([
        EVALUATION_STEP_TYPES.SCOPE,
        EVALUATION_STEP_TYPES.CONDITION_REF,
        EVALUATION_STEP_TYPES.JSON_LOGIC,
      ])
    );
    expect(context.evaluationTrace.failurePoint).toBe(
      'No entities matched target'
    );
  });
});
