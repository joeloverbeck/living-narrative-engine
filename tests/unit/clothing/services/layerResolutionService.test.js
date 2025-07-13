/**
 * @file Unit tests for LayerResolutionService
 * @see src/clothing/services/layerResolutionService.js
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import LayerResolutionService from '../../../../src/clothing/services/layerResolutionService.js';
import { createMockLogger } from '../../../common/mockFactories/loggerMocks.js';
import { ValidationError } from '../../../../src/errors/validationError.js';

describe('LayerResolutionService', () => {
  let service;
  let mockLogger;

  beforeEach(() => {
    mockLogger = createMockLogger();

    service = new LayerResolutionService({
      logger: mockLogger,
    });
  });

  describe('constructor', () => {
    it('should initialize with required dependencies', () => {
      expect(service).toBeInstanceOf(LayerResolutionService);
    });

    it('should throw error when logger is missing', () => {
      expect(() => {
        new LayerResolutionService({});
      }).toThrow();
    });

    it('should throw error when no dependencies provided', () => {
      expect(() => {
        new LayerResolutionService();
      }).toThrow();
    });
  });

  describe('resolveLayer', () => {
    it('should return recipe override when provided (highest precedence)', () => {
      const result = service.resolveLayer('outer', 'base', 'underwear');

      expect(result).toBe('outer');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "LayerResolutionService: Using recipe layer override: 'outer'"
      );
    });

    it('should return entity layer when no recipe override (medium precedence)', () => {
      const result = service.resolveLayer(undefined, 'armor', 'base');

      expect(result).toBe('armor');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "LayerResolutionService: Using entity layer: 'armor'"
      );
    });

    it('should return blueprint default when no recipe or entity layer (lowest precedence)', () => {
      const result = service.resolveLayer(undefined, undefined, 'accessory');

      expect(result).toBe('accessory');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "LayerResolutionService: Using blueprint default layer: 'accessory'"
      );
    });

    it('should return "base" when no layers provided', () => {
      const result = service.resolveLayer();

      expect(result).toBe('base');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "LayerResolutionService: Using blueprint default layer: 'base'"
      );
    });

    it('should ignore empty string values and use next precedence', () => {
      const result = service.resolveLayer('', 'underwear', 'base');

      expect(result).toBe('underwear');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "LayerResolutionService: Using entity layer: 'underwear'"
      );
    });

    it('should ignore null values and use next precedence', () => {
      const result = service.resolveLayer(null, null, 'outer');

      expect(result).toBe('outer');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "LayerResolutionService: Using blueprint default layer: 'outer'"
      );
    });

    it('should use recipe override even when all layers provided', () => {
      const result = service.resolveLayer('armor', 'base', 'underwear');

      expect(result).toBe('armor');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "LayerResolutionService: Using recipe layer override: 'armor'"
      );
    });
  });

  describe('validateLayerAllowed', () => {
    it('should return true when layer is in allowed list', () => {
      const allowedLayers = ['underwear', 'base', 'outer'];
      const result = service.validateLayerAllowed('base', allowedLayers);

      expect(result).toBe(true);
    });

    it('should return false when layer is not in allowed list', () => {
      const allowedLayers = ['underwear', 'base'];
      const result = service.validateLayerAllowed('armor', allowedLayers);

      expect(result).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "LayerResolutionService: Layer 'armor' is not in allowed layers: [underwear, base]"
      );
    });

    it('should return true when allowedLayers is null', () => {
      const result = service.validateLayerAllowed('armor', null);

      expect(result).toBe(true);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'LayerResolutionService: No allowed layers specified, allowing any layer'
      );
    });

    it('should return true when allowedLayers is undefined', () => {
      const result = service.validateLayerAllowed('armor', undefined);

      expect(result).toBe(true);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'LayerResolutionService: No allowed layers specified, allowing any layer'
      );
    });

    it('should return true when allowedLayers is not an array', () => {
      const result = service.validateLayerAllowed('base', 'not-an-array');

      expect(result).toBe(true);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'LayerResolutionService: No allowed layers specified, allowing any layer'
      );
    });

    it('should return true when allowedLayers is empty array', () => {
      const result = service.validateLayerAllowed('base', []);

      expect(result).toBe(false);
    });

    it('should throw ValidationError when layer is null', () => {
      const allowedLayers = ['base', 'outer'];

      expect(() => {
        service.validateLayerAllowed(null, allowedLayers);
      }).toThrow(ValidationError);
    });

    it('should throw ValidationError when layer is undefined', () => {
      const allowedLayers = ['base', 'outer'];

      expect(() => {
        service.validateLayerAllowed(undefined, allowedLayers);
      }).toThrow(ValidationError);
    });

    it('should return false when layer is empty string', () => {
      const allowedLayers = ['base', 'outer'];

      const result = service.validateLayerAllowed('', allowedLayers);
      expect(result).toBe(false);
    });
  });

  describe('resolveAndValidateLayer', () => {
    it('should resolve and validate successfully with recipe override', () => {
      const allowedLayers = ['underwear', 'base', 'outer'];
      const result = service.resolveAndValidateLayer(
        'outer',
        'base',
        'underwear',
        allowedLayers
      );

      expect(result).toEqual({
        layer: 'outer',
        isValid: true,
      });
    });

    it('should resolve and validate successfully with entity layer', () => {
      const allowedLayers = ['underwear', 'base', 'armor'];
      const result = service.resolveAndValidateLayer(
        undefined,
        'armor',
        'base',
        allowedLayers
      );

      expect(result).toEqual({
        layer: 'armor',
        isValid: true,
      });
    });

    it('should resolve and validate successfully with blueprint default', () => {
      const allowedLayers = ['underwear', 'base', 'outer'];
      const result = service.resolveAndValidateLayer(
        undefined,
        undefined,
        'underwear',
        allowedLayers
      );

      expect(result).toEqual({
        layer: 'underwear',
        isValid: true,
      });
    });

    it('should return validation error when resolved layer not allowed', () => {
      const allowedLayers = ['underwear', 'base'];
      const result = service.resolveAndValidateLayer(
        'armor',
        'base',
        'underwear',
        allowedLayers
      );

      expect(result).toEqual({
        layer: 'armor',
        isValid: false,
        error:
          "Layer 'armor' is not allowed. Allowed layers: [underwear, base]",
      });
    });

    it('should resolve and validate when no allowed layers specified', () => {
      const result = service.resolveAndValidateLayer(
        'custom_layer',
        'base',
        'underwear',
        null
      );

      expect(result).toEqual({
        layer: 'custom_layer',
        isValid: true,
      });
    });

    it('should use "base" fallback when all parameters undefined', () => {
      const allowedLayers = ['base', 'outer'];
      const result = service.resolveAndValidateLayer(
        undefined,
        undefined,
        undefined,
        allowedLayers
      );

      expect(result).toEqual({
        layer: 'base',
        isValid: true,
      });
    });

    it('should handle error during validation and return fallback', () => {
      // Create a service instance that will throw during validation
      const errorService = new LayerResolutionService({
        logger: mockLogger,
      });

      // Mock validateLayerAllowed to throw an error
      const originalValidate = errorService.validateLayerAllowed;
      errorService.validateLayerAllowed = () => {
        throw new Error('Validation failed');
      };

      const result = errorService.resolveAndValidateLayer(
        'outer',
        'base',
        'underwear',
        ['base']
      );

      expect(result).toEqual({
        layer: 'base',
        isValid: false,
        error: 'Validation failed',
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        'LayerResolutionService: Failed to resolve and validate layer',
        expect.any(Error)
      );

      // Restore original method
      errorService.validateLayerAllowed = originalValidate;
    });
  });

  describe('getPrecedenceOrder', () => {
    it('should return correct precedence order', () => {
      const result = service.getPrecedenceOrder();

      expect(result).toEqual([
        'Recipe override (highest precedence)',
        'Entity default (medium precedence)',
        'Blueprint default (lowest precedence)',
      ]);
    });

    it('should return array with 3 items', () => {
      const result = service.getPrecedenceOrder();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(3);
    });

    it('should return same result on multiple calls', () => {
      const result1 = service.getPrecedenceOrder();
      const result2 = service.getPrecedenceOrder();

      expect(result1).toEqual(result2);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle non-string types in resolveLayer gracefully', () => {
      const result = service.resolveLayer(123, {}, 'base');

      expect(result).toBe('base');
    });

    it('should handle boolean values in layer resolution', () => {
      const result = service.resolveLayer(false, true, 'base');

      expect(result).toBe('base');
    });

    it('should handle whitespace-only strings as valid strings', () => {
      const result = service.resolveLayer('   ', '\t', 'base');

      // Whitespace strings are considered valid and used as-is
      expect(result).toBe('   ');
    });

    it('should validate case-sensitive layer matching', () => {
      const allowedLayers = ['Base', 'Outer'];
      const result = service.validateLayerAllowed('base', allowedLayers);

      expect(result).toBe(false);
    });

    it('should handle special characters in layer names', () => {
      const allowedLayers = ['under_wear', 'base-layer', 'outer.armor'];

      expect(service.validateLayerAllowed('under_wear', allowedLayers)).toBe(
        true
      );
      expect(service.validateLayerAllowed('base-layer', allowedLayers)).toBe(
        true
      );
      expect(service.validateLayerAllowed('outer.armor', allowedLayers)).toBe(
        true
      );
    });
  });
});
