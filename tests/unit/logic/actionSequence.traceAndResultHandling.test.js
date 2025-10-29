import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { executeActionSequence } from '../../../src/logic/actionSequence.js';
import { createMockLogger } from '../../common/mockFactories/index.js';

const buildBaseContext = () => ({
  evaluationContext: {},
  jsonLogic: {},
  scopeLabel: 'TRACE_SEQ',
});

describe('executeActionSequence trace and result handling', () => {
  let logger;
  let interpreter;

  beforeEach(() => {
    logger = createMockLogger();
    interpreter = {
      execute: jest.fn(),
    };
  });

  it('captures trace hooks when provided in context', async () => {
    const trace = {
      captureOperationStart: jest.fn(),
      captureOperationResult: jest.fn(),
    };
    const actions = [{ type: 'TRACE_OP' }];
    const result = { success: true };
    interpreter.execute.mockResolvedValue(result);

    await executeActionSequence(
      actions,
      { ...buildBaseContext(), trace },
      logger,
      interpreter
    );

    expect(trace.captureOperationStart).toHaveBeenCalledWith(actions[0], 1);
    expect(trace.captureOperationResult).toHaveBeenCalledWith(result);
  });

  it('logs a success message when operation resolves with success=true', async () => {
    const actions = [{ type: 'MOVE' }];
    interpreter.execute.mockResolvedValue({ success: true });

    await executeActionSequence(actions, buildBaseContext(), logger, interpreter);

    const successLogExists = logger.debug.mock.calls.some(([message]) =>
      message.includes('Operation MOVE completed successfully')
    );
    expect(successLogExists).toBe(true);
  });

  it('warns when operation reports success=false and includes diagnostic payload', async () => {
    const failure = { success: false, error: new Error('boom') };
    const actions = [{ type: 'MOVE', parameters: { foo: 'bar' } }];
    interpreter.execute.mockResolvedValue(failure);

    await executeActionSequence(actions, buildBaseContext(), logger, interpreter);

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Operation MOVE reported failure but rule continues'),
      expect.objectContaining({
        operationType: 'MOVE',
        operationIndex: 1,
        error: failure.error,
        operationParameters: actions[0].parameters,
      })
    );
  });

  it('logs generic completion when success is not explicitly reported', async () => {
    const actions = [{ type: 'MOVE' }];
    interpreter.execute.mockResolvedValue({});

    await executeActionSequence(actions, buildBaseContext(), logger, interpreter);

    const genericLogExists = logger.debug.mock.calls.some(([message]) =>
      message.includes('Finished executing operation of type: MOVE')
    );
    expect(genericLogExists).toBe(true);
  });
});
