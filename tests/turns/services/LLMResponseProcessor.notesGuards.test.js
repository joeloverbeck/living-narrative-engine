/**
 * @file Tests notes-related behavior in LLMResponseProcessor.
 * @see tests/turns/services/LLMResponseProcessor.notesGuards.test.js
 */

import { LLMResponseProcessor } from '../../../src/turns/services/LLMResponseProcessor.js';
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { LLMProcessingError } from '../../../src/turns/services/LLMResponseProcessor.js';

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
    schemaValidatorMock = mockSchemaValidator();
    processor = new LLMResponseProcessor({
      schemaValidator: schemaValidatorMock,
      logger: loggerMock,
    });
  });

  test('When "notes" is present and valid, it is extracted correctly', async () => {
    const actorId = 'actor-123';
    const notesFromLlm = ['New note', 'Another new note'];

    const validJson = {
      chosenIndex: 99,
      speech: 'hello',
      thoughts: 'thinking...',
      notes: notesFromLlm,
    };

    const jsonString = JSON.stringify(validJson);
    const result = await processor.processResponse(jsonString, actorId);

    // Assert the overall structure is successful
    expect(result.success).toBe(true);

    // Assert the action part is correct
    expect(result.action).toEqual({
      chosenIndex: 99,
      speech: 'hello',
    });

    // Assert that the notes array is extracted exactly as provided.
    expect(result.extractedData.notes).toEqual(notesFromLlm);

    // No errors should be logged for a valid response
    expect(loggerMock.error).not.toHaveBeenCalled();
  });

  test('When "notes" key is absent, extractedData.notes is undefined', async () => {
    const actorId = 'actor-456';
    const noNotesJson = {
      chosenIndex: 42,
      speech: '',
      thoughts: 'no notes here',
      // "notes" key is absent
    };

    const jsonString = JSON.stringify(noNotesJson);
    const result = await processor.processResponse(jsonString, actorId);

    expect(result.success).toBe(true);
    expect(result.extractedData.notes).toBeUndefined();
    expect(loggerMock.error).not.toHaveBeenCalled();
  });

  test('When "notes" is not an array, it fails schema validation by throwing an error', async () => {
    const actorId = 'actor-789';
    const mockValidationErrors = [
      { instancePath: '/notes', message: 'must be array' },
    ];
    schemaValidatorMock.validate.mockReturnValue({
      isValid: false,
      errors: mockValidationErrors,
    });

    const invalidNotesJson = {
      chosenIndex: 7,
      speech: '',
      thoughts: 'thoughtless',
      notes: 'not-an-array',
    };

    const jsonString = JSON.stringify(invalidNotesJson);

    await expect(
      processor.processResponse(jsonString, actorId)
    ).rejects.toMatchObject({
      name: 'LLMProcessingError',
      message: `LLM response JSON schema validation failed for actor ${actorId}.`,
      details: {
        validationErrors: mockValidationErrors,
      },
    });

    // The processor should log the schema validation failure before throwing.
    // We need to run it again because the `expect().rejects` consumes the error.
    await processor.processResponse(jsonString, actorId).catch(() => {});
    expect(loggerMock.error).toHaveBeenCalledWith(
      `LLMResponseProcessor: schema invalid for actor ${actorId}`,
      {
        errors: mockValidationErrors,
        parsed: invalidNotesJson,
      }
    );
  });
});
