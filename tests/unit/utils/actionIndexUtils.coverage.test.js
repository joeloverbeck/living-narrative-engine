import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';
import { assertValidActionIndex } from '../../../src/utils/actionIndexUtils.js';
import { safeDispatchError } from '../../../src/utils/safeDispatchErrorUtils.js';
import { ActionIndexValidationError } from '../../../src/errors/actionIndexValidationError.js';

jest.mock('../../../src/utils/safeDispatchErrorUtils.js', () => ({
  __esModule: true,
  safeDispatchError: jest.fn(),
}));

/**
 * Creates a mock logger for testing
 *
 * @returns {object} Mock logger with jest.fn() methods
 */
function createLogger() {
  return {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };
}

describe('assertValidActionIndex', () => {
  let dispatcher;
  let logger;

  beforeEach(() => {
    dispatcher = { dispatch: jest.fn() };
    logger = createLogger();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('dispatches and throws when chosen index is not an integer', async () => {
    await expect(
      assertValidActionIndex(1.2, 4, 'provider', 'actor-1', dispatcher, logger)
    ).rejects.toThrow('Could not resolve the chosen action to a valid index.');

    expect(safeDispatchError).toHaveBeenCalledTimes(1);
    expect(safeDispatchError).toHaveBeenCalledWith(
      dispatcher,
      "provider: Did not receive a valid integer 'chosenIndex' for actor actor-1.",
      {},
      logger
    );
  });

  it('dispatches with merged debug data when index is outside bounds', async () => {
    const debugData = { reason: 'too-high' };

    await expect(
      assertValidActionIndex(
        5,
        3,
        'provider',
        'actor-2',
        dispatcher,
        logger,
        debugData
      )
    ).rejects.toThrow(
      'Player chose an index that does not exist for this turn.'
    );

    expect(safeDispatchError).toHaveBeenCalledTimes(1);
    const [, , details] = safeDispatchError.mock.calls[0];
    expect(details).toEqual({ reason: 'too-high', actionsCount: 3 });
    expect(details).not.toBe(debugData);
    expect(debugData).toEqual({ reason: 'too-high' });
  });

  it('returns silently when the index is valid', async () => {
    await expect(
      assertValidActionIndex(2, 5, 'provider', 'actor-3', dispatcher, logger)
    ).resolves.not.toThrow();

    expect(safeDispatchError).not.toHaveBeenCalled();
  });

  describe('LLM Data Preservation', () => {
    it('should throw ActionIndexValidationError with preserved speech when index is out of bounds', async () => {
      const debugData = {
        result: {
          index: 10,
          speech: 'I should reconsider my approach...',
          thoughts: null,
          notes: null,
        },
      };

      await expect(
        assertValidActionIndex(
          10,
          5,
          'LLMChooser',
          'actor-1',
          dispatcher,
          logger,
          debugData
        )
      ).rejects.toThrow(ActionIndexValidationError);

      // Verify error properties separately to avoid conditional expects
      const errorPromise = assertValidActionIndex(
        10,
        5,
        'LLMChooser',
        'actor-1',
        dispatcher,
        logger,
        debugData
      );
      await expect(errorPromise).rejects.toMatchObject({
        llmData: {
          speech: 'I should reconsider my approach...',
          thoughts: null,
          notes: null,
        },
        index: 10,
        actionsLength: 5,
      });
    });

    it('should preserve all LLM data when index is invalid', async () => {
      const debugData = {
        result: {
          index: 7,
          speech: 'Character speech',
          thoughts: 'Internal thoughts',
          notes: [{ key: 'memory', value: 'important' }],
        },
      };

      await expect(
        assertValidActionIndex(
          7,
          3,
          'LLMChooser',
          'actor-2',
          dispatcher,
          logger,
          debugData
        )
      ).rejects.toMatchObject({
        llmData: {
          speech: 'Character speech',
          thoughts: 'Internal thoughts',
          notes: [{ key: 'memory', value: 'important' }],
        },
      });
    });

    it('should handle missing debugData.result gracefully', async () => {
      const debugData = { someOtherField: 'value' };

      await expect(
        assertValidActionIndex(
          10,
          5,
          'LLMChooser',
          'actor-3',
          dispatcher,
          logger,
          debugData
        )
      ).rejects.toMatchObject({
        llmData: {
          speech: null,
          thoughts: null,
          notes: null,
        },
      });
    });

    it('should handle empty debugData object', async () => {
      await expect(
        assertValidActionIndex(
          8,
          4,
          'LLMChooser',
          'actor-4',
          dispatcher,
          logger,
          {}
        )
      ).rejects.toMatchObject({
        llmData: {
          speech: null,
          thoughts: null,
          notes: null,
        },
      });
    });

    it('should still dispatch error event with preserved data', async () => {
      const debugData = {
        result: {
          index: 6,
          speech: 'Preserved speech',
          thoughts: 'Preserved thoughts',
          notes: [],
        },
      };

      await expect(
        assertValidActionIndex(
          6,
          2,
          'LLMChooser',
          'actor-5',
          dispatcher,
          logger,
          debugData
        )
      ).rejects.toMatchObject({
        llmData: {
          speech: 'Preserved speech',
        },
      });

      // Verify error was dispatched (happens before throw)
      expect(safeDispatchError).toHaveBeenCalledWith(
        dispatcher,
        'LLMChooser: invalid chosenIndex (6) for actor actor-5.',
        { ...debugData, actionsCount: 2 },
        logger
      );
    });

    it('should preserve partial LLM data', async () => {
      const debugData = {
        result: {
          index: 5,
          speech: null,
          thoughts: 'Only thoughts here',
          notes: null,
        },
      };

      await expect(
        assertValidActionIndex(
          5,
          2,
          'LLMChooser',
          'actor-6',
          dispatcher,
          logger,
          debugData
        )
      ).rejects.toMatchObject({
        llmData: {
          speech: null,
          thoughts: 'Only thoughts here',
          notes: null,
        },
      });
    });
  });
});
