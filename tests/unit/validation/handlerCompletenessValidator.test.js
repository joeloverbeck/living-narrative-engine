/**
 * @file Unit tests for HandlerCompletenessValidator
 * @see src/validation/handlerCompletenessValidator.js
 * @see tickets/ROBOPEHANVAL-004-handler-completeness-validator.md
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { HandlerCompletenessValidator } from '../../../src/validation/handlerCompletenessValidator.js';
import { ConfigurationError } from '../../../src/errors/configurationError.js';

describe('HandlerCompletenessValidator', () => {
  let validator;
  let mockLogger;
  let mockRegistry;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    mockRegistry = {
      hasHandler: jest.fn(),
      getRegisteredTypes: jest.fn(),
    };

    validator = new HandlerCompletenessValidator({ logger: mockLogger });
  });

  describe('validateRuleHandlerCompleteness', () => {
    it('should pass for rule where all operations have handlers', () => {
      mockRegistry.hasHandler.mockReturnValue(true);
      const rule = {
        id: 'test:rule_1',
        actions: [
          { type: 'ADD_COMPONENT', parameters: {} },
          { type: 'MODIFY_COMPONENT', parameters: {} },
        ],
      };

      expect(() =>
        validator.validateRuleHandlerCompleteness(rule, mockRegistry)
      ).not.toThrow();
    });

    it('should throw ConfigurationError for rule with one missing handler', () => {
      mockRegistry.hasHandler.mockImplementation(
        (type) => type !== 'MISSING_OP'
      );
      const rule = {
        id: 'test:rule_2',
        actions: [
          { type: 'ADD_COMPONENT', parameters: {} },
          { type: 'MISSING_OP', parameters: {} },
        ],
      };

      expect(() =>
        validator.validateRuleHandlerCompleteness(rule, mockRegistry)
      ).toThrow(ConfigurationError);
    });

    it('should throw ConfigurationError listing ALL missing handlers (not just first)', () => {
      mockRegistry.hasHandler.mockImplementation(
        (type) => !['MISSING_A', 'MISSING_B', 'MISSING_C'].includes(type)
      );
      const rule = {
        id: 'test:rule_3',
        actions: [
          { type: 'ADD_COMPONENT', parameters: {} },
          { type: 'MISSING_A', parameters: {} },
          { type: 'MISSING_B', parameters: {} },
          { type: 'MISSING_C', parameters: {} },
        ],
      };

      let error;
      try {
        validator.validateRuleHandlerCompleteness(rule, mockRegistry);
      } catch (e) {
        error = e;
      }

      expect(error).toBeInstanceOf(ConfigurationError);
      expect(error.message).toContain('MISSING_A');
      expect(error.message).toContain('MISSING_B');
      expect(error.message).toContain('MISSING_C');
    });

    it('should include rule ID in error message', () => {
      mockRegistry.hasHandler.mockReturnValue(false);
      const rule = {
        id: 'my_mod:my_rule',
        actions: [{ type: 'UNKNOWN_OP', parameters: {} }],
      };

      let error;
      try {
        validator.validateRuleHandlerCompleteness(rule, mockRegistry);
      } catch (e) {
        error = e;
      }

      expect(error).toBeInstanceOf(ConfigurationError);
      expect(error.message).toContain('my_mod:my_rule');
    });

    it('should include each missing operation type in error message', () => {
      mockRegistry.hasHandler.mockImplementation(
        (type) => !['OP_X', 'OP_Y'].includes(type)
      );
      const rule = {
        id: 'test:rule_4',
        actions: [
          { type: 'OP_X', parameters: {} },
          { type: 'OP_Y', parameters: {} },
        ],
      };

      let error;
      try {
        validator.validateRuleHandlerCompleteness(rule, mockRegistry);
      } catch (e) {
        error = e;
      }

      expect(error.message).toContain('- OP_X (no handler registered)');
      expect(error.message).toContain('- OP_Y (no handler registered)');
    });

    it('should handle rules with no actions array gracefully', () => {
      const rule = { id: 'test:no_actions' };

      expect(() =>
        validator.validateRuleHandlerCompleteness(rule, mockRegistry)
      ).not.toThrow();
    });

    it('should handle rules with empty actions array (passes validation)', () => {
      const rule = { id: 'test:empty_actions', actions: [] };

      expect(() =>
        validator.validateRuleHandlerCompleteness(rule, mockRegistry)
      ).not.toThrow();
    });

    it('should handle rules with undefined rule (uses <unknown> as ID)', () => {
      mockRegistry.hasHandler.mockReturnValue(false);

      let error;
      try {
        validator.validateRuleHandlerCompleteness(
          { actions: [{ type: 'MISSING' }] },
          mockRegistry
        );
      } catch (e) {
        error = e;
      }

      expect(error.message).toContain('<unknown>');
    });

    it('should detect missing handlers in nested IF then_actions', () => {
      mockRegistry.hasHandler.mockImplementation(
        (type) => type !== 'NESTED_MISSING'
      );
      const rule = {
        id: 'test:nested_then',
        actions: [
          {
            type: 'IF',
            parameters: {
              condition: { var: 'test' },
              then_actions: [{ type: 'NESTED_MISSING', parameters: {} }],
            },
          },
        ],
      };

      expect(() =>
        validator.validateRuleHandlerCompleteness(rule, mockRegistry)
      ).toThrow(ConfigurationError);
    });

    it('should detect missing handlers in nested IF else_actions', () => {
      mockRegistry.hasHandler.mockImplementation(
        (type) => type !== 'ELSE_MISSING'
      );
      const rule = {
        id: 'test:nested_else',
        actions: [
          {
            type: 'IF',
            parameters: {
              condition: { var: 'test' },
              then_actions: [],
              else_actions: [{ type: 'ELSE_MISSING', parameters: {} }],
            },
          },
        ],
      };

      expect(() =>
        validator.validateRuleHandlerCompleteness(rule, mockRegistry)
      ).toThrow(ConfigurationError);
    });

    it('should detect missing handlers in deeply nested operations', () => {
      mockRegistry.hasHandler.mockImplementation(
        (type) => type !== 'DEEP_MISSING'
      );
      const rule = {
        id: 'test:deep_nested',
        actions: [
          {
            type: 'IF',
            parameters: {
              condition: { var: 'level1' },
              then_actions: [
                {
                  type: 'IF',
                  parameters: {
                    condition: { var: 'level2' },
                    then_actions: [{ type: 'DEEP_MISSING', parameters: {} }],
                  },
                },
              ],
            },
          },
        ],
      };

      let error;
      try {
        validator.validateRuleHandlerCompleteness(rule, mockRegistry);
      } catch (e) {
        error = e;
      }

      expect(error).toBeInstanceOf(ConfigurationError);
      expect(error.message).toContain('DEEP_MISSING');
    });

    it('should skip macro references (operations with macro property)', () => {
      mockRegistry.hasHandler.mockReturnValue(true);
      const rule = {
        id: 'test:with_macros',
        actions: [
          { macro: 'core:some_macro' },
          { type: 'ADD_COMPONENT', parameters: {} },
          { macro: 'another:macro' },
        ],
      };

      expect(() =>
        validator.validateRuleHandlerCompleteness(rule, mockRegistry)
      ).not.toThrow();
      // Verify hasHandler was NOT called for macros
      expect(mockRegistry.hasHandler).not.toHaveBeenCalledWith(undefined);
    });

    it('should not report duplicate missing handlers', () => {
      mockRegistry.hasHandler.mockImplementation(
        (type) => type !== 'DUP_MISSING'
      );
      const rule = {
        id: 'test:duplicates',
        actions: [
          { type: 'DUP_MISSING', parameters: {} },
          { type: 'DUP_MISSING', parameters: {} },
          { type: 'DUP_MISSING', parameters: {} },
        ],
      };

      let error;
      try {
        validator.validateRuleHandlerCompleteness(rule, mockRegistry);
      } catch (e) {
        error = e;
      }

      // Should only list DUP_MISSING once
      const matches = error.message.match(/DUP_MISSING/g);
      expect(matches.length).toBe(1);
    });

    it('should sort missing handlers in error message for deterministic output', () => {
      mockRegistry.hasHandler.mockImplementation(
        (type) => !['Z_MISSING', 'A_MISSING', 'M_MISSING'].includes(type)
      );
      const rule = {
        id: 'test:sorting',
        actions: [
          { type: 'Z_MISSING', parameters: {} },
          { type: 'A_MISSING', parameters: {} },
          { type: 'M_MISSING', parameters: {} },
        ],
      };

      let error;
      try {
        validator.validateRuleHandlerCompleteness(rule, mockRegistry);
      } catch (e) {
        error = e;
      }

      // Verify sorted order (A, M, Z)
      const aIndex = error.message.indexOf('A_MISSING');
      const mIndex = error.message.indexOf('M_MISSING');
      const zIndex = error.message.indexOf('Z_MISSING');
      expect(aIndex).toBeLessThan(mIndex);
      expect(mIndex).toBeLessThan(zIndex);
    });
  });

  describe('validateHandlerRegistryCompleteness', () => {
    it('should return isComplete: true when whitelist matches registry exactly', () => {
      const knownTypes = [
        'ADD_COMPONENT',
        'MODIFY_COMPONENT',
        'REMOVE_COMPONENT',
      ];
      mockRegistry.getRegisteredTypes.mockReturnValue([
        'ADD_COMPONENT',
        'MODIFY_COMPONENT',
        'REMOVE_COMPONENT',
      ]);

      const result = validator.validateHandlerRegistryCompleteness(
        knownTypes,
        mockRegistry
      );

      expect(result.isComplete).toBe(true);
      expect(result.missingHandlers).toEqual([]);
      expect(result.orphanedHandlers).toEqual([]);
    });

    it('should return missing handlers when whitelist has types not in registry', () => {
      const knownTypes = ['ADD_COMPONENT', 'MISSING_FROM_REGISTRY'];
      mockRegistry.getRegisteredTypes.mockReturnValue(['ADD_COMPONENT']);

      const result = validator.validateHandlerRegistryCompleteness(
        knownTypes,
        mockRegistry
      );

      expect(result.isComplete).toBe(false);
      expect(result.missingHandlers).toEqual(['MISSING_FROM_REGISTRY']);
      expect(result.orphanedHandlers).toEqual([]);
    });

    it('should return orphaned handlers when registry has types not in whitelist', () => {
      const knownTypes = ['ADD_COMPONENT'];
      mockRegistry.getRegisteredTypes.mockReturnValue([
        'ADD_COMPONENT',
        'ORPHAN_HANDLER',
      ]);

      const result = validator.validateHandlerRegistryCompleteness(
        knownTypes,
        mockRegistry
      );

      expect(result.isComplete).toBe(false);
      expect(result.missingHandlers).toEqual([]);
      expect(result.orphanedHandlers).toEqual(['ORPHAN_HANDLER']);
    });

    it('should return both missing and orphaned when both exist', () => {
      const knownTypes = ['ADD_COMPONENT', 'WHITELIST_ONLY'];
      mockRegistry.getRegisteredTypes.mockReturnValue([
        'ADD_COMPONENT',
        'REGISTRY_ONLY',
      ]);

      const result = validator.validateHandlerRegistryCompleteness(
        knownTypes,
        mockRegistry
      );

      expect(result.isComplete).toBe(false);
      expect(result.missingHandlers).toEqual(['WHITELIST_ONLY']);
      expect(result.orphanedHandlers).toEqual(['REGISTRY_ONLY']);
    });

    it('should handle empty whitelist', () => {
      const knownTypes = [];
      mockRegistry.getRegisteredTypes.mockReturnValue(['ORPHAN_A', 'ORPHAN_B']);

      const result = validator.validateHandlerRegistryCompleteness(
        knownTypes,
        mockRegistry
      );

      expect(result.isComplete).toBe(false);
      expect(result.missingHandlers).toEqual([]);
      expect(result.orphanedHandlers).toEqual(['ORPHAN_A', 'ORPHAN_B']);
    });

    it('should handle empty registry', () => {
      const knownTypes = ['MISSING_A', 'MISSING_B'];
      mockRegistry.getRegisteredTypes.mockReturnValue([]);

      const result = validator.validateHandlerRegistryCompleteness(
        knownTypes,
        mockRegistry
      );

      expect(result.isComplete).toBe(false);
      expect(result.missingHandlers).toEqual(['MISSING_A', 'MISSING_B']);
      expect(result.orphanedHandlers).toEqual([]);
    });

    it('should handle both whitelist and registry empty', () => {
      const knownTypes = [];
      mockRegistry.getRegisteredTypes.mockReturnValue([]);

      const result = validator.validateHandlerRegistryCompleteness(
        knownTypes,
        mockRegistry
      );

      expect(result.isComplete).toBe(true);
      expect(result.missingHandlers).toEqual([]);
      expect(result.orphanedHandlers).toEqual([]);
    });

    it('should return sorted arrays for deterministic comparison', () => {
      const knownTypes = ['Z_TYPE', 'A_TYPE', 'M_TYPE'];
      mockRegistry.getRegisteredTypes.mockReturnValue([
        'Z_REG',
        'A_REG',
        'M_REG',
      ]);

      const result = validator.validateHandlerRegistryCompleteness(
        knownTypes,
        mockRegistry
      );

      expect(result.missingHandlers).toEqual(['A_TYPE', 'M_TYPE', 'Z_TYPE']);
      expect(result.orphanedHandlers).toEqual(['A_REG', 'M_REG', 'Z_REG']);
    });

    it('should handle mixed order in inputs and produce sorted outputs', () => {
      const knownTypes = ['D', 'B', 'C', 'A'];
      mockRegistry.getRegisteredTypes.mockReturnValue(['X', 'Y', 'Z', 'W']);

      const result = validator.validateHandlerRegistryCompleteness(
        knownTypes,
        mockRegistry
      );

      expect(result.missingHandlers).toEqual(['A', 'B', 'C', 'D']);
      expect(result.orphanedHandlers).toEqual(['W', 'X', 'Y', 'Z']);
    });
  });

  describe('constructor', () => {
    it('should accept a logger dependency', () => {
      expect(
        () => new HandlerCompletenessValidator({ logger: mockLogger })
      ).not.toThrow();
    });

    it('should use console as fallback when logger is missing', () => {
      // ensureValidLogger provides fallback to console
      expect(() => new HandlerCompletenessValidator({})).not.toThrow();
    });
  });
});
