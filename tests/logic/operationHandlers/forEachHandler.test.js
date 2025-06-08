import ForEachHandler from '../../../src/logic/operationHandlers/forEachHandler.js';
import { describe, expect, jest, test } from '@jest/globals';

const makeMockLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const makeExecCtx = () => ({
  evaluationContext: {
    context: {},
  },
  logger: makeMockLogger(),
});

describe('FOR_EACH handler', () => {
  test('executes nested actions once per element', () => {
    const logger = makeMockLogger();
    const opInterpreter = { execute: jest.fn() };

    const handler = new ForEachHandler({
      logger,
      operationInterpreter: opInterpreter,
    });

    const execCtx = makeExecCtx();
    execCtx.evaluationContext.context.followers = ['a', 'b', 'c'];

    handler.execute(
      {
        collection: 'context.followers',
        item_variable: 'f',
        actions: [{ type: 'LOG', parameters: { message: 'hi' } }],
      },
      execCtx
    );

    expect(opInterpreter.execute).toHaveBeenCalledTimes(3);
    expect(execCtx.evaluationContext.context.f).toBeUndefined(); // variable cleaned up
    expect(logger.warn).not.toHaveBeenCalled();
  });

  test('skips when collection is not an array', () => {
    const logger = makeMockLogger();
    const opInterpreter = { execute: jest.fn() };

    const handler = new ForEachHandler({
      logger,
      operationInterpreter: opInterpreter,
    });
    const execCtx = makeExecCtx();
    execCtx.evaluationContext.context.followers = 42;

    handler.execute(
      {
        collection: 'context.followers',
        item_variable: 'f',
        actions: [{ type: 'NOOP', parameters: {} }],
      },
      execCtx
    );

    expect(opInterpreter.execute).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  test('propagates first nested error & aborts loop', () => {
    const logger = makeMockLogger();
    const opInterpreter = {
      execute: jest
        .fn()
        .mockImplementationOnce(() => {
          throw new Error('boom');
        })
        .mockImplementation(() => {}), // would be second call if loop continued
    };

    const handler = new ForEachHandler({
      logger,
      operationInterpreter: opInterpreter,
    });
    const execCtx = makeExecCtx();
    execCtx.evaluationContext.context.arr = ['x', 'y'];

    expect(() =>
      handler.execute(
        {
          collection: 'context.arr',
          item_variable: 'v',
          actions: [{ type: 'THROW', parameters: {} }],
        },
        execCtx
      )
    ).toThrow('boom');

    expect(opInterpreter.execute).toHaveBeenCalledTimes(1);
  });
});
