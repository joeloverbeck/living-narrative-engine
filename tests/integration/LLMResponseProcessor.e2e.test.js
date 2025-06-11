// tests/integration/LLMResponseProcessor.e2e.test.js

import { describe, beforeEach, test, expect, jest } from '@jest/globals';
import {
  LLMResponseProcessor,
  LLMProcessingError,
} from '../../src/turns/services/LLMResponseProcessor.js';

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
    errors: isValid ? null : [{ error: 'mock validation error' }],
  }),
  isSchemaLoaded: jest.fn().mockReturnValue(true),
});

describe('LLMResponseProcessor', () => {
  let logger;

  beforeEach(() => {
    logger = makeLogger();
  });

  test('should return success and extracted data for a valid JSON response', async () => {
    const schemaValidator = makeSchemaValidator(true);
    const processor = new LLMResponseProcessor({ schemaValidator });
    const llmJsonResponse = JSON.stringify({
      chosenIndex: 4,
      speech: 'Hello Bob!',
      thoughts: 'I should greet Bob.',
      notes: ['Note 1', 'Note 2'],
    });

    const result = await processor.processResponse(
      llmJsonResponse,
      'actor-123',
      logger
    );

    expect(result).toEqual({
      success: true,
      action: {
        actionDefinitionId: '4',
        commandString: '',
        speech: 'Hello Bob!',
      },
      extractedData: {
        thoughts: 'I should greet Bob.',
        notes: ['Note 1', 'Note 2'],
      },
    });

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        'LLMResponseProcessor: Validated LLM output for actor actor-123. Chosen ID: 4'
      )
    );
    expect(logger.error).not.toHaveBeenCalled();
  });

  test('should map chosenIndex to string and set empty commandString', async () => {
    const schemaValidator = makeSchemaValidator(true);
    const processor = new LLMResponseProcessor({ schemaValidator });
    const llmJsonResponse = JSON.stringify({
      chosenIndex: 7,
      speech: 'Just waiting.',
      thoughts: 'Time to wait.',
    });

    const result = await processor.processResponse(
      llmJsonResponse,
      'actor-123',
      logger
    );

    expect(result.success).toBe(true);
    expect(result.action).toEqual({
      actionDefinitionId: '7',
      commandString: '',
      speech: 'Just waiting.',
    });
  });

  test('should throw a detailed error for a JSON response that fails schema validation', async () => {
    const schemaValidator = makeSchemaValidator(false);
    const processor = new LLMResponseProcessor({ schemaValidator });
    const invalidJson = JSON.stringify({
      speech: 'Invalid structure',
      thoughts: 'Missing chosenIndex',
    });
    const actorId = 'actor-123';

    await expect(
      processor.processResponse(invalidJson, actorId, logger)
    ).rejects.toThrow(LLMProcessingError);

    try {
      await processor.processResponse(invalidJson, actorId, logger);
    } catch (e) {
      expect(e.details.errorContext).toBe('json_schema_validation_error');
      expect(e.details.rawLlmResponse).toBe(invalidJson);
      expect(e.details.validationErrors).toBeDefined();
    }

    expect(logger.error).toHaveBeenCalledWith(
      `LLMResponseProcessor: LLM response JSON schema validation failed for actor ${actorId}.`,
      expect.any(Object)
    );
  });

  test('should throw a detailed error for a non-JSON string', async () => {
    const schemaValidator = makeSchemaValidator(true);
    const processor = new LLMResponseProcessor({ schemaValidator });
    const nonJson = 'Not JSON';
    const actorId = 'actor-123';

    await expect(
      processor.processResponse(nonJson, actorId, logger)
    ).rejects.toThrow(LLMProcessingError);

    try {
      await processor.processResponse(nonJson, actorId, logger);
    } catch (e) {
      expect(e.details.errorContext).toBe('json_parse_error');
      expect(e.details.rawLlmResponse).toBe(nonJson);
    }

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        `LLMResponseProcessor: Failed to parse/repair LLM JSON response for actor ${actorId}`
      ),
      expect.any(Object)
    );
  });

  test('should ignore "goals" property in the response and still succeed', async () => {
    const schemaValidator = makeSchemaValidator(true);
    const processor = new LLMResponseProcessor({ schemaValidator });
    const actorId = 'actor-123';
    const llmJsonResponse = JSON.stringify({
      chosenIndex: 3,
      speech: '',
      thoughts: 'No goals here.',
      notes: [],
      goals: ['Ignored'],
    });

    const result = await processor.processResponse(
      llmJsonResponse,
      actorId,
      logger
    );

    expect(result.success).toBe(true);
    expect(result.action.actionDefinitionId).toBe('3');
    expect(result.extractedData.goals).toBeUndefined();

    expect(logger.warn).toHaveBeenCalledWith(
      `LLMResponseProcessor: LLM for actor ${actorId} attempted to return goals; ignoring.`
    );
  });
});
