import { describe, beforeEach, test, expect, jest } from '@jest/globals';

jest.mock('../../../../src/logic/actionSequence.js', () => ({
  executeActionSequence: jest.fn(),
}));

import { executeActionSequence } from '../../../../src/logic/actionSequence.js';
import { handleForEach } from '../../../../src/logic/flowHandlers/forEachHandler.js';

const logger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
const interpreter = { execute: jest.fn() };
const jsonLogic = {};
const baseCtx = { evaluationContext: { context: {} } };

describe('handleForEach', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('iterates over collection and executes actions for each item', async () => {
    const ctx = { evaluationContext: { items: [1, 2], context: {} } };
    const node = {
      parameters: {
        collection: 'items',
        item_variable: 'i',
        actions: [{ type: 'LOG' }],
      },
    };
    const captured = [];
    executeActionSequence.mockImplementation((a, c) => {
      captured.push(c.evaluationContext.context.i);
    });
    await handleForEach(
      node,
      { ...ctx, jsonLogic, scopeLabel: 'Loop' },
      logger,
      interpreter,
      executeActionSequence
    );
    expect(executeActionSequence).toHaveBeenCalledTimes(2);
    expect(captured).toEqual([1, 2]);
    expect(executeActionSequence.mock.calls[0][1].scopeLabel).toBe(
      'Loop > Item 1/2'
    );
    expect(executeActionSequence.mock.calls[1][1].scopeLabel).toBe(
      'Loop > Item 2/2'
    );
    expect(ctx.evaluationContext.context.i).toBeUndefined();
  });

  test('logs warning and skips when parameters invalid', async () => {
    const node = { parameters: {} };
    await handleForEach(
      node,
      { ...baseCtx, jsonLogic, scopeLabel: 'Loop' },
      logger,
      interpreter,
      executeActionSequence
    );
    expect(logger.warn).toHaveBeenCalled();
    expect(executeActionSequence).not.toHaveBeenCalled();
  });
});
