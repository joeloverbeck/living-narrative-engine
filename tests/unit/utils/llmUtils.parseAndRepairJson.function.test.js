import { beforeEach, describe, expect, jest, test } from '@jest/globals';

jest.mock('../../../src/utils/loggerUtils.js', () => ({
  ensureValidLogger: jest.fn(),
}));

jest.mock('../../../src/utils/safeDispatchErrorUtils.js', () => ({
  safeDispatchError: jest.fn(),
}));

jest.mock('../../../src/utils/jsonCleaning.js', () => ({
  cleanLLMJsonOutput: jest.fn(),
  CONVERSATIONAL_PREFIXES: [],
}));

jest.mock('../../../src/utils/jsonRepair.js', () => {
  return {
    JsonProcessingError: class JsonProcessingError extends Error {
      constructor(message, details = {}) {
        super(message);
        this.name = 'JsonProcessingError';
        Object.assign(this, details);
      }
    },
    initialParse: jest.fn(),
    repairAndParse: jest.fn(),
  };
});

import {
  parseAndRepairJson,
  JsonProcessingError,
} from '../../../src/utils/llmUtils.js';
import { ensureValidLogger } from '../../../src/utils/loggerUtils.js';
import { safeDispatchError } from '../../../src/utils/safeDispatchErrorUtils.js';
import { cleanLLMJsonOutput } from '../../../src/utils/jsonCleaning.js';
import { initialParse, repairAndParse } from '../../../src/utils/jsonRepair.js';

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('parseAndRepairJson', () => {
  test('throws TypeError for non-string input and dispatches error', async () => {
    const logger = createLogger();
    const dispatcher = { dispatch: jest.fn() };
    ensureValidLogger.mockReturnValue(logger);

    await expect(parseAndRepairJson(null, logger, dispatcher)).rejects.toThrow(
      TypeError
    );

    expect(ensureValidLogger).toHaveBeenCalledWith(logger, 'LLMUtils');
    expect(safeDispatchError).toHaveBeenCalledWith(
      dispatcher,
      expect.stringContaining("Input 'jsonString' must be a string")
    );
    expect(logger.error).not.toHaveBeenCalled();
  });

  test('throws JsonProcessingError when cleaned string is empty', async () => {
    const logger = createLogger();
    ensureValidLogger.mockReturnValue(logger);
    cleanLLMJsonOutput.mockReturnValue('');

    await expect(parseAndRepairJson('   ', logger)).rejects.toBeInstanceOf(
      JsonProcessingError
    );

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Cleaned JSON string is null or empty'),
      { originalInput: '   ' }
    );
    expect(safeDispatchError).not.toHaveBeenCalled();
  });

  test('parses valid JSON without repair', async () => {
    const logger = createLogger();
    ensureValidLogger.mockReturnValue(logger);
    cleanLLMJsonOutput.mockReturnValue('{"a":1}');
    initialParse.mockReturnValue({ a: 1 });

    const result = await parseAndRepairJson('{"a":1}', logger);

    expect(result).toEqual({ a: 1 });
    expect(initialParse).toHaveBeenCalledWith('{"a":1}', logger);
    expect(repairAndParse).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalled();
  });

  test('repairs JSON when initial parse fails', async () => {
    const logger = createLogger();
    const dispatcher = { dispatch: jest.fn() };
    ensureValidLogger.mockReturnValue(logger);
    cleanLLMJsonOutput.mockReturnValue('{"a":1,}');
    const parseError = new SyntaxError('Unexpected token');
    initialParse.mockImplementation(() => {
      throw parseError;
    });
    repairAndParse.mockReturnValue({ a: 1 });

    const result = await parseAndRepairJson('{"a":1,}', logger, dispatcher);

    expect(result).toEqual({ a: 1 });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Initial JSON.parse failed'),
      expect.any(Object)
    );
    expect(repairAndParse).toHaveBeenCalledWith(
      '{"a":1,}',
      logger,
      dispatcher,
      parseError
    );
  });
});
