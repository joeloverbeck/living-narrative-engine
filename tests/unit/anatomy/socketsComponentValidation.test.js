/**
 * @file Unit tests for sockets component validation
 */

import { describe, it, expect, beforeAll, jest } from '@jest/globals';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import socketsComponentSchema from '../../../data/mods/anatomy/components/sockets.component.json';

describe('Sockets Component Validation', () => {
  let validator;
  let mockLogger;
  const socketsSchemaId = 'anatomy:sockets';

  beforeAll(() => {
    // Create a mock logger that adheres to the ILogger interface
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };
    validator = new AjvSchemaValidator({ logger: mockLogger });
    // Register the component schema
    validator.preloadSchemas([{ schema: socketsComponentSchema.dataSchema, id: socketsSchemaId }]);
  });

  it('should validate socket with valid orientation', () => {
    const validSocket = {
      sockets: [
        {
          id: 'left_shoulder',
          orientation: 'left',
          allowedTypes: ['arm'],
          maxCount: 1,
          nameTpl: '{{orientation}} {{type}}'
        }
      ]
    };

    const result = validator.validate(socketsSchemaId, validSocket);
    expect(result.isValid).toBe(true);
    expect(result.errors).toBeNull();
  });

  it('should validate socket without orientation', () => {
    const socketWithoutOrientation = {
      sockets: [
        {
          id: 'pubic_hair',
          allowedTypes: ['hair'],
          maxCount: 1,
          nameTpl: 'pubic {{type}}'
        }
      ]
    };

    const result = validator.validate(socketsSchemaId, socketWithoutOrientation);
    expect(result.isValid).toBe(true);
    expect(result.errors).toBeNull();
  });

  it('should reject socket with invalid orientation', () => {
    const invalidSocket = {
      sockets: [
        {
          id: 'test_socket',
          orientation: 'lower-front', // Invalid compound orientation
          allowedTypes: ['test'],
          maxCount: 1
        }
      ]
    };

    const result = validator.validate(socketsSchemaId, invalidSocket);
    expect(result.isValid).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors[0].message).toContain('must be equal to one of the allowed values');
  });

  it('should validate multiple sockets with mixed orientation presence', () => {
    const mixedSockets = {
      sockets: [
        {
          id: 'left_arm',
          orientation: 'left',
          allowedTypes: ['arm'],
          nameTpl: '{{orientation}} {{type}}'
        },
        {
          id: 'neck',
          orientation: 'upper',
          allowedTypes: ['head', 'neck']
        },
        {
          id: 'special_socket',
          allowedTypes: ['special']
        }
      ]
    };

    const result = validator.validate(socketsSchemaId, mixedSockets);
    expect(result.isValid).toBe(true);
    expect(result.errors).toBeNull();
  });

  it('should reject socket missing required fields', () => {
    const invalidSocket = {
      sockets: [
        {
          id: 'test_socket'
          // Missing required 'allowedTypes'
        }
      ]
    };

    const result = validator.validate(socketsSchemaId, invalidSocket);
    expect(result.isValid).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors[0].message).toContain("must have required property 'allowedTypes'");
  });

  it('should validate all valid orientation enum values', () => {
    const validOrientations = ['left', 'right', 'mid', 'upper', 'lower', 'front', 'back'];
    
    for (const orientation of validOrientations) {
      const socket = {
        sockets: [
          {
            id: `${orientation}_socket`,
            orientation: orientation,
            allowedTypes: ['test']
          }
        ]
      };

      const result = validator.validate(socketsSchemaId, socket);
      expect(result.isValid).toBe(true);
      expect(result.errors).toBeNull();
    }
  });

  it('should validate socket with all optional properties', () => {
    const fullySpecifiedSocket = {
      sockets: [
        {
          id: 'complete_socket',
          orientation: 'front',
          allowedTypes: ['test_type'],
          maxCount: 2,
          nameTpl: '{{parent.name}} - {{orientation}} {{type}} #{{index}}'
        }
      ]
    };

    const result = validator.validate(socketsSchemaId, fullySpecifiedSocket);
    expect(result.isValid).toBe(true);
    expect(result.errors).toBeNull();
  });

  it('should reject additional properties not in schema', () => {
    const invalidAdditionalProp = {
      sockets: [
        {
          id: 'test_socket',
          allowedTypes: ['test'],
          invalidProp: 'not-allowed' // Additional property
        }
      ]
    };

    const result = validator.validate(socketsSchemaId, invalidAdditionalProp);
    expect(result.isValid).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors[0].message).toContain('must NOT have additional properties');
  });

  it('should handle empty allowedTypes array', () => {
    const emptyAllowedTypes = {
      sockets: [
        {
          id: 'test_socket',
          allowedTypes: [] // Empty array should fail minItems: 1
        }
      ]
    };

    const result = validator.validate(socketsSchemaId, emptyAllowedTypes);
    expect(result.isValid).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors[0].message).toContain('must NOT have fewer than 1 items');
  });

  it('should reject maxCount less than 1', () => {
    const invalidMaxCount = {
      sockets: [
        {
          id: 'test_socket',
          allowedTypes: ['test'],
          maxCount: 0 // Should be minimum 1
        }
      ]
    };

    const result = validator.validate(socketsSchemaId, invalidMaxCount);
    expect(result.isValid).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors[0].message).toContain('must be >= 1');
  });
});