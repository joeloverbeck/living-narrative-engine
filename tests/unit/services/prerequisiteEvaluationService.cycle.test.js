// src/tests/services/prerequisiteEvaluationService.cycle.test.js

import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { PrerequisiteEvaluationService } from '../../../src/actions/validation/prerequisiteEvaluationService.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import { ActionValidationContextBuilder } from '../../../src/actions/validation/actionValidationContextBuilder.js';

jest.mock('../../../src/logic/jsonLogicEvaluationService.js', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    evaluate: jest.fn(),
    addOperation: jest.fn(),
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

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

describe('PrerequisiteEvaluationService Circular Reference Detection', () => {
  /** @type {PrerequisiteEvaluationService} */
  let service;
  /** @type {{getConditionDefinition: jest.Mock}} */
  let mockGameDataRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGameDataRepository = {
      getConditionDefinition: jest.fn(),
    };

    service = new PrerequisiteEvaluationService({
      logger: mockLogger,
      jsonLogicEvaluationService: new JsonLogicEvaluationService({
        logger: mockLogger,
      }),
      actionValidationContextBuilder: new ActionValidationContextBuilder({
        logger: mockLogger,
      }),
      gameDataRepository: mockGameDataRepository,
    });
  });

  test('should throw error with reference path when circular condition_ref detected', () => {
    mockGameDataRepository.getConditionDefinition.mockImplementation((id) => {
      if (id === 'A') return { logic: { condition_ref: 'B' } };
      if (id === 'B') return { logic: { condition_ref: 'C' } };
      if (id === 'C') return { logic: { condition_ref: 'A' } };
      return null;
    });

    expect(() =>
      service._resolveConditionReferences({ condition_ref: 'A' }, 'testAction')
    ).toThrow(
      "Circular reference detected in prerequisites for action 'testAction'. Path: A -> B -> C -> A"
    );
  });

  test('should resolve identical condition_refs in separate branches without errors', () => {
    mockGameDataRepository.getConditionDefinition.mockImplementation((id) => {
      if (id === 'X') return { logic: { condition_ref: 'A' } };
      if (id === 'Y') return { logic: { condition_ref: 'A' } };
      if (id === 'A') return { logic: { '==': [1, 1] } };
      return null;
    });

    const input = [{ condition_ref: 'X' }, { condition_ref: 'Y' }];

    const result = service._resolveConditionReferences(input, 'testAction');

    expect(result).toEqual([{ '==': [1, 1] }, { '==': [1, 1] }]);
  });
});
