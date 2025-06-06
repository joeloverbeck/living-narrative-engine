/**
 * @file This module does an integration test for the behavior of LLMResponseProcessor.
 * @see tests/integration/LLMResponseProcessor.e2e.test.js
 */

/* eslint-disable jsdoc/check-tag-names */
/**
 * @jest-environment node
 */
/* eslint-enable jsdoc/check-tag-names */
import { describe, beforeEach, test, expect, jest } from '@jest/globals';
import { LLMResponseProcessor } from '../../src/turns/services/LLMResponseProcessor.js';
// The test needs to assert against the specific error type
import { LLMProcessingError } from '../../src/turns/services/LLMResponseProcessor.js';

// Mock dependencies to isolate the SUT (System Under Test)
const makeLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

/**
 * Creates a mock schema validator.
 *
 * @param {boolean} isValid - The desired validation outcome.
 * @returns {import('../../src/interfaces/coreServices.js').ISchemaValidator} A mock validator instance.
 */
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
      actionDefinitionId: 'core:interact',
      commandString: 'talk to Bob',
      speech: 'Hello Bob!',
      thoughts: 'I should greet Bob.',
      notes: ['Note 1', 'Note 2'],
    });

    const result = await processor.processResponse(
      llmJsonResponse,
      'actor-123',
      logger
    );

    // This test correctly assumes the success path returns an object, not a throw.
    expect(result).toEqual({
      success: true,
      action: {
        actionDefinitionId: 'core:interact',
        commandString: 'talk to Bob',
        speech: 'Hello Bob!',
      },
      extractedData: {
        thoughts: 'I should greet Bob.',
        notes: ['Note 1', 'Note 2'],
      },
    });

    expect(logger.info).toHaveBeenCalledWith(
      'LLMResponseProcessor: Successfully validated and transformed LLM output for actor actor-123. Action: core:interact'
    );
    expect(logger.error).not.toHaveBeenCalled();
  });

  test('should trim whitespace from actionDefinitionId and commandString', async () => {
    const schemaValidator = makeSchemaValidator(true);
    const processor = new LLMResponseProcessor({ schemaValidator });
    const llmJsonResponse = JSON.stringify({
      actionDefinitionId: '  core:wait  ',
      commandString: '  wait  ',
      speech: 'Just waiting.',
      thoughts: 'Time to wait.',
      notes: [],
    });

    const result = await processor.processResponse(
      llmJsonResponse,
      'actor-123',
      logger
    );

    expect(result.success).toBe(true);
    expect(result.action).toEqual({
      actionDefinitionId: 'core:wait',
      commandString: 'wait',
      speech: 'Just waiting.',
    });
  });

  test('should throw a detailed error for a JSON response that fails schema validation', async () => {
    const schemaValidator = makeSchemaValidator(false); // Simulate validation failure
    const processor = new LLMResponseProcessor({ schemaValidator });
    const invalidJson = JSON.stringify({
      speech: 'I am doing something invalid.',
      thoughts: 'This structure is wrong.',
    });
    const actorId = 'actor-123';

    // FIX: Assert that the promise rejects with a specific error type.
    await expect(
      processor.processResponse(invalidJson, actorId, logger)
    ).rejects.toThrow(LLMProcessingError);

    try {
      await processor.processResponse(invalidJson, actorId, logger);
    } catch (e) {
      // FIX: Check properties of the thrown error.
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
    const nonJsonString = 'This is not JSON.';
    const actorId = 'actor-123';

    // FIX: Assert that the promise rejects.
    await expect(
      processor.processResponse(nonJsonString, actorId, logger)
    ).rejects.toThrow(LLMProcessingError);

    try {
      await processor.processResponse(nonJsonString, actorId, logger);
    } catch (e) {
      // FIX: Check properties of the thrown error.
      expect(e.details.errorContext).toBe('json_parse_error');
      expect(e.details.rawLlmResponse).toBe(nonJsonString);
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
      actionDefinitionId: 'core:wait',
      commandString: 'wait',
      speech: '',
      thoughts: 'I should not be setting goals.',
      notes: [],
      goals: ['This should be ignored'],
    });

    const result = await processor.processResponse(
      llmJsonResponse,
      actorId,
      logger
    );

    expect(result.success).toBe(true);
    expect(result.action.actionDefinitionId).toBe('core:wait');
    expect(result.extractedData.goals).toBeUndefined();

    // FIX: Update the expected log message to match the SUT's more specific output.
    expect(logger.warn).toHaveBeenCalledWith(
      `LLMResponseProcessor: LLM for actor ${actorId} attempted to return goals; ignoring.`
    );
  });
});
