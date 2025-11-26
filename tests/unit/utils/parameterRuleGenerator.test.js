/**
 * @file parameterRuleGenerator.test.js
 * @description Unit tests for parameterRuleGenerator
 * @see tickets/SCHVALTESINT-010-parameter-rule-generator.md
 */

import { describe, it, expect } from '@jest/globals';
import {
  generateParameterRules,
  extractRuleFromSchema,
  detectTemplateFields,
  validateCoverage,
} from '../../../src/utils/parameterRuleGenerator.js';

describe('parameterRuleGenerator', () => {
  describe('extractRuleFromSchema', () => {
    it('should extract operation type from const', () => {
      const schema = {
        allOf: [
          { $ref: '../base-operation.schema.json' },
          {
            properties: {
              type: { const: 'TEST_OPERATION' },
              parameters: { $ref: '#/$defs/Parameters' },
            },
          },
        ],
        $defs: {
          Parameters: {
            properties: {
              field1: { type: 'string' },
            },
            required: ['field1'],
          },
        },
      };

      const result = extractRuleFromSchema(schema);
      expect(result).not.toBeNull();
      expect(result.operationType).toBe('TEST_OPERATION');
    });

    it('should extract required parameters', () => {
      const schema = {
        allOf: [
          { $ref: '../base-operation.schema.json' },
          {
            properties: {
              type: { const: 'TEST_OPERATION' },
              parameters: { $ref: '#/$defs/Parameters' },
            },
          },
        ],
        $defs: {
          Parameters: {
            properties: {
              requiredField: { type: 'string' },
              optionalField: { type: 'number' },
            },
            required: ['requiredField'],
          },
        },
      };

      const result = extractRuleFromSchema(schema);
      expect(result.required).toEqual(['requiredField']);
    });

    it('should extract optional parameters', () => {
      const schema = {
        allOf: [
          { $ref: '../base-operation.schema.json' },
          {
            properties: {
              type: { const: 'TEST_OPERATION' },
              parameters: { $ref: '#/$defs/Parameters' },
            },
          },
        ],
        $defs: {
          Parameters: {
            properties: {
              requiredField: { type: 'string' },
              optionalField1: { type: 'number' },
              optionalField2: { type: 'boolean' },
            },
            required: ['requiredField'],
          },
        },
      };

      const result = extractRuleFromSchema(schema);
      expect(result.optional).toContain('optionalField1');
      expect(result.optional).toContain('optionalField2');
      expect(result.optional).not.toContain('requiredField');
    });

    it('should return null for non-operation schemas', () => {
      const nonOperationSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
      };

      const result = extractRuleFromSchema(nonOperationSchema);
      expect(result).toBeNull();
    });

    it('should return null if allOf is missing', () => {
      const schemaWithoutAllOf = {
        properties: {
          type: { const: 'TEST_OPERATION' },
        },
      };

      const result = extractRuleFromSchema(schemaWithoutAllOf);
      expect(result).toBeNull();
    });

    it('should return null if allOf has fewer than 2 elements', () => {
      const schemaWithShortAllOf = {
        allOf: [{ $ref: '../base-operation.schema.json' }],
      };

      const result = extractRuleFromSchema(schemaWithShortAllOf);
      expect(result).toBeNull();
    });

    it('should return null if no operation type const is found', () => {
      const schemaWithoutTypeConst = {
        allOf: [
          { $ref: '../base-operation.schema.json' },
          {
            properties: {
              type: { type: 'string' },
              parameters: {},
            },
          },
        ],
      };

      const result = extractRuleFromSchema(schemaWithoutTypeConst);
      expect(result).toBeNull();
    });

    it('should handle operations without parameters definition', () => {
      const schemaWithoutParams = {
        allOf: [
          { $ref: '../base-operation.schema.json' },
          {
            properties: {
              type: { const: 'END_TURN' },
            },
          },
        ],
      };

      const result = extractRuleFromSchema(schemaWithoutParams);
      expect(result).not.toBeNull();
      expect(result.operationType).toBe('END_TURN');
      expect(result.required).toEqual([]);
      expect(result.optional).toEqual([]);
      expect(result.templateFields).toEqual([]);
    });

    it('should handle parameters without required array', () => {
      const schemaWithoutRequired = {
        allOf: [
          { $ref: '../base-operation.schema.json' },
          {
            properties: {
              type: { const: 'TEST_OPERATION' },
              parameters: { $ref: '#/$defs/Parameters' },
            },
          },
        ],
        $defs: {
          Parameters: {
            properties: {
              field1: { type: 'string' },
              field2: { type: 'number' },
            },
          },
        },
      };

      const result = extractRuleFromSchema(schemaWithoutRequired);
      expect(result.required).toEqual([]);
      expect(result.optional).toContain('field1');
      expect(result.optional).toContain('field2');
    });
  });

  describe('detectTemplateFields', () => {
    it('should detect $ref to common.schema.json template types', () => {
      const properties = {
        count: {
          $ref: '../common.schema.json#/definitions/positiveIntegerOrTemplate',
        },
        actor_id: { type: 'string' },
      };

      const result = detectTemplateFields(properties);
      expect(result).toContain('count');
    });

    it('should detect multiple template type references', () => {
      const properties = {
        amount: {
          $ref: '../common.schema.json#/definitions/integerOrTemplate',
        },
        enabled: {
          $ref: '../common.schema.json#/definitions/booleanOrTemplate',
        },
        target: {
          $ref: '../common.schema.json#/definitions/entityIdOrTemplate',
        },
      };

      const result = detectTemplateFields(properties);
      expect(result).toContain('amount');
      expect(result).toContain('enabled');
      expect(result).toContain('target');
    });

    it('should detect local oneOf template patterns with templateString ref', () => {
      const properties = {
        value: {
          oneOf: [
            { type: 'integer' },
            { $ref: '../common.schema.json#/definitions/templateString' },
          ],
        },
      };

      const result = detectTemplateFields(properties);
      expect(result).toContain('value');
    });

    it('should detect oneOf with string pattern containing template marker', () => {
      const properties = {
        dynamic: {
          oneOf: [
            { type: 'integer' },
            { type: 'string', pattern: '^\\{[a-zA-Z_]' },
          ],
        },
      };

      const result = detectTemplateFields(properties);
      expect(result).toContain('dynamic');
    });

    it('should treat string properties as template-capable', () => {
      const properties = {
        name: { type: 'string' },
        description: { type: 'string' },
      };

      const result = detectTemplateFields(properties);
      expect(result).toContain('name');
      expect(result).toContain('description');
    });

    it('should not detect non-string primitives without template refs', () => {
      const properties = {
        count: { type: 'integer' },
        enabled: { type: 'boolean' },
        amount: { type: 'number' },
      };

      const result = detectTemplateFields(properties);
      expect(result).not.toContain('count');
      expect(result).not.toContain('enabled');
      expect(result).not.toContain('amount');
    });

    it('should handle empty properties object', () => {
      const result = detectTemplateFields({});
      expect(result).toEqual([]);
    });

    it('should handle null or invalid property definitions', () => {
      const properties = {
        nullProp: null,
        undefinedProp: undefined,
        stringProp: 'invalid',
      };

      const result = detectTemplateFields(properties);
      expect(result).toEqual([]);
    });

    it('should detect stringOrTemplate ref', () => {
      const properties = {
        label: {
          $ref: '../common.schema.json#/definitions/stringOrTemplate',
        },
      };

      const result = detectTemplateFields(properties);
      expect(result).toContain('label');
    });

    it('should not match non-template $refs', () => {
      const properties = {
        entity: {
          $ref: '../common.schema.json#/definitions/entityReference',
        },
      };

      const result = detectTemplateFields(properties);
      expect(result).not.toContain('entity');
    });
  });

  describe('generateParameterRules', () => {
    it('should generate rules for all operation schemas', async () => {
      const rules = await generateParameterRules();

      expect(typeof rules).toBe('object');
      expect(Object.keys(rules).length).toBeGreaterThan(0);
    });

    it('should include schemaId in each rule', async () => {
      const rules = await generateParameterRules();

      for (const rule of Object.values(rules)) {
        expect(rule.schemaId).toBeDefined();
        expect(typeof rule.schemaId).toBe('string');
        expect(rule.schemaId).toContain('schema://');
      }
    });

    it('should generate rule structure with required, optional, and templateFields', async () => {
      const rules = await generateParameterRules();

      for (const rule of Object.values(rules)) {
        expect(Array.isArray(rule.required)).toBe(true);
        expect(Array.isArray(rule.optional)).toBe(true);
        expect(Array.isArray(rule.templateFields)).toBe(true);
      }
    });

    it('should generate correct rules for LOCK_GRABBING', async () => {
      const rules = await generateParameterRules();

      expect(rules.LOCK_GRABBING).toBeDefined();
      expect(rules.LOCK_GRABBING.required).toContain('actor_id');
      expect(rules.LOCK_GRABBING.required).toContain('count');
      expect(rules.LOCK_GRABBING.optional).toContain('item_id');
      expect(rules.LOCK_GRABBING.templateFields).toContain('count');
    });

    it('should generate correct rules for UNLOCK_GRABBING', async () => {
      const rules = await generateParameterRules();

      expect(rules.UNLOCK_GRABBING).toBeDefined();
      expect(rules.UNLOCK_GRABBING.required).toContain('actor_id');
      expect(rules.UNLOCK_GRABBING.required).toContain('count');
    });

    it('should generate valid structure for END_TURN with its required params', async () => {
      const rules = await generateParameterRules();

      // END_TURN has required parameters per its schema
      expect(rules.END_TURN).toBeDefined();
      expect(Array.isArray(rules.END_TURN.required)).toBe(true);
      expect(Array.isArray(rules.END_TURN.optional)).toBe(true);
      expect(Array.isArray(rules.END_TURN.templateFields)).toBe(true);
      // Verify it actually has required params as per schema
      expect(rules.END_TURN.required).toContain('entityId');
      expect(rules.END_TURN.required).toContain('success');
    });
  });

  describe('validateCoverage', () => {
    it('should identify missing rules', () => {
      const rules = {
        OPERATION_A: { required: [], optional: [], templateFields: [] },
        OPERATION_B: { required: [], optional: [], templateFields: [] },
      };
      const knownTypes = ['OPERATION_A', 'OPERATION_B', 'OPERATION_C'];

      const result = validateCoverage(rules, knownTypes);
      expect(result.missing).toContain('OPERATION_C');
      expect(result.missing).toHaveLength(1);
    });

    it('should identify extra rules', () => {
      const rules = {
        OPERATION_A: { required: [], optional: [], templateFields: [] },
        OPERATION_B: { required: [], optional: [], templateFields: [] },
        OPERATION_NEW: { required: [], optional: [], templateFields: [] },
      };
      const knownTypes = ['OPERATION_A', 'OPERATION_B'];

      const result = validateCoverage(rules, knownTypes);
      expect(result.extra).toContain('OPERATION_NEW');
      expect(result.extra).toHaveLength(1);
    });

    it('should return empty arrays when coverage complete', () => {
      const rules = {
        OPERATION_A: { required: [], optional: [], templateFields: [] },
        OPERATION_B: { required: [], optional: [], templateFields: [] },
      };
      const knownTypes = ['OPERATION_A', 'OPERATION_B'];

      const result = validateCoverage(rules, knownTypes);
      expect(result.missing).toEqual([]);
      expect(result.extra).toEqual([]);
    });

    it('should handle empty rules object', () => {
      const rules = {};
      const knownTypes = ['OPERATION_A', 'OPERATION_B'];

      const result = validateCoverage(rules, knownTypes);
      expect(result.missing).toEqual(['OPERATION_A', 'OPERATION_B']);
      expect(result.extra).toEqual([]);
    });

    it('should handle empty known types array', () => {
      const rules = {
        OPERATION_A: { required: [], optional: [], templateFields: [] },
      };
      const knownTypes = [];

      const result = validateCoverage(rules, knownTypes);
      expect(result.missing).toEqual([]);
      expect(result.extra).toEqual(['OPERATION_A']);
    });
  });

  describe('integration with KNOWN_OPERATION_TYPES', () => {
    it('should generate rules for most known operation types', async () => {
      const { KNOWN_OPERATION_TYPES } = await import(
        '../../../src/utils/preValidationUtils.js'
      );
      const rules = await generateParameterRules();
      const { missing, extra } = validateCoverage(rules, KNOWN_OPERATION_TYPES);

      // Log for debugging
      if (missing.length > 0) {
        console.log('Missing operation types:', missing);
      }
      if (extra.length > 0) {
        console.log('Extra operation types:', extra);
      }

      // Allow some flexibility - there may be a few operations without schemas
      // but the vast majority should be covered
      const coveragePercentage =
        (Object.keys(rules).length / KNOWN_OPERATION_TYPES.length) * 100;
      expect(coveragePercentage).toBeGreaterThan(90);
    });
  });
});
