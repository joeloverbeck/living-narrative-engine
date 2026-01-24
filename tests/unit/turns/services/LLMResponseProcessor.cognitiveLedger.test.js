/**
 * @file Tests for LLMResponseProcessor cognitive_ledger extraction.
 * @see src/turns/services/LLMResponseProcessor.js
 */

import { LLMResponseProcessor, LLMProcessingError } from '../../../../src/turns/services/LLMResponseProcessor.js';
import { LLM_TURN_ACTION_RESPONSE_SCHEMA_V5_ID } from '../../../../src/turns/schemas/llmOutputSchemas.js';
import { LlmJsonService } from '../../../../src/llms/llmJsonService.js';
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

/**
 * Creates a valid cognitive_ledger payload.
 *
 * @param {object} overrides - Fields to override or add.
 * @returns {object} Valid cognitive ledger object.
 */
function createValidCognitiveLedger(overrides = {}) {
  return {
    settled_conclusions: ['We are safe here.', 'The stranger is friendly.'],
    open_questions: ['What is their true motive?'],
    ...overrides,
  };
}

/**
 * Creates a minimal valid response with all required fields including cognitive_ledger.
 *
 * @param {object} overrides - Fields to override or add.
 * @returns {object} Valid response object.
 */
function createValidPayload(overrides = {}) {
  return {
    chosenIndex: 1,
    speech: 'Hello',
    thoughts: 'Internal monologue',
    cognitive_ledger: createValidCognitiveLedger(),
    ...overrides,
  };
}

describe('LLMResponseProcessor - cognitive_ledger extraction', () => {
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

  describe('cognitive_ledger extraction', () => {
    test('extracts cognitive_ledger from valid response', async () => {
      const cognitiveLedger = createValidCognitiveLedger();
      const payload = createValidPayload({ cognitive_ledger: cognitiveLedger });
      const llmResponse = JSON.stringify(payload);
      schemaValidatorMock.validate.mockReturnValue({
        isValid: true,
        errors: [],
      });

      const result = await processor.processResponse(llmResponse, actorId);

      expect(result.extractedData.cognitiveLedger).toEqual(cognitiveLedger);
    });

    test('returns cognitiveLedger: undefined when field is missing (mocked schema validation)', async () => {
      // Simulate a response without cognitive_ledger (schema validator mocked)
      const payload = {
        chosenIndex: 1,
        speech: 'Hello',
        thoughts: 'Normal thoughts',
      };
      const llmResponse = JSON.stringify(payload);
      schemaValidatorMock.validate.mockReturnValue({
        isValid: true,
        errors: [],
      });

      const result = await processor.processResponse(llmResponse, actorId);

      expect(result.extractedData.cognitiveLedger).toBeUndefined();
    });

    test('extracted data includes cognitiveLedger field alongside other fields', async () => {
      const cognitiveLedger = createValidCognitiveLedger();
      const payload = createValidPayload({
        cognitive_ledger: cognitiveLedger,
        notes: [{ text: 'note1', subject: 'test', subjectType: 'entity' }],
      });
      const llmResponse = JSON.stringify(payload);
      schemaValidatorMock.validate.mockReturnValue({
        isValid: true,
        errors: [],
      });

      const result = await processor.processResponse(llmResponse, actorId);

      expect(result.success).toBe(true);
      expect(result.action.chosenIndex).toBe(1);
      expect(result.action.speech).toBe('Hello');
      expect(result.extractedData.thoughts).toBe('Internal monologue');
      expect(result.extractedData.notes).toEqual(payload.notes);
      expect(result.extractedData.cognitiveLedger).toEqual(cognitiveLedger);
    });

    test('logs INFO when cognitive_ledger is extracted', async () => {
      const cognitiveLedger = createValidCognitiveLedger();
      const payload = createValidPayload({ cognitive_ledger: cognitiveLedger });
      const llmResponse = JSON.stringify(payload);
      schemaValidatorMock.validate.mockReturnValue({
        isValid: true,
        errors: [],
      });

      await processor.processResponse(llmResponse, actorId);

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('cognitive_ledger extracted'),
        expect.objectContaining({
          settled_conclusions_count: 2,
          open_questions_count: 1,
        })
      );
    });

    test('logs INFO when NO cognitive_ledger in response', async () => {
      const payload = {
        chosenIndex: 1,
        speech: 'Hello',
        thoughts: 'Normal thoughts',
      };
      const llmResponse = JSON.stringify(payload);
      schemaValidatorMock.validate.mockReturnValue({
        isValid: true,
        errors: [],
      });

      await processor.processResponse(llmResponse, actorId);

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('NO cognitive_ledger')
      );
    });

    test('handles empty arrays in cognitive_ledger', async () => {
      const cognitiveLedger = {
        settled_conclusions: [],
        open_questions: [],
      };
      const payload = createValidPayload({ cognitive_ledger: cognitiveLedger });
      const llmResponse = JSON.stringify(payload);
      schemaValidatorMock.validate.mockReturnValue({
        isValid: true,
        errors: [],
      });

      const result = await processor.processResponse(llmResponse, actorId);

      expect(result.extractedData.cognitiveLedger).toEqual(cognitiveLedger);
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('cognitive_ledger extracted'),
        expect.objectContaining({
          settled_conclusions_count: 0,
          open_questions_count: 0,
        })
      );
    });

    test('handles max items (3) in cognitive_ledger arrays', async () => {
      const cognitiveLedger = {
        settled_conclusions: ['Conclusion 1', 'Conclusion 2', 'Conclusion 3'],
        open_questions: ['Question 1', 'Question 2', 'Question 3'],
      };
      const payload = createValidPayload({ cognitive_ledger: cognitiveLedger });
      const llmResponse = JSON.stringify(payload);
      schemaValidatorMock.validate.mockReturnValue({
        isValid: true,
        errors: [],
      });

      const result = await processor.processResponse(llmResponse, actorId);

      expect(result.extractedData.cognitiveLedger).toEqual(cognitiveLedger);
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('cognitive_ledger extracted'),
        expect.objectContaining({
          settled_conclusions_count: 3,
          open_questions_count: 3,
        })
      );
    });
  });

  describe('schema validation for cognitive_ledger', () => {
    test('invalid cognitive_ledger format fails schema validation', async () => {
      const payload = createValidPayload({
        cognitive_ledger: 'invalid-not-an-object',
      });
      const llmResponse = JSON.stringify(payload);
      const mockErrors = [
        { instancePath: '/cognitive_ledger', message: 'must be object' },
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

    test('missing required cognitive_ledger field fails validation when schema enforces it', async () => {
      const payload = {
        chosenIndex: 1,
        speech: 'Hello',
        thoughts: 'Thinking',
        // cognitive_ledger missing
      };
      const llmResponse = JSON.stringify(payload);
      const mockErrors = [
        { instancePath: '', message: 'missing cognitive_ledger' },
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
