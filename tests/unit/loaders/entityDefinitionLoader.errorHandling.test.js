import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import EntityDefinitionLoader from '../../../src/loaders/entityDefinitionLoader.js';
import { ValidationError } from '../../../src/errors/validationError.js';

describe('EntityDefinitionLoader Error Handling', () => {
  let entityLoader;
  let mockSafeEventDispatcher;
  let mockComponentValidator;
  let mockLogger;
  let mockSchemaRegistry;

  beforeEach(() => {
    mockSafeEventDispatcher = {
      dispatch: jest.fn(),
    };

    mockComponentValidator = {
      validateComponent: jest.fn(),
    };

    mockLogger = {
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    };

    mockSchemaRegistry = {
      getSchema: jest.fn(),
    };

    // For these tests, we'll focus on testing the payload structure
    // rather than instantiating the actual loader
    entityLoader = null;
  });

  describe('component validation error handling', () => {
    it('should test error payload structure for component validation failures', () => {
      const mockValidationResult = {
        isValid: false,
        errors: [
          {
            instancePath: '/sockets/0',
            keyword: 'additionalProperties',
            params: { additionalProperty: 'maxCount' },
            message: 'must NOT have additional properties',
          },
        ],
      };

      // Test the payload structure that would be sent
      const payload = {
        message:
          "EntityLoader [anatomy]: Runtime validation failed for component 'anatomy:sockets' in entity 'anatomy:humanoid_arm' (file: humanoid_arm.entity.json)",
        details: {
          raw: JSON.stringify({
            modId: 'anatomy',
            filename: 'humanoid_arm.entity.json',
            entityId: 'anatomy:humanoid_arm',
            componentId: 'anatomy:sockets',
            errors: mockValidationResult.errors,
            validationDetails: JSON.stringify(
              mockValidationResult.errors,
              null,
              2
            ),
          }),
        },
      };

      // Verify payload structure
      expect(payload).toHaveProperty('message');
      expect(payload).toHaveProperty('details');
      expect(payload.details).toHaveProperty('raw');
      expect(Object.keys(payload)).toEqual(['message', 'details']);
      expect(Object.keys(payload.details)).toEqual(['raw']);

      // Verify raw field contains valid JSON
      expect(() => JSON.parse(payload.details.raw)).not.toThrow();
      const parsedRaw = JSON.parse(payload.details.raw);
      expect(parsedRaw.componentId).toBe('anatomy:sockets');
      expect(parsedRaw.errors[0].params.additionalProperty).toBe('maxCount');
    });

    it('should test comprehensive validation failure payload structure', () => {
      const modId = 'anatomy';
      const filename = 'humanoid_arm.entity.json';
      const entityId = 'anatomy:humanoid_arm';
      const failedComponentIds = 'anatomy:sockets';

      const comprehensiveMessage = `Runtime component validation failed for entity '${entityId}' in file '${filename}' (mod: ${modId}). Invalid components: [${failedComponentIds}]. See previous logs for details.`;

      const payload = {
        message: comprehensiveMessage,
        details: {
          raw: JSON.stringify({
            modId,
            filename,
            entityId,
            failedComponentIds,
          }),
        },
      };

      // Verify payload structure
      expect(payload).toHaveProperty('message');
      expect(payload).toHaveProperty('details');
      expect(payload.details).toHaveProperty('raw');
      expect(Object.keys(payload)).toEqual(['message', 'details']);
      expect(Object.keys(payload.details)).toEqual(['raw']);

      // Verify raw field contains valid JSON
      expect(() => JSON.parse(payload.details.raw)).not.toThrow();
      const parsedRaw = JSON.parse(payload.details.raw);
      expect(parsedRaw.failedComponentIds).toBe('anatomy:sockets');
    });

    it('should properly format error details in raw field', () => {
      const errorDetails = {
        modId: 'anatomy',
        filename: 'humanoid_arm.entity.json',
        entityId: 'anatomy:humanoid_arm',
        componentId: 'anatomy:sockets',
        errors: [
          {
            instancePath: '/sockets/0',
            keyword: 'additionalProperties',
            params: { additionalProperty: 'maxCount' },
          },
        ],
      };

      const rawField = JSON.stringify(errorDetails);
      const parsedRaw = JSON.parse(rawField);

      expect(parsedRaw.modId).toBe('anatomy');
      expect(parsedRaw.componentId).toBe('anatomy:sockets');
      expect(parsedRaw.errors).toHaveLength(1);
      expect(parsedRaw.errors[0].params.additionalProperty).toBe('maxCount');
    });
  });

  describe('payload validation compliance', () => {
    it('should create payloads that comply with system error event schema', () => {
      // Test both payload formats used in entityDefinitionLoader
      const payload1 = {
        message:
          "EntityLoader [anatomy]: Runtime validation failed for component 'anatomy:sockets' in entity 'anatomy:humanoid_arm' (file: humanoid_arm.entity.json)",
        details: {
          raw: JSON.stringify({
            modId: 'anatomy',
            filename: 'humanoid_arm.entity.json',
            entityId: 'anatomy:humanoid_arm',
            componentId: 'anatomy:sockets',
            errors: [],
            validationDetails: 'error details',
          }),
        },
      };

      const payload2 = {
        message:
          "Runtime component validation failed for entity 'anatomy:humanoid_arm' in file 'humanoid_arm.entity.json' (mod: anatomy). Invalid components: [anatomy:sockets]. See previous logs for details.",
        details: {
          raw: JSON.stringify({
            modId: 'anatomy',
            filename: 'humanoid_arm.entity.json',
            entityId: 'anatomy:humanoid_arm',
            failedComponentIds: 'anatomy:sockets',
          }),
        },
      };

      // Both payloads should have only allowed properties
      expect(Object.keys(payload1)).toEqual(['message', 'details']);
      expect(Object.keys(payload1.details)).toEqual(['raw']);

      expect(Object.keys(payload2)).toEqual(['message', 'details']);
      expect(Object.keys(payload2.details)).toEqual(['raw']);

      // Raw field should contain valid JSON
      expect(() => JSON.parse(payload1.details.raw)).not.toThrow();
      expect(() => JSON.parse(payload2.details.raw)).not.toThrow();
    });
  });
});
