import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { PrerequisiteEvaluationService } from '../../../src/actions/validation/prerequisiteEvaluationService.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import { ActionValidationContextBuilder } from '../../../src/actions/validation/actionValidationContextBuilder.js';

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
    resolveReferences: jest.fn().mockReturnValue({ '==': [1, 1] }),
  })
);

const mockLogger = {
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
};

describe('PrerequisiteEvaluationService serialization edge cases', () => {
  let service;
  let mockJson;
  let mockBuilder;

  beforeEach(() => {
    jest.clearAllMocks();
    mockJson = new JsonLogicEvaluationService({ logger: mockLogger });
    mockBuilder = new ActionValidationContextBuilder({ logger: mockLogger });
    mockJson.evaluate.mockReturnValue(true);
    service = new PrerequisiteEvaluationService({
      logger: mockLogger,
      jsonLogicEvaluationService: mockJson,
      actionValidationContextBuilder: mockBuilder,
      gameDataRepository: { getConditionDefinition: jest.fn() },
    });
  });

  it('logs component count when actor has components', () => {
    mockBuilder.buildContext.mockReturnValue({
      actor: { id: 'a1', components: { hp: 1, mp: 2 } },
    });

    service.evaluate(
      [{ logic: { '==': [1, 1] } }],
      { id: 'act' },
      { id: 'a1' }
    );

    expect(mockLogger.debug).toHaveBeenCalledWith(
      'PrerequisiteEvaluationService: PrereqEval[act]: Actor entity [a1] has 2 components available.'
    );
  });

  it('handles serialization errors when components cannot be stringified', () => {
    const circular = {};
    circular.self = circular;
    mockBuilder.buildContext.mockReturnValue({
      actor: { id: 'a1', components: circular },
    });

    service.evaluate(
      [{ logic: { '==': [1, 1] } }],
      { id: 'act' },
      { id: 'a1' }
    );

    expect(mockLogger.debug).toHaveBeenCalledWith(
      'PrerequisiteEvaluationService: PrereqEval[act]: Could not serialize components for validation logging'
    );
  });
});
