import { describe, beforeEach, test, expect, jest } from '@jest/globals';

jest.mock('../../../../src/logic/actionSequence.js', () => ({
  executeActionSequence: jest.fn(),
}));

jest.mock('../../../../src/logic/jsonLogicEvaluationService.js', () => ({
  evaluateConditionWithLogging: jest.fn(),
}));

import { executeActionSequence } from '../../../../src/logic/actionSequence.js';
import { evaluateConditionWithLogging } from '../../../../src/logic/jsonLogicEvaluationService.js';
import { handleIf } from '../../../../src/logic/flowHandlers/ifHandler.js';

const logger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
const interpreter = { execute: jest.fn() };
const jsonLogic = { evaluate: jest.fn() };
const baseCtx = { evaluationContext: { context: {} } };

describe('handleIf', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('executes then_actions when condition is true', () => {
    evaluateConditionWithLogging.mockReturnValue({
      result: true,
      errored: false,
    });
    const node = {
      parameters: { then_actions: [{ type: 'LOG' }], else_actions: [] },
    };
    handleIf(
      node,
      { ...baseCtx, jsonLogic, scopeLabel: 'S' },
      logger,
      interpreter
    );
    expect(executeActionSequence).toHaveBeenCalledTimes(1);
    expect(executeActionSequence).toHaveBeenCalledWith(
      node.parameters.then_actions,
      { ...baseCtx, scopeLabel: 'S', jsonLogic },
      logger,
      interpreter
    );
  });

  test('executes else_actions when condition is false', () => {
    evaluateConditionWithLogging.mockReturnValue({
      result: false,
      errored: false,
    });
    const node = {
      parameters: { then_actions: [], else_actions: [{ type: 'LOG' }] },
    };
    handleIf(
      node,
      { ...baseCtx, jsonLogic, scopeLabel: 'S' },
      logger,
      interpreter
    );
    expect(executeActionSequence).toHaveBeenCalledTimes(1);
    expect(executeActionSequence).toHaveBeenCalledWith(
      node.parameters.else_actions,
      { ...baseCtx, scopeLabel: 'S', jsonLogic },
      logger,
      interpreter
    );
  });

  test('skips execution on evaluation error', () => {
    evaluateConditionWithLogging.mockReturnValue({
      result: false,
      errored: true,
      error: new Error('fail'),
    });
    const node = { parameters: {} };
    handleIf(
      node,
      { ...baseCtx, jsonLogic, scopeLabel: 'S' },
      logger,
      interpreter
    );
    expect(executeActionSequence).not.toHaveBeenCalled();
  });
});
