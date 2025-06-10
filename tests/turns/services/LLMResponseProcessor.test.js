// tests/turns/services/LLMResponseProcessor.test.js

import { LLMResponseProcessor } from '../../../src/turns/services/LLMResponseProcessor.js';
import { LLM_TURN_ACTION_RESPONSE_SCHEMA_ID } from '../../../src/turns/schemas/llmOutputSchemas.js';
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
    });
  });

  describe('constructor', () => {
    test('should check schemaLoaded on init', () => {
      expect(schemaValidatorMock.isSchemaLoaded).toHaveBeenCalledWith(
        LLM_TURN_ACTION_RESPONSE_SCHEMA_ID
      );
    });

    test('throws if invalid schemaValidator', () => {
      expect(() => new LLMResponseProcessor({})).toThrow();
      expect(
        () =>
          new LLMResponseProcessor({
            schemaValidator: {
              validate: () => {},
            },
          })
      ).toThrow();
    });
  });

  describe('processResponse', () => {
    describe('Valid Inputs', () => {
      test('processes valid JSON with chosenActionId, speech, thoughts, and notes', async () => {
        const payload = {
          chosenActionId: 2,
          speech: 'Hello there',
          thoughts: 'Thinking',
          notes: ['NoteA', 'NoteB'],
        };
        const llmResponse = JSON.stringify(payload);
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
            actionDefinitionId: '2',
            commandString: '',
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
        const payload = { chosenActionId: 5, speech: '', thoughts: 'Ready' };
        const llmResponse = JSON.stringify(payload);
        schemaValidatorMock.validate.mockReturnValue({
          isValid: true,
          errors: [],
        });

        const result = await processor.processResponse(
          llmResponse,
          actorId,
          logger
        );

        expect(result.action.speech).toBe('');
        expect(result.extractedData.notes).toBeUndefined();
      });

      test('maps chosenActionId to string and sets empty commandString', async () => {
        const payload = {
          chosenActionId: 7,
          speech: 'Go',
          thoughts: 'Let’s go',
        };
        const llmResponse = JSON.stringify(payload);
        schemaValidatorMock.validate.mockReturnValue({
          isValid: true,
          errors: [],
        });

        const result = await processor.processResponse(
          llmResponse,
          actorId,
          logger
        );
        expect(result.action.actionDefinitionId).toBe('7');
        expect(result.action.commandString).toBe('');
      });
    });

    describe('Invalid/Malformed JSON Inputs', () => {
      test('throws LLMProcessingError for malformed JSON string', async () => {
        const badJson = '{invalid json';
        await expect(
          processor.processResponse(badJson, actorId, logger)
        ).rejects.toMatchObject({ name: 'LLMProcessingError' });
      });

      test('throws LLMProcessingError for null input', async () => {
        await expect(
          processor.processResponse(null, actorId, logger)
        ).rejects.toMatchObject({ name: 'LLMProcessingError' });
      });

      test('throws LLMProcessingError for undefined input', async () => {
        await expect(
          processor.processResponse(undefined, actorId, logger)
        ).rejects.toMatchObject({ name: 'LLMProcessingError' });
      });
    });

    describe('Schema Validation Failures', () => {
      test('throws if chosenActionId missing', async () => {
        const payload = { speech: 'X', thoughts: 'Y' };
        const llmResponse = JSON.stringify(payload);
        const mockErrors = [
          { instancePath: '', message: 'missing chosenActionId' },
        ];
        schemaValidatorMock.validate.mockReturnValue({
          isValid: false,
          errors: mockErrors,
        });

        await expect(
          processor.processResponse(llmResponse, actorId, logger)
        ).rejects.toMatchObject({
          name: 'LLMProcessingError',
          message: `LLM response JSON schema validation failed for actor ${actorId}.`,
          details: { validationErrors: mockErrors },
        });
      });

      test('throws if speech missing', async () => {
        const payload = { chosenActionId: 1, thoughts: 'Y' };
        const llmResponse = JSON.stringify(payload);
        const mockErrors = [
          { instancePath: '/speech', message: 'missing speech' },
        ];
        schemaValidatorMock.validate.mockReturnValue({
          isValid: false,
          errors: mockErrors,
        });

        await expect(
          processor.processResponse(llmResponse, actorId, logger)
        ).rejects.toMatchObject({
          name: 'LLMProcessingError',
          details: { validationErrors: mockErrors },
        });
      });

      test('throws if thoughts missing', async () => {
        const payload = { chosenActionId: 1, speech: 'X' };
        const llmResponse = JSON.stringify(payload);
        const mockErrors = [
          { instancePath: '/thoughts', message: 'missing thoughts' },
        ];
        schemaValidatorMock.validate.mockReturnValue({
          isValid: false,
          errors: mockErrors,
        });

        await expect(
          processor.processResponse(llmResponse, actorId, logger)
        ).rejects.toMatchObject({
          name: 'LLMProcessingError',
          details: { validationErrors: mockErrors },
        });
      });
    });
  });
});
