/**
 * @file Test suite for LLMResponseProcessor.
 * @see tests/turns/services/LLMResponseProcessor.test.js
 */

import { LLMResponseProcessor } from '../../../src/turns/services/LLMResponseProcessor.js';
import { LLM_TURN_ACTION_RESPONSE_SCHEMA_ID } from '../../../src/turns/schemas/llmOutputSchemas.js';
import { jest, describe, beforeEach, test, expect } from '@jest/globals';
import { LLMProcessingError } from '../../../src/turns/services/LLMResponseProcessor.js';

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

describe('LLMResponseProcessor', () => {
  let processor;
  let logger;
  let schemaValidatorMock;
  const actorId = 'testActor123';

  beforeEach(() => {
    jest.clearAllMocks();
    logger = mockLogger();
    schemaValidatorMock = mockSchemaValidator();
    processor = new LLMResponseProcessor({
      schemaValidator: schemaValidatorMock,
      logger,
    });
  });

  describe('constructor', () => {
    test('should check schemaLoaded on init', () => {
      expect(schemaValidatorMock.isSchemaLoaded).toHaveBeenCalledWith(
        LLM_TURN_ACTION_RESPONSE_SCHEMA_ID
      );
    });

    test('throws if invalid dependencies are provided', () => {
      const aLogger = mockLogger();
      // Test with missing schemaValidator
      expect(() => new LLMResponseProcessor({ logger: aLogger })).toThrow(
        'LLMResponseProcessor needs a valid ISchemaValidator'
      );

      // Test with partially implemented schemaValidator (missing isSchemaLoaded)
      expect(
        () =>
          new LLMResponseProcessor({
            schemaValidator: { validate: () => {} },
            logger: aLogger,
          })
      ).toThrow('LLMResponseProcessor needs a valid ISchemaValidator');

      // Test with missing logger
      expect(
        () => new LLMResponseProcessor({ schemaValidator: schemaValidatorMock })
      ).toThrow('LLMResponseProcessor needs a valid ILogger');
    });
  });

  describe('processResponse', () => {
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
          LLM_TURN_ACTION_RESPONSE_SCHEMA_ID,
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
  });
});
