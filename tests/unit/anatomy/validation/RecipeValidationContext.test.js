/**
 * @file RecipeValidationContext.test.js
 * @description Unit tests for RecipeValidationContext class
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import RecipeValidationContext from '../../../../src/anatomy/validation/RecipeValidationContext.js';

describe('RecipeValidationContext', () => {
  let mockDeps;

  beforeEach(() => {
    // Create mock dependencies with required methods
    mockDeps = {
      dataRegistry: {
        get: jest.fn(),
        getAll: jest.fn(),
      },
      schemaValidator: {
        validate: jest.fn(),
      },
      anatomyBlueprintRepository: {
        getBlueprint: jest.fn(),
        getRecipe: jest.fn(),
      },
      slotGenerator: {
        generateSlots: jest.fn(),
      },
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      },
    };
  });

  describe('Constructor', () => {
    it('should create context with all required dependencies', () => {
      const context = new RecipeValidationContext(mockDeps);

      expect(context.dataRegistry).toBe(mockDeps.dataRegistry);
      expect(context.schemaValidator).toBe(mockDeps.schemaValidator);
      expect(context.anatomyBlueprintRepository).toBe(mockDeps.anatomyBlueprintRepository);
      expect(context.slotGenerator).toBe(mockDeps.slotGenerator);
      expect(context.logger).toBe(mockDeps.logger);
    });

    it('should initialize with empty frozen config when no config provided', () => {
      const context = new RecipeValidationContext(mockDeps);

      expect(context.config).toEqual({});
      expect(Object.isFrozen(context.config)).toBe(true);
    });

    it('should initialize with frozen config when config provided', () => {
      const config = { strictMode: true, maxErrors: 10 };
      const context = new RecipeValidationContext({
        ...mockDeps,
        config,
      });

      expect(context.config).toEqual(config);
      expect(Object.isFrozen(context.config)).toBe(true);
    });

    it('should throw error when dataRegistry is missing', () => {
      // eslint-disable-next-line no-unused-vars
      const { dataRegistry, ...incompleteDeps } = mockDeps;

      expect(() => new RecipeValidationContext(incompleteDeps)).toThrow();
    });

    it('should throw error when dataRegistry lacks required methods', () => {
      const invalidDeps = {
        ...mockDeps,
        dataRegistry: { get: jest.fn() }, // Missing 'getAll'
      };

      expect(() => new RecipeValidationContext(invalidDeps)).toThrow();
    });

    it('should throw error when schemaValidator is missing', () => {
      // eslint-disable-next-line no-unused-vars
      const { schemaValidator, ...incompleteDeps } = mockDeps;

      expect(() => new RecipeValidationContext(incompleteDeps)).toThrow();
    });

    it('should throw error when schemaValidator lacks required methods', () => {
      const invalidDeps = {
        ...mockDeps,
        schemaValidator: {}, // Missing 'validate'
      };

      expect(() => new RecipeValidationContext(invalidDeps)).toThrow();
    });

    it('should throw error when anatomyBlueprintRepository is missing', () => {
      // eslint-disable-next-line no-unused-vars
      const { anatomyBlueprintRepository, ...incompleteDeps } = mockDeps;

      expect(() => new RecipeValidationContext(incompleteDeps)).toThrow();
    });

    it('should throw error when anatomyBlueprintRepository lacks required methods', () => {
      const invalidDeps = {
        ...mockDeps,
        anatomyBlueprintRepository: { getBlueprint: jest.fn() }, // Missing 'getRecipe'
      };

      expect(() => new RecipeValidationContext(invalidDeps)).toThrow();
    });

    it('should throw error when slotGenerator is missing', () => {
      // eslint-disable-next-line no-unused-vars
      const { slotGenerator, ...incompleteDeps } = mockDeps;

      expect(() => new RecipeValidationContext(incompleteDeps)).toThrow();
    });

    it('should throw error when slotGenerator lacks required methods', () => {
      const invalidDeps = {
        ...mockDeps,
        slotGenerator: {}, // Missing 'generateSlots'
      };

      expect(() => new RecipeValidationContext(invalidDeps)).toThrow();
    });

    it('should throw error when logger is missing', () => {
      // eslint-disable-next-line no-unused-vars
      const { logger, ...incompleteDeps } = mockDeps;

      expect(() => new RecipeValidationContext(incompleteDeps)).toThrow();
    });

    it('should throw error when logger lacks required methods', () => {
      const invalidDeps = {
        ...mockDeps,
        logger: { info: jest.fn(), warn: jest.fn() }, // Missing 'error' and 'debug'
      };

      expect(() => new RecipeValidationContext(invalidDeps)).toThrow();
    });
  });

  describe('Dependency Getters', () => {
    let context;

    beforeEach(() => {
      context = new RecipeValidationContext(mockDeps);
    });

    it('should return dataRegistry via getter', () => {
      expect(context.dataRegistry).toBe(mockDeps.dataRegistry);
    });

    it('should return schemaValidator via getter', () => {
      expect(context.schemaValidator).toBe(mockDeps.schemaValidator);
    });

    it('should return anatomyBlueprintRepository via getter', () => {
      expect(context.anatomyBlueprintRepository).toBe(mockDeps.anatomyBlueprintRepository);
    });

    it('should return slotGenerator via getter', () => {
      expect(context.slotGenerator).toBe(mockDeps.slotGenerator);
    });

    it('should return logger via getter', () => {
      expect(context.logger).toBe(mockDeps.logger);
    });

    it('should return frozen config via getter', () => {
      const config = { strictMode: true };
      const contextWithConfig = new RecipeValidationContext({
        ...mockDeps,
        config,
      });

      expect(contextWithConfig.config).toEqual(config);
      expect(Object.isFrozen(contextWithConfig.config)).toBe(true);
    });
  });

  describe('Immutability', () => {
    it('should not allow config mutation via getter', () => {
      const config = { strictMode: true };
      const context = new RecipeValidationContext({
        ...mockDeps,
        config,
      });

      expect(() => {
        context.config.strictMode = false;
      }).toThrow();
    });

    it('should not allow adding properties to config', () => {
      const context = new RecipeValidationContext(mockDeps);

      expect(() => {
        context.config.newProperty = 'value';
      }).toThrow();
    });

    it('should not have setters for dependencies', () => {
      const context = new RecipeValidationContext(mockDeps);

      expect(() => {
        context.dataRegistry = {};
      }).toThrow();
    });
  });

  describe('Metadata Management', () => {
    let context;

    beforeEach(() => {
      context = new RecipeValidationContext(mockDeps);
    });

    it('should store and retrieve metadata', () => {
      const testValue = { key: 'value' };
      context.setMetadata('testKey', testValue);

      expect(context.getMetadata('testKey')).toBe(testValue);
    });

    it('should return undefined for non-existent metadata', () => {
      expect(context.getMetadata('nonExistent')).toBeUndefined();
    });

    it('should check metadata existence correctly', () => {
      context.setMetadata('existingKey', 'value');

      expect(context.hasMetadata('existingKey')).toBe(true);
      expect(context.hasMetadata('nonExistent')).toBe(false);
    });

    it('should distinguish between undefined value and non-existent key', () => {
      context.setMetadata('undefinedKey', undefined);

      expect(context.hasMetadata('undefinedKey')).toBe(true);
      expect(context.getMetadata('undefinedKey')).toBeUndefined();
    });

    it('should allow storing complex objects as metadata', () => {
      const complexValue = {
        set: new Set(['item1', 'item2']),
        map: new Map([['key', 'value']]),
        array: [1, 2, 3],
      };

      context.setMetadata('complex', complexValue);

      expect(context.getMetadata('complex')).toBe(complexValue);
    });

    it('should allow overwriting existing metadata', () => {
      context.setMetadata('key', 'value1');
      context.setMetadata('key', 'value2');

      expect(context.getMetadata('key')).toBe('value2');
    });

    it('should maintain multiple metadata entries independently', () => {
      context.setMetadata('key1', 'value1');
      context.setMetadata('key2', 'value2');
      context.setMetadata('key3', 'value3');

      expect(context.getMetadata('key1')).toBe('value1');
      expect(context.getMetadata('key2')).toBe('value2');
      expect(context.getMetadata('key3')).toBe('value3');
    });
  });

  describe('Context Derivation', () => {
    let originalContext;

    beforeEach(() => {
      originalContext = new RecipeValidationContext({
        ...mockDeps,
        config: { strictMode: false, maxErrors: 10 },
      });
    });

    it('should create new context with merged config', () => {
      const derivedContext = originalContext.withConfig({ strictMode: true });

      expect(derivedContext.config).toEqual({
        strictMode: true,
        maxErrors: 10,
      });
    });

    it('should not mutate original context config', () => {
      const originalConfig = { ...originalContext.config };
      originalContext.withConfig({ strictMode: true });

      expect(originalContext.config).toEqual(originalConfig);
    });

    it('should share dependencies with derived context', () => {
      const derivedContext = originalContext.withConfig({ strictMode: true });

      expect(derivedContext.dataRegistry).toBe(originalContext.dataRegistry);
      expect(derivedContext.schemaValidator).toBe(originalContext.schemaValidator);
      expect(derivedContext.anatomyBlueprintRepository).toBe(
        originalContext.anatomyBlueprintRepository
      );
      expect(derivedContext.slotGenerator).toBe(originalContext.slotGenerator);
      expect(derivedContext.logger).toBe(originalContext.logger);
    });

    it('should create derived context with empty metadata', () => {
      originalContext.setMetadata('key', 'value');
      const derivedContext = originalContext.withConfig({ strictMode: true });

      expect(derivedContext.hasMetadata('key')).toBe(false);
    });

    it('should isolate metadata between original and derived contexts', () => {
      const derivedContext = originalContext.withConfig({ strictMode: true });

      originalContext.setMetadata('originalKey', 'originalValue');
      derivedContext.setMetadata('derivedKey', 'derivedValue');

      expect(originalContext.hasMetadata('derivedKey')).toBe(false);
      expect(derivedContext.hasMetadata('originalKey')).toBe(false);
    });

    it('should allow adding new config properties via withConfig', () => {
      const derivedContext = originalContext.withConfig({ newProperty: 'newValue' });

      expect(derivedContext.config).toEqual({
        strictMode: false,
        maxErrors: 10,
        newProperty: 'newValue',
      });
    });

    it('should freeze config in derived context', () => {
      const derivedContext = originalContext.withConfig({ strictMode: true });

      expect(Object.isFrozen(derivedContext.config)).toBe(true);
    });

    it('should allow multiple levels of derivation', () => {
      const derived1 = originalContext.withConfig({ level: 1 });
      const derived2 = derived1.withConfig({ level: 2 });
      const derived3 = derived2.withConfig({ level: 3 });

      expect(originalContext.config.level).toBeUndefined();
      expect(derived1.config.level).toBe(1);
      expect(derived2.config.level).toBe(2);
      expect(derived3.config.level).toBe(3);
    });
  });

  describe('Real-World Usage Scenarios', () => {
    it('should support typical validator workflow', () => {
      const context = new RecipeValidationContext(mockDeps);

      // Validator checks if components have been validated
      expect(context.hasMetadata('validatedComponents')).toBe(false);

      // Validator performs validation and stores results
      const validatedComponents = new Set(['core:actor', 'core:location']);
      context.setMetadata('validatedComponents', validatedComponents);

      // Another validator can check cached results
      expect(context.hasMetadata('validatedComponents')).toBe(true);
      expect(context.getMetadata('validatedComponents')).toBe(validatedComponents);
    });

    it('should support configuration-based validation strategies', () => {
      const baseContext = new RecipeValidationContext({
        ...mockDeps,
        config: { strictMode: false },
      });

      // Create strict validation context for critical recipes
      const strictContext = baseContext.withConfig({ strictMode: true });

      expect(baseContext.config.strictMode).toBe(false);
      expect(strictContext.config.strictMode).toBe(true);
    });

    it('should support sharing computed data between validators', () => {
      const context = new RecipeValidationContext(mockDeps);

      // First validator computes slot structure
      const slotStructure = {
        sockets: ['socket1', 'socket2'],
        slots: ['slot1', 'slot2', 'slot3'],
      };
      context.setMetadata('slotStructure', slotStructure);

      // Second validator reuses computed structure
      const cachedStructure = context.getMetadata('slotStructure');
      expect(cachedStructure).toBe(slotStructure);
    });
  });
});
