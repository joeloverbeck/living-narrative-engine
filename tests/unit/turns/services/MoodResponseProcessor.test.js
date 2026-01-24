/**
 * @file Test suite for MoodResponseProcessor.
 * @see src/turns/services/MoodResponseProcessor.js
 */

import { MoodResponseProcessor } from '../../../../src/turns/services/MoodResponseProcessor.js';
import { LLM_MOOD_UPDATE_RESPONSE_SCHEMA_ID } from '../../../../src/turns/schemas/llmOutputSchemas.js';
import { LlmJsonService } from '../../../../src/llms/llmJsonService.js';
import { LLMProcessingError } from '../../../../src/turns/services/LLMResponseProcessor.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../../src/constants/eventIds.js';
import { jest, describe, beforeEach, test, expect } from '@jest/globals';

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

// Valid mood update fixture (all 14 mood axes)
const validMoodUpdate = {
  valence: 10,
  arousal: -20,
  agency_control: 30,
  threat: -40,
  engagement: 50,
  future_expectancy: -60,
  temporal_orientation: 0,
  self_evaluation: 70,
  affiliation: 0,
  inhibitory_control: 0,
  uncertainty: 0,
  contamination_salience: 0,
  rumination: 0,
  evaluation_pressure: 0,
};

// Valid sexual update fixture
const validSexualUpdate = {
  sex_excitation: 30,
  sex_inhibition: 70,
};

/**
 * Creates a minimal valid mood response payload.
 *
 * @param {object} overrides - Fields to override or add.
 * @returns {object} Valid response object.
 */
function createValidPayload(overrides = {}) {
  return {
    moodUpdate: validMoodUpdate,
    sexualUpdate: validSexualUpdate,
    ...overrides,
  };
}

describe('MoodResponseProcessor', () => {
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
    processor = new MoodResponseProcessor({
      schemaValidator: schemaValidatorMock,
      logger,
      safeEventDispatcher,
      llmJsonService,
    });
  });

  describe('constructor', () => {
    test('should check schemaLoaded on init', () => {
      expect(schemaValidatorMock.isSchemaLoaded).toHaveBeenCalledWith(
        LLM_MOOD_UPDATE_RESPONSE_SCHEMA_ID
      );
    });

    test('throws when the required schema has not been loaded', () => {
      const aLogger = mockLogger();
      const dispatcher = { dispatch: jest.fn() };
      const schemaValidator = {
        validate: jest.fn(),
        isSchemaLoaded: jest.fn(() => false),
      };

      expect(
        () =>
          new MoodResponseProcessor({
            schemaValidator,
            logger: aLogger,
            safeEventDispatcher: dispatcher,
            llmJsonService: new LlmJsonService(),
          })
      ).toThrow(`Schema ${LLM_MOOD_UPDATE_RESPONSE_SCHEMA_ID} not loaded`);
    });

    test('throws if schemaValidator is missing', () => {
      const aLogger = mockLogger();
      const dispatcher = { dispatch: jest.fn() };

      expect(
        () =>
          new MoodResponseProcessor({
            logger: aLogger,
            safeEventDispatcher: dispatcher,
            llmJsonService: new LlmJsonService(),
          })
      ).toThrow('MoodResponseProcessor needs a valid ISchemaValidator');
    });

    test('throws if schemaValidator lacks validate method', () => {
      const aLogger = mockLogger();
      const dispatcher = { dispatch: jest.fn() };

      expect(
        () =>
          new MoodResponseProcessor({
            schemaValidator: { isSchemaLoaded: () => true },
            logger: aLogger,
            safeEventDispatcher: dispatcher,
            llmJsonService: new LlmJsonService(),
          })
      ).toThrow('MoodResponseProcessor needs a valid ISchemaValidator');
    });

    test('throws if schemaValidator lacks isSchemaLoaded method', () => {
      const aLogger = mockLogger();
      const dispatcher = { dispatch: jest.fn() };

      expect(
        () =>
          new MoodResponseProcessor({
            schemaValidator: { validate: () => {} },
            logger: aLogger,
            safeEventDispatcher: dispatcher,
            llmJsonService: new LlmJsonService(),
          })
      ).toThrow('MoodResponseProcessor needs a valid ISchemaValidator');
    });

    test('throws if logger is missing', () => {
      const dispatcher = { dispatch: jest.fn() };

      expect(
        () =>
          new MoodResponseProcessor({
            schemaValidator: schemaValidatorMock,
            safeEventDispatcher: dispatcher,
            llmJsonService: new LlmJsonService(),
          })
      ).toThrow('MoodResponseProcessor needs a valid ILogger');
    });

    test('throws if safeEventDispatcher is missing', () => {
      const aLogger = mockLogger();

      expect(
        () =>
          new MoodResponseProcessor({
            schemaValidator: schemaValidatorMock,
            logger: aLogger,
            llmJsonService: new LlmJsonService(),
          })
      ).toThrow('MoodResponseProcessor requires a valid ISafeEventDispatcher');
    });

    test('throws if safeEventDispatcher lacks dispatch method', () => {
      const aLogger = mockLogger();

      expect(
        () =>
          new MoodResponseProcessor({
            schemaValidator: schemaValidatorMock,
            logger: aLogger,
            safeEventDispatcher: {},
            llmJsonService: new LlmJsonService(),
          })
      ).toThrow('MoodResponseProcessor requires a valid ISafeEventDispatcher');
    });

    test('throws if llmJsonService is missing', () => {
      const aLogger = mockLogger();
      const dispatcher = { dispatch: jest.fn() };

      expect(
        () =>
          new MoodResponseProcessor({
            schemaValidator: schemaValidatorMock,
            logger: aLogger,
            safeEventDispatcher: dispatcher,
          })
      ).toThrow('MoodResponseProcessor requires a valid LlmJsonService');
    });

    test('throws if llmJsonService lacks parseAndRepair method', () => {
      const aLogger = mockLogger();
      const dispatcher = { dispatch: jest.fn() };

      expect(
        () =>
          new MoodResponseProcessor({
            schemaValidator: schemaValidatorMock,
            logger: aLogger,
            safeEventDispatcher: dispatcher,
            llmJsonService: {},
          })
      ).toThrow('MoodResponseProcessor requires a valid LlmJsonService');
    });
  });

  describe('processMoodResponse', () => {
    test('dispatches a system error and rethrows when JSON parsing fails', async () => {
      const parseError = new Error('parse exploded');
      parseError.stack = 'stack-trace';
      const llmJsonService = {
        parseAndRepair: jest.fn().mockRejectedValue(parseError),
      };
      const rawResponse = '{"oops":}';

      const schemaValidator = mockSchemaValidator();
      const aLogger = mockLogger();
      const dispatcher = { dispatch: jest.fn() };

      const failingProcessor = new MoodResponseProcessor({
        schemaValidator,
        logger: aLogger,
        safeEventDispatcher: dispatcher,
        llmJsonService,
      });

      await expect(
        failingProcessor.processMoodResponse(rawResponse, actorId)
      ).rejects.toThrow(LLMProcessingError);

      expect(llmJsonService.parseAndRepair).toHaveBeenCalledWith(rawResponse, {
        logger: aLogger,
      });
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: expect.stringContaining(
            'MoodResponseProcessor: JSON could not be parsed for actor'
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
      test('processes valid JSON with moodUpdate and sexualUpdate', async () => {
        const payload = createValidPayload();
        const llmResponse = JSON.stringify(payload);
        schemaValidatorMock.validate.mockReturnValue({
          isValid: true,
          errors: [],
        });

        const result = await processor.processMoodResponse(llmResponse, actorId);

        expect(result).toEqual({
          moodUpdate: validMoodUpdate,
          sexualUpdate: validSexualUpdate,
        });
        expect(schemaValidatorMock.validate).toHaveBeenCalledWith(
          LLM_MOOD_UPDATE_RESPONSE_SCHEMA_ID,
          payload
        );
      });

      test('returns object with exactly moodUpdate and sexualUpdate keys', async () => {
        const payload = createValidPayload();
        const llmResponse = JSON.stringify(payload);
        schemaValidatorMock.validate.mockReturnValue({
          isValid: true,
          errors: [],
        });

        const result = await processor.processMoodResponse(llmResponse, actorId);

        expect(Object.keys(result)).toHaveLength(2);
        expect(result).toHaveProperty('moodUpdate');
        expect(result).toHaveProperty('sexualUpdate');
      });

      test('moodUpdate contains all 14 axes', async () => {
        const payload = createValidPayload();
        const llmResponse = JSON.stringify(payload);
        schemaValidatorMock.validate.mockReturnValue({
          isValid: true,
          errors: [],
        });

        const result = await processor.processMoodResponse(llmResponse, actorId);

        expect(result.moodUpdate).toHaveProperty('valence');
        expect(result.moodUpdate).toHaveProperty('arousal');
        expect(result.moodUpdate).toHaveProperty('agency_control');
        expect(result.moodUpdate).toHaveProperty('threat');
        expect(result.moodUpdate).toHaveProperty('engagement');
        expect(result.moodUpdate).toHaveProperty('future_expectancy');
        expect(result.moodUpdate).toHaveProperty('temporal_orientation');
        expect(result.moodUpdate).toHaveProperty('self_evaluation');
        expect(result.moodUpdate).toHaveProperty('affiliation');
        expect(result.moodUpdate).toHaveProperty('inhibitory_control');
        expect(result.moodUpdate).toHaveProperty('uncertainty');
        expect(result.moodUpdate).toHaveProperty('contamination_salience');
        expect(result.moodUpdate).toHaveProperty('rumination');
        expect(result.moodUpdate).toHaveProperty('evaluation_pressure');
      });

      test('sexualUpdate contains both fields', async () => {
        const payload = createValidPayload();
        const llmResponse = JSON.stringify(payload);
        schemaValidatorMock.validate.mockReturnValue({
          isValid: true,
          errors: [],
        });

        const result = await processor.processMoodResponse(llmResponse, actorId);

        expect(result.sexualUpdate).toHaveProperty('sex_excitation');
        expect(result.sexualUpdate).toHaveProperty('sex_inhibition');
      });
    });

    describe('Invalid/Malformed JSON Inputs', () => {
      test('throws LLMProcessingError for malformed JSON string', async () => {
        const badJson = '{invalid json';
        await expect(
          processor.processMoodResponse(badJson, actorId)
        ).rejects.toThrow(LLMProcessingError);
      });

      test('throws LLMProcessingError for null input', async () => {
        await expect(
          processor.processMoodResponse(null, actorId)
        ).rejects.toThrow(LLMProcessingError);
      });

      test('throws LLMProcessingError for undefined input', async () => {
        await expect(
          processor.processMoodResponse(undefined, actorId)
        ).rejects.toThrow(LLMProcessingError);
      });
    });

    describe('Schema Validation Failures', () => {
      test('throws if moodUpdate missing', async () => {
        const payload = { sexualUpdate: validSexualUpdate };
        const llmResponse = JSON.stringify(payload);
        const mockErrors = [
          { instancePath: '', message: 'missing moodUpdate' },
        ];
        schemaValidatorMock.validate.mockReturnValue({
          isValid: false,
          errors: mockErrors,
        });

        await expect(
          processor.processMoodResponse(llmResponse, actorId)
        ).rejects.toMatchObject({
          name: 'LLMProcessingError',
          message: `Mood response JSON schema validation failed for actor ${actorId}.`,
          details: { validationErrors: mockErrors },
        });
      });

      test('throws if sexualUpdate missing', async () => {
        const payload = { moodUpdate: validMoodUpdate };
        const llmResponse = JSON.stringify(payload);
        const mockErrors = [
          { instancePath: '', message: 'missing sexualUpdate' },
        ];
        schemaValidatorMock.validate.mockReturnValue({
          isValid: false,
          errors: mockErrors,
        });

        await expect(
          processor.processMoodResponse(llmResponse, actorId)
        ).rejects.toMatchObject({
          name: 'LLMProcessingError',
          details: { validationErrors: mockErrors },
        });
      });

      test('dispatches error event when schema validation fails', async () => {
        const payload = { moodUpdate: validMoodUpdate };
        const llmResponse = JSON.stringify(payload);
        const mockErrors = [
          { instancePath: '', message: 'missing sexualUpdate' },
        ];
        schemaValidatorMock.validate.mockReturnValue({
          isValid: false,
          errors: mockErrors,
        });

        await expect(
          processor.processMoodResponse(llmResponse, actorId)
        ).rejects.toThrow(LLMProcessingError);

        expect(safeEventDispatcher.dispatch).toHaveBeenCalledWith(
          SYSTEM_ERROR_OCCURRED_ID,
          expect.objectContaining({
            message: expect.stringContaining(
              'MoodResponseProcessor: schema invalid for actor'
            ),
            details: expect.objectContaining({
              errors: mockErrors,
            }),
          })
        );
      });
    });

    describe('INFO-level logging for mood and sexual updates', () => {
      test('logs INFO for moodUpdate extraction with key values', async () => {
        const payload = createValidPayload();
        const llmResponse = JSON.stringify(payload);
        schemaValidatorMock.validate.mockReturnValue({
          isValid: true,
          errors: [],
        });

        await processor.processMoodResponse(llmResponse, actorId);

        expect(logger.info).toHaveBeenCalledWith(
          expect.stringContaining('moodUpdate extracted'),
          expect.objectContaining({
            valence: validMoodUpdate.valence,
            arousal: validMoodUpdate.arousal,
            threat: validMoodUpdate.threat,
          })
        );
      });

      test('logs INFO for sexualUpdate extraction with key values', async () => {
        const payload = createValidPayload();
        const llmResponse = JSON.stringify(payload);
        schemaValidatorMock.validate.mockReturnValue({
          isValid: true,
          errors: [],
        });

        await processor.processMoodResponse(llmResponse, actorId);

        expect(logger.info).toHaveBeenCalledWith(
          expect.stringContaining('sexualUpdate extracted'),
          expect.objectContaining({
            sex_excitation: validSexualUpdate.sex_excitation,
            sex_inhibition: validSexualUpdate.sex_inhibition,
          })
        );
      });

      test('logs include actorId in messages', async () => {
        const payload = createValidPayload();
        const llmResponse = JSON.stringify(payload);
        schemaValidatorMock.validate.mockReturnValue({
          isValid: true,
          errors: [],
        });

        await processor.processMoodResponse(llmResponse, actorId);

        // Both INFO logs should include the actorId
        const infoCallsWithActorId = logger.info.mock.calls.filter(
          (call) => call[0].includes(actorId)
        );
        expect(infoCallsWithActorId).toHaveLength(2);
      });

      test('logs debug message at start of processing', async () => {
        const payload = createValidPayload();
        const llmResponse = JSON.stringify(payload);
        schemaValidatorMock.validate.mockReturnValue({
          isValid: true,
          errors: [],
        });

        await processor.processMoodResponse(llmResponse, actorId);

        expect(logger.debug).toHaveBeenCalledWith(
          expect.stringContaining('Processing mood response for actor')
        );
      });
    });

    describe('parseAndRepair integration', () => {
      test('calls llmJsonService.parseAndRepair with correct arguments', async () => {
        const llmJsonService = {
          parseAndRepair: jest.fn().mockResolvedValue(createValidPayload()),
        };
        const aLogger = mockLogger();
        const schemaValidator = mockSchemaValidator();
        const dispatcher = { dispatch: jest.fn() };

        const testProcessor = new MoodResponseProcessor({
          schemaValidator,
          logger: aLogger,
          safeEventDispatcher: dispatcher,
          llmJsonService,
        });

        const rawResponse = JSON.stringify(createValidPayload());
        await testProcessor.processMoodResponse(rawResponse, actorId);

        expect(llmJsonService.parseAndRepair).toHaveBeenCalledWith(rawResponse, {
          logger: aLogger,
        });
      });
    });
  });
});
