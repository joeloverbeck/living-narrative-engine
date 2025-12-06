import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { LlmJsonService } from '../../../src/llms/llmJsonService.js';
import { JsonProcessingError } from '../../../src/utils/jsonRepair.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/systemEventIds.js';

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('LlmJsonService – real module integration', () => {
  let service;
  let logger;
  let dispatcher;

  beforeEach(() => {
    service = new LlmJsonService();
    logger = createLogger();
    dispatcher = { dispatch: jest.fn() };
  });

  it('cleans conversational prefixes and markdown wrappers end-to-end', () => {
    const rawOutput =
      'Sure, here is the JSON:\n```json\n{"status":"ok","count":2}\n```';

    const cleaned = service.clean(rawOutput);

    expect(cleaned).toBe('{"status":"ok","count":2}');
  });

  it('parses cleaned JSON without needing repair and logs success details', async () => {
    const rawResponse =
      'Here is the json: ```json\n{"alpha":true,"values":[1,2]}\n```';

    const result = await service.parseAndRepair(rawResponse, { logger });

    expect(result).toEqual({ alpha: true, values: [1, 2] });
    expect(logger.debug).toHaveBeenCalledWith(
      'parseAndRepair: Successfully parsed JSON on first attempt after cleaning.',
      expect.objectContaining({
        inputLength: rawResponse.length,
        cleanedLength: expect.any(Number),
      })
    );
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('dispatches a structured error when non-string input is provided', async () => {
    await expect(
      service.parseAndRepair(42, { logger, dispatcher })
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
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('logs an error when non-string input is provided without dispatcher', async () => {
    await expect(
      service.parseAndRepair(Symbol('nope'), { logger })
    ).rejects.toThrow(new TypeError("Input 'jsonString' must be a string."));

    expect(logger.error).toHaveBeenCalledWith(
      "parseAndRepair: Input 'jsonString' must be a string. Received type: symbol"
    );
  });

  it('logs and throws when cleaning results in empty content without dispatcher', async () => {
    const emptyPayload = '```json\n   \n```';

    await expect(
      service.parseAndRepair(emptyPayload, { logger })
    ).rejects.toBeInstanceOf(JsonProcessingError);

    expect(logger.error).toHaveBeenCalledWith(
      'parseAndRepair: Cleaned JSON string is null or empty, cannot parse.',
      { originalInput: emptyPayload }
    );
  });

  it('dispatches a system error when cleaning results in empty content', async () => {
    const emptyPayload = '```json\n\n```';

    await expect(
      service.parseAndRepair(emptyPayload, { logger, dispatcher })
    ).rejects.toBeInstanceOf(JsonProcessingError);

    expect(dispatcher.dispatch).toHaveBeenCalledWith(SYSTEM_ERROR_OCCURRED_ID, {
      message:
        'parseAndRepair: Cleaned JSON string is null or empty, cannot parse.',
      details: { originalInput: emptyPayload },
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('repairs malformed JSON, emitting warnings but producing a result', async () => {
    const rawResponse = 'Here is the JSON: {"beta": 1,}';

    const result = await service.parseAndRepair(rawResponse, {
      logger,
      dispatcher,
    });

    expect(result).toEqual({ beta: 1 });
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

  it('dispatches enriched diagnostics when repair cannot recover malformed JSON', async () => {
    const irreparable = '```json\n{invalid}\n```';

    await expect(
      service.parseAndRepair(irreparable, { logger, dispatcher })
    ).rejects.toBeInstanceOf(JsonProcessingError);

    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: expect.stringContaining(
          'Failed to parse JSON even after repair attempt.'
        ),
        details: expect.objectContaining({
          cleanedJsonStringLength: expect.any(Number),
          cleanedJsonPreview: expect.stringContaining('invalid'),
          initialParseError: expect.objectContaining({ name: 'SyntaxError' }),
          repairAndParseError: expect.objectContaining({
            name: expect.any(String),
          }),
        }),
      })
    );
    // Logger.error is handled by dispatcher path, so ensure it was not used.
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('logs repair failure details when no dispatcher is available', async () => {
    const irreparable = '{ "foo": }';

    await expect(
      service.parseAndRepair(irreparable, { logger })
    ).rejects.toBeInstanceOf(JsonProcessingError);

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        'parseAndRepairJson: Failed to parse JSON even after repair attempt.'
      ),
      expect.objectContaining({
        cleanedJsonStringLength: expect.any(Number),
        cleanedJsonPreview: expect.any(String),
        initialParseError: expect.objectContaining({ name: 'SyntaxError' }),
        repairAndParseError: expect.objectContaining({
          name: expect.any(String),
        }),
      })
    );
  });
});
