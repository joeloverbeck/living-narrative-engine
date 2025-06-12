/**
 * @file Test suite that covers goals-related behavior for LLMResponseProcessor.
 * @see tests/turns/services/LLMResponseProcessor.goals.test.js
 */

import { LLMResponseProcessor } from '../../../src/turns/services/LLMResponseProcessor.js';
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { LLMProcessingError } from '../../../src/turns/services/LLMResponseProcessor.js';

describe('LLMResponseProcessor – Handling of disallowed properties', () => {
  let mockLogger;
  let mockSchemaValidator;
  let processor;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // This mock simulates a schema validator that fails if it sees a "goals" property.
    mockSchemaValidator = {
      validate: jest.fn((schemaId, data) => {
        if (Object.prototype.hasOwnProperty.call(data, 'goals')) {
          return {
            isValid: false,
            errors: [{ message: "Disallowed extra property: 'goals'" }],
          };
        }
        return { isValid: true, errors: [] };
      }),
      isSchemaLoaded: jest.fn(() => true),
    };

    processor = new LLMResponseProcessor({
      schemaValidator: mockSchemaValidator,
      logger: mockLogger,
    });
  });

  test('should throw a validation error if a disallowed property like "goals" is present', async () => {
    const actorId = 'actor-123';
    const payloadWithGoals = {
      chosenIndex: 1,
      speech: '',
      thoughts: 'This is a test thought.',
      goals: [{ text: 'newGoal' }], // The disallowed property
    };
    const jsonPayload = JSON.stringify(payloadWithGoals);

    // 1. Assert that the promise rejects with the correct error type.
    await expect(
      processor.processResponse(jsonPayload, actorId)
    ).rejects.toThrow(LLMProcessingError);

    // 2. Assert: NO specific warning for 'goals' should be logged. This behavior was removed.
    expect(mockLogger.warn).not.toHaveBeenCalled();

    // 3. Assert: An ERROR for the schema failure should be logged.
    // We must run the method again to inspect the logger, as `rejects` consumes the error.
    await processor.processResponse(jsonPayload, actorId).catch(() => {});
    expect(mockLogger.error).toHaveBeenCalledWith(
      `LLMResponseProcessor: schema invalid for actor ${actorId}`,
      {
        errors: [{ message: "Disallowed extra property: 'goals'" }],
        parsed: payloadWithGoals,
      }
    );

    // 4. To inspect the error's details, we can use a try/catch block.
    try {
      await processor.processResponse(jsonPayload, actorId);
    } catch (e) {
      // 5. Assert: The error details contain the validation errors from the schema validator.
      expect(e.details).toBeDefined();
      expect(e.details.validationErrors).toBeDefined();
      expect(e.details.validationErrors[0].message).toContain(
        "Disallowed extra property: 'goals'"
      );
      // Assert that obsolete properties are not present.
      expect(e.details.errorContext).toBeUndefined();
    }
  });
});
