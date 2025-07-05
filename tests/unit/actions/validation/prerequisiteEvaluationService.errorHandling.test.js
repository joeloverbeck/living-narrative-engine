import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PrerequisiteEvaluationService } from '../../../../src/actions/validation/prerequisiteEvaluationService.js';
import { resolveReferences } from '../../../../src/actions/validation/conditionReferenceResolver.js';

jest.mock('../../../../src/actions/validation/conditionReferenceResolver.js');

const createService = () => {
  const logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  const jsonLogicEvaluationService = { evaluate: jest.fn() };
  const actionValidationContextBuilder = { buildContext: jest.fn() };
  const gameDataRepository = { getConditionDefinition: jest.fn() };
  return new PrerequisiteEvaluationService({
    logger,
    jsonLogicEvaluationService,
    actionValidationContextBuilder,
    gameDataRepository,
  });
};

describe('PrerequisiteEvaluationService._resolveConditionReferences', () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    service = createService();
  });

  it('wraps circular reference errors with a descriptive message', () => {
    const err = new Error(
      'Circular condition_ref detected. Path: cond1 -> cond2'
    );
    resolveReferences.mockImplementation(() => {
      throw err;
    });

    expect(() => service._resolveConditionReferences({}, 'testAction')).toThrow(
      "Circular reference detected in prerequisites for action 'testAction'. Circular condition_ref detected. Path: cond1 -> cond2"
    );
  });

  it('rethrows other errors from resolveReferences', () => {
    const err = new Error('Some other error');
    resolveReferences.mockImplementation(() => {
      throw err;
    });

    expect(() => service._resolveConditionReferences({}, 'testAction')).toThrow(
      err
    );
  });
});
