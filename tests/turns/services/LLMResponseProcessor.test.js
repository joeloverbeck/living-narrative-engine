// --- FILE START: tests/turns/services/LLMResponseProcessor.test.js ---

import { LLMResponseProcessor } from '../../../src/turns/services/LLMResponseProcessor.js';
import { LLM_TURN_ACTION_RESPONSE_SCHEMA_ID } from '../../../src/turns/schemas/llmOutputSchemas.js';
import { jest, describe, beforeEach, test, expect } from '@jest/globals';

/**
 * Creates a mocked logger object for testing.
 *
 * @returns {jest.Mocked<import('../../../src/interfaces/coreServices.js').ILogger>}
 */
const mockLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

/**
 * Creates a mocked schema validator for testing.
 *
 * @returns {jest.Mocked<import('../../../src/interfaces/coreServices.js').ISchemaValidator>}
 */
const mockSchemaValidator = () => ({
  validate: jest.fn().mockReturnValue({ isValid: true, errors: [] }), // Default to valid
  isSchemaLoaded: jest.fn().mockReturnValue(true), // Default: schema is loaded
});

describe('LLMResponseProcessor', () => {
  /** @type {LLMResponseProcessor} */
  let processor;
  /** @type {ReturnType<typeof mockLogger>} */
  let logger;
  /** @type {ReturnType<typeof mockSchemaValidator>} */
  let schemaValidatorMock;
  const actorId = 'testActor123';

  beforeEach(() => {
    jest.clearAllMocks();
    logger = mockLogger();
    schemaValidatorMock = mockSchemaValidator();
    processor = new LLMResponseProcessor({
      schemaValidator: schemaValidatorMock,
    });
  });

  describe('constructor', () => {
    test('should create an instance of LLMResponseProcessor and check schemaLoaded', () => {
      expect(schemaValidatorMock.isSchemaLoaded).toHaveBeenCalledWith(
        LLM_TURN_ACTION_RESPONSE_SCHEMA_ID
      );
      expect(processor).toBeInstanceOf(LLMResponseProcessor);
    });

    test('should throw error if schemaValidator is missing', () => {
      expect(() => new LLMResponseProcessor({})).toThrow(
        "LLMResponseProcessor: Constructor requires a valid ISchemaValidator instance with 'validate' and 'isSchemaLoaded' methods."
      );
    });

    test('should throw error if schemaValidator is invalid (missing validate)', () => {
      const invalidSchemaMock = {
        isSchemaLoaded: jest.fn().mockReturnValue(true),
      };
      expect(
        () => new LLMResponseProcessor({ schemaValidator: invalidSchemaMock })
      ).toThrow(
        "LLMResponseProcessor: Constructor requires a valid ISchemaValidator instance with 'validate' and 'isSchemaLoaded' methods."
      );
    });

    test('should throw error if schemaValidator is invalid (missing isSchemaLoaded)', () => {
      const invalidSchemaMock = {
        validate: jest.fn().mockReturnValue({ isValid: true, errors: [] }),
      };
      expect(
        () => new LLMResponseProcessor({ schemaValidator: invalidSchemaMock })
      ).toThrow(
        "LLMResponseProcessor: Constructor requires a valid ISchemaValidator instance with 'validate' and 'isSchemaLoaded' methods."
      );
    });

    test('should warn if the specific LLM schema is not loaded', () => {
      const consoleWarnSpy = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => {});
      const tempSchemaValidatorMock = mockSchemaValidator();
      tempSchemaValidatorMock.isSchemaLoaded.mockReturnValue(false);

      new LLMResponseProcessor({ schemaValidator: tempSchemaValidatorMock });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        `LLMResponseProcessor: Schema with ID '${LLM_TURN_ACTION_RESPONSE_SCHEMA_ID}' is not loaded in the provided schema validator. Validation will fail.`
      );
      consoleWarnSpy.mockRestore();
    });
  });

  // OBSOLETE: The _createProcessingFallbackAction method has been removed. This entire describe block is deleted.

  describe('processResponse', () => {
    describe('Valid Inputs', () => {
      test('should process a valid JSON string with all fields', async () => {
        const llmResponse = JSON.stringify({
          actionDefinitionId: 'core:move',
          commandString: 'go north',
          speech: 'Moving north',
          thoughts: 'I am moving north.',
          notes: ['Note 1'],
        });
        schemaValidatorMock.validate.mockReturnValue({
          isValid: true,
          errors: [],
        });
        const result = await processor.processResponse(
          llmResponse,
          actorId,
          logger
        );

        expect(result).toEqual({
          success: true,
          action: {
            actionDefinitionId: 'core:move',
            commandString: 'go north',
            speech: 'Moving north',
          },
          extractedData: {
            thoughts: 'I am moving north.',
            notes: ['Note 1'],
          },
        });

        expect(logger.debug).toHaveBeenCalledWith(
          `LLMResponseProcessor: Successfully validated and transformed LLM output for actor ${actorId}. Action: core:move`
        );
        expect(schemaValidatorMock.validate).toHaveBeenCalledWith(
          LLM_TURN_ACTION_RESPONSE_SCHEMA_ID,
          JSON.parse(llmResponse)
        );
      });

      test('should process valid JSON with empty speech', async () => {
        const llmResponse = JSON.stringify({
          actionDefinitionId: 'core:wait',
          commandString: 'Wait a moment',
          speech: '',
          thoughts: 'I will wait.',
        });
        const result = await processor.processResponse(
          llmResponse,
          actorId,
          logger
        );
        expect(result.action.speech).toBe('');
      });

      test('should trim actionDefinitionId and commandString', async () => {
        const llmResponse = JSON.stringify({
          actionDefinitionId: '  core:interact  ',
          commandString: '  pull the lever   ',
          speech: 'Okay',
          thoughts: 'Here I go.',
        });
        const result = await processor.processResponse(
          llmResponse,
          actorId,
          logger
        );
        expect(result.action.actionDefinitionId).toBe('core:interact');
        expect(result.action.commandString).toBe('pull the lever');
      });
    });

    describe('Invalid/Malformed JSON Inputs', () => {
      test('should throw LLMProcessingError for malformed JSON string (syntax error)', async () => {
        const malformedJson =
          '{"actionDefinitionId": "core:speak", "commandString": "say Hello"';

        await expect(
          processor.processResponse(malformedJson, actorId, logger)
        ).rejects.toMatchObject({
          name: 'LLMProcessingError',
          message: 'Failed to parse/repair LLM JSON response',
          details: {
            errorContext: 'json_parse_error',
            rawLlmResponse: malformedJson,
          },
        });
      });

      test('should throw LLMProcessingError for llmJsonResponse being null', async () => {
        await expect(
          processor.processResponse(null, actorId, logger)
        ).rejects.toMatchObject({
          name: 'LLMProcessingError',
          message: 'Invalid input type for LLM JSON response',
          details: {
            errorContext: 'invalid_input_type',
            rawLlmResponse: null,
          },
        });
      });

      test('should throw LLMProcessingError for llmJsonResponse being undefined', async () => {
        await expect(
          processor.processResponse(undefined, actorId, logger)
        ).rejects.toMatchObject({
          name: 'LLMProcessingError',
          message: 'Invalid input type for LLM JSON response',
          details: {
            errorContext: 'invalid_input_type',
            rawLlmResponse: undefined,
          },
        });
      });
    });

    describe('Schema Validation Failures', () => {
      // Helper function to test various schema failures that should now throw an error.
      const testSchemaFailureThrows = (
        description,
        llmResponsePartial,
        expectedInstancePath = ''
      ) => {
        test(`should throw LLMProcessingError if ${description}`, async () => {
          let baseLlmObject = {
            actionDefinitionId: 'core:valid',
            commandString: 'valid command',
            speech: 'valid speech',
            thoughts: 'valid thoughts',
          };

          // Adjust the object based on the test case
          if (llmResponsePartial === undefined && expectedInstancePath) {
            delete baseLlmObject[expectedInstancePath];
          } else if (llmResponsePartial !== undefined) {
            baseLlmObject = { ...baseLlmObject, ...llmResponsePartial };
          }

          const llmResponse = JSON.stringify(baseLlmObject);
          const parsedJson = JSON.parse(llmResponse);

          const mockErrors = [
            {
              instancePath:
                expectedInstancePath || Object.keys(llmResponsePartial)[0],
              message: `is invalid for ${description}`,
            },
          ];
          schemaValidatorMock.validate.mockReturnValueOnce({
            isValid: false,
            errors: mockErrors,
          });

          // Assert that the promise rejects with the correct error details.
          await expect(
            processor.processResponse(llmResponse, actorId, logger)
          ).rejects.toMatchObject({
            name: 'LLMProcessingError',
            message: `LLM response JSON schema validation failed for actor ${actorId}.`,
            details: {
              errorContext: 'json_schema_validation_error',
              rawLlmResponse: llmResponse,
              parsedJsonAttempt: parsedJson,
              validationErrors: mockErrors,
            },
          });
        });
      };

      testSchemaFailureThrows(
        'actionDefinitionId key is missing',
        undefined,
        'actionDefinitionId'
      );
      testSchemaFailureThrows(
        'commandString key is missing',
        undefined,
        'commandString'
      );
      testSchemaFailureThrows('speech key is missing', undefined, 'speech');
      testSchemaFailureThrows(
        'actionDefinitionId is null',
        { actionDefinitionId: null },
        'actionDefinitionId'
      );
      testSchemaFailureThrows(
        'actionDefinitionId is empty string',
        { actionDefinitionId: '' },
        'actionDefinitionId'
      );
      testSchemaFailureThrows(
        'actionDefinitionId is a number',
        { actionDefinitionId: 123 },
        'actionDefinitionId'
      );
      testSchemaFailureThrows(
        'commandString is null',
        { commandString: null },
        'commandString'
      );
      testSchemaFailureThrows(
        'commandString is empty string',
        { commandString: '' },
        'commandString'
      );
      testSchemaFailureThrows('speech is a number', { speech: 123 }, 'speech');
    });
  });
});
