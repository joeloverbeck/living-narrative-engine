// --- FILE START: tests/turns/services/LLMResponseProcessor.notesGuards.test.js ---

/**
 * @file This module tests notes-related behavior in LLMResponseProcessor.
 * @see tests/turns/services/LLMResponseProcessor.notesGuards.test.js
 */

import { LLMResponseProcessor } from '../../../src/turns/services/LLMResponseProcessor.js';
import { beforeEach, describe, expect, jest, test } from '@jest/globals';

// --- Mocks & Helpers ---

const mockLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const mockSchemaValidator = (isValid = true) => ({
  isSchemaLoaded: jest.fn().mockReturnValue(true),
  validate: jest.fn().mockReturnValue({
    isValid,
    errors: isValid ? [] : [{ message: 'mock schema error' }],
  }),
});

describe('LLMResponseProcessor - notes data extraction', () => {
  let schemaValidatorMock;
  let loggerMock;
  let processor;

  beforeEach(() => {
    loggerMock = mockLogger();
    // The processor only depends on the schema validator. EntityManager is removed.
    schemaValidatorMock = mockSchemaValidator();
    processor = new LLMResponseProcessor({
      schemaValidator: schemaValidatorMock,
    });
  });

  test('When "notes" is present and valid, it is extracted correctly', async () => {
    const actorId = 'actor-123';
    const notesFromLlm = ['New note', 'Another new note'];

    const validJson = {
      actionDefinitionId: 'some:action',
      commandString: 'do something',
      speech: 'hello',
      thoughts: 'thinking...',
      notes: notesFromLlm,
    };

    const jsonString = JSON.stringify(validJson);

    const result = await processor.processResponse(
      jsonString,
      actorId,
      loggerMock
    );

    // Assert the overall structure is successful
    expect(result.success).toBe(true);

    // Assert the action part is correct
    expect(result.action).toEqual({
      actionDefinitionId: 'some:action',
      commandString: 'do something',
      speech: 'hello',
    });

    // Assert that the notes array is extracted exactly as provided.
    // The processor is not responsible for merging or deduplication.
    expect(result.extractedData.notes).toEqual(notesFromLlm);

    // No errors should be logged for a valid response
    expect(loggerMock.error).not.toHaveBeenCalled();
  });

  test('When "notes" key is absent, extractedData.notes is undefined', async () => {
    const actorId = 'actor-456';
    const noNotesJson = {
      actionDefinitionId: 'another:action',
      commandString: 'do something else',
      speech: '',
      thoughts: 'no notes here',
      // "notes" key is absent
    };

    const jsonString = JSON.stringify(noNotesJson);
    const result = await processor.processResponse(
      jsonString,
      actorId,
      loggerMock
    );

    // The operation should still be successful
    expect(result.success).toBe(true);

    // The 'notes' property on the extracted data should be undefined
    expect(result.extractedData.notes).toBeUndefined();

    // No errors should be logged
    expect(loggerMock.error).not.toHaveBeenCalled();
  });

  test('When "notes" is not an array, it fails schema validation by throwing an error', async () => {
    const actorId = 'actor-789';
    // This test now verifies that a schema failure throws a detailed error.
    const mockValidationErrors = [
      { instancePath: '/notes', message: 'must be array' },
    ];
    schemaValidatorMock.validate.mockReturnValue({
      isValid: false,
      errors: mockValidationErrors,
    });

    const invalidNotesJson = {
      actionDefinitionId: 'invalid:action',
      commandString: 'broken',
      speech: '',
      thoughts: 'thoughtless',
      notes: 'not-an-array', // notes is a string, which the schema will reject
    };

    const jsonString = JSON.stringify(invalidNotesJson);

    // Assert that the promise rejects and verify the properties of the thrown error.
    await expect(
      processor.processResponse(jsonString, actorId, loggerMock)
    ).rejects.toMatchObject({
      name: 'LLMProcessingError',
      message: `LLM response JSON schema validation failed for actor ${actorId}.`,
      details: {
        errorContext: 'json_schema_validation_error',
        rawLlmResponse: jsonString,
        parsedJsonAttempt: invalidNotesJson,
        validationErrors: mockValidationErrors,
      },
    });

    // Confirm that the error was logged before being thrown.
    expect(loggerMock.error).toHaveBeenCalledWith(
      `LLMResponseProcessor: LLM response JSON schema validation failed for actor ${actorId}.`,
      expect.any(Object)
    );
  });
});
