/**
 * @file Unit tests for EffectsGenerator validation functionality
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import EffectsGenerator from '../../../../src/goap/generation/effectsGenerator.js';

describe('EffectsGenerator - Validation', () => {
  let generator;
  let mockLogger;
  let mockEffectsAnalyzer;
  let mockDataRegistry;
  let mockSchemaValidator;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };

    mockEffectsAnalyzer = {
      analyzeRule: jest.fn(),
      isWorldStateChanging: jest.fn()
    };

    mockDataRegistry = {
      get: jest.fn(),
      getAll: jest.fn()
    };

    mockSchemaValidator = {
      validate: jest.fn()
    };

    generator = new EffectsGenerator({
      logger: mockLogger,
      effectsAnalyzer: mockEffectsAnalyzer,
      dataRegistry: mockDataRegistry,
      schemaValidator: mockSchemaValidator
    });
  });

  describe('schema validation', () => {
    it('should pass validation for well-formed effects', () => {
      const effects = {
        effects: [
          {
            operation: 'ADD_COMPONENT',
            entity: 'actor',
            component: 'positioning:sitting',
            data: {}
          }
        ],
        cost: 1.0
      };

      mockSchemaValidator.validate.mockReturnValue({ isValid: true });

      const result = generator.validateEffects('test:action', effects);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(mockSchemaValidator.validate).toHaveBeenCalledWith(
        'schema://living-narrative-engine/planning-effects.schema.json',
        effects
      );
    });

    it('should fail validation for malformed effects', () => {
      const effects = {
        effects: [
          {
            operation: 'INVALID_OPERATION',
            entity: 'actor'
          }
        ],
        cost: 1.0
      };

      mockSchemaValidator.validate.mockReturnValue({
        isValid: false,
        errors: ['operation must be one of: ADD_COMPONENT, REMOVE_COMPONENT, MODIFY_COMPONENT, CONDITIONAL']
      });

      const result = generator.validateEffects('test:action', effects);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe('schema');
      expect(result.errors[0].message).toBe('Effects do not match schema');
    });

    it('should fail validation for missing required fields', () => {
      const effects = {
        effects: [
          {
            operation: 'ADD_COMPONENT',
            entity: 'actor'
            // Missing component field
          }
        ],
        cost: 1.0
      };

      mockSchemaValidator.validate.mockReturnValue({
        isValid: false,
        errors: ['component is required']
      });

      const result = generator.validateEffects('test:action', effects);

      expect(result.valid).toBe(false);
      expect(result.errors[0].type).toBe('schema');
    });

    it('should pass validation for effects with optional fields', () => {
      const effects = {
        effects: [
          {
            operation: 'ADD_COMPONENT',
            entity: 'actor',
            component: 'test:component',
            data: { key: 'value' }  // Optional field
          }
        ],
        cost: 1.5,
        abstractPreconditions: {  // Optional field
          testPrecondition: {
            description: 'Test precondition',
            parameters: ['actor'],
            simulationFunction: 'assumeTrue'
          }
        }
      };

      mockSchemaValidator.validate.mockReturnValue({ isValid: true });

      const result = generator.validateEffects('test:action', effects);

      expect(result.valid).toBe(true);
    });
  });

  describe('component reference validation', () => {
    beforeEach(() => {
      mockSchemaValidator.validate.mockReturnValue({ isValid: true });
    });

    it('should accept valid component references (mod:component)', () => {
      const effects = {
        effects: [
          {
            operation: 'ADD_COMPONENT',
            entity: 'actor',
            component: 'positioning:sitting'
          },
          {
            operation: 'REMOVE_COMPONENT',
            entity: 'target',
            component: 'items:in_inventory'
          }
        ],
        cost: 1.0
      };

      const result = generator.validateEffects('test:action', effects);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject component references without colon separator', () => {
      const effects = {
        effects: [
          {
            operation: 'ADD_COMPONENT',
            entity: 'actor',
            component: 'positioning_sitting'  // Missing colon
          }
        ],
        cost: 1.0
      };

      const result = generator.validateEffects('test:action', effects);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e =>
        e.type === 'invalid_component' &&
        e.message.includes('positioning_sitting')
      )).toBe(true);
    });

    it('should reject component references with empty mod ID', () => {
      const effects = {
        effects: [
          {
            operation: 'ADD_COMPONENT',
            entity: 'actor',
            component: ':sitting'  // Empty mod ID
          }
        ],
        cost: 1.0
      };

      const result = generator.validateEffects('test:action', effects);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.type === 'invalid_component')).toBe(true);
    });

    it('should reject component references with empty component ID', () => {
      const effects = {
        effects: [
          {
            operation: 'ADD_COMPONENT',
            entity: 'actor',
            component: 'positioning:'  // Empty component ID
          }
        ],
        cost: 1.0
      };

      const result = generator.validateEffects('test:action', effects);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.type === 'invalid_component')).toBe(true);
    });

    it('should handle effects without component field (CONDITIONAL)', () => {
      const effects = {
        effects: [
          {
            operation: 'CONDITIONAL',
            condition: { '==': [1, 1] },
            then: [
              {
                operation: 'ADD_COMPONENT',
                entity: 'actor',
                component: 'test:component'
              }
            ]
          }
        ],
        cost: 1.0
      };

      const result = generator.validateEffects('test:action', effects);

      expect(result.valid).toBe(true);
    });
  });

  describe('abstract precondition validation', () => {
    beforeEach(() => {
      mockSchemaValidator.validate.mockReturnValue({ isValid: true });
    });

    it('should accept valid abstract preconditions', () => {
      const effects = {
        effects: [
          {
            operation: 'ADD_COMPONENT',
            entity: 'actor',
            component: 'test:component'
          }
        ],
        cost: 1.0,
        abstractPreconditions: {
          targetHasSpace: {
            description: 'Checks if target has inventory space',
            parameters: ['target'],
            simulationFunction: 'assumeTrue'
          }
        }
      };

      const result = generator.validateEffects('test:action', effects);

      expect(result.valid).toBe(true);
    });

    it('should reject precondition missing description', () => {
      const effects = {
        effects: [
          {
            operation: 'ADD_COMPONENT',
            entity: 'actor',
            component: 'test:component'
          }
        ],
        cost: 1.0,
        abstractPreconditions: {
          invalidPrecondition: {
            parameters: ['target'],
            simulationFunction: 'assumeTrue'
            // Missing description
          }
        }
      };

      const result = generator.validateEffects('test:action', effects);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e =>
        e.type === 'invalid_precondition' &&
        e.message.includes('invalidPrecondition')
      )).toBe(true);
    });

    it('should reject precondition missing parameters', () => {
      const effects = {
        effects: [
          {
            operation: 'ADD_COMPONENT',
            entity: 'actor',
            component: 'test:component'
          }
        ],
        cost: 1.0,
        abstractPreconditions: {
          invalidPrecondition: {
            description: 'Test',
            simulationFunction: 'assumeTrue'
            // Missing parameters
          }
        }
      };

      const result = generator.validateEffects('test:action', effects);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.type === 'invalid_precondition')).toBe(true);
    });

    it('should reject precondition missing simulationFunction', () => {
      const effects = {
        effects: [
          {
            operation: 'ADD_COMPONENT',
            entity: 'actor',
            component: 'test:component'
          }
        ],
        cost: 1.0,
        abstractPreconditions: {
          invalidPrecondition: {
            description: 'Test',
            parameters: ['target']
            // Missing simulationFunction
          }
        }
      };

      const result = generator.validateEffects('test:action', effects);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.type === 'invalid_precondition')).toBe(true);
    });

    it('should accept multiple valid preconditions', () => {
      const effects = {
        effects: [
          {
            operation: 'ADD_COMPONENT',
            entity: 'actor',
            component: 'test:component'
          }
        ],
        cost: 1.0,
        abstractPreconditions: {
          precondition1: {
            description: 'First precondition',
            parameters: ['actor'],
            simulationFunction: 'assumeTrue'
          },
          precondition2: {
            description: 'Second precondition',
            parameters: ['target'],
            simulationFunction: 'assumeFalse'
          }
        }
      };

      const result = generator.validateEffects('test:action', effects);

      expect(result.valid).toBe(true);
    });
  });

  describe('empty effects warning', () => {
    beforeEach(() => {
      mockSchemaValidator.validate.mockReturnValue({ isValid: true });
    });

    it('should warn when effects array is empty', () => {
      const effects = {
        effects: [],
        cost: 1.0
      };

      const result = generator.validateEffects('test:action', effects);

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].type).toBe('empty');
      expect(result.warnings[0].message).toBe('No effects generated');
    });

    it('should not warn when effects array has items', () => {
      const effects = {
        effects: [
          {
            operation: 'ADD_COMPONENT',
            entity: 'actor',
            component: 'test:component'
          }
        ],
        cost: 1.0
      };

      const result = generator.validateEffects('test:action', effects);

      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('multiple validation errors', () => {
    it('should collect multiple validation errors', () => {
      const effects = {
        effects: [
          {
            operation: 'ADD_COMPONENT',
            entity: 'actor',
            component: 'invalid_component'  // Invalid component reference
          },
          {
            operation: 'ADD_COMPONENT',
            entity: 'actor',
            component: 'another_invalid'  // Another invalid reference
          }
        ],
        cost: 1.0,
        abstractPreconditions: {
          badPrecondition: {
            description: 'Missing parameters and simulationFunction'
          }
        }
      };

      mockSchemaValidator.validate.mockReturnValue({ isValid: true });

      const result = generator.validateEffects('test:action', effects);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
      expect(result.errors.some(e => e.type === 'invalid_component')).toBe(true);
      expect(result.errors.some(e => e.type === 'invalid_precondition')).toBe(true);
    });

    it('should collect both schema and semantic errors', () => {
      const effects = {
        effects: [
          {
            operation: 'ADD_COMPONENT',
            entity: 'actor',
            component: 'invalid_reference'
          }
        ],
        cost: 1.0
      };

      mockSchemaValidator.validate.mockReturnValue({
        isValid: false,
        errors: ['Schema validation failed']
      });

      const result = generator.validateEffects('test:action', effects);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.type === 'schema')).toBe(true);
      expect(result.errors.some(e => e.type === 'invalid_component')).toBe(true);
    });
  });
});
