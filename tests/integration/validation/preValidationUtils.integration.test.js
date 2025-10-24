/**
 * @file preValidationUtils.integration.test.js
 * @description Integration coverage for pre-validation utilities to ensure
 * production validation catches malformed operations and rules.
 */

import { describe, it, expect, jest } from '@jest/globals';
import {
  validateOperationStructure,
  validateAllOperations,
  validateRuleStructure,
  performPreValidation,
  formatPreValidationError,
} from '../../../src/utils/preValidationUtils.js';
import { validateAgainstSchema } from '../../../src/utils/schemaValidationUtils.js';

describe('preValidationUtils integration', () => {
  describe('validateOperationStructure', () => {
    it('rejects non-object operations with actionable guidance', () => {
      const result = validateOperationStructure(null);

      expect(result).toEqual({
        isValid: false,
        error: 'Operation must be an object',
        path: 'root',
        suggestions: [
          'Ensure the operation is a valid JSON object with type and parameters fields',
        ],
      });
    });

    it('rejects macro references that incorrectly include a type field', () => {
      const result = validateOperationStructure({
        macro: 'core:follow-leader',
        type: 'QUERY_COMPONENT',
      });

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Macro reference should not have a type field');
      expect(result.path).toBe('root');
      expect(result.suggestions).toContain(
        'Use either {"macro": "namespace:id"} OR {"type": "OPERATION_TYPE", "parameters": {...}}'
      );
    });

    it('accepts macro references without additional fields', () => {
      const result = validateOperationStructure({ macro: 'core:follow-leader' });

      expect(result).toEqual({
        isValid: true,
        error: null,
        path: null,
        suggestions: null,
      });
    });

    it('detects missing type and lists the first valid operation suggestions', () => {
      const result = validateOperationStructure({ parameters: {} });

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Missing required "type" field in operation');
      expect(result.suggestions?.[1]).toMatch(/Valid operation types include:/);
    });

    it('rejects non-string operation types', () => {
      const result = validateOperationStructure({ type: 42 });

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Operation "type" field must be a string');
    });

    it('rejects unknown operation types with enumerated suggestions', () => {
      const result = validateOperationStructure({ type: 'NOT_A_REAL_OPERATION', parameters: {} });

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Unknown operation type "NOT_A_REAL_OPERATION"');
      expect(result.suggestions?.[1]).toBe('QUERY_COMPONENT');
      expect(result.suggestions?.at(-1)).toMatch(/more$/);
    });

    it('rejects missing parameters for operations that require them', () => {
      const result = validateOperationStructure({ type: 'QUERY_COMPONENT' });

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Missing "parameters" field for operation type "QUERY_COMPONENT"');
    });

    it('accepts END_TURN without parameters while still requiring other types', () => {
      const endTurnResult = validateOperationStructure({ type: 'END_TURN' });
      const sequenceResult = validateOperationStructure({ type: 'SEQUENCE', parameters: {} });

      expect(endTurnResult.isValid).toBe(true);
      expect(sequenceResult.isValid).toBe(true);
    });

    it('rejects parameters that are not objects', () => {
      const result = validateOperationStructure({
        type: 'QUERY_COMPONENT',
        parameters: 'not-an-object',
      });

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Operation type "QUERY_COMPONENT" requires a parameters object');
      expect(result.path).toBe('root');
      expect(result.suggestions?.[0]).toBe('Required parameters: entity_ref, component_type, result_variable');
    });

    it('flags invalid parameter fields and suggests corrections when a value exists', () => {
      const result = validateOperationStructure({
        type: 'QUERY_COMPONENT',
        parameters: {
          entity_id: 'core:actor',
          component_type: 'core:actor',
          result_variable: 'actorComponent',
        },
      });

      expect(result.isValid).toBe(false);
      expect(result.path).toBe('root.parameters');
      expect(result.suggestions).toEqual([
        'Use "entity_ref" instead of "entity_id"',
        'QUERY_COMPONENT expects: entity_ref, component_type, result_variable',
        'Change to: "entity_ref": "core:actor"',
      ]);
    });

    it('handles invalid fields without providing change suggestion when value missing', () => {
      const result = validateOperationStructure({
        type: 'ADD_COMPONENT',
        parameters: {
          entity_id: undefined,
          component_type: 'core:actor',
        },
      });

      expect(result.isValid).toBe(false);
      expect(result.suggestions).toEqual([
        'Use "entity_ref" instead of "entity_id"',
        'ADD_COMPONENT expects: entity_ref, component_type',
      ]);
    });

    it('accepts well formed operations that satisfy known rules', () => {
      const result = validateOperationStructure({
        type: 'QUERY_COMPONENT',
        parameters: {
          entity_ref: 'core:actor',
          component_type: 'core:actor',
          result_variable: 'actorComponent',
        },
      });

      expect(result.isValid).toBe(true);
    });
  });

  describe('validateAllOperations', () => {
    it('returns success for empty or null data', () => {
      expect(validateAllOperations(null)).toEqual({
        isValid: true,
        error: null,
        path: null,
        suggestions: null,
      });
    });

    it('returns enhanced error context when an operation in an array fails validation', () => {
      const operations = [
        {
          type: 'END_TURN',
        },
        {
          parameters: {},
        },
      ];

      const result = validateAllOperations(operations, 'root.actions', true);

      expect(result.isValid).toBe(false);
      expect(result.path).toBe('root.actions[1]');
      expect(result.error).toContain('Operation at index 1 failed validation');
      expect(result.suggestions?.[0]).toContain('Add a "type" field');
      expect(result.suggestions?.[result.suggestions.length - 1]).toContain('Problematic operation:');
    });

    it('skips deep validation for macro references while still scanning siblings', () => {
      const operations = [
        {
          macro: 'core:do-something',
        },
        {
          type: 'END_TURN',
        },
      ];

      const result = validateAllOperations(operations, 'root.actions', true);

      expect(result.isValid).toBe(true);
    });

    it('recursively validates nested operation collections within parameters', () => {
      const operations = [
        {
          type: 'SEQUENCE',
          parameters: {
            actions: [
              {
                type: 'UNKNOWN_OPERATION',
                parameters: {},
              },
            ],
          },
        },
      ];

      const result = validateAllOperations(operations, 'root.actions', true);

      expect(result.isValid).toBe(false);
      expect(result.path).toBe('root.actions[0].parameters.actions[0]');
      expect(result.error).toContain('Unknown operation type "UNKNOWN_OPERATION"');
    });

    it('scans non-operation object properties for nested collections', () => {
      const structure = {
        metadata: {
          nested: {
            actions: [
              {
                type: 'REMOVE_COMPONENT',
                parameters: {
                  entity_ref: 'core:actor',
                  component_type: 'core:actor',
                },
              },
            ],
          },
        },
      };

      const result = validateAllOperations(structure, 'root');

      expect(result.isValid).toBe(true);
    });
  });

  describe('validateRuleStructure', () => {
    it('requires rule data to be an object', () => {
      const result = validateRuleStructure(null);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Rule data must be an object');
    });

    it('requires an event_type field', () => {
      const result = validateRuleStructure({ actions: [{}] });

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Missing required "event_type" field in rule');
    });

    it('requires an actions array', () => {
      const result = validateRuleStructure({ event_type: 'core:event' });

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Missing required "actions" field in rule');
    });

    it('ensures actions is an array', () => {
      const result = validateRuleStructure({
        event_type: 'core:event',
        actions: {},
      });

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Rule "actions" field must be an array');
      expect(result.path).toBe('actions');
    });

    it('ensures the actions array is not empty', () => {
      const result = validateRuleStructure({
        event_type: 'core:event',
        actions: [],
      });

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Rule "actions" array cannot be empty');
    });

    it('propagates operation validation errors with accurate paths', () => {
      const result = validateRuleStructure({
        event_type: 'core:event',
        actions: [
          {
            type: 'UNKNOWN_OPERATION',
            parameters: {},
          },
        ],
      });

      expect(result.isValid).toBe(false);
      expect(result.path).toBe('root.actions[0]');
      expect(result.error).toContain('Unknown operation type');
    });

    it('accepts well-formed rules with nested operations', () => {
      const result = validateRuleStructure({
        event_type: 'core:event',
        actions: [
          {
            type: 'SEQUENCE',
            parameters: {
              actions: [
                {
                  type: 'END_TURN',
                },
              ],
            },
          },
        ],
      });

      expect(result.isValid).toBe(true);
    });
  });

  describe('performPreValidation', () => {
    it('runs rule-specific validation for rule schemas', () => {
      const result = performPreValidation(
        {
          event_type: 'core:event',
          actions: [],
        },
        'schema://living-narrative-engine/rule.schema.json'
      );

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Rule "actions" array cannot be empty');
    });

    it('skips validation for non-rule schemas', () => {
      const result = performPreValidation({}, 'schema://other-schema.json');

      expect(result).toEqual({ isValid: true, error: null, path: null, suggestions: null });
    });
  });

  describe('formatPreValidationError', () => {
    it('summarizes successful validations succinctly', () => {
      const message = formatPreValidationError(
        { isValid: true, error: null, path: null, suggestions: null },
        'file.json',
        'schema'
      );

      expect(message).toBe('No pre-validation errors');
    });

    it('generates detailed error reports when validation fails', () => {
      const message = formatPreValidationError(
        {
          isValid: false,
          error: 'Something went wrong',
          path: 'root.actions[0]',
          suggestions: ['Fix it', 'Try again'],
        },
        'file.json',
        'schema'
      );

      expect(message).toContain('Pre-validation failed for');
      expect(message).toContain('Location: root.actions[0]');
      expect(message).toContain('- Fix it');
    });
  });

  describe('integration with schemaValidationUtils', () => {
    it('surfaces pre-validation failures before AJV validation occurs', () => {
      const validator = {
        isSchemaLoaded: () => true,
        validate: jest.fn().mockReturnValue({ isValid: true, errors: null }),
      };
      const logger = {
        debug: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };

      const faultyRule = {
        event_type: 'core:event',
        actions: [
          {
            type: 'UNKNOWN_OPERATION',
            parameters: {},
          },
        ],
      };

      expect(() =>
        validateAgainstSchema(
          validator,
          'schema://living-narrative-engine/rule.schema.json',
          faultyRule,
          logger,
          { filePath: '/mods/core/actions/faulty.action.json' }
        )
      ).toThrow(/Pre-validation failed/);

      expect(logger.error).toHaveBeenCalledWith(
        "Pre-validation failed for 'faulty.action.json'",
        expect.objectContaining({
          schemaId: 'schema://living-narrative-engine/rule.schema.json',
          preValidationError: expect.stringContaining('Unknown operation type'),
          preValidationPath: 'root.actions[0]',
        })
      );
      expect(validator.validate).not.toHaveBeenCalled();
    });

    it('allows skipping pre-validation when explicitly requested', () => {
      const validator = {
        isSchemaLoaded: () => true,
        validate: jest.fn().mockReturnValue({ isValid: true, errors: null }),
      };
      const logger = {
        debug: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };

      const faultyRule = {
        event_type: 'core:event',
        actions: [],
      };

      const result = validateAgainstSchema(
        validator,
        'schema://living-narrative-engine/rule.schema.json',
        faultyRule,
        logger,
        { skipPreValidation: true }
      );

      expect(result).toEqual({ isValid: true, errors: null });
      expect(validator.validate).toHaveBeenCalled();
      expect(logger.error).not.toHaveBeenCalled();
    });
  });
});
