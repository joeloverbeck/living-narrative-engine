/**
 * Unit tests for schema registration warnings in schemaUtils
 * Tests the specific warning conditions that were causing issues
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  registerSchema,
  registerInlineSchema,
} from '../../../src/utils/schemaUtils.js';

describe('SchemaUtils - Schema Registration Warnings', () => {
  let mockValidator;
  let mockLogger;

  beforeEach(() => {
    mockValidator = {
      isSchemaLoaded: jest.fn(),
      removeSchema: jest.fn(),
      addSchema: jest.fn().mockResolvedValue(undefined),
    };

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
  });

  describe('registerSchema', () => {
    it('should warn when schema already exists and remove it before adding new one', async () => {
      // Arrange
      const schema = { type: 'object' };
      const schemaId = 'test-schema';
      mockValidator.isSchemaLoaded.mockReturnValue(true);

      // Act
      await registerSchema(mockValidator, schema, schemaId, mockLogger);

      // Assert
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Schema 'test-schema' already loaded. Overwriting."
      );
      expect(mockValidator.removeSchema).toHaveBeenCalledWith(schemaId);
      expect(mockValidator.addSchema).toHaveBeenCalledWith(schema, schemaId);
    });

    it('should use custom warning message when provided', async () => {
      // Arrange
      const schema = { type: 'object' };
      const schemaId = 'test-schema';
      const customMessage = 'Custom warning message for schema conflict';
      mockValidator.isSchemaLoaded.mockReturnValue(true);

      // Act
      await registerSchema(
        mockValidator,
        schema,
        schemaId,
        mockLogger,
        customMessage
      );

      // Assert
      expect(mockLogger.warn).toHaveBeenCalledWith(customMessage);
      expect(mockValidator.removeSchema).toHaveBeenCalledWith(schemaId);
      expect(mockValidator.addSchema).toHaveBeenCalledWith(schema, schemaId);
    });

    it('should not warn when schema does not exist', async () => {
      // Arrange
      const schema = { type: 'object' };
      const schemaId = 'new-schema';
      mockValidator.isSchemaLoaded.mockReturnValue(false);

      // Act
      await registerSchema(mockValidator, schema, schemaId, mockLogger);

      // Assert
      expect(mockLogger.warn).not.toHaveBeenCalled();
      expect(mockValidator.removeSchema).not.toHaveBeenCalled();
      expect(mockValidator.addSchema).toHaveBeenCalledWith(schema, schemaId);
    });

    it('should propagate errors from addSchema', async () => {
      // Arrange
      const schema = { type: 'object' };
      const schemaId = 'failing-schema';
      const error = new Error('Schema registration failed');
      mockValidator.isSchemaLoaded.mockReturnValue(false);
      mockValidator.addSchema.mockRejectedValue(error);

      // Act & Assert
      await expect(
        registerSchema(mockValidator, schema, schemaId, mockLogger)
      ).rejects.toThrow('Schema registration failed');
    });
  });

  describe('registerInlineSchema', () => {
    it('should handle successful schema registration with custom messages', async () => {
      // Arrange
      const schema = { type: 'object' };
      const schemaId = 'inline-schema';
      const messages = {
        warnMessage:
          "EventLoader [core]: Payload schema ID 'inline-schema' was already loaded. Overwriting.",
        successDebugMessage:
          "EventLoader [core]: Successfully registered payload schema 'inline-schema'.",
      };
      mockValidator.isSchemaLoaded.mockReturnValue(true);

      // Act
      await registerInlineSchema(
        mockValidator,
        schema,
        schemaId,
        mockLogger,
        messages
      );

      // Assert
      expect(mockLogger.warn).toHaveBeenCalledWith(messages.warnMessage);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        messages.successDebugMessage
      );
      expect(mockValidator.removeSchema).toHaveBeenCalledWith(schemaId);
      expect(mockValidator.addSchema).toHaveBeenCalledWith(schema, schemaId);
    });

    it('should handle registration failure with custom error messages', async () => {
      // Arrange
      const schema = { type: 'object' };
      const schemaId = 'failing-inline-schema';
      const error = new Error('Registration failed');
      const messages = {
        errorLogMessage:
          "EventLoader [core]: CRITICAL - Failed to register payload schema 'failing-inline-schema'.",
        throwErrorMessage:
          "CRITICAL: Failed to register payload schema 'failing-inline-schema'.",
        errorContext: () => ({ modId: 'core', filename: 'test.json' }),
      };

      mockValidator.isSchemaLoaded.mockReturnValue(false);
      mockValidator.addSchema.mockRejectedValue(error);

      // Act & Assert
      await expect(
        registerInlineSchema(
          mockValidator,
          schema,
          schemaId,
          mockLogger,
          messages
        )
      ).rejects.toThrow(messages.throwErrorMessage);

      expect(mockLogger.error).toHaveBeenCalledWith(
        messages.errorLogMessage,
        expect.objectContaining({
          modId: 'core',
          filename: 'test.json',
          error: 'Registration failed',
        }),
        error
      );
    });

    it('should handle registration failure without custom error messages', async () => {
      // Arrange
      const schema = { type: 'object' };
      const schemaId = 'failing-schema';
      const error = new Error('Original error');

      mockValidator.isSchemaLoaded.mockReturnValue(false);
      mockValidator.addSchema.mockRejectedValue(error);

      // Act & Assert
      await expect(
        registerInlineSchema(mockValidator, schema, schemaId, mockLogger)
      ).rejects.toThrow('Original error');

      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should handle context function that throws error', async () => {
      // Arrange
      const schema = { type: 'object' };
      const schemaId = 'context-error-schema';
      const error = new Error('Registration failed');
      const messages = {
        errorLogMessage: 'Context error test',
        errorContext: () => {
          throw new Error('Context function failed');
        },
      };

      mockValidator.isSchemaLoaded.mockReturnValue(false);
      mockValidator.addSchema.mockRejectedValue(error);

      // Act & Assert
      await expect(
        registerInlineSchema(
          mockValidator,
          schema,
          schemaId,
          mockLogger,
          messages
        )
      ).rejects.toThrow('Registration failed');

      // Should still log with minimal context since context function failed
      expect(mockLogger.error).toHaveBeenCalledWith(
        messages.errorLogMessage,
        expect.objectContaining({ error: 'Registration failed' }),
        error
      );
    });
  });
});
