import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PrerequisiteEvaluationService } from '../../../../src/actions/validation/prerequisiteEvaluationService.js';
import { resolveReferences } from '../../../../src/actions/validation/conditionReferenceResolver.js';

jest.mock(
  '../../../../src/actions/validation/conditionReferenceResolver.js',
  () => ({
    resolveReferences: jest.fn(),
  })
);

describe('PrerequisiteEvaluationService context override coverage', () => {
  let logger;
  let jsonLogicEvaluationService;
  let actionValidationContextBuilder;
  let gameDataRepository;
  let service;

  const createService = () =>
    new PrerequisiteEvaluationService({
      logger,
      jsonLogicEvaluationService,
      actionValidationContextBuilder,
      gameDataRepository,
    });

  beforeEach(() => {
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    jsonLogicEvaluationService = {
      evaluate: jest.fn(),
    };
    actionValidationContextBuilder = {
      buildContext: jest.fn(),
    };
    gameDataRepository = {
      getConditionDefinition: jest.fn(),
    };

    resolveReferences.mockImplementation((logic) => logic);
    service = createService();
  });

  it('merges context overrides without clobbering base context entries', () => {
    const baseComponents = {
      toJSON: jest.fn(() => ({ equipment: ['rope', 'torch'] })),
    };

    actionValidationContextBuilder.buildContext.mockReturnValue({
      actor: { id: 'actor-1', components: baseComponents },
      stats: { health: 12 },
      metadata: { origin: 'base' },
      location: { zone: 'ancient-ruins' },
    });

    resolveReferences.mockImplementation((logic) => ({
      ...logic,
      resolved: true,
    }));

    jsonLogicEvaluationService.evaluate.mockReturnValue(true);

    const trace = {
      withSpan: jest.fn((name, fn) => fn()),
      step: jest.fn(),
      data: jest.fn(),
      success: jest.fn(),
      failure: jest.fn(),
      error: jest.fn(),
    };

    const result = service.evaluate(
      [
        { logic: { '===': [1, 1] } },
        { logic: { truthy: true }, failure_message: 'should never trigger' },
      ],
      { id: 'action-1' },
      { id: 'actor-1', components: {} },
      trace,
      {
        contextOverride: {
          actor: { stance: 'aggressive' },
          stats: { stamina: 5 },
          metadata: { updated: true },
          location: 'forgotten-catacombs',
          tags: undefined,
          newField: { difficulty: 'hard' },
        },
      }
    );

    expect(result).toBe(true);

    const passedContext = jsonLogicEvaluationService.evaluate.mock.calls[0][1];
    expect(passedContext.actor).toEqual({
      id: 'actor-1',
      components: baseComponents,
      stance: 'aggressive',
    });
    expect(passedContext.stats).toEqual({ health: 12, stamina: 5 });
    expect(passedContext.metadata).toEqual({ origin: 'base', updated: true });
    expect(passedContext.location).toBe('forgotten-catacombs');
    expect(passedContext).toHaveProperty('newField', { difficulty: 'hard' });
    expect(Object.prototype.hasOwnProperty.call(passedContext, 'tags')).toBe(
      false
    );

    expect(trace.withSpan).toHaveBeenCalledWith(
      'prerequisite.evaluate',
      expect.any(Function),
      expect.objectContaining({
        actionId: 'action-1',
        actorId: 'actor-1',
        ruleCount: 2,
      })
    );
    expect(trace.withSpan).toHaveBeenCalledWith(
      'prerequisite.evaluateRules',
      expect.any(Function),
      expect.objectContaining({
        actionId: 'action-1',
        ruleCount: 2,
      })
    );
  });

  it('signals trace failure when evaluation context cannot be built', () => {
    const circularComponents = {};
    circularComponents.self = circularComponents;

    actionValidationContextBuilder.buildContext.mockReturnValue({
      actor: { id: 'actor-2', components: circularComponents },
    });

    const trace = {
      withSpan: jest.fn((name, fn) => fn()),
      step: jest.fn(),
      data: jest.fn(),
      success: jest.fn(),
      failure: jest.fn(),
      error: jest.fn(),
    };

    const result = service.evaluate(
      [{ logic: { truthy: true } }],
      { id: 'action-2' },
      { id: 'actor-2', components: circularComponents },
      trace
    );

    expect(result).toBe(false);
    expect(jsonLogicEvaluationService.evaluate).not.toHaveBeenCalled();
    expect(trace.failure).toHaveBeenCalledWith(
      'Failed to build evaluation context',
      'PrerequisiteEvaluationService.evaluate',
      expect.objectContaining({ actionId: 'action-2', actorId: 'actor-2' })
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to build evaluation context'),
      expect.objectContaining({ actorId: 'actor-2' })
    );
  });
});
