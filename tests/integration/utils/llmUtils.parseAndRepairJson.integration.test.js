import { describe, it, expect, jest, afterEach } from '@jest/globals';
import { parseAndRepairJson } from '../../../src/utils/llmUtils.js';
import { JsonProcessingError } from '../../../src/utils/jsonRepair.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/systemEventIds.js';

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('parseAndRepairJson integration', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('cleans conversational prefixes, parses JSON, and logs success', async () => {
    const logger = createLogger();

    const rawResponse =
      'Here is the JSON: ```json\n{"status":"ok","values":[1,2]}\n```';

    const result = await parseAndRepairJson(rawResponse, logger);

    expect(result).toEqual({ status: 'ok', values: [1, 2] });
    expect(logger.debug).toHaveBeenCalledWith(
      'parseAndRepairJson: Successfully parsed JSON on first attempt after cleaning.',
      expect.objectContaining({
        inputLength: rawResponse.length,
        cleanedLength: expect.any(Number),
      })
    );
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('dispatches an error when the input is not a string and falls back to console logging', async () => {
    const invalidLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      // Missing debug on purpose to trigger the fallback path in ensureValidLogger.
    };
    const dispatcher = { dispatch: jest.fn() };

    const consoleWarnSpy = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => {});
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    await expect(
      parseAndRepairJson(123, invalidLogger, dispatcher)
    ).rejects.toThrow(new TypeError("Input 'jsonString' must be a string."));

    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: expect.stringContaining(
          "Input 'jsonString' must be a string."
        ),
        details: {},
      })
    );
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'LLMUtils: ',
      expect.stringContaining('An invalid logger instance was provided.')
    );
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('logs a type error directly when no dispatcher is provided', async () => {
    const logger = createLogger();

    await expect(parseAndRepairJson(Symbol('nope'), logger)).rejects.toThrow(
      new TypeError("Input 'jsonString' must be a string.")
    );

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        "parseAndRepairJson: Input 'jsonString' must be a string."
      )
    );
  });

  it('logs and throws when cleaning produces an empty payload without a dispatcher', async () => {
    const logger = createLogger();
    const emptyPayload = '```json\n   \n```';

    await expect(
      parseAndRepairJson(emptyPayload, logger)
    ).rejects.toBeInstanceOf(JsonProcessingError);

    expect(logger.error).toHaveBeenCalledWith(
      'parseAndRepairJson: Cleaned JSON string is null or empty, cannot parse.',
      { originalInput: emptyPayload }
    );
  });

  it('dispatches a structured error when cleaning produces an empty payload', async () => {
    const logger = createLogger();
    const dispatcher = { dispatch: jest.fn() };
    const emptyPayload = '```json\n\n```';

    await expect(
      parseAndRepairJson(emptyPayload, logger, dispatcher)
    ).rejects.toBeInstanceOf(JsonProcessingError);

    expect(dispatcher.dispatch).toHaveBeenCalledWith(SYSTEM_ERROR_OCCURRED_ID, {
      message:
        'parseAndRepairJson: Cleaned JSON string is null or empty, cannot parse.',
      details: { originalInput: emptyPayload },
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('repairs invalid JSON, logs diagnostic warnings, and returns the repaired object', async () => {
    const logger = createLogger();
    const dispatcher = { dispatch: jest.fn() };
    const rawResponse = 'Here is the JSON: {"alpha": 1,}';

    const result = await parseAndRepairJson(rawResponse, logger, dispatcher);

    expect(result).toEqual({ alpha: 1 });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'Initial JSON.parse failed after cleaning. Attempting repair.'
      ),
      expect.objectContaining({
        originalInputLength: rawResponse.length,
        cleanedJsonStringLength: expect.any(Number),
        cleanedJsonPreview: expect.any(String),
        error: expect.objectContaining({ name: 'SyntaxError' }),
      })
    );
    expect(logger.debug).toHaveBeenCalledWith(
      'parseAndRepairJson: Successfully parsed JSON after repair.',
      expect.objectContaining({
        cleanedLength: expect.any(Number),
        repairedLength: expect.any(Number),
      })
    );
    expect(dispatcher.dispatch).not.toHaveBeenCalled();
  });
});
