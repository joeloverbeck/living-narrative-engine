/**
 * @jest-environment node
 */
/**
 * @file Unit tests for scripts/lintSchemaPatterns.js
 * @see tickets/SCHVALTESINT-009-schema-pattern-lint-script.md
 */

import {
  jest,
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
} from '@jest/globals';

describe('lintSchemaPatterns', () => {
  let lintSchemaPatterns;
  let processExitSpy;
  let consoleLogSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    lintSchemaPatterns = require('../../../scripts/lintSchemaPatterns.js');
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    processExitSpy.mockRestore();
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('TEMPLATE_PATTERN_REGEX', () => {
    test('should match template string regex patterns', () => {
      const { TEMPLATE_PATTERN_REGEX } = lintSchemaPatterns;
      // The actual pattern in schema files looks like:
      // "^\\{[a-zA-Z_][a-zA-Z0-9_]*(\\.[a-zA-Z_][a-zA-Z0-9_]*)*\\}$"
      expect(
        TEMPLATE_PATTERN_REGEX.test(
          '^\\\\{[a-zA-Z_][a-zA-Z0-9_]*(\\\\.[a-zA-Z_][a-zA-Z0-9_]*)*\\\\}$'
        )
      ).toBe(true);
    });

    test('should not match non-template regex patterns', () => {
      const { TEMPLATE_PATTERN_REGEX } = lintSchemaPatterns;
      expect(TEMPLATE_PATTERN_REGEX.test('^[a-z]+$')).toBe(false);
      expect(TEMPLATE_PATTERN_REGEX.test('^\\S(.*\\S)?$')).toBe(false);
    });
  });

  describe('getSchemaFiles', () => {
    test('should return only .schema.json files', async () => {
      const { getSchemaFiles } = lintSchemaPatterns;
      const mockFs = {
        readdir: jest
          .fn()
          .mockResolvedValue([
            'lockGrabbing.schema.json',
            'unlockGrabbing.schema.json',
            'base-operation.schema.json',
            'README.md',
            '.gitkeep',
          ]),
      };

      const result = await getSchemaFiles('/mock/operations', mockFs);
      expect(result).toEqual([
        'lockGrabbing.schema.json',
        'unlockGrabbing.schema.json',
        'base-operation.schema.json',
      ]);
    });

    test('should return empty array on directory read error', async () => {
      const { getSchemaFiles } = lintSchemaPatterns;
      const mockFs = {
        readdir: jest.fn().mockRejectedValue(new Error('ENOENT')),
      };

      const result = await getSchemaFiles('/nonexistent', mockFs);
      expect(result).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error reading operations directory')
      );
    });
  });

  describe('findLocalOneOfPatterns', () => {
    test('should detect local oneOf with template pattern', () => {
      const { findLocalOneOfPatterns } = lintSchemaPatterns;

      // This is what a LOCAL pattern looks like (should be flagged)
      const schemaWithLocalPattern = {
        $defs: {
          Parameters: {
            properties: {
              count: {
                oneOf: [
                  { type: 'integer' },
                  {
                    type: 'string',
                    pattern:
                      '^\\\\{[a-zA-Z_][a-zA-Z0-9_]*(\\\\.[a-zA-Z_][a-zA-Z0-9_]*)*\\\\}$',
                  },
                ],
              },
            },
          },
        },
      };

      const result = findLocalOneOfPatterns(schemaWithLocalPattern);
      expect(result).toHaveLength(1);
      expect(result[0]).toBe('$defs.Parameters.properties.count');
    });

    test('should NOT flag $ref patterns', () => {
      const { findLocalOneOfPatterns } = lintSchemaPatterns;

      // This is what a CORRECT pattern looks like (should NOT be flagged)
      const schemaWithRef = {
        $defs: {
          Parameters: {
            properties: {
              count: {
                $ref: '../common.schema.json#/definitions/integerOrTemplate',
              },
            },
          },
        },
      };

      const result = findLocalOneOfPatterns(schemaWithRef);
      expect(result).toHaveLength(0);
    });

    test('should NOT flag oneOf without template string pattern', () => {
      const { findLocalOneOfPatterns } = lintSchemaPatterns;

      // oneOf for MathOperand (number | object | nested expression)
      const schemaWithNonTemplateOneOf = {
        MathOperand: {
          oneOf: [
            { type: 'number' },
            {
              type: 'object',
              properties: { var: { type: 'string' } },
            },
          ],
        },
      };

      const result = findLocalOneOfPatterns(schemaWithNonTemplateOneOf);
      expect(result).toHaveLength(0);
    });

    test('should detect multiple violations in nested structure', () => {
      const { findLocalOneOfPatterns } = lintSchemaPatterns;

      const schemaWithMultipleViolations = {
        properties: {
          field1: {
            oneOf: [
              { type: 'integer' },
              {
                type: 'string',
                pattern:
                  '^\\\\{[a-zA-Z_][a-zA-Z0-9_]*(\\\\.[a-zA-Z_][a-zA-Z0-9_]*)*\\\\}$',
              },
            ],
          },
        },
        $defs: {
          Nested: {
            properties: {
              field2: {
                oneOf: [
                  { type: 'boolean' },
                  {
                    type: 'string',
                    pattern:
                      '^\\\\{[a-zA-Z_][a-zA-Z0-9_]*(\\\\.[a-zA-Z_][a-zA-Z0-9_]*)*\\\\}$',
                  },
                ],
              },
            },
          },
        },
      };

      const result = findLocalOneOfPatterns(schemaWithMultipleViolations);
      expect(result).toHaveLength(2);
      expect(result).toContain('properties.field1');
      expect(result).toContain('$defs.Nested.properties.field2');
    });

    test('should return empty array for null/undefined input', () => {
      const { findLocalOneOfPatterns } = lintSchemaPatterns;
      expect(findLocalOneOfPatterns(null)).toEqual([]);
      expect(findLocalOneOfPatterns(undefined)).toEqual([]);
    });
  });

  describe('lintSchemaFile', () => {
    test('should return null for valid schema without violations', async () => {
      const { lintSchemaFile } = lintSchemaPatterns;

      const validSchema = {
        $defs: {
          Parameters: {
            properties: {
              count: {
                $ref: '../common.schema.json#/definitions/integerOrTemplate',
              },
            },
          },
        },
      };

      const mockFs = {
        readFile: jest.fn().mockResolvedValue(JSON.stringify(validSchema)),
      };

      const result = await lintSchemaFile('/mock/valid.schema.json', mockFs);
      expect(result).toBeNull();
    });

    test('should return violation object for schema with local oneOf', async () => {
      const { lintSchemaFile } = lintSchemaPatterns;

      const invalidSchema = {
        $defs: {
          Parameters: {
            properties: {
              count: {
                oneOf: [
                  { type: 'integer' },
                  {
                    type: 'string',
                    pattern:
                      '^\\\\{[a-zA-Z_][a-zA-Z0-9_]*(\\\\.[a-zA-Z_][a-zA-Z0-9_]*)*\\\\}$',
                  },
                ],
              },
            },
          },
        },
      };

      const mockFs = {
        readFile: jest.fn().mockResolvedValue(JSON.stringify(invalidSchema)),
      };

      const result = await lintSchemaFile('/mock/invalid.schema.json', mockFs);
      expect(result).not.toBeNull();
      expect(result.file).toBe('/mock/invalid.schema.json');
      expect(result.paths).toContain('$defs.Parameters.properties.count');
      expect(result.suggestion).toContain('common.schema.json');
    });

    test('should return error for invalid JSON', async () => {
      const { lintSchemaFile } = lintSchemaPatterns;

      const mockFs = {
        readFile: jest.fn().mockResolvedValue('{ invalid json }'),
      };

      const result = await lintSchemaFile('/mock/broken.schema.json', mockFs);
      expect(result).not.toBeNull();
      expect(result.paths).toContain('(parse error)');
      expect(result.suggestion).toContain('Error');
    });

    test('should return error for file read failure', async () => {
      const { lintSchemaFile } = lintSchemaPatterns;

      const mockFs = {
        readFile: jest.fn().mockRejectedValue(new Error('ENOENT')),
      };

      const result = await lintSchemaFile('/mock/missing.schema.json', mockFs);
      expect(result).not.toBeNull();
      expect(result.suggestion).toContain('ENOENT');
    });
  });

  describe('lintSchemas', () => {
    test('should return empty array when no violations', async () => {
      const { lintSchemas } = lintSchemaPatterns;

      const validSchema = {
        properties: {
          count: {
            $ref: '../common.schema.json#/definitions/integerOrTemplate',
          },
        },
      };

      const mockFs = {
        readdir: jest.fn().mockResolvedValue(['valid.schema.json']),
        readFile: jest.fn().mockResolvedValue(JSON.stringify(validSchema)),
      };

      const mockPath = {
        join: (...args) => args.join('/'),
      };

      const result = await lintSchemas('/mock/operations', mockFs, mockPath);
      expect(result).toEqual([]);
    });

    test('should return violations array when issues found', async () => {
      const { lintSchemas } = lintSchemaPatterns;

      const invalidSchema = {
        properties: {
          count: {
            oneOf: [
              { type: 'integer' },
              {
                type: 'string',
                pattern:
                  '^\\\\{[a-zA-Z_][a-zA-Z0-9_]*(\\\\.[a-zA-Z_][a-zA-Z0-9_]*)*\\\\}$',
              },
            ],
          },
        },
      };

      const mockFs = {
        readdir: jest.fn().mockResolvedValue(['bad.schema.json']),
        readFile: jest.fn().mockResolvedValue(JSON.stringify(invalidSchema)),
      };

      const mockPath = {
        join: (...args) => args.join('/'),
      };

      const result = await lintSchemas('/mock/operations', mockFs, mockPath);
      expect(result).toHaveLength(1);
      expect(result[0].file).toBe('/mock/operations/bad.schema.json');
    });
  });

  describe('main (CLI)', () => {
    test('should exit 0 when no violations found', async () => {
      const { main } = lintSchemaPatterns;

      const validSchema = {
        properties: {
          count: {
            $ref: '../common.schema.json#/definitions/integerOrTemplate',
          },
        },
      };

      const mockFs = {
        readdir: jest.fn().mockResolvedValue(['valid.schema.json']),
        readFile: jest.fn().mockResolvedValue(JSON.stringify(validSchema)),
      };

      const mockPath = {
        join: (...args) => args.join('/'),
      };

      await main('/mock/operations', mockFs, mockPath);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '✅ All operation schemas use $ref patterns correctly'
      );
      expect(processExitSpy).toHaveBeenCalledWith(0);
    });

    test('should exit 1 when violations found', async () => {
      const { main } = lintSchemaPatterns;

      const invalidSchema = {
        properties: {
          count: {
            oneOf: [
              { type: 'integer' },
              {
                type: 'string',
                pattern:
                  '^\\\\{[a-zA-Z_][a-zA-Z0-9_]*(\\\\.[a-zA-Z_][a-zA-Z0-9_]*)*\\\\}$',
              },
            ],
          },
        },
      };

      const mockFs = {
        readdir: jest.fn().mockResolvedValue(['bad.schema.json']),
        readFile: jest.fn().mockResolvedValue(JSON.stringify(invalidSchema)),
      };

      const mockPath = {
        join: (...args) => args.join('/'),
      };

      await main('/mock/operations', mockFs, mockPath);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Found schemas with local oneOf patterns')
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    test('should exit 0 when no schema files found', async () => {
      const { main } = lintSchemaPatterns;

      const mockFs = {
        readdir: jest.fn().mockResolvedValue([]),
      };

      const mockPath = {
        join: (...args) => args.join('/'),
      };

      await main('/mock/empty', mockFs, mockPath);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '✅ All operation schemas use $ref patterns correctly'
      );
      expect(processExitSpy).toHaveBeenCalledWith(0);
    });
  });
});
