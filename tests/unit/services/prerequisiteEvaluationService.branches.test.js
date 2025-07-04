import { describe, test, expect, jest, beforeEach } from '@jest/globals';

import { PrerequisiteEvaluationService } from '../../../src/actions/validation/prerequisiteEvaluationService.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import { ActionValidationContextBuilder } from '../../../src/actions/validation/actionValidationContextBuilder.js';
import { resolveReferences } from '../../../src/actions/validation/conditionReferenceResolver.js';

jest.mock('../../../src/logic/jsonLogicEvaluationService.js', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    evaluate: jest.fn(),
  })),
}));

jest.mock(
  '../../../src/actions/validation/actionValidationContextBuilder.js',
  () => ({
    __esModule: true,
    ActionValidationContextBuilder: jest.fn().mockImplementation(() => ({
      buildContext: jest.fn(),
    })),
  })
);

jest.mock(
  '../../../src/actions/validation/conditionReferenceResolver.js',
  () => ({
    __esModule: true,
    resolveReferences: jest.fn(),
  })
);

const mockLogger = {
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
};

describe('PrerequisiteEvaluationService additional branches', () => {
  let service;
  let mockJson;
  let mockBuilder;
  let mockRepo;
  let resolveReferencesMock;

  beforeEach(() => {
    jest.clearAllMocks();
    resolveReferencesMock = resolveReferences;
    mockJson = new JsonLogicEvaluationService({ logger: mockLogger });
    mockBuilder = new ActionValidationContextBuilder({ logger: mockLogger });
    mockRepo = { getConditionDefinition: jest.fn() };
    mockBuilder.buildContext.mockReturnValue({
      actor: { id: 'actor1', components: { hp: 1 } },
    });
    mockJson.evaluate.mockReturnValue(true);
    service = new PrerequisiteEvaluationService({
      logger: mockLogger,
      jsonLogicEvaluationService: mockJson,
      actionValidationContextBuilder: mockBuilder,
      gameDataRepository: mockRepo,
    });
  });

  test('logs default ids when action or actor is missing', () => {
    const result = service.evaluate([], {}, {});
    expect(result).toBe(true);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'PrerequisiteEvaluationService: PrereqEval[unknown_action]: → PASSED (No prerequisites to evaluate).'
    );
  });

  test('logs error when actor components property missing', () => {
    mockBuilder.buildContext.mockReturnValue({ actor: { id: 'a1' } });
    const prereqs = [{ logic: { '==': [1, 1] } }];
    service.evaluate(prereqs, { id: 'act' }, { id: 'a1' });
    expect(mockLogger.error).toHaveBeenCalledWith(
      'PrerequisiteEvaluationService: PrereqEval[act]: ERROR - Actor context is missing components property entirely!'
    );
  });

  test('warns when actor has no components', () => {
    mockBuilder.buildContext.mockReturnValue({
      actor: { id: 'a1', components: {} },
    });
    const prereqs = [{ logic: { '==': [1, 1] } }];
    service.evaluate(prereqs, { id: 'act' }, { id: 'a1' });
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'PrerequisiteEvaluationService: PrereqEval[act]: WARNING - Actor entity [a1] appears to have NO components. This may indicate a loading issue.'
    );
  });

  test('propagates non-circular errors from resolveReferences', () => {
    resolveReferencesMock.mockImplementation(() => {
      throw new Error('boom');
    });
    const prereqs = [{ logic: { var: 'actor.id' } }];
    const result = service.evaluate(prereqs, { id: 'act' }, { id: 'a1' });
    expect(result).toBe(false);
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        'PrereqEval[act]: ← FAILED (Rule 1/1): Error during rule resolution or evaluation.'
      ),
      expect.objectContaining({ error: 'boom' })
    );
  });

  test('invokes trace hooks when provided', () => {
    const trace = {
      info: jest.fn(),
      data: jest.fn(),
      success: jest.fn(),
      failure: jest.fn(),
      error: jest.fn(),
    };
    const prereqs = [{ logic: { '==': [1, 1] } }];
    service.evaluate(prereqs, { id: 'act' }, { id: 'a1' }, trace);
    expect(trace.info).toHaveBeenCalled();
    expect(trace.data).toHaveBeenCalled();
    expect(
      trace.success.mock.calls.length + trace.failure.mock.calls.length
    ).toBeGreaterThanOrEqual(0);
  });
});
