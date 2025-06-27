import { describe, test, expect } from '@jest/globals';
import {
  formatAjvErrorToStandardizedError,
  formatSemanticErrorToStandardizedError,
} from '../../../../src/llms/services/llmConfigErrorFormatter.js';

describe('llmConfigErrorFormatter', () => {
  describe('formatAjvErrorToStandardizedError', () => {
    test('handles root instance path', () => {
      const ajvError = { instancePath: '', message: 'fail', params: {} };
      const result = formatAjvErrorToStandardizedError(ajvError, {});
      expect(result).toEqual(
        expect.objectContaining({
          errorType: 'SCHEMA_VALIDATION',
          configId: 'N/A (root data)',
          path: '(root)',
          message: 'fail',
        })
      );
    });

    test('handles configs entry path with array indices and allowedValues', () => {
      const ajvError = {
        instancePath: '/configs/test/promptElements/0/prefix',
        keyword: 'enum',
        params: { allowedValues: ['a', 'b'] },
        message: 'bad value',
      };
      const result = formatAjvErrorToStandardizedError(ajvError, {
        configs: { test: {} },
      });
      expect(result.configId).toBe('test');
      expect(result.path).toBe('configs.test.promptElements[0].prefix');
      expect(result.expected).toEqual(['a', 'b']);
    });

    test('handles defaultConfigId path when configs missing', () => {
      const ajvError = {
        instancePath: '/defaultConfigId',
        keyword: 'type',
        params: { type: 'string' },
        message: 'wrong type',
      };
      const result = formatAjvErrorToStandardizedError(ajvError, null);
      expect(result.configId).toBe('N/A (root property)');
      expect(result.path).toBe('defaultConfigId');
      expect(result.expected).toBe('string');
    });

    test('handles additionalProperties keyword', () => {
      const ajvError = {
        instancePath: '/configs/foo',
        keyword: 'additionalProperties',
        params: { additionalProperty: 'bar' },
        message: 'is not allowed',
      };
      const result = formatAjvErrorToStandardizedError(ajvError, {
        configs: { foo: {} },
      });
      expect(result.message).toContain("'bar'");
    });

    test('handles unknown path structure', () => {
      const ajvError = {
        instancePath: '/',
        message: 'oops',
        params: {},
      };
      const result = formatAjvErrorToStandardizedError(ajvError, {
        configs: {},
      });
      expect(result.configId).toBe('N/A (unknown path structure)');
      expect(result.path).toBe('(root)');
    });
  });

  describe('formatSemanticErrorToStandardizedError', () => {
    test('formats root structure error', () => {
      const err = {
        configId: 'N/A - Root "configs" property',
        message: 'bad structure',
        path: '(root).configs',
        errorType: 'SEMANTIC_VALIDATION_INVALID_CONFIGS_STRUCTURE',
      };
      const result = formatSemanticErrorToStandardizedError(err);
      expect(result).toEqual(
        expect.objectContaining({
          configId: 'N/A (root property)',
          path: 'configs',
        })
      );
    });

    test('formats config specific error with relative path', () => {
      const err = {
        configId: 'myCfg',
        message: 'missing',
        path: 'promptAssemblyOrder[2]',
        errorType: 'SEMANTIC_VALIDATION_MISSING_ASSEMBLY_KEY',
      };
      const result = formatSemanticErrorToStandardizedError(err);
      expect(result.configId).toBe('myCfg');
      expect(result.path).toBe('configs.myCfg.promptAssemblyOrder[2]');
    });

    test('formats fallback error', () => {
      const err = { configId: undefined, message: 'no path' };
      const result = formatSemanticErrorToStandardizedError(err);
      expect(result.configId).toBe('N/A');
      expect(result.path).toBe('(path not specified)');
    });
  });
});
