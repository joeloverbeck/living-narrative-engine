import { describe, it, expect, beforeEach } from '@jest/globals';
import { IRecipeValidator } from '../../../src/interfaces/IRecipeValidator.js';

describe('IRecipeValidator Interface', () => {
  describe('abstract methods', () => {
    let validator;

    beforeEach(() => {
      validator = new IRecipeValidator();
    });

    it('should throw when name getter not implemented', () => {
      expect(() => validator.name).toThrow(
        'IRecipeValidator.name not implemented'
      );
    });

    it('should throw when priority getter not implemented', () => {
      expect(() => validator.priority).toThrow(
        'IRecipeValidator.priority not implemented'
      );
    });

    it('should throw when validate method not implemented', async () => {
      await expect(validator.validate({}, {})).rejects.toThrow(
        'IRecipeValidator.validate not implemented'
      );
    });
  });

  describe('default behavior', () => {
    it('should default failFast to false', () => {
      const validator = new IRecipeValidator();
      expect(validator.failFast).toBe(false);
    });
  });

  describe('method signatures', () => {
    it('should accept recipe and options parameters in validate', async () => {
      const validator = new IRecipeValidator();
      const recipe = { recipeId: 'test:recipe' };
      const options = { recipePath: 'path/to/recipe.json' };

      // Should accept both parameters without throwing synchronously
      const promise = validator.validate(recipe, options);
      expect(promise).toBeInstanceOf(Promise);

      // Will throw asynchronously because not implemented
      await expect(promise).rejects.toThrow();
    });

    it('should accept recipe without options parameter', async () => {
      const validator = new IRecipeValidator();
      const recipe = { recipeId: 'test:recipe' };

      // Should accept single parameter
      const promise = validator.validate(recipe);
      expect(promise).toBeInstanceOf(Promise);

      // Will throw asynchronously because not implemented
      await expect(promise).rejects.toThrow();
    });
  });

  describe('interface contract', () => {
    it('should be instantiable as base class', () => {
      expect(() => new IRecipeValidator()).not.toThrow();
    });

    it('should have all required properties defined', () => {
      const validator = new IRecipeValidator();

      // Check getters exist (accessing them will throw, but they're defined)
      expect(() => validator.name).toThrow();
      expect(() => validator.priority).toThrow();
      expect(validator.failFast).toBeDefined();
    });

    it('should have validate method defined', () => {
      const validator = new IRecipeValidator();
      expect(typeof validator.validate).toBe('function');
    });
  });

  describe('error messages', () => {
    let validator;

    beforeEach(() => {
      validator = new IRecipeValidator();
    });

    it('should throw clear error for unimplemented name', () => {
      expect(() => {
        // Access the name getter to trigger the error
        return validator.name;
      }).toThrow(
        expect.objectContaining({
          message: expect.stringContaining('IRecipeValidator.name'),
        })
      );
    });

    it('should throw clear error for unimplemented priority', () => {
      expect(() => {
        // Access the priority getter to trigger the error
        return validator.priority;
      }).toThrow(
        expect.objectContaining({
          message: expect.stringContaining('IRecipeValidator.priority'),
        })
      );
    });

    it('should throw clear error for unimplemented validate', async () => {
      await expect(validator.validate({}, {})).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining('IRecipeValidator.validate'),
        })
      );
    });
  });
});
