import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { ActionErrorContextBuilder } from '../../../../src/actions/errors/actionErrorContextBuilder.js';
import {
  EVALUATION_STEP_TYPES,
  ERROR_PHASES,
} from '../../../../src/actions/errors/actionErrorTypes.js';

describe('ActionErrorContextBuilder additional coverage', () => {
  let logger;
  let entityManager;
  let fixSuggestionEngine;
  let builder;

  beforeEach(() => {
    logger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
    };

    entityManager = {
      getEntityInstance: jest.fn(),
      getAllComponentTypesForEntity: jest.fn(),
      getComponentData: jest.fn(),
    };

    fixSuggestionEngine = {
      suggestFixes: jest.fn().mockReturnValue([]),
    };

    builder = new ActionErrorContextBuilder({
      entityManager,
      logger,
      fixSuggestionEngine,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates a snapshot with default location and handles undefined component data gracefully', () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1234567890);

    entityManager.getEntityInstance.mockReturnValue({
      id: 'actor-42',
      type: 'villager',
    });
    entityManager.getAllComponentTypesForEntity.mockReturnValue([
      'core:location',
      'core:undefined',
      'core:items',
    ]);
    entityManager.getComponentData.mockImplementation(
      (actorId, componentType) => {
        switch (componentType) {
          case 'core:location':
            return { value: null };
          case 'core:undefined':
            return undefined;
          case 'core:items':
            return ['alpha', 'beta', 'gamma'];
          default:
            return {};
        }
      }
    );

    const error = new Error('Component snapshot test');
    const actionDef = { id: 'action:test' };

    const context = builder.buildErrorContext({
      error,
      actionDef,
      actorId: 'actor-42',
      phase: ERROR_PHASES.VALIDATION,
    });

    expect(context.actorSnapshot.location).toBe('none');
    expect(context.actorSnapshot.metadata).toMatchObject({
      entityType: 'villager',
      capturedAt: 1234567890,
    });
    expect(context.actorSnapshot.components['core:undefined']).toEqual({
      _error: true,
      _reason: 'Failed to serialize component',
    });
    expect(context.actorSnapshot.components['core:items']).toEqual([
      'alpha',
      'beta',
      'gamma',
    ]);

    expect(fixSuggestionEngine.suggestFixes).toHaveBeenCalledWith(
      error,
      actionDef,
      expect.objectContaining({ id: 'actor-42', location: 'none' }),
      ERROR_PHASES.VALIDATION
    );

    nowSpy.mockRestore();
  });

  it('falls back to current time when the first trace log has no timestamp and keeps failure context intact', () => {
    const nowSpy = jest.spyOn(Date, 'now');
    nowSpy.mockImplementationOnce(() => 2000); // context timestamp
    nowSpy.mockImplementationOnce(() => 3000); // snapshot capturedAt
    nowSpy.mockImplementationOnce(() => 4000); // evaluation trace start time fallback
    nowSpy.mockImplementation(() => 4000); // any additional calls reuse the fallback time

    entityManager.getEntityInstance.mockReturnValue({
      id: 'actor-99',
      type: 'scout',
    });
    entityManager.getAllComponentTypesForEntity.mockReturnValue([
      'core:location',
    ]);
    entityManager.getComponentData.mockImplementation(() => ({
      value: 'harbor',
    }));

    const trace = {
      logs: [
        {
          type: 'info',
          message: 'Begin resolution workflow',
          source: 'ResolutionCoordinator',
          data: { input: { scope: 'test-scope' } },
        },
        {
          type: 'error',
          message: 'Resolution failed due to missing scope',
          source: 'ResolutionCoordinator',
          data: { output: { scope: null } },
          timestamp: 4100,
        },
        {
          type: 'data',
          message: 'Final resolution snapshot',
          source: 'ResolutionReporter',
          data: { resolved: false, attempts: 1 },
          timestamp: 4200,
        },
      ],
    };

    const context = builder.buildErrorContext({
      error: new Error('Resolution failure'),
      actionDef: { id: 'resolution:test' },
      actorId: 'actor-99',
      phase: ERROR_PHASES.DISCOVERY,
      trace,
    });

    const steps = context.evaluationTrace.steps;
    expect(steps).toHaveLength(3);
    expect(Number.isNaN(steps[0].duration)).toBe(true);
    expect(steps[1]).toMatchObject({
      type: EVALUATION_STEP_TYPES.SCOPE,
      success: false,
      message: 'Resolution failed due to missing scope',
    });
    expect(context.evaluationTrace.failurePoint).toBe(
      'Resolution failed due to missing scope'
    );
    expect(context.evaluationTrace.finalContext).toEqual({
      resolved: false,
      attempts: 1,
    });
    expect(nowSpy).toHaveBeenCalledTimes(3);

    nowSpy.mockRestore();
  });
});
