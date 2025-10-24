/**
 * @file Test suite that covers goals-related behavior for LLMResponseProcessor.
 * @see tests/turns/services/LLMResponseProcessor.goals.test.js
 */

import { LLMResponseProcessor } from '../../../../src/turns/services/LLMResponseProcessor.js';
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { LLMProcessingError } from '../../../../src/turns/services/LLMResponseProcessor.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../../src/constants/eventIds.js';
import { LlmJsonService } from '../../../../src/llms/llmJsonService.js';

describe('LLMResponseProcessor – Handling of disallowed properties', () => {
  let mockLogger;
  let mockSchemaValidator;
  let processor;
  let safeEventDispatcher;

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

    // By default, the safe dispatcher resolves `true` on success. Reflect that
    // real behavior here so we do not trigger the warning path in
    // `safeDispatchError` simply because the mock returned `undefined`.
    safeEventDispatcher = { dispatch: jest.fn(() => true) };
    processor = new LLMResponseProcessor({
      schemaValidator: mockSchemaValidator,
      logger: mockLogger,
      safeEventDispatcher,
      llmJsonService: new LlmJsonService(),
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
    expect(safeEventDispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      {
        message: `LLMResponseProcessor: schema invalid for actor ${actorId}`,
        details: {
          errors: [{ message: "Disallowed extra property: 'goals'" }],
          parsed: payloadWithGoals,
        },
      }
    );

    await expect(
      processor.processResponse(jsonPayload, actorId)
    ).rejects.toMatchObject({
      details: {
        validationErrors: [
          {
            message: expect.stringContaining(
              "Disallowed extra property: 'goals'"
            ),
          },
        ],
      },
    });
  });
});
