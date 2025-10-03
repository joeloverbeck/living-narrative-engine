import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import SequenceHandler from '../../../../src/logic/operationHandlers/sequenceHandler.js';
import { createMockLogger } from '../../../common/mockFactories/index.js';

describe('SequenceHandler', () => {
  let logger;
  let actionSequence;

  const createHandler = () => new SequenceHandler({ logger, actionSequence });

  beforeEach(() => {
    logger = createMockLogger();
    actionSequence = {
      execute: jest.fn(),
    };
  });

  it('initializes with a prefixed logger and validates dependencies', () => {
    const handler = createHandler();

    expect(handler).toBeInstanceOf(SequenceHandler);
    expect(logger.debug).toHaveBeenCalledWith(
      'SequenceHandler: SequenceHandler initialized.'
    );
  });

  it('throws when the action sequence dependency lacks execute()', () => {
    actionSequence = {};

    expect(() => new SequenceHandler({ logger, actionSequence })).toThrow(
      "Invalid or missing method 'execute' on dependency 'SequenceHandler: actionSequence'."
    );
    expect(logger.error).toHaveBeenCalledWith(
      "SequenceHandler: Invalid or missing method 'execute' on dependency 'SequenceHandler: actionSequence'."
    );
  });

  it('executes the provided actions through the action sequence service', async () => {
    const handler = createHandler();
    const operation = {
      parameters: {
        actions: [{ id: 'alpha' }, { id: 'beta' }],
      },
    };
    const context = { correlationId: 'test-context' };

    actionSequence.execute.mockResolvedValue(undefined);

    await expect(handler.execute(operation, context)).resolves.toEqual({
      success: true,
      actionsExecuted: 2,
    });

    expect(actionSequence.execute).toHaveBeenCalledWith(
      { actions: operation.parameters.actions },
      context
    );
    const debugMessages = logger.debug.mock.calls.map((call) => call[0]);
    expect(debugMessages).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Executing sequence with 2 actions'),
        expect.stringContaining('Sequence execution completed successfully'),
      ])
    );
  });

  it('throws when the operation does not supply an actions array', async () => {
    const handler = createHandler();
    const badOperation = { parameters: { actions: null } };

    await expect(handler.execute(badOperation, { logger })).rejects.toThrow(
      'SequenceHandler.execute: operation must have parameters.actions array'
    );
  });

  it('throws when the execution context is missing', async () => {
    const handler = createHandler();
    const operation = { parameters: { actions: [] } };

    await expect(handler.execute(operation, undefined)).rejects.toThrow(
      'SequenceHandler.execute: context is required'
    );
  });

  it('logs and rethrows errors from the action sequence service', async () => {
    const handler = createHandler();
    const operation = { parameters: { actions: [{ id: 'only' }] } };
    const context = { correlationId: 'failure-case' };
    const failure = new Error('action sequence failed');

    actionSequence.execute.mockRejectedValue(failure);

    await expect(handler.execute(operation, context)).rejects.toBe(failure);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Sequence execution failed'),
      failure
    );
  });
});
