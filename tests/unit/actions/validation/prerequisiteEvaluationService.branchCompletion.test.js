import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { PrerequisiteEvaluationService } from '../../../../src/actions/validation/prerequisiteEvaluationService.js';
import { resolveReferences } from '../../../../src/actions/validation/conditionReferenceResolver.js';

jest.mock(
  '../../../../src/actions/validation/conditionReferenceResolver.js',
  () => ({
    resolveReferences: jest.fn(),
  })
);

describe('PrerequisiteEvaluationService additional branch coverage', () => {
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

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns false and logs when a prerequisite rule is invalid', () => {
    actionValidationContextBuilder.buildContext.mockReturnValue({
      actor: { id: 'actor-1', components: {} },
    });

    jsonLogicEvaluationService.evaluate.mockReturnValue(true);

    const result = service.evaluate(
      [
        {
          // missing logic triggers validation error
        },
      ],
      { id: 'act-1' },
      { id: 'actor-1', components: {} }
    );

    expect(result).toBe(false);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Prerequisite item is invalid')
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('appears to have NO components')
    );
  });

  it('logs failure messages when a rule fails evaluation', () => {
    resolveReferences.mockReturnValue({ equals: [1, 2] });
    jsonLogicEvaluationService.evaluate.mockReturnValue(false);
    actionValidationContextBuilder.buildContext.mockReturnValue({
      actor: { id: 'actor-2', components: { head: {} } },
    });

    const result = service.evaluate(
      [
        {
          logic: { equals: [1, 2] },
          failure_message: 'not allowed',
        },
      ],
      { id: 'act-2' },
      { id: 'actor-2', components: { head: {} } }
    );

    expect(result).toBe(false);
    const debugMessages = logger.debug.mock.calls.map(([message]) => message);
    expect(
      debugMessages.some((msg) => msg?.includes('Reason: not allowed'))
    ).toBe(true);
    expect(
      debugMessages.some((msg) => msg?.includes('has 1 components available'))
    ).toBe(true);
  });

  it('logs error when actor context is missing components property entirely', () => {
    actionValidationContextBuilder.buildContext.mockReturnValue({
      actor: { id: 'actor-3' },
    });
    jsonLogicEvaluationService.evaluate.mockReturnValue(true);

    const result = service.evaluate(
      [
        {
          logic: { truthy: true },
        },
      ],
      { id: 'act-3' },
      { id: 'actor-3' }
    );

    expect(result).toBe(true);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        'Actor context is missing components property entirely'
      )
    );
  });

  it('handles component serialization failures gracefully', () => {
    const components = {};
    components.self = components;
    actionValidationContextBuilder.buildContext.mockReturnValue({
      actor: { id: 'actor-4', components },
    });
    jsonLogicEvaluationService.evaluate.mockReturnValue(true);

    const result = service.evaluate(
      [
        {
          logic: { truthy: true },
        },
      ],
      { id: 'act-4' },
      { id: 'actor-4', components }
    );

    expect(result).toBe(false);
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        'Could not serialize components for validation logging'
      ),
      expect.any(Error)
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to build evaluation context'),
      expect.objectContaining({ actorId: 'actor-4' })
    );
  });

  it('falls back to unknown identifiers when prerequisites array is empty', () => {
    const result = service.evaluate([], null, null);

    expect(result).toBe(true);
    expect(
      logger.debug.mock.calls.some(
        ([message]) =>
          typeof message === 'string' &&
          message.includes('→ PASSED (No prerequisites to evaluate).')
      )
    ).toBe(true);
  });

  it('records resolved logic snapshots when condition references change', () => {
    const trace = {
      step: jest.fn(),
      data: jest.fn(),
      success: jest.fn(),
      failure: jest.fn(),
      error: jest.fn(),
      withSpan: undefined,
    };

    resolveReferences.mockReturnValue(undefined);
    jsonLogicEvaluationService.evaluate.mockReturnValue(true);
    const evaluationContext = {
      actor: { id: 'actor-5', components: { torso: {} } },
    };

    const spy = jest
      .spyOn(service, '_validatePrerequisiteRule')
      .mockReturnValue(true);

    const result = service._evaluatePrerequisite(
      { logic: null },
      1,
      1,
      evaluationContext,
      'act-5',
      trace
    );

    expect(result).toBe(true);
    expect(trace.data).toHaveBeenCalledWith(
      'Prerequisite rule',
      expect.any(String),
      expect.objectContaining({ logic: {} })
    );
    expect(
      trace.data.mock.calls.some(
        ([event, , payload]) =>
          event === 'Condition reference resolved' &&
          payload.originalLogic &&
          Object.keys(payload.originalLogic).length === 0 &&
          payload.resolvedLogic &&
          Object.keys(payload.resolvedLogic).length === 0
      )
    ).toBe(true);

    spy.mockRestore();
  });
});
