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

describe('PrerequisiteEvaluationService circular reference handling', () => {
  let service;
  let mockJson;
  let mockBuilder;
  let resolveReferencesMock;

  beforeEach(() => {
    jest.clearAllMocks();
    resolveReferencesMock = resolveReferences;
    mockJson = new JsonLogicEvaluationService({ logger: mockLogger });
    mockBuilder = new ActionValidationContextBuilder({ logger: mockLogger });
    mockBuilder.buildContext.mockReturnValue({
      actor: { id: 'a1', components: { hp: 1 } },
    });
    service = new PrerequisiteEvaluationService({
      logger: mockLogger,
      jsonLogicEvaluationService: mockJson,
      actionValidationContextBuilder: mockBuilder,
      gameDataRepository: { getConditionDefinition: jest.fn() },
    });
  });

  test('returns false and logs circular reference error', () => {
    resolveReferencesMock.mockImplementation(() => {
      throw new Error('Circular condition_ref detected. Path: A -> A');
    });

    const prereqs = [{ logic: { condition_ref: 'A' } }];
    const result = service.evaluate(prereqs, { id: 'act' }, { id: 'a1' });

    expect(result).toBe(false);
    expect(mockJson.evaluate).not.toHaveBeenCalled();

    const [msg, meta] = mockLogger.error.mock.calls[0];
    expect(msg).toContain('Error during rule resolution or evaluation');
    expect(meta.error).toContain(
      'Circular reference detected in prerequisites for action'
    );
  });
});
