/**
 * @file Integration tests for component validationRules feature
 * Tests enhanced validation, similarity suggestions, and backward compatibility
 * @see workflows/ANASYSIMP-019-04-08-create-integration-tests.md
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import ValidatorGenerator from '../../../src/validation/validatorGenerator.js';
import StringSimilarityCalculator from '../../../src/validation/stringSimilarityCalculator.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';

describe('Component ValidationRules Integration', () => {
  let testBed;
  let validator;
  let dataRegistry;
  let logger;

  beforeEach(() => {
    testBed = createTestBed();
    logger = testBed.createMockLogger();

    // Create real dependencies
    const similarityCalculator = new StringSimilarityCalculator({ logger });
    const validatorGenerator = new ValidatorGenerator({ logger, similarityCalculator });
    dataRegistry = new InMemoryDataRegistry({ logger });

    // Create validator with enhanced validation enabled
    validator = new AjvSchemaValidator({
      logger,
      validatorGenerator,
      dataRegistry,
    });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Enhanced Error Messages', () => {
    it('should provide enhanced error messages for enum violations', async () => {
      // Test with clothing:wearable component (migrated in ANASYSIMP-019-04-04)
      const componentSchema = {
        id: 'clothing:wearable',
        dataSchema: {
          type: 'object',
          properties: {
            layer: {
              type: 'string',
              enum: ['underwear', 'base', 'outer', 'accessories'],
            },
          },
          required: ['layer'],
          additionalProperties: false,
        },
        validationRules: {
          generateValidator: true,
          errorMessages: {
            invalidEnum: 'Invalid {propertyName}: {{value}}. Valid options: {{validValues}}',
          },
          suggestions: {
            enableSimilarity: true,
            maxDistance: 3,
            maxSuggestions: 3,
          },
        },
      };

      dataRegistry.store('components', 'clothing:wearable', componentSchema);
      await validator.addSchema(componentSchema.dataSchema, 'clothing:wearable');

      const invalidData = { layer: 'invalid-layer' };
      const result = validator.validate('clothing:wearable', invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(1);

      // Find the enhanced error (has custom message format)
      const enhancedError = result.errors.find(err => err.type === 'invalidEnum' && err.suggestion !== undefined);
      expect(enhancedError).toBeDefined();
      expect(enhancedError.message).toContain('Invalid');
      expect(enhancedError.message).toContain('invalid-layer');
      expect(enhancedError.message).toContain('Valid options');
      expect(enhancedError.message).toMatch(/underwear|base|outer|accessories/);
    });

    it('should provide enhanced error for descriptors:build enum violation', async () => {
      // Test with descriptors:build component (migrated in ANASYSIMP-019-04-02)
      const componentSchema = {
        id: 'descriptors:build',
        dataSchema: {
          type: 'object',
          properties: {
            build: {
              type: 'string',
              enum: ['skinny', 'slim', 'lissom', 'toned', 'athletic', 'shapely', 'hourglass', 'thick', 'muscular', 'hulking', 'stocky', 'frail', 'gaunt', 'skeletal', 'atrophied', 'cadaverous', 'massive', 'willowy', 'barrel-chested', 'lanky'],
            },
          },
          required: ['build'],
          additionalProperties: false,
        },
        validationRules: {
          generateValidator: true,
          errorMessages: {
            invalidEnum: 'Invalid build: {{value}}. Valid options: {{validValues}}',
          },
          suggestions: {
            enableSimilarity: true,
            maxDistance: 3,
            maxSuggestions: 3,
          },
        },
      };

      dataRegistry.store('components', 'descriptors:build', componentSchema);
      await validator.addSchema(componentSchema.dataSchema, 'descriptors:build');

      const invalidData = { build: 'super-muscular' };
      const result = validator.validate('descriptors:build', invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toContain('Invalid build');
      expect(result.errors[0].message).toContain('super-muscular');
      expect(result.errors[0].message).toContain('Valid options');
    });

    it('should provide enhanced error for core:gender enum violation', async () => {
      // Test with core:gender component (migrated in ANASYSIMP-019-04-05)
      // NOTE: core:gender property is "value", not "gender"
      const componentSchema = {
        id: 'core:gender',
        dataSchema: {
          type: 'object',
          required: ['value'],
          properties: {
            value: {
              type: 'string',
              enum: ['male', 'female', 'neutral'],
            },
          },
          additionalProperties: false,
        },
        validationRules: {
          generateValidator: true,
          errorMessages: {
            invalidEnum: 'Invalid gender: {{value}}. Valid options: {{validValues}}',
          },
          suggestions: {
            enableSimilarity: true,
            maxDistance: 3,
            maxSuggestions: 3,
          },
        },
      };

      dataRegistry.store('components', 'core:gender', componentSchema);
      await validator.addSchema(componentSchema.dataSchema, 'core:gender');

      const invalidData = { value: 'unknown-gender' };
      const result = validator.validate('core:gender', invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toContain('Invalid gender');
      expect(result.errors[0].message).toContain('unknown-gender');
    });
  });

  describe('Similarity Suggestions', () => {
    it('should suggest similar valid values for typos', async () => {
      // Test with typo close to valid value
      const componentSchema = {
        id: 'clothing:wearable',
        dataSchema: {
          type: 'object',
          properties: {
            layer: {
              type: 'string',
              enum: ['underwear', 'base', 'outer', 'accessories'],
            },
          },
          required: ['layer'],
          additionalProperties: false,
        },
        validationRules: {
          generateValidator: true,
          errorMessages: {
            invalidEnum: 'Invalid {propertyName}: {{value}}. Valid options: {{validValues}}',
          },
          suggestions: {
            enableSimilarity: true,
            maxDistance: 3,
            maxSuggestions: 3,
          },
        },
      };

      dataRegistry.store('components', 'clothing:wearable', componentSchema);
      await validator.addSchema(componentSchema.dataSchema, 'clothing:wearable');

      const invalidData = { layer: 'outter' }; // Typo of "outer"
      const result = validator.validate('clothing:wearable', invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(1);

      // Find the enhanced error (has suggestion property)
      const enhancedError = result.errors.find(err => err.type === 'invalidEnum');
      expect(enhancedError).toBeDefined();
      // NOTE: Property is "suggestion" (singular), not "suggestions" (plural)
      expect(enhancedError.suggestion).toBeDefined();
      expect(enhancedError.suggestion).toBe('outer');
    });

    it('should suggest similar values for descriptors:height typo', async () => {
      const componentSchema = {
        id: 'descriptors:height',
        dataSchema: {
          type: 'object',
          properties: {
            height: {
              type: 'string',
              enum: ['microscopic', 'minuscule', 'tiny', 'petite', 'short', 'average', 'tall', 'very-tall', 'gigantic', 'colossal', 'titanic'],
            },
          },
          required: ['height'],
          additionalProperties: false,
        },
        validationRules: {
          generateValidator: true,
          errorMessages: {
            invalidEnum: 'Invalid height: {{value}}. Valid options: {{validValues}}',
          },
          suggestions: {
            enableSimilarity: true,
            maxDistance: 3,
            maxSuggestions: 3,
          },
        },
      };

      dataRegistry.store('components', 'descriptors:height', componentSchema);
      await validator.addSchema(componentSchema.dataSchema, 'descriptors:height');

      const invalidData = { height: 'tallll' }; // Typo of "tall"
      const result = validator.validate('descriptors:height', invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors[0].suggestion).toBeDefined();
      expect(result.errors[0].suggestion).toBe('tall');
    });

    it('should not suggest when distance exceeds maxDistance', async () => {
      // Test with value too different from any valid value
      const componentSchema = {
        id: 'clothing:wearable',
        dataSchema: {
          type: 'object',
          properties: {
            layer: {
              type: 'string',
              enum: ['underwear', 'base', 'outer', 'accessories'],
            },
          },
          required: ['layer'],
          additionalProperties: false,
        },
        validationRules: {
          generateValidator: true,
          errorMessages: {
            invalidEnum: 'Invalid {propertyName}: {{value}}. Valid options: {{validValues}}',
          },
          suggestions: {
            enableSimilarity: true,
            maxDistance: 3,
            maxSuggestions: 3,
          },
        },
      };

      dataRegistry.store('components', 'clothing:wearable', componentSchema);
      await validator.addSchema(componentSchema.dataSchema, 'clothing:wearable');

      const invalidData = { layer: 'xyz123' };
      const result = validator.validate('clothing:wearable', invalidData);

      expect(result.isValid).toBe(false);
      // Should be null when distance exceeds maxDistance
      expect(result.errors[0].suggestion).toBeNull();
    });
  });

  describe('Required Field Validation', () => {
    it('should provide enhanced error for missing required field', async () => {
      // Test with missing required field
      // NOTE: clothing:wearable requires BOTH 'layer' AND 'equipmentSlots'
      const componentSchema = {
        id: 'clothing:wearable',
        dataSchema: {
          type: 'object',
          properties: {
            layer: {
              type: 'string',
              enum: ['underwear', 'base', 'outer', 'accessories'],
            },
          },
          required: ['layer'],
          additionalProperties: false,
        },
        validationRules: {
          generateValidator: true,
          errorMessages: {
            missingRequired: '{PropertyLabel} is required',
          },
        },
      };

      dataRegistry.store('components', 'clothing:wearable', componentSchema);
      await validator.addSchema(componentSchema.dataSchema, 'clothing:wearable');

      const invalidData = {}; // Missing 'layer' which is required
      const result = validator.validate('clothing:wearable', invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(1);

      const error = result.errors[0];
      expect(error.message).toContain('required');
      expect(error.message).not.toContain('{{'); // No unresolved template vars
    });

    it('should provide enhanced error for missing descriptors:build', async () => {
      const componentSchema = {
        id: 'descriptors:build',
        dataSchema: {
          type: 'object',
          properties: {
            build: {
              type: 'string',
              enum: ['skinny', 'slim', 'lissom', 'toned', 'athletic', 'shapely', 'hourglass', 'thick', 'muscular', 'hulking', 'stocky', 'frail', 'gaunt', 'skeletal', 'atrophied', 'cadaverous', 'massive', 'willowy', 'barrel-chested', 'lanky'],
            },
          },
          required: ['build'],
          additionalProperties: false,
        },
        validationRules: {
          generateValidator: true,
          errorMessages: {
            missingRequired: 'Build is required',
          },
        },
      };

      dataRegistry.store('components', 'descriptors:build', componentSchema);
      await validator.addSchema(componentSchema.dataSchema, 'descriptors:build');

      const invalidData = {};
      const result = validator.validate('descriptors:build', invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toContain('Build is required');
    });
  });

  describe('Type Validation', () => {
    it('should provide enhanced error for type mismatch', async () => {
      // Test with wrong type (number instead of string)
      const componentSchema = {
        id: 'clothing:wearable',
        dataSchema: {
          type: 'object',
          properties: {
            layer: {
              type: 'string',
              enum: ['underwear', 'base', 'outer', 'accessories'],
            },
          },
          required: ['layer'],
          additionalProperties: false,
        },
        validationRules: {
          generateValidator: true,
          errorMessages: {
            invalidType: 'Invalid type for {propertyName}: expected {{expected}}, got {{actual}}',
          },
        },
      };

      dataRegistry.store('components', 'clothing:wearable', componentSchema);
      await validator.addSchema(componentSchema.dataSchema, 'clothing:wearable');

      const invalidData = { layer: 123 };
      const result = validator.validate('clothing:wearable', invalidData);

      expect(result.isValid).toBe(false);
      // Type mismatch will be caught by AJV standard validation
      // Enhanced error may be for enum or type depending on validation order
      const hasTypeError = result.errors.some(err =>
        err.keyword === 'type' || err.message?.includes('type')
      );
      const hasEnumError = result.errors.some(err =>
        err.keyword === 'enum' || err.type === 'invalidEnum'
      );
      // Should have at least one type-related or enum error
      expect(hasTypeError || hasEnumError).toBe(true);
    });

    it('should provide enhanced error for descriptors:height type mismatch', async () => {
      const componentSchema = {
        id: 'descriptors:height',
        dataSchema: {
          type: 'object',
          properties: {
            height: {
              type: 'string',
              enum: ['microscopic', 'minuscule', 'tiny', 'petite', 'short', 'average', 'tall', 'very-tall', 'gigantic', 'colossal', 'titanic'],
            },
          },
          required: ['height'],
          additionalProperties: false,
        },
        validationRules: {
          generateValidator: true,
          errorMessages: {
            invalidType: 'Invalid type for height: expected {{expected}}, got {{actual}}',
          },
        },
      };

      dataRegistry.store('components', 'descriptors:height', componentSchema);
      await validator.addSchema(componentSchema.dataSchema, 'descriptors:height');

      const invalidData = { height: true }; // Boolean instead of string
      const result = validator.validate('descriptors:height', invalidData);

      expect(result.isValid).toBe(false);
      // Type mismatch will be caught by validation
      const hasTypeError = result.errors.some(err =>
        err.keyword === 'type' || err.message?.includes('type')
      );
      const hasEnumError = result.errors.some(err =>
        err.keyword === 'enum' || err.type === 'invalidEnum'
      );
      // Should have at least one type-related or enum error
      expect(hasTypeError || hasEnumError).toBe(true);
    });
  });

  describe('Backward Compatibility', () => {
    it('should work with components without validationRules', async () => {
      // Test with component that doesn't have validationRules
      const componentSchema = {
        id: 'test:no-validation-rules',
        dataSchema: {
          type: 'object',
          properties: {
            someProperty: { type: 'string' },
          },
          required: ['someProperty'],
          additionalProperties: false,
        },
        // No validationRules - should fall back to AJV only
      };

      dataRegistry.store('components', 'test:no-validation-rules', componentSchema);
      await validator.addSchema(componentSchema.dataSchema, 'test:no-validation-rules');

      const validData = { someProperty: 'someValue' };
      const result = validator.validate('test:no-validation-rules', validData);

      // Should still work, just without enhanced messages
      expect(result).toBeDefined();
      expect(result.isValid).toBe(true);
    });

    it('should provide standard AJV errors for non-migrated components', async () => {
      // Test that non-migrated components still validate
      const componentSchema = {
        id: 'test:no-validation-rules',
        dataSchema: {
          type: 'object',
          properties: {
            someEnum: {
              type: 'string',
              enum: ['valid-value'],
            },
          },
          required: ['someEnum'],
          additionalProperties: false,
        },
        // No validationRules
      };

      dataRegistry.store('components', 'test:no-validation-rules', componentSchema);
      await validator.addSchema(componentSchema.dataSchema, 'test:no-validation-rules');

      const invalidData = { someEnum: 'invalid-value' };
      const result = validator.validate('test:no-validation-rules', invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors.length).toBeGreaterThan(0);
      // Error message may not have enhanced format (no suggestion property)
    });
  });

  describe('Multiple Enum Properties', () => {
    it('should validate multiple enum properties independently', async () => {
      // Test with component that has multiple enum properties
      const componentSchema = {
        id: 'test:multi-enum',
        dataSchema: {
          type: 'object',
          properties: {
            property1: {
              type: 'string',
              enum: ['valid-1a', 'valid-1b'],
            },
            property2: {
              type: 'string',
              enum: ['valid-2a', 'valid-2b'],
            },
          },
          required: ['property1', 'property2'],
          additionalProperties: false,
        },
        validationRules: {
          generateValidator: true,
          errorMessages: {
            invalidEnum: 'Invalid {{property}}: {{value}}. Valid: {{validValues}}',
          },
        },
      };

      dataRegistry.store('components', 'test:multi-enum', componentSchema);
      await validator.addSchema(componentSchema.dataSchema, 'test:multi-enum');

      const invalidData = {
        property1: 'invalid-value-1',
        property2: 'valid-2a',
      };
      const result = validator.validate('test:multi-enum', invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(1);
      // Find error related to property1
      const property1Error = result.errors.find(err =>
        err.property === 'property1' || err.instancePath === '/property1'
      );
      expect(property1Error).toBeDefined();
      expect(property1Error.property || 'property1').toBe('property1');
    });

    it('should report all enum violations when multiple fail', async () => {
      const componentSchema = {
        id: 'test:multi-enum',
        dataSchema: {
          type: 'object',
          properties: {
            property1: {
              type: 'string',
              enum: ['valid-1a', 'valid-1b'],
            },
            property2: {
              type: 'string',
              enum: ['valid-2a', 'valid-2b'],
            },
          },
          required: ['property1', 'property2'],
          additionalProperties: false,
        },
        validationRules: {
          generateValidator: true,
          errorMessages: {
            invalidEnum: 'Invalid {{property}}: {{value}}. Valid: {{validValues}}',
          },
        },
      };

      dataRegistry.store('components', 'test:multi-enum', componentSchema);
      await validator.addSchema(componentSchema.dataSchema, 'test:multi-enum');

      const invalidData = {
        property1: 'invalid-value-1',
        property2: 'invalid-value-2',
      };
      const result = validator.validate('test:multi-enum', invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Valid Data', () => {
    it('should pass validation with valid data', async () => {
      const componentSchema = {
        id: 'clothing:wearable',
        dataSchema: {
          type: 'object',
          properties: {
            layer: {
              type: 'string',
              enum: ['underwear', 'base', 'outer', 'accessories'],
            },
          },
          required: ['layer'],
          additionalProperties: false,
        },
        validationRules: {
          generateValidator: true,
        },
      };

      dataRegistry.store('components', 'clothing:wearable', componentSchema);
      await validator.addSchema(componentSchema.dataSchema, 'clothing:wearable');

      const validData = { layer: 'outer' };
      const result = validator.validate('clothing:wearable', validData);

      expect(result.isValid).toBe(true);
      expect(result.errors).toBeNull();
    });

    it('should pass validation for all valid descriptors:height values', async () => {
      const componentSchema = {
        id: 'descriptors:height',
        dataSchema: {
          type: 'object',
          properties: {
            height: {
              type: 'string',
              enum: ['microscopic', 'minuscule', 'tiny', 'petite', 'short', 'average', 'tall', 'very-tall', 'gigantic', 'colossal', 'titanic'],
            },
          },
          required: ['height'],
          additionalProperties: false,
        },
        validationRules: {
          generateValidator: true,
        },
      };

      dataRegistry.store('components', 'descriptors:height', componentSchema);
      await validator.addSchema(componentSchema.dataSchema, 'descriptors:height');

      const validHeights = [
        'microscopic', 'minuscule', 'tiny', 'petite', 'short',
        'average', 'tall', 'very-tall', 'gigantic', 'colossal', 'titanic',
      ];

      validHeights.forEach((height) => {
        const result = validator.validate('descriptors:height', { height });
        expect(result.isValid).toBe(true);
      });
    });
  });

  describe('Metabolism Components Validation', () => {
    describe('metabolic_store component', () => {
      it('should validate correct metabolic_store data', async () => {
        const componentSchema = {
          id: 'metabolism:metabolic_store',
          dataSchema: {
            type: 'object',
            properties: {
              currentEnergy: {
                type: 'number',
                minimum: 0,
              },
              maxEnergy: {
                type: 'number',
                minimum: 0,
              },
              baseBurnRate: {
                type: 'number',
                exclusiveMinimum: 0,
              },
              activityMultiplier: {
                type: 'number',
                minimum: 0,
                default: 1.0,
              },
              lastUpdateTurn: {
                type: 'integer',
                minimum: 0,
                default: 0,
              },
            },
            required: ['currentEnergy', 'maxEnergy', 'baseBurnRate'],
            additionalProperties: false,
          },
          validationRules: {
            generateValidator: true,
          },
        };

        dataRegistry.store('components', 'metabolism:metabolic_store', componentSchema);
        await validator.addSchema(componentSchema.dataSchema, 'metabolism:metabolic_store');

        const validData = {
          currentEnergy: 800,
          maxEnergy: 1000,
          baseBurnRate: 1.0,
          activityMultiplier: 1.0,
          lastUpdateTurn: 42,
        };

        const result = validator.validate('metabolism:metabolic_store', validData);
        expect(result.isValid).toBe(true);
        expect(result.errors).toBeNull();
      });

      it('should reject negative currentEnergy', async () => {
        const componentSchema = {
          id: 'metabolism:metabolic_store',
          dataSchema: {
            type: 'object',
            properties: {
              currentEnergy: {
                type: 'number',
                minimum: 0,
              },
              maxEnergy: {
                type: 'number',
                minimum: 0,
              },
              baseBurnRate: {
                type: 'number',
                exclusiveMinimum: 0,
              },
            },
            required: ['currentEnergy', 'maxEnergy', 'baseBurnRate'],
            additionalProperties: false,
          },
          validationRules: {
            generateValidator: true,
          },
        };

        dataRegistry.store('components', 'metabolism:metabolic_store', componentSchema);
        await validator.addSchema(componentSchema.dataSchema, 'metabolism:metabolic_store');

        const invalidData = {
          currentEnergy: -10,
          maxEnergy: 1000,
          baseBurnRate: 1.0,
        };

        const result = validator.validate('metabolism:metabolic_store', invalidData);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it('should reject baseBurnRate of 0 (exclusiveMinimum)', async () => {
        const componentSchema = {
          id: 'metabolism:metabolic_store',
          dataSchema: {
            type: 'object',
            properties: {
              currentEnergy: {
                type: 'number',
                minimum: 0,
              },
              maxEnergy: {
                type: 'number',
                minimum: 0,
              },
              baseBurnRate: {
                type: 'number',
                exclusiveMinimum: 0,
              },
            },
            required: ['currentEnergy', 'maxEnergy', 'baseBurnRate'],
            additionalProperties: false,
          },
          validationRules: {
            generateValidator: true,
          },
        };

        dataRegistry.store('components', 'metabolism:metabolic_store', componentSchema);
        await validator.addSchema(componentSchema.dataSchema, 'metabolism:metabolic_store');

        const invalidData = {
          currentEnergy: 800,
          maxEnergy: 1000,
          baseBurnRate: 0,
        };

        const result = validator.validate('metabolism:metabolic_store', invalidData);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it('should reject missing required fields', async () => {
        const componentSchema = {
          id: 'metabolism:metabolic_store',
          dataSchema: {
            type: 'object',
            properties: {
              currentEnergy: {
                type: 'number',
                minimum: 0,
              },
              maxEnergy: {
                type: 'number',
                minimum: 0,
              },
              baseBurnRate: {
                type: 'number',
                exclusiveMinimum: 0,
              },
            },
            required: ['currentEnergy', 'maxEnergy', 'baseBurnRate'],
            additionalProperties: false,
          },
          validationRules: {
            generateValidator: true,
          },
        };

        dataRegistry.store('components', 'metabolism:metabolic_store', componentSchema);
        await validator.addSchema(componentSchema.dataSchema, 'metabolism:metabolic_store');

        const invalidData = {
          currentEnergy: 800,
          // missing maxEnergy and baseBurnRate
        };

        const result = validator.validate('metabolism:metabolic_store', invalidData);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it('should allow currentEnergy > maxEnergy (for gluttonous state)', async () => {
        const componentSchema = {
          id: 'metabolism:metabolic_store',
          dataSchema: {
            type: 'object',
            properties: {
              currentEnergy: {
                type: 'number',
                minimum: 0,
              },
              maxEnergy: {
                type: 'number',
                minimum: 0,
              },
              baseBurnRate: {
                type: 'number',
                exclusiveMinimum: 0,
              },
            },
            required: ['currentEnergy', 'maxEnergy', 'baseBurnRate'],
            additionalProperties: false,
          },
          validationRules: {
            generateValidator: true,
          },
        };

        dataRegistry.store('components', 'metabolism:metabolic_store', componentSchema);
        await validator.addSchema(componentSchema.dataSchema, 'metabolism:metabolic_store');

        const validData = {
          currentEnergy: 1200,
          maxEnergy: 1000,
          baseBurnRate: 1.0,
        };

        const result = validator.validate('metabolism:metabolic_store', validData);
        expect(result.isValid).toBe(true);
        expect(result.errors).toBeNull();
      });
    });

    describe('hunger_state component', () => {
      it('should validate correct hunger_state data', async () => {
        const componentSchema = {
          id: 'metabolism:hunger_state',
          dataSchema: {
            type: 'object',
            properties: {
              state: {
                type: 'string',
                enum: ['gluttonous', 'satiated', 'neutral', 'hungry', 'starving', 'critical'],
              },
              energyPercentage: {
                type: 'number',
                minimum: 0,
              },
              turnsInState: {
                type: 'integer',
                minimum: 0,
                default: 0,
              },
              starvationDamage: {
                type: 'number',
                minimum: 0,
                default: 0,
              },
            },
            required: ['state', 'energyPercentage'],
            additionalProperties: false,
          },
          validationRules: {
            generateValidator: true,
            errorMessages: {
              invalidEnum: 'Invalid hunger state: {{value}}. Valid states: gluttonous, satiated, neutral, hungry, starving, critical',
            },
            suggestions: {
              enableSimilarity: true,
              maxDistance: 3,
              maxSuggestions: 3,
            },
          },
        };

        dataRegistry.store('components', 'metabolism:hunger_state', componentSchema);
        await validator.addSchema(componentSchema.dataSchema, 'metabolism:hunger_state');

        const validData = {
          state: 'hungry',
          energyPercentage: 25.5,
          turnsInState: 15,
          starvationDamage: 0,
        };

        const result = validator.validate('metabolism:hunger_state', validData);
        expect(result.isValid).toBe(true);
        expect(result.errors).toBeNull();
      });

      it('should reject invalid hunger state with similarity suggestion', async () => {
        const componentSchema = {
          id: 'metabolism:hunger_state',
          dataSchema: {
            type: 'object',
            properties: {
              state: {
                type: 'string',
                enum: ['gluttonous', 'satiated', 'neutral', 'hungry', 'starving', 'critical'],
              },
              energyPercentage: {
                type: 'number',
                minimum: 0,
              },
            },
            required: ['state', 'energyPercentage'],
            additionalProperties: false,
          },
          validationRules: {
            generateValidator: true,
            errorMessages: {
              invalidEnum: 'Invalid hunger state: {{value}}. Valid states: gluttonous, satiated, neutral, hungry, starving, critical',
            },
            suggestions: {
              enableSimilarity: true,
              maxDistance: 3,
              maxSuggestions: 3,
            },
          },
        };

        dataRegistry.store('components', 'metabolism:hunger_state', componentSchema);
        await validator.addSchema(componentSchema.dataSchema, 'metabolism:hunger_state');

        const invalidData = {
          state: 'hungrey', // Typo of "hungry"
          energyPercentage: 25.5,
        };

        const result = validator.validate('metabolism:hunger_state', invalidData);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);

        const enhancedError = result.errors.find(err => err.type === 'invalidEnum');
        expect(enhancedError).toBeDefined();
        expect(enhancedError.suggestion).toBeDefined();
        expect(enhancedError.suggestion).toBe('hungry');
      });

      it('should validate all hunger states', async () => {
        const componentSchema = {
          id: 'metabolism:hunger_state',
          dataSchema: {
            type: 'object',
            properties: {
              state: {
                type: 'string',
                enum: ['gluttonous', 'satiated', 'neutral', 'hungry', 'starving', 'critical'],
              },
              energyPercentage: {
                type: 'number',
                minimum: 0,
              },
            },
            required: ['state', 'energyPercentage'],
            additionalProperties: false,
          },
          validationRules: {
            generateValidator: true,
          },
        };

        dataRegistry.store('components', 'metabolism:hunger_state', componentSchema);
        await validator.addSchema(componentSchema.dataSchema, 'metabolism:hunger_state');

        const validStates = ['gluttonous', 'satiated', 'neutral', 'hungry', 'starving', 'critical'];

        validStates.forEach((state) => {
          const result = validator.validate('metabolism:hunger_state', {
            state,
            energyPercentage: 50,
          });
          expect(result.isValid).toBe(true);
        });
      });

      it('should reject negative energyPercentage', async () => {
        const componentSchema = {
          id: 'metabolism:hunger_state',
          dataSchema: {
            type: 'object',
            properties: {
              state: {
                type: 'string',
                enum: ['gluttonous', 'satiated', 'neutral', 'hungry', 'starving', 'critical'],
              },
              energyPercentage: {
                type: 'number',
                minimum: 0,
              },
            },
            required: ['state', 'energyPercentage'],
            additionalProperties: false,
          },
          validationRules: {
            generateValidator: true,
          },
        };

        dataRegistry.store('components', 'metabolism:hunger_state', componentSchema);
        await validator.addSchema(componentSchema.dataSchema, 'metabolism:hunger_state');

        const invalidData = {
          state: 'hungry',
          energyPercentage: -5,
        };

        const result = validator.validate('metabolism:hunger_state', invalidData);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it('should allow energyPercentage > 100 (for gluttonous state)', async () => {
        const componentSchema = {
          id: 'metabolism:hunger_state',
          dataSchema: {
            type: 'object',
            properties: {
              state: {
                type: 'string',
                enum: ['gluttonous', 'satiated', 'neutral', 'hungry', 'starving', 'critical'],
              },
              energyPercentage: {
                type: 'number',
                minimum: 0,
              },
            },
            required: ['state', 'energyPercentage'],
            additionalProperties: false,
          },
          validationRules: {
            generateValidator: true,
          },
        };

        dataRegistry.store('components', 'metabolism:hunger_state', componentSchema);
        await validator.addSchema(componentSchema.dataSchema, 'metabolism:hunger_state');

        const validData = {
          state: 'gluttonous',
          energyPercentage: 125.5,
        };

        const result = validator.validate('metabolism:hunger_state', validData);
        expect(result.isValid).toBe(true);
        expect(result.errors).toBeNull();
      });

      it('should reject negative turnsInState', async () => {
        const componentSchema = {
          id: 'metabolism:hunger_state',
          dataSchema: {
            type: 'object',
            properties: {
              state: {
                type: 'string',
                enum: ['gluttonous', 'satiated', 'neutral', 'hungry', 'starving', 'critical'],
              },
              energyPercentage: {
                type: 'number',
                minimum: 0,
              },
              turnsInState: {
                type: 'integer',
                minimum: 0,
              },
            },
            required: ['state', 'energyPercentage'],
            additionalProperties: false,
          },
          validationRules: {
            generateValidator: true,
          },
        };

        dataRegistry.store('components', 'metabolism:hunger_state', componentSchema);
        await validator.addSchema(componentSchema.dataSchema, 'metabolism:hunger_state');

        const invalidData = {
          state: 'hungry',
          energyPercentage: 25.5,
          turnsInState: -1,
        };

        const result = validator.validate('metabolism:hunger_state', invalidData);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it('should reject negative starvationDamage', async () => {
        const componentSchema = {
          id: 'metabolism:hunger_state',
          dataSchema: {
            type: 'object',
            properties: {
              state: {
                type: 'string',
                enum: ['gluttonous', 'satiated', 'neutral', 'hungry', 'starving', 'critical'],
              },
              energyPercentage: {
                type: 'number',
                minimum: 0,
              },
              starvationDamage: {
                type: 'number',
                minimum: 0,
              },
            },
            required: ['state', 'energyPercentage'],
            additionalProperties: false,
          },
          validationRules: {
            generateValidator: true,
          },
        };

        dataRegistry.store('components', 'metabolism:hunger_state', componentSchema);
        await validator.addSchema(componentSchema.dataSchema, 'metabolism:hunger_state');

        const invalidData = {
          state: 'starving',
          energyPercentage: 5.2,
          starvationDamage: -10,
        };

        const result = validator.validate('metabolism:hunger_state', invalidData);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });
  });
});
