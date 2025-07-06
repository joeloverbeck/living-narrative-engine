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
  return {
    service: new PrerequisiteEvaluationService({
      logger,
      jsonLogicEvaluationService,
      actionValidationContextBuilder,
      gameDataRepository,
    }),
    logger,
  };
};

describe('PrerequisiteEvaluationService debug logging', () => {
  let service;
  let logger;

  beforeEach(() => {
    jest.clearAllMocks();
    ({ service, logger } = createService());
  });

  it('forwards debug messages from resolveReferences', () => {
    resolveReferences.mockImplementation((logic, repo, { debug }) => {
      debug('resolving');
      return { ok: true };
    });

    const result = service._resolveConditionReferences({}, 'act');

    expect(result).toEqual({ ok: true });
    expect(logger.debug).toHaveBeenCalledWith(
      'PrerequisiteEvaluationService: PrereqEval[act]: resolving'
    );
  });
});
