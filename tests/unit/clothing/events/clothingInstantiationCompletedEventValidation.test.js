/**
 * @file Focused test suite for clothing:instantiation_completed event validation
 * @see data/mods/clothing/events/clothing_instantiation_completed.event.json
 * @see src/clothing/services/clothingInstantiationService.js
 */

import { beforeEach, describe, it, expect } from '@jest/globals';
import ConsoleLogger from '../../../../src/logging/consoleLogger.js';
import AjvSchemaValidator from '../../../../src/validation/ajvSchemaValidator.js';
import fs from 'fs';
import path from 'path';

describe('ClothingInstantiationCompleted Event Validation', () => {
  let schemaValidator;
  let logger;
  let eventSchema;

  beforeEach(async () => {
    logger = new ConsoleLogger();
    schemaValidator = new AjvSchemaValidator({ logger });

    // Load the clothing:instantiation_completed event schema directly
    const eventDir = path.join(process.cwd(), 'data/mods/clothing/events');
    const eventDefinition = JSON.parse(
      fs.readFileSync(
        path.join(eventDir, 'clothing_instantiation_completed.event.json'),
        'utf8'
      )
    );

    eventSchema = eventDefinition.payloadSchema;

    // Add the schema to the validator
    await schemaValidator.addSchema(
      eventSchema,
      'clothing:instantiation_completed#payload'
    );
  });

  describe('Valid payload formats', () => {
    it('should accept valid payload with correct object format for equipped array', () => {
      const validPayload = {
        actorId: 'actor_123',
        result: {
          instantiated: [
            {
              clothingId: 'clothing_item_1',
              entityDefinitionId: 'clothing:simple_shirt',
            },
            {
              clothingId: 'clothing_item_2',
              entityDefinitionId: 'clothing:blue_jeans',
            },
          ],
          equipped: [
            {
              clothingId: 'clothing_item_1',
              entityDefinitionId: 'clothing:simple_shirt',
            },
            {
              clothingId: 'clothing_item_2',
              entityDefinitionId: 'clothing:blue_jeans',
            },
          ],
          errors: [],
        },
      };

      const result = schemaValidator.validate(
        'clothing:instantiation_completed#payload',
        validPayload
      );
      expect(result.isValid).toBe(true);
      expect(result.errors || []).toEqual([]);
    });

    it('should accept valid payload with empty arrays', () => {
      const validPayload = {
        actorId: 'actor_123',
        result: {
          instantiated: [],
          equipped: [],
          errors: [],
        },
      };

      const result = schemaValidator.validate(
        'clothing:instantiation_completed#payload',
        validPayload
      );
      expect(result.isValid).toBe(true);
      expect(result.errors || []).toEqual([]);
    });

    it('should accept valid payload with errors', () => {
      const validPayload = {
        actorId: 'actor_123',
        result: {
          instantiated: [
            {
              clothingId: 'clothing_item_1',
              entityDefinitionId: 'clothing:simple_shirt',
            },
          ],
          equipped: [
            {
              clothingId: 'clothing_item_1',
              entityDefinitionId: 'clothing:simple_shirt',
            },
          ],
          errors: ['Failed to instantiate clothing:broken_item'],
        },
      };

      const result = schemaValidator.validate(
        'clothing:instantiation_completed#payload',
        validPayload
      );
      expect(result.isValid).toBe(true);
      expect(result.errors || []).toEqual([]);
    });
  });

  describe('Invalid payload formats - equipped array issues', () => {
    it('should reject payload with equipped array containing strings (original bug)', () => {
      const invalidPayload = {
        actorId: 'actor_123',
        result: {
          instantiated: [
            {
              clothingId: 'clothing_item_1',
              entityDefinitionId: 'clothing:simple_shirt',
            },
          ],
          equipped: ['clothing_item_1'], // ❌ This should be objects, not strings
          errors: [],
        },
      };

      const result = schemaValidator.validate(
        'clothing:instantiation_completed#payload',
        invalidPayload
      );
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject payload with equipped array missing clothingId', () => {
      const invalidPayload = {
        actorId: 'actor_123',
        result: {
          instantiated: [
            {
              clothingId: 'clothing_item_1',
              entityDefinitionId: 'clothing:simple_shirt',
            },
          ],
          equipped: [
            {
              // missing clothingId
              entityDefinitionId: 'clothing:simple_shirt',
            },
          ],
          errors: [],
        },
      };

      const result = schemaValidator.validate(
        'clothing:instantiation_completed#payload',
        invalidPayload
      );
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject payload with equipped array missing entityDefinitionId', () => {
      const invalidPayload = {
        actorId: 'actor_123',
        result: {
          instantiated: [
            {
              clothingId: 'clothing_item_1',
              entityDefinitionId: 'clothing:simple_shirt',
            },
          ],
          equipped: [
            {
              clothingId: 'clothing_item_1',
              // missing entityDefinitionId
            },
          ],
          errors: [],
        },
      };

      const result = schemaValidator.validate(
        'clothing:instantiation_completed#payload',
        invalidPayload
      );
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Invalid payload formats - instantiated array issues', () => {
    it('should reject payload with instantiated array containing strings', () => {
      const invalidPayload = {
        actorId: 'actor_123',
        result: {
          instantiated: ['clothing_item_1'], // ❌ Should be objects
          equipped: [
            {
              clothingId: 'clothing_item_1',
              entityDefinitionId: 'clothing:simple_shirt',
            },
          ],
          errors: [],
        },
      };

      const result = schemaValidator.validate(
        'clothing:instantiation_completed#payload',
        invalidPayload
      );
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Invalid payload formats - missing required fields', () => {
    it('should reject payload missing actorId', () => {
      const invalidPayload = {
        // missing actorId
        result: {
          instantiated: [],
          equipped: [],
          errors: [],
        },
      };

      const result = schemaValidator.validate(
        'clothing:instantiation_completed#payload',
        invalidPayload
      );
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject payload missing result', () => {
      const invalidPayload = {
        actorId: 'actor_123',
        // missing result
      };

      const result = schemaValidator.validate(
        'clothing:instantiation_completed#payload',
        invalidPayload
      );
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject payload missing result.instantiated', () => {
      const invalidPayload = {
        actorId: 'actor_123',
        result: {
          // missing instantiated
          equipped: [],
          errors: [],
        },
      };

      const result = schemaValidator.validate(
        'clothing:instantiation_completed#payload',
        invalidPayload
      );
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject payload missing result.equipped', () => {
      const invalidPayload = {
        actorId: 'actor_123',
        result: {
          instantiated: [],
          // missing equipped
          errors: [],
        },
      };

      const result = schemaValidator.validate(
        'clothing:instantiation_completed#payload',
        invalidPayload
      );
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject payload missing result.errors', () => {
      const invalidPayload = {
        actorId: 'actor_123',
        result: {
          instantiated: [],
          equipped: [],
          // missing errors
        },
      };

      const result = schemaValidator.validate(
        'clothing:instantiation_completed#payload',
        invalidPayload
      );
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Invalid payload formats - wrong types', () => {
    it('should reject payload with non-string actorId', () => {
      const invalidPayload = {
        actorId: 123, // ❌ Should be string
        result: {
          instantiated: [],
          equipped: [],
          errors: [],
        },
      };

      const result = schemaValidator.validate(
        'clothing:instantiation_completed#payload',
        invalidPayload
      );
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject payload with non-array instantiated', () => {
      const invalidPayload = {
        actorId: 'actor_123',
        result: {
          instantiated: 'not an array', // ❌ Should be array
          equipped: [],
          errors: [],
        },
      };

      const result = schemaValidator.validate(
        'clothing:instantiation_completed#payload',
        invalidPayload
      );
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject payload with non-array equipped', () => {
      const invalidPayload = {
        actorId: 'actor_123',
        result: {
          instantiated: [],
          equipped: 'not an array', // ❌ Should be array
          errors: [],
        },
      };

      const result = schemaValidator.validate(
        'clothing:instantiation_completed#payload',
        invalidPayload
      );
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject payload with non-array errors', () => {
      const invalidPayload = {
        actorId: 'actor_123',
        result: {
          instantiated: [],
          equipped: [],
          errors: 'not an array', // ❌ Should be array
        },
      };

      const result = schemaValidator.validate(
        'clothing:instantiation_completed#payload',
        invalidPayload
      );
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Edge cases', () => {
    it('should reject payload with additional properties when additionalProperties is false', () => {
      const invalidPayload = {
        actorId: 'actor_123',
        result: {
          instantiated: [],
          equipped: [],
          errors: [],
          unexpectedProperty: 'should not be here', // ❌ Additional property
        },
        unexpectedTopLevel: 'also not allowed', // ❌ Additional property
      };

      const result = schemaValidator.validate(
        'clothing:instantiation_completed#payload',
        invalidPayload
      );
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject equipped items with additional properties', () => {
      const invalidPayload = {
        actorId: 'actor_123',
        result: {
          instantiated: [],
          equipped: [
            {
              clothingId: 'clothing_item_1',
              entityDefinitionId: 'clothing:simple_shirt',
              extraProperty: 'not allowed', // ❌ Additional property
            },
          ],
          errors: [],
        },
      };

      const result = schemaValidator.validate(
        'clothing:instantiation_completed#payload',
        invalidPayload
      );
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle very large arrays efficiently', () => {
      const largeArray = Array.from({ length: 1000 }, (_, i) => ({
        clothingId: `clothing_item_${i}`,
        entityDefinitionId: `clothing:item_${i}`,
      }));

      const validPayload = {
        actorId: 'actor_123',
        result: {
          instantiated: largeArray,
          equipped: largeArray,
          errors: [],
        },
      };

      const startTime = Date.now();
      const result = schemaValidator.validate(
        'clothing:instantiation_completed#payload',
        validPayload
      );
      const endTime = Date.now();

      expect(result.isValid).toBe(true);
      expect(endTime - startTime).toBeLessThan(100); // Should be fast
    });
  });
});
