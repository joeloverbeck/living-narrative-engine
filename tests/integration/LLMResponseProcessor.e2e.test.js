/**
 * @file Integration test suite for LLMResponseProcessor.
 * @see tests/integration/LLMResponseProcessor.e2e.test.js
 */

import { describe, beforeEach, test, expect, jest } from '@jest/globals';
import {
  LLMResponseProcessor,
  LLMProcessingError,
} from '../../src/turns/services/LLMResponseProcessor.js';
import { DISPLAY_ERROR_ID } from '../../src/constants/eventIds.js';

// Mocked logger for capturing logs
const makeLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

// Mocked schema validator factory
const makeSchemaValidator = (isValid = true) => ({
  validate: jest.fn().mockReturnValue({
    isValid,
    errors: isValid ? [] : [{ message: 'mock validation error' }],
  }),
  isSchemaLoaded: jest.fn().mockReturnValue(true),
});

describe('LLMResponseProcessor', () => {
  let logger;
  let safeEventDispatcher;
  const actorId = 'actor-123';

  beforeEach(() => {
    logger = makeLogger();
    safeEventDispatcher = { dispatch: jest.fn() };
  });

  test('should return success and extracted data for a valid JSON response', async () => {
    const schemaValidator = makeSchemaValidator(true);
    const processor = new LLMResponseProcessor({
      schemaValidator,
      logger,
      safeEventDispatcher,
    });
    const llmJsonResponse = JSON.stringify({
      chosenIndex: 4,
      speech: 'Hello Bob!',
      thoughts: 'I should greet Bob.',
      notes: ['Note 1', 'Note 2'],
    });

    const result = await processor.processResponse(llmJsonResponse, actorId);

    expect(result).toEqual({
      success: true,
      action: {
        chosenIndex: 4,
        speech: 'Hello Bob!',
      },
      extractedData: {
        thoughts: 'I should greet Bob.',
        notes: ['Note 1', 'Note 2'],
      },
    });

    expect(logger.debug).toHaveBeenCalledWith(
      `LLMResponseProcessor: Validated LLM output for actor ${actorId}. Chosen ID: 4`
    );
    expect(safeEventDispatcher.dispatch).not.toHaveBeenCalled();
  });

  test('should preserve chosenIndex as a number in the action object', async () => {
    const schemaValidator = makeSchemaValidator(true);
    const processor = new LLMResponseProcessor({
      schemaValidator,
      logger,
      safeEventDispatcher,
    });
    const llmJsonResponse = JSON.stringify({
      chosenIndex: 7,
      speech: 'Just waiting.',
      thoughts: 'Time to wait.',
    });

    const result = await processor.processResponse(llmJsonResponse, actorId);

    expect(result.success).toBe(true);
    expect(result.action).toEqual({
      chosenIndex: 7,
      speech: 'Just waiting.',
    });
  });

  test('should throw a detailed error for a JSON response that fails schema validation', async () => {
    const mockErrors = [{ message: 'mock validation error' }];
    const schemaValidator = {
      validate: jest
        .fn()
        .mockReturnValue({ isValid: false, errors: mockErrors }),
      isSchemaLoaded: jest.fn().mockReturnValue(true),
    };
    const processor = new LLMResponseProcessor({
      schemaValidator,
      logger,
      safeEventDispatcher,
    });
    const invalidJson = JSON.stringify({
      speech: 'Invalid structure',
      thoughts: 'Missing chosenIndex',
    });

    await expect(
      processor.processResponse(invalidJson, actorId)
    ).rejects.toThrow(LLMProcessingError);

    await expect(
      processor.processResponse(invalidJson, actorId)
    ).rejects.toMatchObject({
      details: { validationErrors: mockErrors },
    });

    expect(safeEventDispatcher.dispatch).toHaveBeenCalledWith(
      DISPLAY_ERROR_ID,
      {
        message: `LLMResponseProcessor: schema invalid for actor ${actorId}`,
        details: { errors: mockErrors, parsed: JSON.parse(invalidJson) },
      }
    );
  });

  test('should throw a detailed error for a non-JSON string', async () => {
    const schemaValidator = makeSchemaValidator(true);
    const processor = new LLMResponseProcessor({
      schemaValidator,
      logger,
      safeEventDispatcher,
    });
    const nonJson = 'Not JSON';

    await expect(processor.processResponse(nonJson, actorId)).rejects.toThrow(
      LLMProcessingError
    );
    await expect(processor.processResponse(nonJson, actorId)).rejects.toThrow(
      /JSON could not be parsed/
    );

    // Run again to check the logger without the test failing due to the throw
    await processor.processResponse(nonJson, actorId).catch(() => {});

    expect(safeEventDispatcher.dispatch).toHaveBeenCalledWith(
      DISPLAY_ERROR_ID,
      expect.objectContaining({
        message: expect.stringContaining(
          `LLMResponseProcessor: JSON could not be parsed for actor ${actorId}`
        ),
      })
    );
  });

  test('should not extract unknown properties from the response', async () => {
    // This test assumes schema validation is mocked to pass, even with extra properties.
    // A real schema validator with `additionalProperties: false` would fail.
    const schemaValidator = makeSchemaValidator(true);
    const processor = new LLMResponseProcessor({
      schemaValidator,
      logger,
      safeEventDispatcher,
    });
    const llmJsonResponse = JSON.stringify({
      chosenIndex: 3,
      speech: '',
      thoughts: 'This response has extra, unknown properties.',
      notes: [],
      goals: ['This should be ignored by the processor'],
    });

    const result = await processor.processResponse(llmJsonResponse, actorId);

    expect(result.success).toBe(true);
    expect(result.action.chosenIndex).toBe(3);
    // The processor only extracts known properties; `goals` should not be in the result.
    expect(result.extractedData.goals).toBeUndefined();
    // The current implementation does not log a warning for this.
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
