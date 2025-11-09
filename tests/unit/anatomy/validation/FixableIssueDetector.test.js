/**
 * @file Unit tests for FixableIssueDetector
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { FixableIssueDetector } from '../../../../src/anatomy/validation/FixableIssueDetector.js';
import { ValidationReport } from '../../../../src/anatomy/validation/ValidationReport.js';

describe('FixableIssueDetector', () => {
  let mockReportData;
  let report;

  beforeEach(() => {
    mockReportData = {
      recipeId: 'test:recipe',
      recipePath: 'data/mods/test/recipes/test.recipe.json',
      timestamp: '2025-01-01T00:00:00.000Z',
      errors: [],
      warnings: [],
      suggestions: [],
      passed: [],
    };
  });

  describe('analyze', () => {
    it('should return empty array for clean report', () => {
      report = new ValidationReport(mockReportData);
      const fixable = FixableIssueDetector.analyze(report);
      expect(fixable).toEqual([]);
    });

    it('should detect missing component errors', () => {
      mockReportData.errors = [
        {
          type: 'COMPONENT_NOT_FOUND',
          message: 'Component not found',
          componentId: 'test:missing',
          suggestion: 'Add component',
        },
      ];
      report = new ValidationReport(mockReportData);
      const fixable = FixableIssueDetector.analyze(report);

      expect(fixable).toHaveLength(1);
      expect(fixable[0].type).toBe('missing_component');
      expect(fixable[0].fixable).toBe(false);
      expect(fixable[0].action).toBe('manual');
    });

    it('should detect missing blueprint errors', () => {
      mockReportData.errors = [
        {
          type: 'BLUEPRINT_NOT_FOUND',
          message: 'Blueprint not found',
          blueprintId: 'test:missing_blueprint',
          fix: 'Create blueprint at data/mods/test/blueprints/missing_blueprint.blueprint.json',
        },
      ];
      report = new ValidationReport(mockReportData);
      const fixable = FixableIssueDetector.analyze(report);

      expect(fixable).toHaveLength(1);
      expect(fixable[0].type).toBe('missing_blueprint');
      expect(fixable[0].fixable).toBe(false);
      expect(fixable[0].action).toBe('manual');
      expect(fixable[0].command).toContain('data/mods/test/blueprints');
    });

    it('should detect socket reference errors', () => {
      mockReportData.errors = [
        {
          type: 'SOCKET_NOT_FOUND',
          message: 'Socket not found',
          socketKey: 'invalid_socket',
          suggestion: 'Use valid socket key',
        },
      ];
      report = new ValidationReport(mockReportData);
      const fixable = FixableIssueDetector.analyze(report);

      expect(fixable).toHaveLength(1);
      expect(fixable[0].type).toBe('invalid_socket_reference');
      expect(fixable[0].fixable).toBe(true);
      expect(fixable[0].action).toBe('replace');
    });

    it('should detect schema validation errors', () => {
      mockReportData.errors = [
        {
          type: 'SCHEMA_VALIDATION_ERROR',
          message: 'Property type mismatch',
        },
      ];
      report = new ValidationReport(mockReportData);
      const fixable = FixableIssueDetector.analyze(report);

      expect(fixable).toHaveLength(1);
      expect(fixable[0].type).toBe('schema_violation');
      expect(fixable[0].fixable).toBe(false);
    });

    it('should detect pattern matching warnings', () => {
      mockReportData.warnings = [
        {
          type: 'PATTERN_NO_MATCH',
          message: 'Pattern has no matching slots',
          suggestion: 'Adjust pattern',
        },
      ];
      report = new ValidationReport(mockReportData);
      const fixable = FixableIssueDetector.analyze(report);

      expect(fixable).toHaveLength(1);
      expect(fixable[0].type).toBe('pattern_no_match');
      expect(fixable[0].severity).toBe('warning');
      expect(fixable[0].action).toBe('manual');
    });

    it('should detect missing tag warnings', () => {
      mockReportData.warnings = [
        {
          type: 'MISSING_SLOT_TAG',
          message: 'Missing required tag',
          location: { type: 'slot', name: 'test_slot' },
          suggestion: 'Add tag',
          suggestedTag: 'test:tag',
        },
      ];
      report = new ValidationReport(mockReportData);
      const fixable = FixableIssueDetector.analyze(report);

      expect(fixable).toHaveLength(1);
      expect(fixable[0].type).toBe('missing_tag');
      expect(fixable[0].fixable).toBe(true);
      expect(fixable[0].action).toBe('add');
      expect(fixable[0].tagToAdd).toBe('test:tag');
    });

    it('should handle multiple issues', () => {
      mockReportData.errors = [
        {
          type: 'COMPONENT_NOT_FOUND',
          message: 'Component not found',
        },
        {
          type: 'BLUEPRINT_NOT_FOUND',
          message: 'Blueprint not found',
          blueprintId: 'test:missing',
        },
      ];
      mockReportData.warnings = [
        {
          type: 'PATTERN_NO_MATCH',
          message: 'Pattern has no matching slots',
        },
      ];
      report = new ValidationReport(mockReportData);
      const fixable = FixableIssueDetector.analyze(report);

      expect(fixable).toHaveLength(3);
    });

    it('should return null for unrecognized error types', () => {
      mockReportData.errors = [
        {
          type: 'UNKNOWN_ERROR_TYPE',
          message: 'Unknown error',
        },
      ];
      report = new ValidationReport(mockReportData);
      const fixable = FixableIssueDetector.analyze(report);

      expect(fixable).toEqual([]);
    });
  });

  describe('generateBatchSuggestions', () => {
    it('should categorize fixable issues', () => {
      const fixableIssues = [
        {
          fixable: true,
          action: 'replace',
          type: 'socket_fix',
        },
        {
          fixable: false,
          action: 'manual',
          type: 'blueprint_create',
        },
        {
          fixable: true,
          action: 'add',
          type: 'tag_add',
        },
      ];

      const batched = FixableIssueDetector.generateBatchSuggestions(fixableIssues);

      expect(batched.summary.total).toBe(3);
      expect(batched.summary.automatic).toBe(0);
      expect(batched.summary.semiAutomatic).toBe(2);
      expect(batched.summary.manual).toBe(1);
    });

    it('should handle empty fixable issues', () => {
      const batched = FixableIssueDetector.generateBatchSuggestions([]);

      expect(batched.summary.total).toBe(0);
      expect(batched.automatic).toEqual([]);
      expect(batched.semiAutomatic).toEqual([]);
      expect(batched.manual).toEqual([]);
    });
  });

  describe('generateFixScript', () => {
    it('should generate commands for issues with command field', () => {
      const fixableIssues = [
        {
          type: 'missing_blueprint',
          command: 'data/mods/test/blueprints/test.blueprint.json',
          original: { message: 'Blueprint not found' },
        },
      ];

      const script = FixableIssueDetector.generateFixScript(fixableIssues);

      expect(script.length).toBeGreaterThan(0);
      expect(script.join('\n')).toContain('missing_blueprint');
      expect(script.join('\n')).toContain('data/mods/test/blueprints');
    });

    it('should generate commands for replace actions', () => {
      const fixableIssues = [
        {
          type: 'socket_fix',
          fixable: true,
          action: 'replace',
          oldValue: 'wrong_socket',
          suggestedValue: 'correct_socket',
          original: {
            message: 'Socket not found',
            location: { type: 'slot', name: 'test_slot' },
          },
        },
      ];

      const script = FixableIssueDetector.generateFixScript(fixableIssues);

      expect(script.length).toBeGreaterThan(0);
      expect(script.join('\n')).toContain('socket_fix');
      expect(script.join('\n')).toContain('wrong_socket');
      expect(script.join('\n')).toContain('correct_socket');
    });

    it('should handle empty fixable issues', () => {
      const script = FixableIssueDetector.generateFixScript([]);
      expect(script).toEqual([]);
    });
  });
});
