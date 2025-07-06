import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { executeActionSequence } from '../../../src/logic/actionSequence.js';
import { createMockLogger } from '../../common/mockFactories/index.js';
import { evaluateConditionWithLogging } from '../../../src/logic/jsonLogicEvaluationService.js';
import { handleIf } from '../../../src/logic/flowHandlers/ifHandler.js';
import { handleForEach } from '../../../src/logic/flowHandlers/forEachHandler.js';

jest.mock('../../../src/logic/jsonLogicEvaluationService.js', () => ({
  evaluateConditionWithLogging: jest.fn(),
}));

jest.mock('../../../src/logic/flowHandlers/ifHandler.js', () => ({
  handleIf: jest.fn(),
}));

jest.mock('../../../src/logic/flowHandlers/forEachHandler.js', () => ({
  handleForEach: jest.fn(),
}));

const logger = createMockLogger();
const interpreter = { execute: jest.fn() };
const baseCtx = { evaluationContext: {}, jsonLogic: {}, scopeLabel: 'SEQ' };

describe('executeActionSequence branches', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('logs error and stops on invalid operation object', () => {
    const actions = [null, { type: 'NEXT' }];
    executeActionSequence(actions, baseCtx, logger, interpreter);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Invalid operation object. Halting sequence.'),
      null
    );
    expect(interpreter.execute).not.toHaveBeenCalled();
  });

  it('skips operation when condition evaluation errors', () => {
    const error = new Error('fail');
    evaluateConditionWithLogging.mockReturnValueOnce({
      result: false,
      errored: true,
      error,
    });
    const actions = [{ type: 'TEST', condition: {} }, { type: 'NEXT' }];
    executeActionSequence(actions, baseCtx, logger, interpreter);
    expect(evaluateConditionWithLogging).toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Condition evaluation failed'),
      error
    );
    expect(interpreter.execute).toHaveBeenCalledTimes(1);
    expect(interpreter.execute).toHaveBeenCalledWith(
      actions[1],
      expect.objectContaining({ evaluationContext: {} })
    );
  });

  it('skips operation when condition evaluates to false', () => {
    evaluateConditionWithLogging.mockReturnValueOnce({
      result: false,
      errored: false,
    });
    const actions = [{ type: 'TEST', condition: {} }, { type: 'NEXT' }];
    executeActionSequence(actions, baseCtx, logger, interpreter);
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Condition=false – op skipped.')
    );
    expect(interpreter.execute).toHaveBeenCalledTimes(1);
    expect(interpreter.execute).toHaveBeenCalledWith(
      actions[1],
      expect.objectContaining({ evaluationContext: {} })
    );
  });

  it('delegates to flow handler for IF type', () => {
    const actions = [{ type: 'IF' }];
    executeActionSequence(actions, baseCtx, logger, interpreter);
    expect(handleIf).toHaveBeenCalledWith(
      actions[0],
      expect.objectContaining({ scopeLabel: 'SEQ IF#1' }),
      logger,
      interpreter,
      executeActionSequence
    );
    expect(interpreter.execute).not.toHaveBeenCalled();
  });

  it('delegates to flow handler for FOR_EACH type', () => {
    const actions = [{ type: 'FOR_EACH' }];
    executeActionSequence(actions, baseCtx, logger, interpreter);
    expect(handleForEach).toHaveBeenCalledWith(
      actions[0],
      expect.objectContaining({ scopeLabel: 'SEQ FOR_EACH#1' }),
      logger,
      interpreter,
      executeActionSequence
    );
  });

  it('executes via interpreter for unknown type', () => {
    evaluateConditionWithLogging.mockReturnValueOnce({
      result: true,
      errored: false,
    });
    const actions = [{ type: 'MOVE', condition: {} }];
    executeActionSequence(actions, baseCtx, logger, interpreter);
    expect(interpreter.execute).toHaveBeenCalledWith(
      actions[0],
      expect.objectContaining({ evaluationContext: {} })
    );
  });
});
