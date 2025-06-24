// src/tests/services/prerequisiteEvaluationService.cycle.test.js

import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { resolveConditionRefs } from '../../../src/utils/conditionRefResolver.js';

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
  /** @type {{getConditionDefinition: jest.Mock}} */
  let mockGameDataRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGameDataRepository = {
      getConditionDefinition: jest.fn(),
    };
  });

  test('should throw error with reference path when circular condition_ref detected', () => {
    mockGameDataRepository.getConditionDefinition.mockImplementation((id) => {
      if (id === 'A') return { logic: { condition_ref: 'B' } };
      if (id === 'B') return { logic: { condition_ref: 'C' } };
      if (id === 'C') return { logic: { condition_ref: 'A' } };
      return null;
    });

    expect(() =>
      resolveConditionRefs(
        { condition_ref: 'A' },
        mockGameDataRepository,
        mockLogger
      )
    ).toThrow('Circular condition_ref detected. Path: A -> B -> C -> A');
  });

  test('should resolve identical condition_refs in separate branches without errors', () => {
    mockGameDataRepository.getConditionDefinition.mockImplementation((id) => {
      if (id === 'X') return { logic: { condition_ref: 'A' } };
      if (id === 'Y') return { logic: { condition_ref: 'A' } };
      if (id === 'A') return { logic: { '==': [1, 1] } };
      return null;
    });

    const input = [{ condition_ref: 'X' }, { condition_ref: 'Y' }];

    const result = resolveConditionRefs(
      input,
      mockGameDataRepository,
      mockLogger
    );

    expect(result).toEqual([{ '==': [1, 1] }, { '==': [1, 1] }]);
  });
});
