/**
 * Unit tests for ValidatedEventDispatcher warnings and validation scenarios
 * Focuses on testing the specific warning conditions that were fixed
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import ValidatedEventDispatcher from '../../../src/events/validatedEventDispatcher.js';

describe('ValidatedEventDispatcher - Warnings and Validation', () => {
  let validatedEventDispatcher;
  let mockEventBus;
  let mockGameDataRepository;
  let mockSchemaValidator;
  let mockLogger;

  beforeEach(() => {
    mockEventBus = {
      dispatch: jest.fn().mockResolvedValue(undefined),
    };

    mockGameDataRepository = {
      getEventDefinition: jest.fn(),
    };

    mockSchemaValidator = {
      isSchemaLoaded: jest.fn(),
      validate: jest.fn(),
    };

    mockLogger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    validatedEventDispatcher = new ValidatedEventDispatcher({
      eventBus: mockEventBus,
      gameDataRepository: mockGameDataRepository,
      schemaValidator: mockSchemaValidator,
      logger: mockLogger,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Missing Event Definition Warnings', () => {
    it('should warn when event definition is not found', async () => {
      // Arrange
      mockGameDataRepository.getEventDefinition.mockReturnValue(null);

      // Act
      await validatedEventDispatcher.dispatch('non-existent-event', {});

      // Assert
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "VED: EventDefinition not found for 'non-existent-event'. Cannot validate payload. Proceeding with dispatch."
      );
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        'non-existent-event',
        {}
      );
    });

    it('should not warn when allowSchemaNotFound is true', async () => {
      // Arrange
      mockGameDataRepository.getEventDefinition.mockReturnValue(null);

      // Act
      await validatedEventDispatcher.dispatch(
        'non-existent-event',
        {},
        { allowSchemaNotFound: true }
      );

      // Assert
      expect(mockLogger.warn).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "VED: EventDefinition not found for 'non-existent-event'. Skipping validation as allowed by options."
      );
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        'non-existent-event',
        {}
      );
    });

    it('should warn when event definition exists but schema is not loaded', async () => {
      // Arrange
      const mockEventDef = {
        id: 'test-event',
        payloadSchema: { type: 'object' },
      };
      mockGameDataRepository.getEventDefinition.mockReturnValue(mockEventDef);
      mockSchemaValidator.isSchemaLoaded.mockReturnValue(false);

      // Act
      await validatedEventDispatcher.dispatch('test-event', {});

      // Assert
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "VED: Payload schema 'test-event#payload' not found/loaded for event 'test-event'. Skipping validation and proceeding with dispatch."
      );
      expect(mockEventBus.dispatch).toHaveBeenCalledWith('test-event', {});
    });
  });

  describe('Schema Validation Success Cases', () => {
    it('should successfully validate and dispatch core:direction_updated event', async () => {
      // Arrange
      const mockEventDef = {
        id: 'core:direction_updated',
        payloadSchema: {
          type: 'object',
          required: ['directionId', 'field', 'oldValue', 'newValue'],
          properties: {
            directionId: { type: 'string' },
            field: {
              type: 'string',
              enum: [
                'title',
                'description',
                'coreTension',
                'uniqueTwist',
                'narrativePotential',
              ],
            },
            oldValue: { type: 'string' },
            newValue: { type: 'string' },
          },
        },
      };
      const payload = {
        directionId: 'test-123',
        field: 'title',
        oldValue: 'Old',
        newValue: 'New',
      };

      mockGameDataRepository.getEventDefinition.mockReturnValue(mockEventDef);
      mockSchemaValidator.isSchemaLoaded.mockReturnValue(true);
      mockSchemaValidator.validate.mockReturnValue({ isValid: true });

      // Act
      const result = await validatedEventDispatcher.dispatch(
        'core:direction_updated',
        payload
      );

      // Assert
      expect(result).toBe(true);
      expect(mockLogger.warn).not.toHaveBeenCalled();
      expect(mockLogger.error).not.toHaveBeenCalled();
      expect(mockSchemaValidator.validate).toHaveBeenCalledWith(
        'core:direction_updated#payload',
        payload
      );
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        'core:direction_updated',
        payload
      );
    });

    it('should successfully validate and dispatch core:analytics_track event', async () => {
      // Arrange
      const mockEventDef = {
        id: 'core:analytics_track',
        payloadSchema: {
          type: 'object',
          required: ['event', 'properties'],
          properties: {
            event: { type: 'string' },
            properties: { type: 'object' },
          },
        },
      };
      const payload = {
        event: 'thematic_dropdown_interaction',
        properties: {
          action: 'select',
          value: 'test-value',
          timestamp: Date.now(),
        },
      };

      mockGameDataRepository.getEventDefinition.mockReturnValue(mockEventDef);
      mockSchemaValidator.isSchemaLoaded.mockReturnValue(true);
      mockSchemaValidator.validate.mockReturnValue({ isValid: true });

      // Act
      const result = await validatedEventDispatcher.dispatch(
        'core:analytics_track',
        payload
      );

      // Assert
      expect(result).toBe(true);
      expect(mockLogger.warn).not.toHaveBeenCalled();
      expect(mockLogger.error).not.toHaveBeenCalled();
      expect(mockSchemaValidator.validate).toHaveBeenCalledWith(
        'core:analytics_track#payload',
        payload
      );
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        'core:analytics_track',
        payload
      );
    });
  });

  describe('Schema Validation Failure Cases', () => {
    it('should fail validation and not dispatch when payload is invalid', async () => {
      // Arrange
      const mockEventDef = {
        id: 'test-event',
        payloadSchema: { type: 'object', required: ['requiredField'] },
      };
      const payload = { wrongField: 'value' }; // Missing required field

      mockGameDataRepository.getEventDefinition.mockReturnValue(mockEventDef);
      mockSchemaValidator.isSchemaLoaded.mockReturnValue(true);
      mockSchemaValidator.validate.mockReturnValue({
        isValid: false,
        errors: [{ instancePath: '/requiredField', message: 'is required' }],
      });

      // Act
      const result = await validatedEventDispatcher.dispatch(
        'test-event',
        payload
      );

      // Assert
      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        "VED: Payload validation FAILED for event 'test-event'. Dispatch SKIPPED. Errors: [/requiredField]: is required",
        expect.objectContaining({ payload, errors: expect.any(Array) })
      );
      expect(mockEventBus.dispatch).not.toHaveBeenCalled();
    });

    it('should handle validation errors gracefully', async () => {
      // Arrange
      const mockEventDef = {
        id: 'test-event',
        payloadSchema: { type: 'object' },
      };

      mockGameDataRepository.getEventDefinition.mockReturnValue(mockEventDef);
      mockSchemaValidator.isSchemaLoaded.mockReturnValue(true);
      mockSchemaValidator.validate.mockImplementation(() => {
        throw new Error('Validation process failed');
      });

      // Act
      const result = await validatedEventDispatcher.dispatch('test-event', {});

      // Assert
      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        "VED: Unexpected error during payload validation process for event 'test-event'. Dispatch will be skipped.",
        expect.any(Error)
      );
      expect(mockEventBus.dispatch).not.toHaveBeenCalled();
    });
  });

  describe('Schema Registration Tests', () => {
    it('should skip validation when event has no payload schema', async () => {
      // Arrange
      const mockEventDef = {
        id: 'simple-event',
        // No payloadSchema property
      };

      mockGameDataRepository.getEventDefinition.mockReturnValue(mockEventDef);

      // Act
      const result = await validatedEventDispatcher.dispatch(
        'simple-event',
        {}
      );

      // Assert
      expect(result).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "VED: Event definition 'simple-event' found, but no 'payloadSchema' defined. Skipping validation and proceeding with dispatch."
      );
      expect(mockEventBus.dispatch).toHaveBeenCalledWith('simple-event', {});
    });
  });
});
