/**
 * @file validationErrorContext.test.js
 * @description Unit tests for validationErrorContext module
 */

import { describe, it, expect } from '@jest/globals';
import {
  extractLineNumber,
  generateCodeSnippet,
  createValidationErrorContext,
  formatValidationErrors,
} from '../../../src/validation/validationErrorContext.js';

describe('validationErrorContext', () => {
  describe('extractLineNumber', () => {
    it('should find line number for simple property path', () => {
      const json = '{\n  "name": "test",\n  "value": 123\n}';
      expect(extractLineNumber(json, '/value')).toBe(3);
    });

    it('should find line number for nested property path', () => {
      const json =
        '{\n  "outer": {\n    "inner": {\n      "deep": "value"\n    }\n  }\n}';
      expect(extractLineNumber(json, '/outer/inner/deep')).toBe(4);
    });

    it('should find line number for nested array path', () => {
      const json =
        '{\n  "items": [\n    { "id": 1 },\n    { "id": 2 }\n  ]\n}';
      expect(extractLineNumber(json, '/items/1/id')).toBe(4);
    });

    it('should return 1 for root path (empty string)', () => {
      expect(extractLineNumber('{}', '')).toBe(1);
    });

    it('should return 1 for null path', () => {
      expect(extractLineNumber('{}', null)).toBe(1);
    });

    it('should return 1 for undefined path', () => {
      expect(extractLineNumber('{}', undefined)).toBe(1);
    });

    it('should handle first element in array', () => {
      const json = '{\n  "actions": [\n    { "type": "TEST" }\n  ]\n}';
      expect(extractLineNumber(json, '/actions/0')).toBe(3);
    });

    it('should handle property that appears multiple times', () => {
      const json =
        '{\n  "a": { "type": "first" },\n  "b": { "type": "second" }\n}';
      // Should find the last occurrence
      const line = extractLineNumber(json, '/b/type');
      expect(line).toBeGreaterThan(1);
    });
  });

  describe('generateCodeSnippet', () => {
    it('should generate snippet with context lines', () => {
      const json = 'line1\nline2\nline3\nline4\nline5';
      const snippet = generateCodeSnippet(json, 3, 1);
      expect(snippet).toContain('line2');
      expect(snippet).toContain('> 3 | line3');
      expect(snippet).toContain('line4');
    });

    it('should handle first line errors', () => {
      const json = 'line1\nline2';
      const snippet = generateCodeSnippet(json, 1, 2);
      expect(snippet).toContain('> 1 | line1');
      expect(snippet).toContain('line2');
    });

    it('should handle last line errors', () => {
      const json = 'line1\nline2';
      const snippet = generateCodeSnippet(json, 2, 2);
      expect(snippet).toContain('line1');
      expect(snippet).toContain('> 2 | line2');
    });

    it('should use default context of 2 lines', () => {
      const json = 'line1\nline2\nline3\nline4\nline5';
      const snippet = generateCodeSnippet(json, 3);
      expect(snippet).toContain('line1');
      expect(snippet).toContain('line5');
    });

    it('should align line numbers correctly', () => {
      // Create a file with 12 lines so we get padding
      const lines = [];
      for (let i = 1; i <= 12; i++) {
        lines.push(`line${i}`);
      }
      const json = lines.join('\n');
      const snippet = generateCodeSnippet(json, 10, 2);
      // Line numbers should be padded to same width
      expect(snippet).toContain(' 8 |');
      expect(snippet).toContain(' 9 |');
      expect(snippet).toContain('10 |');
      expect(snippet).toContain('11 |');
      expect(snippet).toContain('12 |');
    });

    it('should handle single line content', () => {
      const json = 'single line';
      const snippet = generateCodeSnippet(json, 1, 2);
      expect(snippet).toContain('> 1 | single line');
    });
  });

  describe('createValidationErrorContext', () => {
    it('should create complete context object', () => {
      const ctx = createValidationErrorContext({
        filePath: '/path/to/file.json',
        fileContent: '{\n  "type": "INVALID"\n}',
        instancePath: '/type',
        message: 'Invalid type',
        ruleId: 'test_rule',
      });

      expect(ctx.filePath).toBe('/path/to/file.json');
      expect(ctx.lineNumber).toBe(2);
      expect(ctx.message).toBe('Invalid type');
      expect(ctx.ruleId).toBe('test_rule');
      expect(ctx.instancePath).toBe('/type');
      expect(ctx.codeSnippet).toBeDefined();
    });

    it('should format toString correctly with ruleId', () => {
      const ctx = createValidationErrorContext({
        filePath: '/path/to/file.json',
        fileContent: '{\n  "type": "INVALID"\n}',
        instancePath: '/type',
        message: 'Invalid type',
        ruleId: 'test_rule',
      });

      const str = ctx.toString();
      expect(str).toContain('Validation Error in rule "test_rule"');
      expect(str).toContain('File: /path/to/file.json');
      expect(str).toContain('Line: 2');
      expect(str).toContain('Error: Invalid type');
      expect(str).toContain('Path: /type');
      expect(str).toContain('Context:');
    });

    it('should format toString correctly without ruleId', () => {
      const ctx = createValidationErrorContext({
        filePath: '/path/to/file.json',
        fileContent: '{\n  "type": "INVALID"\n}',
        instancePath: '/type',
        message: 'Invalid type',
      });

      const str = ctx.toString();
      expect(str).toContain('Validation Error');
      expect(str).not.toContain('Validation Error in rule');
    });

    it('should handle empty instancePath', () => {
      const ctx = createValidationErrorContext({
        filePath: '/path/to/file.json',
        fileContent: '{}',
        instancePath: '',
        message: 'Invalid structure',
      });

      expect(ctx.lineNumber).toBe(1);
    });

    it('should include code snippet in context', () => {
      const json = '{\n  "actions": [\n    { "type": "INVALID" }\n  ]\n}';
      const ctx = createValidationErrorContext({
        filePath: '/path/to/file.json',
        fileContent: json,
        instancePath: '/actions/0/type',
        message: 'Unknown operation type',
      });

      expect(ctx.codeSnippet).toContain('"type": "INVALID"');
    });
  });

  describe('formatValidationErrors', () => {
    it('should format single error', () => {
      const errors = [{ instancePath: '/type', message: 'Invalid type' }];
      const result = formatValidationErrors(
        errors,
        '/path/to/file.json',
        '{\n  "type": "INVALID"\n}',
        'test_rule'
      );

      expect(result).toContain('Validation Error in rule "test_rule"');
      expect(result).toContain('File: /path/to/file.json');
      expect(result).toContain('Error: Invalid type');
    });

    it('should format multiple errors with separator', () => {
      const errors = [
        { instancePath: '/type', message: 'Invalid type' },
        { instancePath: '/name', message: 'Missing name' },
      ];
      const result = formatValidationErrors(
        errors,
        '/path/to/file.json',
        '{\n  "type": "INVALID",\n  "name": null\n}'
      );

      expect(result).toContain('---');
      expect(result).toContain('Invalid type');
      expect(result).toContain('Missing name');
    });

    it('should handle errors without instancePath', () => {
      const errors = [{ message: 'Schema validation failed' }];
      const result = formatValidationErrors(
        errors,
        '/path/to/file.json',
        '{}'
      );

      expect(result).toContain('Schema validation failed');
      expect(result).toContain('Path: ');
    });

    it('should handle errors without message', () => {
      const errors = [{ instancePath: '/field' }];
      const result = formatValidationErrors(
        errors,
        '/path/to/file.json',
        '{\n  "field": null\n}'
      );

      expect(result).toContain('Unknown validation error');
    });

    it('should work without ruleId', () => {
      const errors = [{ instancePath: '/type', message: 'Invalid' }];
      const result = formatValidationErrors(
        errors,
        '/path/to/file.json',
        '{\n  "type": "X"\n}'
      );

      expect(result).toContain('Validation Error');
      expect(result).not.toContain('Validation Error in rule');
    });
  });

  describe('edge cases', () => {
    it('should handle complex JSON with deeply nested paths', () => {
      const json = `{
  "rules": [
    {
      "conditions": [
        {
          "type": "AND",
          "operands": [
            { "check": "value" }
          ]
        }
      ]
    }
  ]
}`;
      const ctx = createValidationErrorContext({
        filePath: '/test.json',
        fileContent: json,
        instancePath: '/rules/0/conditions/0/operands/0/check',
        message: 'Invalid check',
      });

      expect(ctx.lineNumber).toBeGreaterThan(1);
      expect(ctx.toString()).toContain('Invalid check');
    });

    it('should handle JSON with special characters in property names', () => {
      const json = '{\n  "special-name": "value"\n}';
      const ctx = createValidationErrorContext({
        filePath: '/test.json',
        fileContent: json,
        instancePath: '/special-name',
        message: 'Invalid value',
      });

      expect(ctx.lineNumber).toBe(2);
    });

    it('should gracefully degrade for malformed paths', () => {
      const json = '{\n  "field": "value"\n}';
      const ctx = createValidationErrorContext({
        filePath: '/test.json',
        fileContent: json,
        instancePath: '/nonexistent/path/here',
        message: 'Not found',
      });

      // Should not throw, should return a reasonable line number
      expect(ctx.lineNumber).toBeGreaterThanOrEqual(1);
      expect(ctx.toString()).toBeDefined();
    });
  });
});
