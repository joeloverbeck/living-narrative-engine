/**
 * @file Test suite for LLMResponseProcessor.
 * @see tests/turns/services/LLMResponseProcessor.test.js
 */

import { LLMResponseProcessor } from '../../../../src/turns/services/LLMResponseProcessor.js';
import { LLM_TURN_ACTION_RESPONSE_SCHEMA_V5_ID } from '../../../../src/turns/schemas/llmOutputSchemas.js';
import { LlmJsonService } from '../../../../src/llms/llmJsonService.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../../src/constants/eventIds.js';
import { jest, describe, beforeEach, test, expect } from '@jest/globals';
import { LLMProcessingError } from '../../../../src/turns/services/LLMResponseProcessor.js';

// Mocked logger
const mockLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

// Mocked schema validator
const mockSchemaValidator = () => ({
  validate: jest.fn().mockReturnValue({ isValid: true, errors: [] }),
  isSchemaLoaded: jest.fn().mockReturnValue(true),
});

// Common valid fixtures for required fields (moodUpdate and sexualUpdate are now required)
const validMoodUpdate = {
  valence: 10,
  arousal: -20,
  agency_control: 30,
  threat: -40,
  engagement: 50,
  future_expectancy: -60,
  self_evaluation: 70,
};

const validSexualUpdate = {
  sex_excitation: 30,
  sex_inhibition: 70,
};

/**
 * Creates a minimal valid response with all required fields.
 * @param {object} overrides - Fields to override or add.
 * @returns {object} Valid response object.
 */
function createValidPayload(overrides = {}) {
  return {
    chosenIndex: 1,
    speech: 'Hello',
    thoughts: 'Internal monologue',
    moodUpdate: validMoodUpdate,
    sexualUpdate: validSexualUpdate,
    ...overrides,
  };
}

describe('LLMResponseProcessor', () => {
  let processor;
  let logger;
  let schemaValidatorMock;
  let safeEventDispatcher;
  const actorId = 'testActor123';

  beforeEach(() => {
    jest.clearAllMocks();
    logger = mockLogger();
    schemaValidatorMock = mockSchemaValidator();
    safeEventDispatcher = { dispatch: jest.fn() };
    const llmJsonService = new LlmJsonService();
    processor = new LLMResponseProcessor({
      schemaValidator: schemaValidatorMock,
      logger,
      safeEventDispatcher,
      llmJsonService,
    });
  });

  describe('constructor', () => {
    test('should check schemaLoaded on init', () => {
      expect(schemaValidatorMock.isSchemaLoaded).toHaveBeenCalledWith(
        LLM_TURN_ACTION_RESPONSE_SCHEMA_V5_ID
      );
    });

    test('throws when the required schema has not been loaded', () => {
      const logger = mockLogger();
      const safeEventDispatcher = { dispatch: jest.fn() };
      const schemaValidator = {
        validate: jest.fn(),
        isSchemaLoaded: jest.fn(() => false),
      };

      expect(
        () =>
          new LLMResponseProcessor({
            schemaValidator,
            logger,
            safeEventDispatcher,
            llmJsonService: new LlmJsonService(),
          })
      ).toThrow(`Schema ${LLM_TURN_ACTION_RESPONSE_SCHEMA_V5_ID} not loaded`);
    });

    test('throws if invalid dependencies are provided', () => {
      const aLogger = mockLogger();
      const dispatcher = { dispatch: jest.fn() };
      // Test with missing schemaValidator
      expect(
        () =>
          new LLMResponseProcessor({
            logger: aLogger,
            safeEventDispatcher: dispatcher,
            llmJsonService: new LlmJsonService(),
          })
      ).toThrow('LLMResponseProcessor needs a valid ISchemaValidator');

      // Test with partially implemented schemaValidator (missing isSchemaLoaded)
      expect(
        () =>
          new LLMResponseProcessor({
            schemaValidator: { validate: () => {} },
            logger: aLogger,
            safeEventDispatcher: dispatcher,
            llmJsonService: new LlmJsonService(),
          })
      ).toThrow('LLMResponseProcessor needs a valid ISchemaValidator');

      // Test with missing logger
      expect(
        () =>
          new LLMResponseProcessor({
            schemaValidator: schemaValidatorMock,
            safeEventDispatcher: dispatcher,
            llmJsonService: new LlmJsonService(),
          })
      ).toThrow('LLMResponseProcessor needs a valid ILogger');

      // Test with missing safeEventDispatcher
      expect(
        () =>
          new LLMResponseProcessor({
            schemaValidator: schemaValidatorMock,
            logger: aLogger,
            llmJsonService: new LlmJsonService(),
          })
      ).toThrow('LLMResponseProcessor requires a valid ISafeEventDispatcher');

      // Test with missing llmJsonService
      expect(
        () =>
          new LLMResponseProcessor({
            schemaValidator: schemaValidatorMock,
            logger: aLogger,
            safeEventDispatcher: dispatcher,
          })
      ).toThrow('LLMResponseProcessor requires a valid LlmJsonService');
    });
  });

  describe('processResponse', () => {
    test('dispatches a system error and rethrows when JSON parsing fails', async () => {
      const parseError = new Error('parse exploded');
      // Ensure a stable stack string so assertions are predictable
      parseError.stack = 'stack-trace';
      const llmJsonService = {
        parseAndRepair: jest.fn().mockRejectedValue(parseError),
      };
      const rawResponse = '{"oops":}';

      const schemaValidator = mockSchemaValidator();
      const logger = mockLogger();
      const dispatcher = { dispatch: jest.fn() };

      const failingProcessor = new LLMResponseProcessor({
        schemaValidator,
        logger,
        safeEventDispatcher: dispatcher,
        llmJsonService,
      });

      await expect(
        failingProcessor.processResponse(rawResponse, actorId)
      ).rejects.toThrow(LLMProcessingError);

      expect(llmJsonService.parseAndRepair).toHaveBeenCalledWith(rawResponse, {
        logger,
      });
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: expect.stringContaining(
            'LLMResponseProcessor: JSON could not be parsed for actor'
          ),
          details: expect.objectContaining({
            actorId,
            rawResponse,
            error: parseError.message,
          }),
        })
      );
    });

    describe('Valid Inputs', () => {
      test('processes valid JSON with chosenIndex, speech, thoughts, and notes', async () => {
        const payload = {
          chosenIndex: 2,
          speech: 'Hello there',
          thoughts: 'Thinking',
          notes: ['NoteA', 'NoteB'],
        };
        const llmResponse = JSON.stringify(payload);
        schemaValidatorMock.validate.mockReturnValue({
          isValid: true,
          errors: [],
        });

        const result = await processor.processResponse(llmResponse, actorId);

        expect(result).toEqual({
          success: true,
          action: {
            chosenIndex: 2,
            speech: 'Hello there',
          },
          extractedData: {
            thoughts: 'Thinking',
            notes: ['NoteA', 'NoteB'],
          },
        });
        expect(schemaValidatorMock.validate).toHaveBeenCalledWith(
          LLM_TURN_ACTION_RESPONSE_SCHEMA_V5_ID,
          payload
        );
      });

      test('processes valid JSON with empty speech and no notes', async () => {
        const payload = { chosenIndex: 5, speech: '', thoughts: 'Ready' };
        const llmResponse = JSON.stringify(payload);
        schemaValidatorMock.validate.mockReturnValue({
          isValid: true,
          errors: [],
        });

        const result = await processor.processResponse(llmResponse, actorId);

        expect(result.action.speech).toBe('');
        expect(result.extractedData.notes).toBeUndefined();
        expect(result.action.chosenIndex).toBe(5);
      });

      test('preserves chosenIndex as number and does not add commandString', async () => {
        const payload = {
          chosenIndex: 7,
          speech: 'Go',
          thoughts: 'Let’s go',
        };
        const llmResponse = JSON.stringify(payload);
        schemaValidatorMock.validate.mockReturnValue({
          isValid: true,
          errors: [],
        });

        const result = await processor.processResponse(llmResponse, actorId);
        expect(result.action.chosenIndex).toBe(7);
        expect(result.action).not.toHaveProperty('actionDefinitionId');
        expect(result.action).not.toHaveProperty('commandString');
      });
    });

    describe('Invalid/Malformed JSON Inputs', () => {
      test('throws LLMProcessingError for malformed JSON string', async () => {
        const badJson = '{invalid json';
        await expect(
          processor.processResponse(badJson, actorId)
        ).rejects.toThrow(LLMProcessingError);
      });

      test('throws LLMProcessingError for null input', async () => {
        await expect(processor.processResponse(null, actorId)).rejects.toThrow(
          LLMProcessingError
        );
      });

      test('throws LLMProcessingError for undefined input', async () => {
        await expect(
          processor.processResponse(undefined, actorId)
        ).rejects.toThrow(LLMProcessingError);
      });
    });

    describe('Schema Validation Failures', () => {
      test('throws if chosenIndex missing', async () => {
        const payload = { speech: 'X', thoughts: 'Y' };
        const llmResponse = JSON.stringify(payload);
        const mockErrors = [
          { instancePath: '', message: 'missing chosenIndex' },
        ];
        schemaValidatorMock.validate.mockReturnValue({
          isValid: false,
          errors: mockErrors,
        });

        await expect(
          processor.processResponse(llmResponse, actorId)
        ).rejects.toMatchObject({
          name: 'LLMProcessingError',
          message: `LLM response JSON schema validation failed for actor ${actorId}.`,
          details: { validationErrors: mockErrors },
        });
      });

      test('throws if speech missing', async () => {
        const payload = { chosenIndex: 1, thoughts: 'Y' };
        const llmResponse = JSON.stringify(payload);
        const mockErrors = [
          { instancePath: '/speech', message: 'missing speech' },
        ];
        schemaValidatorMock.validate.mockReturnValue({
          isValid: false,
          errors: mockErrors,
        });

        await expect(
          processor.processResponse(llmResponse, actorId)
        ).rejects.toMatchObject({
          name: 'LLMProcessingError',
          details: { validationErrors: mockErrors },
        });
      });

      test('throws if thoughts missing', async () => {
        const payload = { chosenIndex: 1, speech: 'X' };
        const llmResponse = JSON.stringify(payload);
        const mockErrors = [
          { instancePath: '/thoughts', message: 'missing thoughts' },
        ];
        schemaValidatorMock.validate.mockReturnValue({
          isValid: false,
          errors: mockErrors,
        });

        await expect(
          processor.processResponse(llmResponse, actorId)
        ).rejects.toMatchObject({
          name: 'LLMProcessingError',
          details: { validationErrors: mockErrors },
        });
      });
    });

    describe('moodUpdate and sexualUpdate extraction', () => {
      // Uses validMoodUpdate and validSexualUpdate fixtures defined at top of file

      test('extracts moodUpdate from valid response', async () => {
        const payload = createValidPayload({ thoughts: 'Feeling good' });
        const llmResponse = JSON.stringify(payload);
        schemaValidatorMock.validate.mockReturnValue({
          isValid: true,
          errors: [],
        });

        const result = await processor.processResponse(llmResponse, actorId);

        expect(result.extractedData.moodUpdate).toEqual(validMoodUpdate);
      });

      test('extracts sexualUpdate from valid response', async () => {
        const payload = createValidPayload({ thoughts: 'Feeling something' });
        const llmResponse = JSON.stringify(payload);
        schemaValidatorMock.validate.mockReturnValue({
          isValid: true,
          errors: [],
        });

        const result = await processor.processResponse(llmResponse, actorId);

        expect(result.extractedData.sexualUpdate).toEqual(validSexualUpdate);
      });

      test('extracts both moodUpdate and sexualUpdate from valid response', async () => {
        const payload = createValidPayload({ thoughts: 'Complex emotional state' });
        const llmResponse = JSON.stringify(payload);
        schemaValidatorMock.validate.mockReturnValue({
          isValid: true,
          errors: [],
        });

        const result = await processor.processResponse(llmResponse, actorId);

        expect(result.extractedData.moodUpdate).toEqual(validMoodUpdate);
        expect(result.extractedData.sexualUpdate).toEqual(validSexualUpdate);
      });

      test('extracts notes alongside mood and sexual updates', async () => {
        const payload = createValidPayload({
          chosenIndex: 3,
          speech: 'Test speech',
          thoughts: 'Test thoughts',
          notes: [{ text: 'note1', subject: 'test', subjectType: 'entity' }],
        });
        const llmResponse = JSON.stringify(payload);
        schemaValidatorMock.validate.mockReturnValue({
          isValid: true,
          errors: [],
        });

        const result = await processor.processResponse(llmResponse, actorId);

        expect(result.success).toBe(true);
        expect(result.action.chosenIndex).toBe(3);
        expect(result.action.speech).toBe('Test speech');
        expect(result.extractedData.thoughts).toBe('Test thoughts');
        expect(result.extractedData.notes).toEqual(payload.notes);
        expect(result.extractedData.moodUpdate).toEqual(validMoodUpdate);
        expect(result.extractedData.sexualUpdate).toEqual(validSexualUpdate);
      });
    });

    describe('INFO-level logging for mood and sexual updates', () => {
      // Uses validMoodUpdate and validSexualUpdate fixtures defined at top of file

      test('logs INFO for moodUpdate extraction when present', async () => {
        const payload = createValidPayload();
        const llmResponse = JSON.stringify(payload);
        schemaValidatorMock.validate.mockReturnValue({
          isValid: true,
          errors: [],
        });

        await processor.processResponse(llmResponse, actorId);

        expect(logger.info).toHaveBeenCalledWith(
          expect.stringContaining('moodUpdate extracted'),
          expect.objectContaining({
            valence: validMoodUpdate.valence,
            arousal: validMoodUpdate.arousal,
            threat: validMoodUpdate.threat,
          })
        );
      });

      test('logs INFO for sexualUpdate extraction when present', async () => {
        const payload = createValidPayload();
        const llmResponse = JSON.stringify(payload);
        schemaValidatorMock.validate.mockReturnValue({
          isValid: true,
          errors: [],
        });

        await processor.processResponse(llmResponse, actorId);

        expect(logger.info).toHaveBeenCalledWith(
          expect.stringContaining('sexualUpdate extracted'),
          expect.objectContaining({
            sex_excitation: validSexualUpdate.sex_excitation,
            sex_inhibition: validSexualUpdate.sex_inhibition,
          })
        );
      });

      test('logs INFO with NO moodUpdate when field is missing in response', async () => {
        // Simulate a response without moodUpdate (schema validator bypassed for unit test)
        const payload = {
          chosenIndex: 1,
          speech: 'Hello',
          thoughts: 'Normal thoughts',
          sexualUpdate: validSexualUpdate,
        };
        const llmResponse = JSON.stringify(payload);
        schemaValidatorMock.validate.mockReturnValue({
          isValid: true,
          errors: [],
        });

        await processor.processResponse(llmResponse, actorId);

        expect(logger.info).toHaveBeenCalledWith(
          expect.stringContaining('NO moodUpdate')
        );
      });

      test('logs INFO with NO sexualUpdate when field is missing in response', async () => {
        // Simulate a response without sexualUpdate (schema validator bypassed for unit test)
        const payload = {
          chosenIndex: 1,
          speech: 'Hello',
          thoughts: 'Normal thoughts',
          moodUpdate: validMoodUpdate,
        };
        const llmResponse = JSON.stringify(payload);
        schemaValidatorMock.validate.mockReturnValue({
          isValid: true,
          errors: [],
        });

        await processor.processResponse(llmResponse, actorId);

        expect(logger.info).toHaveBeenCalledWith(
          expect.stringContaining('NO sexualUpdate')
        );
      });

      test('logs INFO for both fields in a complete response', async () => {
        const payload = createValidPayload();
        const llmResponse = JSON.stringify(payload);
        schemaValidatorMock.validate.mockReturnValue({
          isValid: true,
          errors: [],
        });

        await processor.processResponse(llmResponse, actorId);

        // Should have exactly 2 INFO calls for mood and sexual extraction
        const infoCallsWithExtracted = logger.info.mock.calls.filter(
          (call) =>
            call[0].includes('moodUpdate extracted') ||
            call[0].includes('sexualUpdate extracted')
        );
        expect(infoCallsWithExtracted).toHaveLength(2);
      });
    });
  });
});
