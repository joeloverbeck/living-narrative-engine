/**
 * @file Unit tests for validateComponentOverrides function
 *
 * Tests early validation of component overrides from recipe slots against
 * entity definitions to provide actionable feedback to modders during
 * anatomy graph construction.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { validateComponentOverrides } from '../../../../src/anatomy/bodyBlueprintFactory/slotResolutionOrchestrator.js';
import { ValidationError } from '../../../../src/errors/validationError.js';

describe('validateComponentOverrides', () => {
  let mockLogger;
  let mockDataRegistry;

  beforeEach(() => {
    mockLogger = {
      warn: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      error: jest.fn(),
    };

    mockDataRegistry = {
      get: jest.fn(),
    };
  });

  describe('valid overrides', () => {
    it('should return all valid overrides unchanged', () => {
      mockDataRegistry.get.mockReturnValue({
        components: {
          'core:physical': { mass: 1 },
          'core:name': { text: 'default' },
        },
      });

      const overrides = {
        'core:physical': { mass: 10 },
        'core:name': { text: 'Custom Arm' },
      };

      const result = validateComponentOverrides(
        'anatomy:arm',
        overrides,
        mockDataRegistry,
        mockLogger
      );

      expect(mockLogger.warn).not.toHaveBeenCalled();
      expect(result).toEqual(overrides);
    });

    it('should return a subset of valid overrides when some are invalid', () => {
      mockDataRegistry.get.mockReturnValue({
        components: {
          'core:physical': { mass: 1 },
          'core:name': { text: 'default' },
        },
      });

      const overrides = {
        'core:physical': { mass: 10 },
        'core:nonexistent': { foo: 'bar' },
      };

      const result = validateComponentOverrides(
        'anatomy:arm',
        overrides,
        mockDataRegistry,
        mockLogger
      );

      expect(result).toEqual({ 'core:physical': { mass: 10 } });
      expect(result).not.toHaveProperty('core:nonexistent');
    });
  });

  describe('invalid overrides', () => {
    it('should log warning for overrides referencing non-existent components', () => {
      mockDataRegistry.get.mockReturnValue({
        components: {
          'core:physical': {},
          'core:name': {},
        },
      });

      const overrides = {
        'core:physical': { mass: 10 },
        'core:nonexistent': { foo: 'bar' },
      };

      validateComponentOverrides(
        'anatomy:arm',
        overrides,
        mockDataRegistry,
        mockLogger
      );

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('core:nonexistent')
      );
    });

    it('should include invalid component IDs in warning message', () => {
      mockDataRegistry.get.mockReturnValue({
        components: {
          'core:physical': {},
        },
      });

      const overrides = {
        'invalid:component1': { foo: 1 },
        'invalid:component2': { bar: 2 },
      };

      validateComponentOverrides(
        'anatomy:arm',
        overrides,
        mockDataRegistry,
        mockLogger
      );

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('invalid:component1')
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('invalid:component2')
      );
    });

    it('should include available component IDs in warning message', () => {
      mockDataRegistry.get.mockReturnValue({
        components: {
          'core:physical': {},
          'core:name': {},
        },
      });

      const overrides = {
        'core:nonexistent': { foo: 'bar' },
      };

      validateComponentOverrides(
        'anatomy:arm',
        overrides,
        mockDataRegistry,
        mockLogger
      );

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('core:physical')
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('core:name')
      );
    });

    it('should include part definition ID in warning message', () => {
      mockDataRegistry.get.mockReturnValue({
        components: {
          'core:physical': {},
        },
      });

      const overrides = {
        'core:nonexistent': { foo: 'bar' },
      };

      validateComponentOverrides(
        'anatomy:left_arm',
        overrides,
        mockDataRegistry,
        mockLogger
      );

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('anatomy:left_arm')
      );
    });
  });

  describe('strict mode', () => {
    it('should throw ValidationError in strict mode for invalid overrides', () => {
      mockDataRegistry.get.mockReturnValue({
        components: {
          'core:physical': {},
        },
      });

      const overrides = { 'invalid:component': {} };

      expect(() => {
        validateComponentOverrides(
          'anatomy:arm',
          overrides,
          mockDataRegistry,
          mockLogger,
          { strict: true }
        );
      }).toThrow(ValidationError);
    });

    it('should not call logger.warn in strict mode when throwing', () => {
      mockDataRegistry.get.mockReturnValue({
        components: {
          'core:physical': {},
        },
      });

      const overrides = { 'invalid:component': {} };

      try {
        validateComponentOverrides(
          'anatomy:arm',
          overrides,
          mockDataRegistry,
          mockLogger,
          { strict: true }
        );
      } catch {
        // Expected to throw
      }

      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should not throw in strict mode when all overrides are valid', () => {
      mockDataRegistry.get.mockReturnValue({
        components: {
          'core:physical': {},
        },
      });

      const overrides = { 'core:physical': { mass: 10 } };

      expect(() => {
        validateComponentOverrides(
          'anatomy:arm',
          overrides,
          mockDataRegistry,
          mockLogger,
          { strict: true }
        );
      }).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle empty overrides object', () => {
      const result = validateComponentOverrides(
        'anatomy:arm',
        {},
        mockDataRegistry,
        mockLogger
      );

      expect(result).toEqual({});
      expect(mockDataRegistry.get).not.toHaveBeenCalled();
    });

    it('should handle undefined overrides', () => {
      const result = validateComponentOverrides(
        'anatomy:arm',
        undefined,
        mockDataRegistry,
        mockLogger
      );

      expect(result).toBeUndefined();
      expect(mockDataRegistry.get).not.toHaveBeenCalled();
    });

    it('should handle null overrides', () => {
      const result = validateComponentOverrides(
        'anatomy:arm',
        null,
        mockDataRegistry,
        mockLogger
      );

      expect(result).toBeNull();
      expect(mockDataRegistry.get).not.toHaveBeenCalled();
    });

    it('should handle entity definition not found', () => {
      mockDataRegistry.get.mockReturnValue(undefined);

      const overrides = { 'core:physical': { mass: 10 } };

      const result = validateComponentOverrides(
        'anatomy:unknown_part',
        overrides,
        mockDataRegistry,
        mockLogger
      );

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('entity definition')
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('anatomy:unknown_part')
      );
      expect(result).toEqual(overrides);
    });

    it('should handle entity definition with no components property', () => {
      mockDataRegistry.get.mockReturnValue({});

      const overrides = { 'core:physical': { mass: 10 } };

      const result = validateComponentOverrides(
        'anatomy:arm',
        overrides,
        mockDataRegistry,
        mockLogger
      );

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('core:physical')
      );
      expect(result).toEqual({});
    });

    it('should handle entity definition with empty components object', () => {
      mockDataRegistry.get.mockReturnValue({
        components: {},
      });

      const overrides = { 'core:physical': { mass: 10 } };

      const result = validateComponentOverrides(
        'anatomy:arm',
        overrides,
        mockDataRegistry,
        mockLogger
      );

      expect(mockLogger.warn).toHaveBeenCalled();
      expect(result).toEqual({});
    });
  });

  describe('dataRegistry interaction', () => {
    it('should call dataRegistry.get with correct arguments', () => {
      mockDataRegistry.get.mockReturnValue({
        components: {
          'core:physical': {},
        },
      });

      const overrides = { 'core:physical': { mass: 10 } };

      validateComponentOverrides(
        'anatomy:arm',
        overrides,
        mockDataRegistry,
        mockLogger
      );

      expect(mockDataRegistry.get).toHaveBeenCalledWith(
        'entityDefinitions',
        'anatomy:arm'
      );
    });
  });
});
