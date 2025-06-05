// tests/turns/services/LLMResponseProcessor.goals.test.js

import { LLMResponseProcessor } from '../../../src/turns/services/LLMResponseProcessor.js';
import { beforeEach, describe, expect, jest, test } from '@jest/globals';

describe('LLMResponseProcessor – “Ignore returned goals” behavior', () => {
  let mockLogger;
  let mockSchemaValidator;
  let mockEntityManager;
  let processor;

  beforeEach(() => {
    // 1. Mock logger with spies
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // 2. Mock schemaValidator: always return isValid: false
    mockSchemaValidator = {
      validate: jest.fn(() => ({
        isValid: false,
        errors: [{ message: 'extra property: goals' }],
      })),
      isSchemaLoaded: jest.fn(() => true),
    };

    // 3. Prepare a fake actorEntity with a pre-existing core:goals component
    const existingGoals = [
      { text: 'existing', timestamp: '2025-06-05T00:00:00Z' },
    ];
    const actorEntity = {
      id: 'actor-123',
      components: {
        'core:goals': { goals: existingGoals.slice() },
      },
    };

    // 4. Mock entityManager.getEntityInstance to return our actorEntity
    mockEntityManager = {
      getEntityInstance: jest.fn(() => actorEntity),
    };

    // 5. Instantiate the processor
    processor = new LLMResponseProcessor({
      schemaValidator: mockSchemaValidator,
      entityManager: mockEntityManager,
    });

    // Save reference to actorEntity for assertions
    processor._test_actorEntity = actorEntity;
  });

  test('logs a warning and does not mutate core:goals if “goals” is present in the LLM payload', async () => {
    const actorEntity = processor._test_actorEntity;
    const originalGoalsCopy = JSON.parse(
      JSON.stringify(actorEntity.components['core:goals'])
    );

    // 1. Build a JSON string that includes a "goals" array plus required fields to pass parse
    const payloadWithGoals = JSON.stringify({
      actionDefinitionId: 'core:wait',
      commandString: 'wait',
      speech: '',
      goals: [{ text: 'newGoal', timestamp: '2025-06-05T12:00:00Z' }],
    });

    // 2. Call processResponse
    const result = await processor.processResponse(
      payloadWithGoals,
      actorEntity.id,
      mockLogger
    );

    // 3. Assert: logger.warn was called exactly once with the expected message
    expect(mockLogger.warn).toHaveBeenCalledTimes(1);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'LLM attempted to return goals; ignoring.'
    );

    // 4. Assert: actorEntity.components['core:goals'] remains unchanged
    expect(actorEntity.components['core:goals']).toEqual(originalGoalsCopy);

    // 5. Because our schemaValidator always rejects, we expect a fallback wait-action
    expect(result).toHaveProperty('actionDefinitionId', 'core:wait');
    expect(result).toHaveProperty('commandString', 'wait');
    expect(result).toHaveProperty('speech', '');
    // And the fallback action should have an `llmProcessingFailureInfo` property
    expect(result).toHaveProperty('llmProcessingFailureInfo');
    expect(result.llmProcessingFailureInfo.errorContext).toBe(
      'json_schema_validation_error'
    );
  });
});
