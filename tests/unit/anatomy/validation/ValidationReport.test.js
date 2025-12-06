/**
 * @file Unit tests for ValidationReport
 */

import { describe, it, expect } from '@jest/globals';
import { ValidationReport } from '../../../../src/anatomy/validation/ValidationReport.js';
import { ReportFormatter } from '../../../../src/anatomy/validation/ReportFormatter.js';

describe('ValidationReport', () => {
  describe('Constructor', () => {
    it('should create instance with valid results', () => {
      const results = {
        recipeId: 'test:recipe',
        recipePath: 'data/mods/test/recipes/recipe.json',
        timestamp: new Date().toISOString(),
        errors: [],
        warnings: [],
        suggestions: [],
        passed: [],
      };

      const report = new ValidationReport(results);

      expect(report).toBeDefined();
    });
  });

  describe('isValid', () => {
    it('should return true when no errors', () => {
      const results = {
        recipeId: 'test:recipe',
        recipePath: 'data/mods/test/recipes/recipe.json',
        timestamp: new Date().toISOString(),
        errors: [],
        warnings: [],
        suggestions: [],
        passed: [],
      };

      const report = new ValidationReport(results);

      expect(report.isValid).toBe(true);
    });

    it('should return false when errors exist', () => {
      const results = {
        recipeId: 'test:recipe',
        recipePath: 'data/mods/test/recipes/recipe.json',
        timestamp: new Date().toISOString(),
        errors: [{ message: 'Test error' }],
        warnings: [],
        suggestions: [],
        passed: [],
      };

      const report = new ValidationReport(results);

      expect(report.isValid).toBe(false);
    });
  });

  describe('hasWarnings', () => {
    it('should return true when warnings exist', () => {
      const results = {
        recipeId: 'test:recipe',
        recipePath: 'data/mods/test/recipes/recipe.json',
        timestamp: new Date().toISOString(),
        errors: [],
        warnings: [{ message: 'Test warning' }],
        suggestions: [],
        passed: [],
      };

      const report = new ValidationReport(results);

      expect(report.hasWarnings).toBe(true);
    });

    it('should return false when no warnings', () => {
      const results = {
        recipeId: 'test:recipe',
        recipePath: 'data/mods/test/recipes/recipe.json',
        timestamp: new Date().toISOString(),
        errors: [],
        warnings: [],
        suggestions: [],
        passed: [],
      };

      const report = new ValidationReport(results);

      expect(report.hasWarnings).toBe(false);
    });
  });

  describe('hasSuggestions', () => {
    it('should return true when suggestions exist', () => {
      const results = {
        recipeId: 'test:recipe',
        recipePath: 'data/mods/test/recipes/recipe.json',
        timestamp: new Date().toISOString(),
        errors: [],
        warnings: [],
        suggestions: [{ message: 'Test suggestion' }],
        passed: [],
      };

      const report = new ValidationReport(results);

      expect(report.hasSuggestions).toBe(true);
    });

    it('should return false when no suggestions', () => {
      const results = {
        recipeId: 'test:recipe',
        recipePath: 'data/mods/test/recipes/recipe.json',
        timestamp: new Date().toISOString(),
        errors: [],
        warnings: [],
        suggestions: [],
        passed: [],
      };

      const report = new ValidationReport(results);

      expect(report.hasSuggestions).toBe(false);
    });
  });

  describe('errors', () => {
    it('should return array of errors', () => {
      const errors = [{ message: 'Error 1' }, { message: 'Error 2' }];

      const results = {
        recipeId: 'test:recipe',
        recipePath: 'data/mods/test/recipes/recipe.json',
        timestamp: new Date().toISOString(),
        errors,
        warnings: [],
        suggestions: [],
        passed: [],
      };

      const report = new ValidationReport(results);

      expect(report.errors).toEqual(errors);
    });

    it('should return copy of errors array', () => {
      const errors = [{ message: 'Error 1' }];

      const results = {
        recipeId: 'test:recipe',
        recipePath: 'data/mods/test/recipes/recipe.json',
        timestamp: new Date().toISOString(),
        errors,
        warnings: [],
        suggestions: [],
        passed: [],
      };

      const report = new ValidationReport(results);
      const reportErrors = report.errors;
      reportErrors.push({ message: 'Error 2' });

      expect(report.errors.length).toBe(1);
    });
  });

  describe('warnings', () => {
    it('should return array of warnings', () => {
      const warnings = [{ message: 'Warning 1' }, { message: 'Warning 2' }];

      const results = {
        recipeId: 'test:recipe',
        recipePath: 'data/mods/test/recipes/recipe.json',
        timestamp: new Date().toISOString(),
        errors: [],
        warnings,
        suggestions: [],
        passed: [],
      };

      const report = new ValidationReport(results);

      expect(report.warnings).toEqual(warnings);
    });

    it('should return copy of warnings array', () => {
      const warnings = [{ message: 'Warning 1' }];

      const results = {
        recipeId: 'test:recipe',
        recipePath: 'data/mods/test/recipes/recipe.json',
        timestamp: new Date().toISOString(),
        errors: [],
        warnings,
        suggestions: [],
        passed: [],
      };

      const report = new ValidationReport(results);
      const reportWarnings = report.warnings;
      reportWarnings.push({ message: 'Warning 2' });

      expect(report.warnings.length).toBe(1);
    });
  });

  describe('suggestions', () => {
    it('should return array of suggestions', () => {
      const suggestions = [
        { message: 'Suggestion 1' },
        { message: 'Suggestion 2' },
      ];

      const results = {
        recipeId: 'test:recipe',
        recipePath: 'data/mods/test/recipes/recipe.json',
        timestamp: new Date().toISOString(),
        errors: [],
        warnings: [],
        suggestions,
        passed: [],
      };

      const report = new ValidationReport(results);

      expect(report.suggestions).toEqual(suggestions);
    });

    it('should return copy of suggestions array', () => {
      const suggestions = [{ message: 'Suggestion 1' }];

      const results = {
        recipeId: 'test:recipe',
        recipePath: 'data/mods/test/recipes/recipe.json',
        timestamp: new Date().toISOString(),
        errors: [],
        warnings: [],
        suggestions,
        passed: [],
      };

      const report = new ValidationReport(results);
      const reportSuggestions = report.suggestions;
      reportSuggestions.push({ message: 'Suggestion 2' });

      expect(report.suggestions.length).toBe(1);
    });
  });

  describe('passed', () => {
    it('should return copy of passed checks array', () => {
      const passed = [
        { message: 'Check 1 passed' },
        { message: 'Check 2 passed' },
      ];

      const results = {
        recipeId: 'test:recipe',
        recipePath: 'data/mods/test/recipes/recipe.json',
        timestamp: new Date().toISOString(),
        errors: [],
        warnings: [],
        suggestions: [],
        passed,
      };

      const report = new ValidationReport(results);
      const reportPassed = report.passed;

      expect(reportPassed).toEqual(passed);

      reportPassed.push({ message: 'Check 3 passed' });
      expect(report.passed).toHaveLength(2);
    });
  });

  describe('summary', () => {
    it('should return summary with correct statistics', () => {
      const results = {
        recipeId: 'test:recipe',
        recipePath: 'data/mods/test/recipes/recipe.json',
        timestamp: '2025-01-01T00:00:00.000Z',
        errors: [{ message: 'Error 1' }, { message: 'Error 2' }],
        warnings: [{ message: 'Warning 1' }],
        suggestions: [{ message: 'Suggestion 1' }],
        passed: [{ check: 'check1' }, { check: 'check2' }],
      };

      const report = new ValidationReport(results);
      const summary = report.summary;

      expect(summary.recipeId).toBe('test:recipe');
      expect(summary.recipePath).toBe('data/mods/test/recipes/recipe.json');
      expect(summary.timestamp).toBe('2025-01-01T00:00:00.000Z');
      expect(summary.totalErrors).toBe(2);
      expect(summary.totalWarnings).toBe(1);
      expect(summary.totalSuggestions).toBe(1);
      expect(summary.passedChecks).toBe(2);
      expect(summary.isValid).toBe(false);
    });

    it('should show isValid as true when no errors', () => {
      const results = {
        recipeId: 'test:recipe',
        recipePath: 'data/mods/test/recipes/recipe.json',
        timestamp: '2025-01-01T00:00:00.000Z',
        errors: [],
        warnings: [],
        suggestions: [],
        passed: [],
      };

      const report = new ValidationReport(results);
      const summary = report.summary;

      expect(summary.isValid).toBe(true);
    });
  });

  describe('metadata accessors', () => {
    it('should expose recipe metadata through getters', () => {
      const timestamp = '2026-02-01T12:34:56.789Z';
      const results = {
        recipeId: 'meta:recipe',
        recipePath: 'data/mods/meta/recipes/recipe.json',
        timestamp,
        errors: [],
        warnings: [],
        suggestions: [],
        passed: [],
      };

      const report = new ValidationReport(results);

      expect(report.recipeId).toBe('meta:recipe');
      expect(report.recipePath).toBe('data/mods/meta/recipes/recipe.json');
      expect(report.timestamp).toBe(timestamp);
    });
  });

  describe('toString', () => {
    it('should format report with passed checks', () => {
      const results = {
        recipeId: 'test:recipe',
        recipePath: 'data/mods/test/recipes/recipe.json',
        timestamp: '2025-01-01T00:00:00.000Z',
        errors: [],
        warnings: [],
        suggestions: [],
        passed: [
          { check: 'check1', message: 'Check 1 passed' },
          { check: 'check2', message: 'Check 2 passed' },
        ],
      };

      const report = new ValidationReport(results);
      const output = report.toString();

      expect(output).toContain('Validation Report: test:recipe');
      expect(output).toContain('Path: data/mods/test/recipes/recipe.json');
      expect(output).toContain('✓ Passed Checks:');
      expect(output).toContain('✓ Check 1 passed');
      expect(output).toContain('✓ Check 2 passed');
      expect(output).toContain('✅ Validation PASSED');
    });

    it('should omit recipe path when not provided', () => {
      const results = {
        recipeId: 'test:recipe',
        timestamp: '2025-01-01T00:00:00.000Z',
        errors: [],
        warnings: [],
        suggestions: [],
        passed: [],
      };

      const report = new ValidationReport(results);
      const output = report.toString();

      expect(output).toContain('Validation Report: test:recipe');
      expect(output).not.toContain('Path:');
    });

    it('should format report with errors', () => {
      const results = {
        recipeId: 'test:recipe',
        recipePath: 'data/mods/test/recipes/recipe.json',
        timestamp: '2025-01-01T00:00:00.000Z',
        errors: [
          {
            message: 'Error 1',
            location: { type: 'slot', name: 'slot1' },
            componentId: 'test:component',
            fix: 'Fix suggestion',
          },
        ],
        warnings: [],
        suggestions: [],
        passed: [],
      };

      const report = new ValidationReport(results);
      const output = report.toString();

      expect(output).toContain('✗ Errors:');
      expect(output).toContain('[ERROR] Error 1');
      expect(output).toContain("Location: slot 'slot1'");
      expect(output).toContain('Component: test:component');
      expect(output).toContain('Fix: Fix suggestion');
      expect(output).toContain('❌ Validation FAILED with 1 error(s)');
    });

    it('should format errors without location gracefully', () => {
      const results = {
        recipeId: 'test:recipe',
        timestamp: '2025-01-01T00:00:00.000Z',
        errors: [
          {
            message: 'Error without location',
          },
        ],
        warnings: [],
        suggestions: [],
        passed: [],
      };

      const report = new ValidationReport(results);
      const output = report.toString();

      expect(output).toContain('[ERROR] Error without location');
      expect(output).not.toContain('Location:');
    });

    it('should handle error locations without file or name', () => {
      const results = {
        recipeId: 'test:recipe',
        timestamp: '2025-01-01T00:00:00.000Z',
        errors: [
          {
            message: 'Error with incomplete location',
            location: { type: 'slot' },
          },
        ],
        warnings: [],
        suggestions: [],
        passed: [],
      };

      const report = new ValidationReport(results);
      const output = report.toString();

      expect(output).toContain('[ERROR] Error with incomplete location');
      expect(output).not.toContain('Location:');
    });

    it('should include file-based error locations', () => {
      const results = {
        recipeId: 'test:recipe',
        recipePath: 'data/mods/test/recipes/recipe.json',
        timestamp: '2025-01-01T00:00:00.000Z',
        errors: [
          {
            message: 'File error',
            location: { type: 'file', file: 'data/mods/test/file.json' },
          },
        ],
        warnings: [],
        suggestions: [],
        passed: [],
      };

      const report = new ValidationReport(results);
      const output = report.toString();

      expect(output).toContain("Location: file 'data/mods/test/file.json'");
    });

    it('should format report with warnings', () => {
      const results = {
        recipeId: 'test:recipe',
        recipePath: 'data/mods/test/recipes/recipe.json',
        timestamp: '2025-01-01T00:00:00.000Z',
        errors: [],
        warnings: [
          {
            message: 'Warning 1',
            location: { type: 'pattern', name: 'pattern1' },
            suggestion: 'Suggestion for warning',
          },
        ],
        suggestions: [],
        passed: [],
      };

      const report = new ValidationReport(results);
      const output = report.toString();

      expect(output).toContain('⚠ Warnings:');
      expect(output).toContain('[WARNING] Warning 1');
      expect(output).toContain("Location: pattern 'pattern1'");
      expect(output).toContain('Suggestion: Suggestion for warning');
    });

    it('should format warnings without optional fields', () => {
      const results = {
        recipeId: 'test:recipe',
        recipePath: 'data/mods/test/recipes/recipe.json',
        timestamp: '2025-01-01T00:00:00.000Z',
        errors: [],
        warnings: [
          {
            message: 'Warning 1',
          },
        ],
        suggestions: [],
        passed: [],
      };

      const report = new ValidationReport(results);
      const output = report.toString();

      expect(output).toContain('[WARNING] Warning 1');
      expect(output).not.toContain('Location:');
      expect(output).not.toContain('Suggestion:');
    });

    it('should format report with suggestions', () => {
      const results = {
        recipeId: 'test:recipe',
        recipePath: 'data/mods/test/recipes/recipe.json',
        timestamp: '2025-01-01T00:00:00.000Z',
        errors: [],
        warnings: [],
        suggestions: [
          {
            message: 'Suggestion 1',
            location: { type: 'slot', name: 'slot1' },
            suggestion: 'Add descriptor components',
            reason: 'No descriptors found',
            impact: 'Part will be excluded',
          },
        ],
        passed: [],
      };

      const report = new ValidationReport(results);
      const output = report.toString();

      expect(output).toContain('💡 Suggestions:');
      expect(output).toContain('[SUGGESTION] Suggestion 1');
      expect(output).toContain("Location: slot 'slot1'");
      expect(output).toContain('Suggestion: Add descriptor components');
      expect(output).toContain('Reason: No descriptors found');
      expect(output).toContain('Impact: Part will be excluded');
    });

    it('should format suggestions without optional fields', () => {
      const results = {
        recipeId: 'test:recipe',
        recipePath: 'data/mods/test/recipes/recipe.json',
        timestamp: '2025-01-01T00:00:00.000Z',
        errors: [],
        warnings: [],
        suggestions: [
          {
            message: 'Suggestion 1',
          },
        ],
        passed: [],
      };

      const report = new ValidationReport(results);
      const output = report.toString();

      expect(output).toContain('[SUGGESTION] Suggestion 1');
      expect(output).not.toContain('Location:');
      expect(output).not.toContain('Suggestion: ');
      expect(output).not.toContain('Reason: ');
      expect(output).not.toContain('Impact: ');
    });

    it('should handle errors with context location', () => {
      const results = {
        recipeId: 'test:recipe',
        recipePath: 'data/mods/test/recipes/recipe.json',
        timestamp: '2025-01-01T00:00:00.000Z',
        errors: [
          {
            message: 'Error 1',
            context: {
              location: { type: 'slot', name: 'slot1' },
            },
            suggestion: 'Fix it',
          },
        ],
        warnings: [],
        suggestions: [],
        passed: [],
      };

      const report = new ValidationReport(results);
      const output = report.toString();

      expect(output).toContain('[ERROR] Error 1');
      expect(output).toContain("Location: slot 'slot1'");
      expect(output).toContain('Suggestion: Fix it');
    });

    it('should include entity load failure details', () => {
      const results = {
        recipeId: 'test:recipe',
        recipePath: 'data/mods/test/recipes/recipe.json',
        timestamp: '2025-01-01T00:00:00.000Z',
        errors: [
          {
            message: 'Failed to load entity',
            type: 'ENTITY_LOAD_FAILURE',
            details: {
              failedComponents: ['component.a', 'component.b'],
              error: 'Stack trace',
            },
          },
        ],
        warnings: [],
        suggestions: [],
        passed: [],
      };

      const report = new ValidationReport(results);
      const output = report.toString();

      expect(output).toContain('Failed Components: component.a, component.b');
      expect(output).toContain('Error Details: Stack trace');
    });

    it('should handle entity load failures without detail fields', () => {
      const results = {
        recipeId: 'test:recipe',
        recipePath: 'data/mods/test/recipes/recipe.json',
        timestamp: '2025-01-01T00:00:00.000Z',
        errors: [
          {
            message: 'Failed to load entity',
            type: 'ENTITY_LOAD_FAILURE',
            details: {},
          },
        ],
        warnings: [],
        suggestions: [],
        passed: [],
      };

      const report = new ValidationReport(results);
      const output = report.toString();

      expect(output).toContain('[ERROR] Failed to load entity');
      expect(output).not.toContain('Failed Components:');
      expect(output).not.toContain('Error Details:');
    });
  });

  describe('toJSON', () => {
    it('should return results object', () => {
      const results = {
        recipeId: 'test:recipe',
        recipePath: 'data/mods/test/recipes/recipe.json',
        timestamp: '2025-01-01T00:00:00.000Z',
        errors: [{ message: 'Error 1' }],
        warnings: [{ message: 'Warning 1' }],
        suggestions: [{ message: 'Suggestion 1' }],
        passed: [{ check: 'check1' }],
      };

      const report = new ValidationReport(results);
      const json = report.toJSON();

      expect(json).toEqual(results);
    });
  });

  describe('formatter', () => {
    it('should create ReportFormatter instance', () => {
      const results = {
        recipeId: 'test:recipe',
        recipePath: 'data/mods/test/recipes/recipe.json',
        timestamp: '2025-01-01T00:00:00.000Z',
        errors: [],
        warnings: [],
        suggestions: [],
        passed: [],
      };

      const report = new ValidationReport(results);
      const formatter = report.formatter();

      expect(formatter).toBeInstanceOf(ReportFormatter);
    });
  });
});
