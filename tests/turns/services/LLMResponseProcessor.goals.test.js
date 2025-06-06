// tests/turns/services/LLMResponseProcessor.goals.test.js

import { LLMResponseProcessor } from '../../../src/turns/services/LLMResponseProcessor.js';
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
// Import the custom error type to assert against it specifically
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

    mockSchemaValidator = {
      validate: jest.fn((schemaId, data) => {
        if (Object.prototype.hasOwnProperty.call(data, 'goals')) {
          return {
            isValid: false,
            errors: [{ message: 'extra property: goals' }],
          };
        }
        return { isValid: true, errors: [] };
      }),
      isSchemaLoaded: jest.fn(() => true),
    };

    processor = new LLMResponseProcessor({
      schemaValidator: mockSchemaValidator,
    });
  });

  // FIX: The test is updated to assert that an error is thrown, instead of checking a return value.
  test('should warn, then throw a validation error if "goals" property is present', async () => {
    const actorId = 'actor-123';
    const payloadWithGoals = JSON.stringify({
      actionDefinitionId: 'core:wait',
      commandString: 'wait',
      speech: '',
      goals: [{ text: 'newGoal', timestamp: '2025-06-05T12:00:00Z' }],
      thoughts: 'This is a test thought.',
    });

    // 1. Assert that the promise rejects with the correct error type
    await expect(
      processor.processResponse(payloadWithGoals, actorId, mockLogger)
    ).rejects.toThrow(LLMProcessingError);

    // 2. Assert: A specific warning for 'goals' was logged before the error was thrown.
    expect(mockLogger.warn).toHaveBeenCalledTimes(1);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      `LLMResponseProcessor: LLM for actor ${actorId} attempted to return goals; ignoring.`
    );

    // 3. To inspect the error's details, we can use a try/catch block
    try {
      await processor.processResponse(payloadWithGoals, actorId, mockLogger);
    } catch (e) {
      // 4. Assert: The error has the correct context and includes validation details.
      expect(e.details.errorContext).toBe('json_schema_validation_error');
      expect(e.details.validationErrors).toBeDefined();
      expect(e.details.validationErrors[0].message).toContain(
        'extra property: goals'
      );
    }
  });
});
