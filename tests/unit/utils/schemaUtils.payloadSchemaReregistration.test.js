/**
 * @file Unit tests for payload schema re-registration behavior in schemaUtils
 * @description Tests that payload schemas are logged at debug level when re-registered,
 * while other schemas continue to warn.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { registerSchema } from '../../../src/utils/schemaUtils.js';

describe('registerSchema - Payload Schema Re-registration', () => {
  let mockValidator;
  let mockLogger;
  let debugCalls;
  let warnCalls;

  beforeEach(() => {
    debugCalls = [];
    warnCalls = [];

    mockValidator = {
      isSchemaLoaded: jest.fn(),
      removeSchema: jest.fn(),
      addSchema: jest.fn().mockResolvedValue(undefined),
    };

    mockLogger = {
      debug: jest.fn((msg) => {
        debugCalls.push(msg);
      }),
      warn: jest.fn((msg) => {
        warnCalls.push(msg);
      }),
      info: jest.fn(),
      error: jest.fn(),
    };
  });

  describe('when payload schema is already loaded', () => {
    it('should log at debug level instead of warning', async () => {
      // Arrange
      const schemaId = 'core:direction_deleted#payload';
      const schema = { type: 'object' };
      mockValidator.isSchemaLoaded.mockReturnValue(true);

      // Act
      await registerSchema(mockValidator, schema, schemaId, mockLogger);

      // Assert
      expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(schemaId);
      expect(mockValidator.removeSchema).toHaveBeenCalledWith(schemaId);
      expect(mockValidator.addSchema).toHaveBeenCalledWith(schema, schemaId);

      // Should log at debug level, not warn
      expect(debugCalls.length).toBe(1);
      expect(debugCalls[0]).toContain(schemaId);
      expect(debugCalls[0]).toContain('already loaded from previous session');

      expect(warnCalls.length).toBe(0);
    });

    it('should handle multiple payload schema re-registrations', async () => {
      // Arrange
      const schemas = [
        'core:direction_deleted#payload',
        'core:direction_updated#payload',
        'core:orphans_cleaned#payload',
      ];
      mockValidator.isSchemaLoaded.mockReturnValue(true);

      // Act
      for (const schemaId of schemas) {
        await registerSchema(
          mockValidator,
          { type: 'object' },
          schemaId,
          mockLogger
        );
      }

      // Assert
      expect(debugCalls.length).toBe(3);
      expect(warnCalls.length).toBe(0);

      // All should be debug messages
      debugCalls.forEach((msg) => {
        expect(msg).toContain('#payload');
        expect(msg).toContain('already loaded from previous session');
      });
    });
  });

  describe('when non-payload schema is already loaded', () => {
    it('should warn for regular schema re-registration', async () => {
      // Arrange
      const schemaId = 'core:some_event';
      const schema = { type: 'object' };
      mockValidator.isSchemaLoaded.mockReturnValue(true);

      // Act
      await registerSchema(mockValidator, schema, schemaId, mockLogger);

      // Assert
      expect(warnCalls.length).toBe(1);
      expect(warnCalls[0]).toContain(schemaId);
      expect(warnCalls[0]).toContain('already loaded');

      expect(debugCalls.length).toBe(0);
    });

    it('should use custom warn message for non-payload schemas', async () => {
      // Arrange
      const schemaId = 'core:component_schema';
      const schema = { type: 'object' };
      const customWarnMessage = `Custom warning for ${schemaId}`;
      mockValidator.isSchemaLoaded.mockReturnValue(true);

      // Act
      await registerSchema(
        mockValidator,
        schema,
        schemaId,
        mockLogger,
        customWarnMessage
      );

      // Assert
      expect(warnCalls.length).toBe(1);
      expect(warnCalls[0]).toBe(customWarnMessage);
    });
  });

  describe('when schema is not already loaded', () => {
    it('should not log anything for payload schema first registration', async () => {
      // Arrange
      const schemaId = 'core:new_event#payload';
      const schema = { type: 'object' };
      mockValidator.isSchemaLoaded.mockReturnValue(false);

      // Act
      await registerSchema(mockValidator, schema, schemaId, mockLogger);

      // Assert
      expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(schemaId);
      expect(mockValidator.removeSchema).not.toHaveBeenCalled();
      expect(mockValidator.addSchema).toHaveBeenCalledWith(schema, schemaId);

      expect(debugCalls.length).toBe(0);
      expect(warnCalls.length).toBe(0);
    });

    it('should not log anything for non-payload schema first registration', async () => {
      // Arrange
      const schemaId = 'core:new_component';
      const schema = { type: 'object' };
      mockValidator.isSchemaLoaded.mockReturnValue(false);

      // Act
      await registerSchema(mockValidator, schema, schemaId, mockLogger);

      // Assert
      expect(debugCalls.length).toBe(0);
      expect(warnCalls.length).toBe(0);
    });
  });
});
