// src/tests/unit/logic/actionSequence.errorPropagation.test.js

/**
 * @jest-environment node
 */
import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { executeActionSequence } from '../../../src/logic/actionSequence.js';
import { createMockLogger } from '../../common/mockFactories/index.js';

const logger = createMockLogger();

describe('executeActionSequence error propagation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('rethrows errors from operation handlers', async () => {
    const interpreter = {
      execute: jest.fn(() => {
        throw new Error('boom');
      }),
    };

    const actions = [{ type: 'TEST' }, { type: 'SKIP' }];
    const ctx = { evaluationContext: {}, scopeLabel: 'T', jsonLogic: {} };

    await expect(
      executeActionSequence(actions, ctx, logger, interpreter)
    ).rejects.toThrow('boom');

    expect(interpreter.execute).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        '[T - Action 1/2] CRITICAL error during execution of Operation TEST'
      ),
      expect.any(Error)
    );
  });
});
