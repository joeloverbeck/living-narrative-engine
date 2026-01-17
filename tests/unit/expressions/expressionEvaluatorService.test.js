import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import ExpressionEvaluatorService from '../../../src/expressions/expressionEvaluatorService.js';

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createService = ({
  expressions = [],
  evaluateImpl = null,
  evaluateWithTraceImpl = null,
  gameDataRepositoryOverrides = {},
  strictMode = false,
} = {}) => {
  const expressionRegistry = {
    getExpressionsByPriority: jest.fn().mockReturnValue(expressions),
  };
  const jsonLogicEvaluationService = {
    evaluate: evaluateImpl ?? jest.fn(),
    evaluateWithTrace:
      evaluateWithTraceImpl ?? jest.fn().mockReturnValue({ resultBoolean: true }),
  };
  const gameDataRepository = {
    getConditionDefinition: jest.fn(),
    ...gameDataRepositoryOverrides,
  };
  const logger = createLogger();

  const service = new ExpressionEvaluatorService({
    expressionRegistry,
    jsonLogicEvaluationService,
    gameDataRepository,
    logger,
    strictMode,
  });

  return {
    service,
    expressionRegistry,
    jsonLogicEvaluationService,
    gameDataRepository,
    logger,
  };
};

describe('ExpressionEvaluatorService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return null when no expressions exist', () => {
    const { service, jsonLogicEvaluationService } = createService();

    expect(service.evaluate({})).toBeNull();
    expect(jsonLogicEvaluationService.evaluate).not.toHaveBeenCalled();
  });

  it('should return null when no expressions match', () => {
    const expression = {
      id: 'expr:one',
      prerequisites: [{ logic: { '==': [1, 2] } }],
    };
    const evaluate = jest.fn().mockReturnValue(false);
    const { service } = createService({
      expressions: [expression],
      evaluateImpl: evaluate,
    });

    expect(service.evaluate({})).toBeNull();
    expect(evaluate).toHaveBeenCalledTimes(1);
  });

  it('should return highest priority matching expression', () => {
    const expressions = [
      { id: 'expr:high', prerequisites: [{ logic: { '==': [1, 2] } }] },
      { id: 'expr:low', prerequisites: [{ logic: { '==': [2, 2] } }] },
    ];
    const evaluate = jest.fn().mockReturnValueOnce(false).mockReturnValueOnce(true);
    const { service } = createService({
      expressions,
      evaluateImpl: evaluate,
    });

    expect(service.evaluate({})).toEqual(expressions[1]);
    expect(evaluate).toHaveBeenCalledTimes(2);
  });

  it('should evaluate all prerequisites with AND logic', () => {
    const expression = {
      id: 'expr:and',
      prerequisites: [
        { logic: { '>': [2, 1] } },
        { logic: { '<': [1, 2] } },
      ],
    };
    const evaluate = jest.fn().mockReturnValue(true);
    const { service } = createService({
      expressions: [expression],
      evaluateImpl: evaluate,
    });

    expect(service.evaluate({})).toEqual(expression);
    expect(evaluate).toHaveBeenCalledTimes(2);
  });

  it('should fail expression if any prerequisite fails', () => {
    const expression = {
      id: 'expr:fail',
      prerequisites: [
        { logic: { '>': [2, 1] } },
        { logic: { '<': [2, 1] } },
      ],
    };
    const evaluate = jest.fn().mockReturnValueOnce(true).mockReturnValueOnce(false);
    const { service } = createService({
      expressions: [expression],
      evaluateImpl: evaluate,
    });

    expect(service.evaluate({})).toBeNull();
    expect(evaluate).toHaveBeenCalledTimes(2);
  });

  it('should resolve condition_ref in prerequisites', () => {
    const expression = {
      id: 'expr:ref',
      prerequisites: [{ logic: { condition_ref: 'cond:one' } }],
    };
    const evaluate = jest.fn().mockReturnValue(true);
    const { service, gameDataRepository, jsonLogicEvaluationService } =
      createService({
        expressions: [expression],
        evaluateImpl: evaluate,
      });

    gameDataRepository.getConditionDefinition.mockReturnValue({
      id: 'cond:one',
      logic: { '==': [1, 1] },
    });

    const context = { actor: { id: 'actor-1' } };
    expect(service.evaluate(context)).toEqual(expression);
    expect(gameDataRepository.getConditionDefinition).toHaveBeenCalledWith(
      'cond:one'
    );
    expect(jsonLogicEvaluationService.evaluate).toHaveBeenCalledWith(
      { '==': [1, 1] },
      context
    );
  });

  it('should detect circular condition_ref and fail safely', () => {
    const expression = {
      id: 'expr:loop',
      prerequisites: [{ logic: { condition_ref: 'cond:loop' } }],
    };
    const { service, gameDataRepository, jsonLogicEvaluationService, logger } =
      createService({
        expressions: [expression],
      });

    gameDataRepository.getConditionDefinition.mockReturnValue({
      id: 'cond:loop',
      logic: { condition_ref: 'cond:loop' },
    });

    expect(service.evaluate({})).toBeNull();
    expect(jsonLogicEvaluationService.evaluate).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });

  it('should handle missing logic in prerequisite gracefully', () => {
    const expression = {
      id: 'expr:missing-logic',
      prerequisites: [{ reason: 'missing' }],
    };
    const { service, jsonLogicEvaluationService, logger } = createService({
      expressions: [expression],
    });

    expect(service.evaluate({})).toEqual(expression);
    expect(jsonLogicEvaluationService.evaluate).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });

  it('should isolate strict mode missing logic errors to the failing expression', () => {
    const expressions = [
      { id: 'expr:missing-logic', prerequisites: [{ reason: 'missing' }] },
      { id: 'expr:valid', prerequisites: [{ logic: { '==': [1, 1] } }] },
    ];
    const evaluate = jest.fn().mockReturnValue(true);
    const { service, logger } = createService({
      expressions,
      evaluateImpl: evaluate,
      strictMode: true,
    });

    expect(service.evaluate({})).toEqual(expressions[1]);
    expect(evaluate).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalled();
  });

  it('should handle JSON Logic evaluation errors gracefully', () => {
    const expression = {
      id: 'expr:error',
      prerequisites: [{ logic: { '==': [1, 1] } }],
    };
    const evaluate = jest.fn(() => {
      throw new Error('boom');
    });
    const { service, logger } = createService({
      expressions: [expression],
      evaluateImpl: evaluate,
    });

    expect(service.evaluate({})).toBeNull();
    expect(logger.error).toHaveBeenCalled();
  });

  it('should isolate strict mode evaluation errors to the failing expression', () => {
    const expressions = [
      { id: 'expr:error', prerequisites: [{ logic: { '==': [1, 1] } }] },
      { id: 'expr:ok', prerequisites: [{ logic: { '==': [2, 2] } }] },
    ];
    const evaluate = jest
      .fn()
      .mockImplementationOnce(() => {
        throw new Error('boom');
      })
      .mockReturnValueOnce(true);
    const { service, logger } = createService({
      expressions,
      evaluateImpl: evaluate,
      strictMode: true,
    });

    expect(service.evaluate({})).toEqual(expressions[1]);
    expect(evaluate).toHaveBeenCalledTimes(2);
    expect(logger.error).toHaveBeenCalled();
  });

  it('should log structured error payload for missing context vars', () => {
    const expression = {
      id: 'expr:missing-var',
      prerequisites: [{ logic: { '>': [{ var: 'moodAxes.valence' }, 0] } }],
    };
    const evaluateWithTrace = jest.fn().mockReturnValue({
      resultBoolean: false,
      failure: { op: '>', reason: 'Operation evaluated to false' },
    });
    const { service, logger } = createService({
      expressions: [expression],
      evaluateWithTraceImpl: evaluateWithTrace,
    });

    const context = { actor: { id: 'actor-1' }, moodAxes: {} };
    expect(service.evaluate(context)).toBeNull();
    expect(logger.error).toHaveBeenCalled();

    const [message, payload] = logger.error.mock.calls[0];
    expect(message).toContain('EXPR_PREREQ_ERROR');
    expect(payload.category).toBe('missing-var');
    expect(payload.expressionId).toBe('expr:missing-var');
    expect(payload.prerequisiteIndex).toBe(1);
    expect(payload.vars).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'moodAxes.valence', missing: true }),
      ])
    );
  });

  it('should log structured error payload for invalid logic', () => {
    const expression = {
      id: 'expr:invalid-logic',
      prerequisites: [{ logic: { '??': [1, 2] } }],
    };
    const evaluateWithTrace = jest.fn().mockReturnValue({
      resultBoolean: false,
      failure: {
        op: 'validation',
        reason: "JSON Logic validation error: Disallowed operation '??'",
      },
    });
    const { service, logger } = createService({
      expressions: [expression],
      evaluateWithTraceImpl: evaluateWithTrace,
    });

    expect(service.evaluate({})).toBeNull();
    expect(logger.error).toHaveBeenCalled();

    const [message, payload] = logger.error.mock.calls[0];
    expect(message).toContain('EXPR_PREREQ_ERROR');
    expect(payload.category).toBe('invalid-logic');
    expect(payload.code).toBe('EXPR_PREREQ_INVALID_LOGIC');
    expect(payload.expressionId).toBe('expr:invalid-logic');
    expect(payload.prerequisiteIndex).toBe(1);
  });

  it('should evaluate expressions in priority order', () => {
    const expressions = [
      { id: 'expr:high', prerequisites: [{ logic: { '==': [1, 2] } }] },
      { id: 'expr:low', prerequisites: [{ logic: { '==': [2, 2] } }] },
    ];
    const evaluate = jest.fn().mockReturnValueOnce(false).mockReturnValueOnce(true);
    const { service } = createService({
      expressions,
      evaluateImpl: evaluate,
    });

    expect(service.evaluate({})).toEqual(expressions[1]);
    expect(evaluate).toHaveBeenNthCalledWith(1, { '==': [1, 2] }, {});
    expect(evaluate).toHaveBeenNthCalledWith(2, { '==': [2, 2] }, {});
  });

  it('should return all matches with evaluateAll method', () => {
    const expressions = [
      { id: 'expr:first', prerequisites: [{ logic: { '==': [1, 1] } }] },
      { id: 'expr:second', prerequisites: [{ logic: { '==': [2, 2] } }] },
    ];
    const evaluate = jest.fn().mockReturnValue(true);
    const { service } = createService({
      expressions,
      evaluateImpl: evaluate,
    });

    expect(service.evaluateAll({})).toEqual(expressions);
    expect(evaluate).toHaveBeenCalledTimes(2);
  });

  it('should treat empty prerequisites as a match', () => {
    const expression = { id: 'expr:empty', prerequisites: [] };
    const { service, jsonLogicEvaluationService } = createService({
      expressions: [expression],
    });

    expect(service.evaluate({})).toEqual(expression);
    expect(jsonLogicEvaluationService.evaluate).not.toHaveBeenCalled();
  });

  it('should validate dependencies in constructor', () => {
    const logger = createLogger();
    const expressionRegistry = {
      getExpressionsByPriority: jest.fn(),
    };
    const jsonLogicEvaluationService = {
      evaluate: jest.fn(),
      evaluateWithTrace: jest.fn(),
    };
    const gameDataRepository = {
      getConditionDefinition: jest.fn(),
    };

    expect(
      () =>
        new ExpressionEvaluatorService({
          expressionRegistry: null,
          jsonLogicEvaluationService,
          gameDataRepository,
          logger,
        })
    ).toThrow('Missing required dependency');

    expect(
      () =>
        new ExpressionEvaluatorService({
          expressionRegistry: {},
          jsonLogicEvaluationService,
          gameDataRepository,
          logger,
        })
    ).toThrow('Invalid or missing method');
  });
});
