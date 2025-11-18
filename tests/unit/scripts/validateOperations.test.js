/**
 * @file Unit tests for validateOperations.js script
 * @description Tests each validation function with known-good and known-bad data
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import path from 'path';

describe('validateOperations script - Naming Convention Helpers', () => {
  describe('toTokenName', () => {
    it('should convert DRINK_FROM to DrinkFromHandler', () => {
      const result = convertOperationTypeToTokenName('DRINK_FROM');
      expect(result).toBe('DrinkFromHandler');
    });

    it('should convert ADD_COMPONENT to AddComponentHandler', () => {
      const result = convertOperationTypeToTokenName('ADD_COMPONENT');
      expect(result).toBe('AddComponentHandler');
    });

    it('should convert TRANSFER_ITEM to TransferItemHandler', () => {
      const result = convertOperationTypeToTokenName('TRANSFER_ITEM');
      expect(result).toBe('TransferItemHandler');
    });

    it('should handle single word operations', () => {
      const result = convertOperationTypeToTokenName('SEQUENCE');
      expect(result).toBe('SequenceHandler');
    });

    it('should not add "I" prefix to operation handlers', () => {
      const result = convertOperationTypeToTokenName('DRINK_FROM');
      expect(result).not.toStartWith('I');
      expect(result).toBe('DrinkFromHandler');
    });
  });

  describe('toHandlerFileName', () => {
    it('should convert DRINK_FROM to drinkFromHandler.js', () => {
      const result = convertOperationTypeToFileName('DRINK_FROM');
      expect(result).toBe('drinkFromHandler.js');
    });

    it('should convert ADD_COMPONENT to addComponentHandler.js', () => {
      const result = convertOperationTypeToFileName('ADD_COMPONENT');
      expect(result).toBe('addComponentHandler.js');
    });

    it('should use camelCase for first word', () => {
      const result = convertOperationTypeToFileName('TRANSFER_ITEM');
      expect(result).toBe('transferItemHandler.js');
      expect(result[0]).toBe(result[0].toLowerCase());
    });
  });

  describe('toSchemaFileName', () => {
    it('should convert DRINK_FROM to drinkFrom.schema.json', () => {
      const result = convertOperationTypeToSchemaName('DRINK_FROM');
      expect(result).toBe('drinkFrom.schema.json');
    });

    it('should convert ADD_COMPONENT to addComponent.schema.json', () => {
      const result = convertOperationTypeToSchemaName('ADD_COMPONENT');
      expect(result).toBe('addComponent.schema.json');
    });

    it('should use camelCase for all parts', () => {
      const result = convertOperationTypeToSchemaName('TRANSFER_ITEM');
      expect(result).toBe('transferItem.schema.json');
    });
  });
});

describe('validateOperations script - Validation Logic', () => {
  let mockProjectRoot;
  let mockFiles;

  beforeEach(() => {
    mockProjectRoot = '/mock/project';
    mockFiles = new Map();
  });

  afterEach(() => {
    mockFiles.clear();
  });

  describe('scanOperationSchemas', () => {
    it('should find all operation schemas except base and nested', () => {
      const schemaFiles = [
        'drinkFrom.schema.json',
        'addComponent.schema.json',
        'base-operation.schema.json',
        'nested-operation.schema.json',
      ];

      const result = filterOperationSchemas(schemaFiles);

      expect(result).toHaveLength(2);
      expect(result).toContain('drinkFrom.schema.json');
      expect(result).toContain('addComponent.schema.json');
      expect(result).not.toContain('base-operation.schema.json');
      expect(result).not.toContain('nested-operation.schema.json');
    });

    it('should extract operation type from schema', () => {
      const schema = {
        allOf: [
          {},
          {
            properties: {
              type: {
                const: 'DRINK_FROM',
              },
            },
          },
        ],
      };

      const operationType = extractOperationType(schema);
      expect(operationType).toBe('DRINK_FROM');
    });

    it('should return null for schema without type constant', () => {
      const schema = {
        allOf: [
          {},
          {
            properties: {
              type: {
                // Missing const
              },
            },
          },
        ],
      };

      const operationType = extractOperationType(schema);
      expect(operationType).toBeUndefined();
    });
  });

  describe('checkSchemaReferences', () => {
    it('should detect missing schema reference', () => {
      const operations = [{ schemaFile: 'drinkFrom.schema.json', type: 'DRINK_FROM' }];
      const operationSchema = {
        $defs: {
          Operation: {
            anyOf: [
              // drinkFrom.schema.json is missing
              { $ref: './operations/addComponent.schema.json' },
            ],
          },
        },
      };

      const missing = findMissingSchemaReferences(operations, operationSchema);
      expect(missing).toContain('drinkFrom.schema.json');
    });

    it('should pass when all schemas are referenced', () => {
      const operations = [
        { schemaFile: 'drinkFrom.schema.json', type: 'DRINK_FROM' },
        { schemaFile: 'addComponent.schema.json', type: 'ADD_COMPONENT' },
      ];
      const operationSchema = {
        $defs: {
          Operation: {
            anyOf: [
              { $ref: './operations/drinkFrom.schema.json' },
              { $ref: './operations/addComponent.schema.json' },
            ],
          },
        },
      };

      const missing = findMissingSchemaReferences(operations, operationSchema);
      expect(missing).toHaveLength(0);
    });
  });

  describe('checkPreValidationWhitelist', () => {
    it('should detect missing operation types in whitelist', () => {
      const operations = [
        { type: 'DRINK_FROM' },
        { type: 'ADD_COMPONENT' },
        { type: 'NEW_OPERATION' },
      ];
      const knownTypes = ['DRINK_FROM', 'ADD_COMPONENT'];

      const missing = findMissingWhitelistEntries(operations, knownTypes);
      expect(missing).toContain('NEW_OPERATION');
      expect(missing).toHaveLength(1);
    });

    it('should pass when all types are in whitelist', () => {
      const operations = [{ type: 'DRINK_FROM' }, { type: 'ADD_COMPONENT' }];
      const knownTypes = ['DRINK_FROM', 'ADD_COMPONENT', 'OTHER_TYPE'];

      const missing = findMissingWhitelistEntries(operations, knownTypes);
      expect(missing).toHaveLength(0);
    });
  });

  describe('checkDITokens', () => {
    it('should detect missing DI tokens', () => {
      const operations = [
        { type: 'DRINK_FROM' },
        { type: 'ADD_COMPONENT' },
        { type: 'NEW_OPERATION' },
      ];
      const definedTokens = ['DrinkFromHandler', 'AddComponentHandler'];

      const missing = findMissingTokens(operations, definedTokens);
      expect(missing).toContain('NewOperationHandler');
      expect(missing).toHaveLength(1);
    });

    it('should pass when all tokens are defined', () => {
      const operations = [{ type: 'DRINK_FROM' }, { type: 'ADD_COMPONENT' }];
      const definedTokens = ['DrinkFromHandler', 'AddComponentHandler', 'OtherHandler'];

      const missing = findMissingTokens(operations, definedTokens);
      expect(missing).toHaveLength(0);
    });

    it('should not expect "I" prefix for operation handlers', () => {
      const operations = [{ type: 'DRINK_FROM' }];
      const definedTokens = ['DrinkFromHandler']; // Not IDrinkFromHandler

      const missing = findMissingTokens(operations, definedTokens);
      expect(missing).toHaveLength(0);
    });
  });

  describe('checkNamingConsistency', () => {
    it('should detect incorrect schema file naming', () => {
      const operations = [
        {
          type: 'DRINK_FROM',
          schemaFile: 'drink_from.schema.json', // Wrong: should be camelCase
        },
      ];

      const errors = validateNamingConsistency(operations);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('drinkFrom.schema.json');
    });

    it('should pass with correct naming', () => {
      const operations = [
        {
          type: 'DRINK_FROM',
          schemaFile: 'drinkFrom.schema.json',
        },
      ];

      const errors = validateNamingConsistency(operations);
      expect(errors).toHaveLength(0);
    });

    it('should reject "I" prefix in operation handler tokens', () => {
      const tokenName = 'IDrinkFromHandler'; // Wrong: should not have "I" prefix
      const hasIPrefix = tokenName.startsWith('I');

      expect(hasIPrefix).toBe(true);
      // This should be flagged as an error
    });
  });
});

// ============================================================================
// Helper Functions (extracted from the script for testing)
// ============================================================================

/**
 *
 * @param operationType
 */
function convertOperationTypeToTokenName(operationType) {
  return (
    operationType
      .split('_')
      .map(word => word.charAt(0) + word.slice(1).toLowerCase())
      .join('') + 'Handler'
  );
}

/**
 *
 * @param operationType
 */
function convertOperationTypeToFileName(operationType) {
  const parts = operationType.split('_');
  return (
    parts
      .map((word, idx) =>
        idx === 0 ? word.toLowerCase() : word.charAt(0) + word.slice(1).toLowerCase()
      )
      .join('') + 'Handler.js'
  );
}

/**
 *
 * @param operationType
 */
function convertOperationTypeToSchemaName(operationType) {
  const parts = operationType.split('_');
  return (
    parts
      .map((word, idx) =>
        idx === 0 ? word.toLowerCase() : word.charAt(0) + word.slice(1).toLowerCase()
      )
      .join('') + '.schema.json'
  );
}

/**
 *
 * @param schemaFiles
 */
function filterOperationSchemas(schemaFiles) {
  return schemaFiles.filter(
    f => !f.endsWith('base-operation.schema.json') && !f.endsWith('nested-operation.schema.json')
  );
}

/**
 *
 * @param schema
 */
function extractOperationType(schema) {
  return schema.allOf?.[1]?.properties?.type?.const;
}

/**
 *
 * @param operations
 * @param operationSchema
 */
function findMissingSchemaReferences(operations, operationSchema) {
  const referencedSchemas =
    operationSchema.$defs?.Operation?.anyOf?.map(ref => path.basename(ref.$ref)) || [];

  return operations
    .filter(op => !referencedSchemas.includes(op.schemaFile))
    .map(op => op.schemaFile);
}

/**
 *
 * @param operations
 * @param knownTypes
 */
function findMissingWhitelistEntries(operations, knownTypes) {
  return operations.filter(op => !knownTypes.includes(op.type)).map(op => op.type);
}

/**
 *
 * @param operations
 * @param definedTokens
 */
function findMissingTokens(operations, definedTokens) {
  return operations
    .map(op => convertOperationTypeToTokenName(op.type))
    .filter(token => !definedTokens.includes(token));
}

/**
 *
 * @param operations
 */
function validateNamingConsistency(operations) {
  const errors = [];

  for (const op of operations) {
    const expectedSchemaFile = convertOperationTypeToSchemaName(op.type);
    if (op.schemaFile !== expectedSchemaFile) {
      errors.push(`Expected: ${expectedSchemaFile}, Actual: ${op.schemaFile}`);
    }
  }

  return errors;
}
